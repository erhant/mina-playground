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
} from 'snarkyjs';
import { OffchainStorageAPI } from './api/storage.js';

const KEY_TREE_HEIGHT = 32;

const STORAGE_SERVER_ADDR = 'http://localhost:3001';
const USE_LOCAL = true;
const TX_FEE = 0.1;

async function main() {
  console.log('preeee');
  const owner = await setup();
  console.log('posttt');

  // prepare keys
  const zkappPrivateKey = USE_LOCAL ? PrivateKey.random() : owner;
  const zkappPublicKey = zkappPrivateKey.toPublicKey();

  // prepare server key
  const offchainStorage = new OffchainStorageAPI(STORAGE_SERVER_ADDR, zkappPublicKey);
  const serverPublicKey = await offchainStorage.getServerPublicKey();
  console.log('Off-chain Server Public Key:', serverPublicKey.toBase58());

  // prepare contract
  const contract = await prepareContract(owner, zkappPrivateKey, zkappPublicKey, serverPublicKey);

  // console.log('init keysss!');
  // await initializeKeys(owner, contract, zkappPrivateKey, offchainStorage);

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
  const indexKey = PublicKey.fromGroup(sender.toGroup().add(recipient.toGroup()));
  const index = indexKey.x.toBigInt();
  const newValue = PrivateKey.random().toFields();

  // current root
  const root = contract.keysRoot.get();

  // get off-chain stored tree
  const idx2fields = await offchainStorage.getItems(KEY_TREE_HEIGHT, root);

  // generate local tree
  const tree = new MerkleTree(KEY_TREE_HEIGHT);
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
  const newRoot = tree.getRoot();
  idx2fields.set(index, newValue);

  // store off-chain
  const [newRootNumber, newRootSignature] = await offchainStorage.setItems(KEY_TREE_HEIGHT, idx2fields);

  // fetch account if not local
  // if (!USE_LOCAL) {
  //   await fetchAccount({ publicKey: deployerAccount.toPublicKey() });
  // }

  // create transaction
  const tx = await Mina.transaction({ feePayerKey: owner, fee: TX_FEE }, () => {
    contract.update(leafIsEmpty, oldValue, newValue, circuitWitness, newRootNumber, newRootSignature);
    // contract.sign(zkappPrivateKey);
    contract.requireSignature();
  });

  // create a proof for transaction
  // NOTE: maybe sign before the proof?
  // if (!USE_LOCAL) {
  //   const LABEL = 'Creating an execution proof...';
  //   console.time(LABEL);
  //   await tx.prove();
  //   console.timeEnd(LABEL);
  // }

  // send transaction
  console.log('Sending the transaction...');
  const res = await tx.sign([zkappPrivateKey]).send();
  console.log('Hash:', res.hash());
}

// Sets up Mina local blockchain / Berkeley network, returns the fee payer.
async function setup(): Promise<PrivateKey> {
  const LABEL = 'Loading SnarkyJS...';
  console.time(LABEL);
  await isReady;
  console.timeEnd(LABEL);

  if (USE_LOCAL) {
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
  if (!USE_LOCAL) {
    console.log('Compiling smart contract...');
    await MinaChatContract.compile();
  }

  // instantiate
  const contract = new MinaChatContract(zkappPublicKey);

  if (USE_LOCAL) {
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
