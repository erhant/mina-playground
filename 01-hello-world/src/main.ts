import { Square } from './Square.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
} from 'snarkyjs';

async function main() {
  const localBC = await setup();

  // a pre-funded account
  const deployerAccount = localBC.testAccounts[0].privateKey;

  /////// create a public/private key pair. The public key is our address and where we will deploy to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // create an instance of our Square smart contract and deploy it to zkAppAddress
  const contract = new Square(zkAppAddress);
  const deployTxn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    contract.deploy({ zkappKey: zkAppPrivateKey });
    contract.sign(zkAppPrivateKey);
  });
  await deployTxn.send();
  console.log('contract deployed.');

  // get the initial state of our zkApp account after deployment
  const num0 = contract.num.get();
  console.log('state after init:', num0.toString());

  /////// update with a transaction
  const txn1 = await Mina.transaction(deployerAccount, () => {
    contract.update(Field(9));
    contract.sign(zkAppPrivateKey);
  });
  await txn1.send();

  const num1 = contract.num.get();
  console.log('state after txn1:', num1.toString());

  /////// update with a transaction that is for sure to fail
  try {
    const txn2 = await Mina.transaction(deployerAccount, () => {
      contract.update(Field(75));
      contract.sign(zkAppPrivateKey);
    });
    await txn2.send();
  } catch (err: any) {
    console.log(err.message);
  }
  const num2 = contract.num.get();
  console.log('state after txn2:', num2.toString());

  /////// update with another transaction
  const txn3 = await Mina.transaction(deployerAccount, () => {
    contract.update(Field(81));
    contract.sign(zkAppPrivateKey);
  });
  await txn3.send();
  const num3 = contract.num.get();
  console.log('state after txn3:', num3.toString());

  ///// finish
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
main()
  .then(() => console.log('Done'))
  .catch(() => console.log('Error!'));
