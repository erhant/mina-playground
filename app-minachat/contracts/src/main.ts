import fs from 'fs';
import { MinaChatContract, OffchainStorageMerkleWitness } from './MinaChatContract.js';
import {
  Mina,
  isReady,
  PrivateKey,
  AccountUpdate,
  shutdown,
  PublicKey,
  fetchAccount,
  Bool,
  Field,
  MerkleTree,
  Poseidon,
  Encryption,
} from 'snarkyjs';
import { OffchainStorageAPI } from './api/storage.js';
import constants from './constants/index.js';
import { encryptSecret, publicKeysToIndex } from './utils/index.js';

async function main() {
  const owner = await setup();

  // prepare zkapp keys
  const zkappPrivateKey = constants.USE_LOCAL ? PrivateKey.random() : owner;
  const zkappPublicKey = zkappPrivateKey.toPublicKey();
  console.log('zkApp Public Key:', zkappPublicKey.toBase58());

  // prepare server key
  const offchainStorage = new OffchainStorageAPI(constants.STORAGE_SERVER_ADDR, zkappPublicKey);
  const serverPublicKey = await offchainStorage.getServerPublicKey();
  console.log('Off-chain Server Public Key:', serverPublicKey.toBase58());

  // prepare contract
  const contract = await prepareContract(owner, zkappPrivateKey, zkappPublicKey, serverPublicKey);

  console.log('init keysss!');
  await initializeKeys(owner, contract, zkappPrivateKey, offchainStorage);

  console.log('gettin the key');
  await getKeys(owner, contract, zkappPrivateKey, offchainStorage);

  await finish();
}

async function initializeKeys(
  owner: PrivateKey,
  contract: MinaChatContract,
  zkappPrivateKey: PrivateKey,
  offchainStorage: OffchainStorageAPI
) {
  // for the sake of example, the sender sends to themselves
  const sender = owner.toPublicKey();
  const recipient = owner.toPublicKey();

  // index is (senderPk + recipientPk).x.toFields()
  const index = publicKeysToIndex(sender, recipient);
  const randomField = Field.random(); // a random field element is private key for AES
  const newValue = encryptSecret(sender, recipient, randomField);

  console.log('Setting:', index.toString(), 'to', newValue.toString());

  // current root
  const root = contract.keysRoot.get();

  // get off-chain stored tree
  const idx2fields = await offchainStorage.getItems(constants.KEY_TREE_HEIGHT, root);

  // generate local tree
  const tree = new MerkleTree(constants.KEY_TREE_HEIGHT);
  for (const [idx, fields] of idx2fields) {
    tree.setLeaf(idx, Poseidon.hash(fields));
  }

  // check current value at index
  const leafIsEmpty = Bool(!idx2fields.has(index));
  const oldValue: Field[] = leafIsEmpty.toBoolean() ? [Field(0)] : idx2fields.get(index)!;

  // make a witness on the current tree
  const witness = tree.getWitness(index);
  const circuitWitness = new OffchainStorageMerkleWitness(witness);

  // update tree & get new root
  tree.setLeaf(index, Poseidon.hash(newValue));
  const newRoot = tree.getRoot(); // what to do with this guy?
  idx2fields.set(index, newValue);

  // store off-chain
  const [newRootNumber, newRootSignature] = await offchainStorage.setItems(constants.KEY_TREE_HEIGHT, idx2fields);

  // fetch account if not local
  if (!constants.USE_LOCAL) {
    await fetchAccount({ publicKey: owner.toPublicKey() });
  }

  // create transaction
  console.log('Creating tx...');
  let tx;
  try {
    tx = await Mina.transaction({ feePayerKey: owner, fee: constants.TX_FEE }, () => {
      contract.update(
        leafIsEmpty,
        Poseidon.hash(oldValue),
        Poseidon.hash(newValue),
        circuitWitness,
        newRootNumber,
        newRootSignature
      );
      contract.sign(zkappPrivateKey);
      // contract.requireSignature();
    });
  } catch (err) {
    console.log('ERROR!', err);
    return;
  }

  console.log('Created tx.');

  // create a proof for transaction
  // NOTE: maybe sign before the proof?
  if (!constants.USE_LOCAL) {
    const LABEL = 'Creating an execution proof...';
    console.time(LABEL);
    await tx.prove();
    console.timeEnd(LABEL);
  }

  // send transaction
  console.log('Sending the transaction...');
  await tx.send();
  // console.log('Hash:', res.hash());
}

async function getKeys(
  owner: PrivateKey,
  contract: MinaChatContract,
  zkappPrivateKey: PrivateKey,
  offchainStorage: OffchainStorageAPI
) {
  // for the sake of example, the sender sends to themselves
  const sender = owner.toPublicKey();
  const recipient = owner.toPublicKey();

  const root = contract.keysRoot.get();
  const idx2fields = await offchainStorage.getItems(constants.KEY_TREE_HEIGHT, root);
  const indexKey = PublicKey.fromGroup(sender.toGroup().add(recipient.toGroup()));
  const index = indexKey.x.toBigInt();

  console.log('GOT INDEX:', idx2fields.get(index)?.toString());
}

// Sets up Mina local blockchain / Berkeley network, returns the fee payer.
async function setup(): Promise<PrivateKey> {
  const LABEL = 'Loading SnarkyJS:';
  console.time(LABEL);
  await isReady;
  console.timeEnd(LABEL);

  if (constants.USE_LOCAL) {
    // use local blockchain
    const localBC = Mina.LocalBlockchain();
    Mina.setActiveInstance(localBC);

    // get default account
    return localBC.testAccounts[0].privateKey;
  } else {
    // connect to Berkeley
    const Berkeley = Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql');
    Mina.setActiveInstance(Berkeley);

    // read deployer from file
    // TODO: read env?
    const deployAlias = process.argv[2];
    const deployerKeysFileContents = fs.readFileSync('keys/' + deployAlias + '.json', 'utf8');
    const deployerPrivateKeyBase58 = JSON.parse(deployerKeysFileContents).privateKey as string;
    return PrivateKey.fromBase58(deployerPrivateKeyBase58);
  }
}

async function prepareContract(
  owner: PrivateKey,
  zkappPrivateKey: PrivateKey,
  zkappPublicKey: PublicKey,
  serverPublicKey: PublicKey
): Promise<MinaChatContract> {
  // compile the contract if not local
  if (!constants.USE_LOCAL) {
    console.log('Compiling smart contract...');
    await MinaChatContract.compile();
  }

  // instantiate
  const contract = new MinaChatContract(zkappPublicKey);

  if (constants.USE_LOCAL) {
    // deploy to local network
    const tx = await Mina.transaction(owner, () => {
      AccountUpdate.fundNewAccount(owner);
      contract.deploy({ zkappKey: zkappPrivateKey });
      contract.initState(serverPublicKey);
      contract.requireSignature();
    });
    await tx.sign([zkappPrivateKey]).send();
  } else {
    // retrieve the on-chain contract
    while (true) {
      let response = await fetchAccount({ publicKey: zkappPublicKey });
      if (response.error == null && response.account!.appState != null) {
        // TODO add optional check that verification key is correct once this is available in SnarkyJS
        // return response.account!;
        break;
      }
      console.log('waiting for zkApp account to be deployed...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  console.log('Contract loaded.');
  return contract;
}

// Terminates Snarkyjs.
async function finish() {
  const LABEL = 'Shutting down SnarkyJS...';
  console.time(LABEL);
  await shutdown();
  console.timeEnd(LABEL);
}

main().then(() => console.log('Done'));
