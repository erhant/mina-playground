import { IncrementSecret } from './IncrementSecret.js';
import { isReady, shutdown, Field, Mina } from 'snarkyjs';

async function main() {
  const localBC = await setup();

  // a pre-funded account
  const owner = localBC.testAccounts[0].privateKey;

  // make a random salt
  const salt = Field.random();

  // deploy contract
  const [contract, zkAppPrivateKey] = await IncrementSecret.deployTx(owner, salt, Field(750));

  // get the initial state of IncrementSecret after deployment
  console.log('state after init:', contract.x.get().toString());

  // make a transaction
  await contract.updateTx(owner, zkAppPrivateKey, salt, Field(750));

  // check the new state
  console.log('state after txn1:', contract.x.get().toString());

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

// dont use require.module here
main().then(() => console.log('Done'));
// .catch(() => console.log('Error!'));
