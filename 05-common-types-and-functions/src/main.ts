import {
  Mina,
  isReady,
  shutdown,
  Int64,
  Signature,
  Poseidon,
  Field,
  Circuit,
  MerkleWitness,
  MerkleTree,
  AccountUpdate,
} from 'snarkyjs';

import { basicMerkleTreeExample } from './merkleTree.js';
import {
  boolExample,
  signedNumExample,
  charExample,
  stringExample,
  demonstration,
} from './types.js';
import { pointExample } from './struct.js';
import { ifExample } from './controlFlow.js';
import { basicMerkleMapExample } from './merkleMap.js';

async function main() {
  await isReady;

  // deploy local blockchain
  const Local = await setup();
  const deployerAccount = Local.testAccounts[0].privateKey;

  // simple types
  boolExample();
  signedNumExample();
  charExample();

  // advanced types
  stringExample();

  // demo of all types
  demonstration();

  // class (struct) example
  pointExample();

  // circuit logic flow if / switch example
  ifExample();

  // merkle tree example
  await basicMerkleTreeExample(deployerAccount);

  // merkle map example
  await basicMerkleMapExample();

  // --------------------------------------
  // create a new merkle tree and LedgerContract zkapp account

  // --------------------------------------

  await finish();
}

main();

/**
 * Sets up Mina local blockchain.
 * @returns a Local blockchain instance
 */
async function setup() {
  console.log('Loading SnarkyJS...');
  await isReady;
  console.log('SnarkyJS loaded!\n');

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  return Local;
}

/**
 * Terminates Mina snarkyjs.
 */
async function finish() {
  console.log('\nShutting down...');
  await shutdown();
  console.log('bye bye.');
}
main()
  .then(() => console.log('Done'))
  .catch(() => console.log('Error!'));
