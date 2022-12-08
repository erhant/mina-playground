import fs from 'fs';
import { NumberTreeContract } from './NumberTreeContract.js';
import { OffChainStorage, MerkleWitness8 } from 'experimental-zkapp-offchain-storage';
import { Mina, isReady, PrivateKey, AccountUpdate, Field, Bool, shutdown, PublicKey, fetchAccount } from 'snarkyjs';
import { makeAndSendTransaction } from './utils.js';
import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest = XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

const TREE_HEIGHT = 8;
const STORAGE_SERVER_ADDR = 'http://localhost:3001';
const USE_LOCAL = true;
const TX_FEE = 100_000_000;

async function main() {
  const owner = await setup();

  // prepare keys
  const zkappPrivateKey = USE_LOCAL ? PrivateKey.random() : owner;
  const zkappPublicKey = zkappPrivateKey.toPublicKey();
  const serverPublicKey = await OffChainStorage.getPublicKey(STORAGE_SERVER_ADDR, NodeXMLHttpRequest);
  console.log('Off-chain Server Public Key:', serverPublicKey.toBase58());

  // prepare contract
  const contract = await prepareContract(owner, zkappPrivateKey, zkappPublicKey, serverPublicKey);

  // make an example transaction
  await incrementIndex(owner, contract, zkappPrivateKey, zkappPublicKey, 1n, Field(4)); // 0 -> 4
  await incrementIndex(owner, contract, zkappPrivateKey, zkappPublicKey, 1n, Field(5)); // 4 -> 9
  await incrementIndex(owner, contract, zkappPrivateKey, zkappPublicKey, 0n, Field(3)); // 0 -> 3

  await finish();
}

async function incrementIndex(
  owner: PrivateKey,
  zkapp: NumberTreeContract,
  zkappPrivateKey: PrivateKey,
  zkappPublicKey: PublicKey,
  index: bigint,
  incrementAmount: Field
) {
  // select a random index for the sake of tutorial
  // const index = BigInt(Math.floor(Math.random() * 4));

  // get the existing tree
  const treeRoot = zkapp.storageTreeRoot.get();
  const idx2fields = await OffChainStorage.get(
    STORAGE_SERVER_ADDR,
    zkappPublicKey,
    TREE_HEIGHT,
    treeRoot,
    NodeXMLHttpRequest
  );
  console.log('Index to Fields', idx2fields);
  const tree = OffChainStorage.mapToTree(TREE_HEIGHT, idx2fields);
  const leafWitness = new MerkleWitness8(tree.getWitness(index));

  // get the prior leaf
  const priorLeafIsEmpty = !idx2fields.has(index);
  const priorLeafNumber = priorLeafIsEmpty ? Field(0) : idx2fields.get(index)![0];

  // update the leaf, and save it in the storage server
  const newLeafNumber = priorLeafNumber.add(incrementAmount);
  idx2fields.set(index, [newLeafNumber]);
  const [storedNewStorageNumber, storedNewStorageSignature] = await OffChainStorage.requestStore(
    STORAGE_SERVER_ADDR,
    zkappPublicKey,
    TREE_HEIGHT,
    idx2fields,
    NodeXMLHttpRequest
  );
  console.log('changing index', index, 'from', priorLeafNumber.toString(), 'to', newLeafNumber.toString());

  // update the smart contract
  const doUpdate = () => {
    zkapp.update(
      Bool(priorLeafIsEmpty),
      priorLeafNumber,
      newLeafNumber,
      leafWitness,
      storedNewStorageNumber,
      storedNewStorageSignature
    );
  };

  if (USE_LOCAL) {
    // make a local transaction as we have done in previous tutorials
    const tx = await Mina.transaction({ feePayerKey: owner, fee: TX_FEE }, () => {
      doUpdate();
      zkapp.requireSignature();
    });
    await tx.sign([zkappPrivateKey]).send();
  } else {
    await makeAndSendTransaction({
      feePayerPrivateKey: owner,
      zkAppPublicKey: zkappPublicKey,
      mutateZkApp: () => doUpdate(),
      transactionFee: TX_FEE,
      getState: () => zkapp.storageTreeRoot.get(),
      statesEqual: (root1, root2) => root1.equals(root2).toBoolean(),
    });
  }

  console.log('root updated to', zkapp.storageTreeRoot.get().toString());
}

/**
 * Sets up Mina local blockchain / Berkeley network.
 * @returns fee payer
 */
async function setup(): Promise<PrivateKey> {
  console.log('Loading SnarkyJS...');
  await isReady;
  console.log('SnarkyJS loaded!\n');

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
): Promise<NumberTreeContract> {
  // compile the contract if not local
  if (!USE_LOCAL) {
    console.log('Compiling smart contract...');
    await NumberTreeContract.compile();
  }

  // instantiate
  const contract = new NumberTreeContract(zkappPublicKey);

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

/**
 * Terminates Mina snarkyjs.
 */
async function finish() {
  console.log('\nShutting down...');
  await shutdown();
  console.log('bye bye.');
}

main().then(() => console.log('Done'));
