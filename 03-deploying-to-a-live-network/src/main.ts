import { Square } from './Square.js';
import { isReady, shutdown, Field, Mina } from 'snarkyjs';

async function main() {
  const localBC = await setup();

  // a pre-funded account
  const owner = localBC.testAccounts[0].privateKey;

  // deploy contract
  const [contract, zkAppPrivateKey] = await Square.deployTx(owner);

  // get the initial state of our zkApp account after deployment
  console.log('state after init:', contract.num.get().toString());

  // update with a transaction (9 = 3^2)
  await contract.updateTx(owner, zkAppPrivateKey, Field(9));
  console.log('state after txn1:', contract.num.get().toString());

  // update with an invalid transaction (75 != 9^2)
  try {
    await contract.updateTx(owner, zkAppPrivateKey, Field(75));
  } catch (err: any) {
    console.log(err.message);
  }
  console.log('state after txn2:', contract.num.get().toString());

  // update with a transaction (81 = 9^2)
  await contract.updateTx(owner, zkAppPrivateKey, Field(81));
  console.log('state after txn3:', contract.num.get().toString());

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

// dont use require.module here
main().then(() => console.log('Done'));
// .catch(() => console.log('Error!'));
