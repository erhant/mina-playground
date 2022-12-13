import fs from 'fs';
import { MinaKeyShareContract, OffchainStorageMerkleWitness } from './MinaKeyShareContract.js';
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
import constants from './constants/index.js';
import { decryptSecret, encryptSecret, equalFields, publicKeysToIndex } from './utils/index.js';

async function main(owner: PrivateKey) {
  // prepare zkapp keys
  const zkappPrivateKey = PrivateKey.fromBase58('EKEdrzLT5eRp5x8a1aGDQJy5aYM1g4sHuPPvTJpTTsCrycNi9gHj'); // constants.USE_LOCAL ? PrivateKey.random() : owner;
  const zkappPublicKey = zkappPrivateKey.toPublicKey();
  console.log('zkApp Private Key:', zkappPrivateKey.toBase58());
  console.log('zkApp Public Key:', zkappPublicKey.toBase58());

  // prepare server key
  const offchainStorage = new OffchainStorageAPI(constants.STORAGE_SERVER_ADDR, zkappPublicKey);
  if (!(await offchainStorage.pingServer())) {
    console.error('Server could not be pinged!');
    return;
  }
  const serverPublicKey = await offchainStorage.getServerPublicKey();
  console.log('Off-chain Server Public Key:', serverPublicKey.toBase58());

  // prepare contract
  const contract = await prepareContract(owner, zkappPrivateKey, zkappPublicKey, serverPublicKey);

  // sender & receiver
  const senderSk: PrivateKey = owner; // you are the sender
  const recipientPk: PublicKey = PrivateKey.random().toPublicKey(); // random recipient

  // initialize keys
  console.log('\nInitializing keys.');
  const kInit = await initializeKey(senderSk, recipientPk, contract, zkappPrivateKey, offchainStorage);

  // get the keys
  console.log('\nGetting the key.');
  const kGet = await getKey(senderSk, recipientPk, contract, offchainStorage);

  console.log('Keys are matching:', equalFields(kGet, kInit));

  // try {
  //   console.log('\nTrying to initialize keys again.');
  //   await initializeKey(senderSk, recipientPk, contract, zkappPrivateKey, offchainStorage);
  // } catch (err) {
  //   console.log('Failed, as expected.');
  // }

  await finish();
}

async function initializeKey(
  senderSk: PrivateKey,
  recipientPk: PublicKey,
  contract: MinaKeyShareContract,
  zkappPrivateKey: PrivateKey,
  offchainStorage: OffchainStorageAPI
): Promise<Field[]> {
  // for the sake of example, the sender sends to themselves
  const senderPk = senderSk.toPublicKey();

  // index is (senderPk + recipientPk).x.toFields()
  const index = publicKeysToIndex(senderPk, recipientPk);
  const randomFields = [Field.random(), Field.random(), Field.random()];
  // console.log('\tSETTING:', randomFields.toString());
  const encryptedRandomFields = encryptSecret(senderPk, recipientPk, randomFields);
  // console.log(`SET ${index.toString()} --> ${newValue.toString()}`);
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
  if (!leafIsEmpty.toBoolean()) {
    console.log('Key already exists!');
    return idx2fields.get(index)!;
  }
  const oldValue: Field[] = leafIsEmpty.toBoolean() ? [Field(0)] : idx2fields.get(index)!;

  // make a witness on the current tree
  const witness = tree.getWitness(index);
  const circuitWitness = new OffchainStorageMerkleWitness(witness);

  // update tree & get new root
  tree.setLeaf(index, Poseidon.hash(encryptedRandomFields));
  // const newRoot = tree.getRoot(); // what to do with this guy?
  idx2fields.set(index, encryptedRandomFields);

  // store off-chain
  const [newRootNumber, newRootSignature] = await offchainStorage.setItems(constants.KEY_TREE_HEIGHT, idx2fields);

  // fetch account if not local
  if (!constants.USE_LOCAL) {
    await fetchAccount({ publicKey: senderPk });
  }

  // create transaction
  console.time('Creating transaction');
  const tx = await Mina.transaction({ feePayerKey: senderSk, fee: constants.TX_FEE }, () => {
    contract.update(
      leafIsEmpty,
      Poseidon.hash(oldValue),
      Poseidon.hash(encryptedRandomFields),
      circuitWitness,
      newRootNumber,
      newRootSignature
    );
    // contract.sign(zkappPrivateKey);
    contract.requireSignature();
  });

  console.timeEnd('Creating transaction');

  // create a proof for transaction
  // NOTE: maybe sign before the proof?
  if (!constants.USE_LOCAL) {
    const LABEL = 'Creating an execution proof...';
    console.time(LABEL);
    await tx.prove();
    console.timeEnd(LABEL);
  }

  await tx.sign([zkappPrivateKey]).send();
  // console.log('Hash:', res.hash());

  return randomFields;
}

async function getKey(
  senderSk: PrivateKey,
  recipientPk: PublicKey,
  contract: MinaKeyShareContract,
  offchainStorage: OffchainStorageAPI
): Promise<Field[]> {
  // for the sake of example, the sender sends to themselves
  const senderPk = senderSk.toPublicKey();

  const root = contract.keysRoot.get();
  const idx2fields = await offchainStorage.getItems(constants.KEY_TREE_HEIGHT, root);
  const index = publicKeysToIndex(senderPk, recipientPk);

  const value = idx2fields.get(index);
  if (value === undefined) {
    // console.log('No key at this index.');
    return [];
  } else {
    // console.log(`GET ${index} --> ${value}`);
    const f = decryptSecret(senderSk, recipientPk, value);
    return f;
  }
}

// Sets up Mina local blockchain / Berkeley network, returns the fee payer.
async function setup(): Promise<PrivateKey> {
  const LABEL = 'Loading SnarkyJS';
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
): Promise<MinaKeyShareContract> {
  // compile the contract if not local
  if (!constants.USE_LOCAL) {
    console.log('Compiling smart contract...');
    await MinaKeyShareContract.compile();
  }

  // instantiate
  const contract = new MinaKeyShareContract(zkappPublicKey);

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
    // deploy here if wanted
    // if (true) {
    //   console.log('Deploying!');
    //   const tx = await Mina.transaction(
    //     {
    //       feePayerKey: owner,
    //       fee: constants.TX_FEE,
    //     },
    //     () => {
    //       AccountUpdate.fundNewAccount(owner); // funds the deployed zkapp account
    //       contract.deploy({ zkappKey: zkappPrivateKey });
    //       contract.initState(serverPublicKey);
    //       contract.requireSignature();
    //     }
    //   );
    //   await tx.sign([zkappPrivateKey]).send();
    // }
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
  const LABEL = 'Shutting down SnarkyJS';
  console.time(LABEL);
  await shutdown();
  console.timeEnd(LABEL);
}

setup()
  .then(main)
  .then(finish)
  .then(() => console.log('Done'));
