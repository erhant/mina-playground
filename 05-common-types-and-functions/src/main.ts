import { Mina, isReady, shutdown } from 'snarkyjs';

import { basicMerkleTreeExample } from './merkleTree.js';
import { boolExample, signedNumExample, charExample, stringExample, demonstration } from './types.js';
import { pointExample } from './struct.js';
import { ifAndSwitchExample } from './controlFlow.js';
import { basicMerkleMapExample } from './merkleMap.js';
import { ledgerContractExample } from './ledgerWithMerkleTree.js';

async function main() {
  const localBC = await setup();
  const owner = localBC.testAccounts[0].privateKey;

  // simple types
  // boolExample();
  // signedNumExample();
  // charExample();

  // advanced types
  // stringExample();

  // demo of all types
  // demonstration();

  // class (struct) example
  // pointExample();

  // circuit logic flow if / switch example
  // ifAndSwitchExample();

  // merkle tree example
  // await basicMerkleTreeExample(owner);

  // merkle map example
  // await basicMerkleMapExample(owner);

  // ledger contract example
  await ledgerContractExample(owner);

  await finish();
}

/**
 * Sets up Mina local blockchain.
 * @returns a Local blockchain instance
 */
async function setup() {
  console.log('Loading SnarkyJS...');
  await isReady;
  console.log('SnarkyJS loaded!\n');

  const localBC = Mina.LocalBlockchain();
  Mina.setActiveInstance(localBC);
  return localBC;
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
