import { Mina, isReady, shutdown } from 'snarkyjs';

import { basicMerkleTreeExample } from './merkleTree.js';
import { boolExample, signedNumExample, charExample, stringExample, demonstration } from './types.js';
import { pointExample } from './struct.js';
import { ifAndSwitchExample } from './controlFlow.js';
import { basicMerkleMapExample } from './merkleMap.js';
import { ledgerContractExample } from './ledgerWithMerkleTree.js';

async function main() {
  const owner = await setup();

  // simple types
  console.log('\n===== SIMPLE TYPES =====');
  boolExample();
  signedNumExample();
  charExample();

  // advanced types
  console.log('\n===== ADVANCED TYPES =====');
  stringExample();
  demonstration();

  // class (struct) example
  console.log('\n===== STRUCT TYPE =====');
  pointExample();

  // circuit logic flow if / switch example
  console.log('\n===== IF & SWITCH =====');
  ifAndSwitchExample();

  // merkle tree example
  console.log('\n===== MERKLE TREE =====');
  await basicMerkleTreeExample(owner);

  // merkle map example
  console.log('\n===== MERKLE MAP =====');
  await basicMerkleMapExample(owner);

  // ledger contract example
  console.log('\n===== LEDGER WITH MERKLE TREE =====');
  await ledgerContractExample(owner);

  await finish();
}

/**
 * Sets up Mina local blockchain.
 * @returns fee payer account
 */
async function setup() {
  console.log('Loading SnarkyJS...');
  await isReady;
  console.log('SnarkyJS loaded!\n');

  const localBC = Mina.LocalBlockchain();
  Mina.setActiveInstance(localBC);
  return localBC.testAccounts[0].privateKey;
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
