import { NumberTreeContract } from './NumberTreeContract.js';
import { OffChainStorage, MerkleWitness8 } from 'experimental-zkapp-offchain-storage';
import fs from 'fs';

import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Group,
  Character,
  CircuitString,
  Signature,
  Field,
  Bool,
  shutdown,
} from 'snarkyjs';

import { makeAndSendTransaction, loopUntilAccountExists } from './utils.js';

import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest = XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

// constants
const TREE_HEIGHT = 8;
const STORAGE_SERVER_ADDR = 'http://localhost:3001';
const USE_LOCAL = true;
const TX_FEE = 100_000_000;

async function main() {
  await isReady;

  // ----------------------------------------

  let feePayerKey: PrivateKey;
  let zkappPrivateKey: PrivateKey;
  if (USE_LOCAL) {
    // use local blockchain
    const localBC = Mina.LocalBlockchain();
    Mina.setActiveInstance(localBC);

    // get default account
    feePayerKey = localBC.testAccounts[0].privateKey;

    // random account for the contract
    zkappPrivateKey = PrivateKey.random();
  } else {
    // connect to Berkeley
    const Berkeley = Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql');
    Mina.setActiveInstance(Berkeley);

    // read deployer from file
    const deployAlias = process.argv[2];
    const deployerKeysFileContents = fs.readFileSync('keys/' + deployAlias + '.json', 'utf8');
    const deployerPrivateKeyBase58 = JSON.parse(deployerKeysFileContents).privateKey as string;

    feePayerKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
    zkappPrivateKey = feePayerKey;
  }

  const zkappPublicKey = zkappPrivateKey.toPublicKey();

  const serverPublicKey = await OffChainStorage.getPublicKey(STORAGE_SERVER_ADDR, NodeXMLHttpRequest);

  // setup the zkapp
  if (!USE_LOCAL) {
    console.log('Compiling smart contract...');
    await NumberTreeContract.compile();
  }
  const zkapp = new NumberTreeContract(zkappPublicKey);

  if (USE_LOCAL) {
    const transaction = await Mina.transaction(feePayerKey, () => {
      AccountUpdate.fundNewAccount(feePayerKey);
      zkapp.deploy({ zkappKey: zkappPrivateKey });
      zkapp.initState(serverPublicKey);
      zkapp.sign(zkappPrivateKey);
    });

    await transaction.send();
  } else {
    let zkAppAccount = await loopUntilAccountExists({
      account: zkappPrivateKey.toPublicKey(),
      eachTimeNotExist: () => console.log('waiting for zkApp account to be deployed...'),
      isZkAppAccount: true,
    });
  }

  // ----------------------------------------
  // update the smart contract

  async function updateTree() {
    // select a random index for the sake of tutorial
    const index = BigInt(Math.floor(Math.random() * 4));

    // get the existing tree
    const treeRoot = await zkapp.storageTreeRoot.get();
    const idx2fields = await OffChainStorage.get(
      STORAGE_SERVER_ADDR,
      zkappPublicKey,
      TREE_HEIGHT,
      treeRoot,
      NodeXMLHttpRequest
    );

    const tree = OffChainStorage.mapToTree(TREE_HEIGHT, idx2fields);
    const leafWitness = new MerkleWitness8(tree.getWitness(BigInt(index)));

    // get the prior leaf
    const priorLeafIsEmpty = !idx2fields.has(index);
    let priorLeafNumber: Field;
    let newLeafNumber: Field;
    if (!priorLeafIsEmpty) {
      priorLeafNumber = idx2fields.get(index)![0];
      newLeafNumber = priorLeafNumber.add(3);
    } else {
      priorLeafNumber = Field(0);
      newLeafNumber = Field(1);
    }

    // update the leaf, and save it in the storage server
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
      const updateTransaction = await Mina.transaction({ feePayerKey, fee: TX_FEE }, () => {
        doUpdate();
        zkapp.sign(zkappPrivateKey);
      });

      await updateTransaction.send();
    } else {
      await makeAndSendTransaction({
        feePayerPrivateKey: feePayerKey,
        zkAppPublicKey: zkappPublicKey,
        mutateZkApp: () => doUpdate(),
        transactionFee: TX_FEE,
        getState: () => zkapp.storageTreeRoot.get(),
        statesEqual: (root1, root2) => root1.equals(root2).toBoolean(),
      });
    }

    console.log('root updated to', zkapp.storageTreeRoot.get().toString());
  }

  for (;;) {
    await updateTree();
  }

  //---------------------------

  await shutdown();
}

main();
