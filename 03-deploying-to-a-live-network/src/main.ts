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
  const owner = localBC.testAccounts[0].privateKey;

  // deploy contract
  const [contract, zkAppPrivateKey] = await deployTx(owner);

  // get the initial state of our zkApp account after deployment
  console.log('state after init:', contract.num.get().toString());

  // update with a transaction (9 = 3^2)
  await updateTx(owner, contract, zkAppPrivateKey, Field(9));
  console.log('state after txn1:', contract.num.get().toString());

  // update with an invalid transaction (75 != 9^2)
  try {
    await updateTx(owner, contract, zkAppPrivateKey, Field(75));
  } catch (err: any) {
    console.log(err.message);
  }
  console.log('state after txn2:', contract.num.get().toString());

  // update with a transaction (81 = 9^2)
  await updateTx(owner, contract, zkAppPrivateKey, Field(81));
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

/**
 * Deploys a Square contract with a random private key
 * @param owner fee payer & deployer account
 * @returns the contract instance and its private key
 */
async function deployTx(owner: PrivateKey): Promise<[Square, PrivateKey]> {
  // create a public/private key pair. The public key is our address and where we will deploy to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // create an instance of our Square smart contract and deploy it to zkAppAddress
  const contract = new Square(zkAppAddress);
  const deployTxn = await Mina.transaction(owner, () => {
    AccountUpdate.fundNewAccount(owner); // pays for the fee
    contract.requireSignature();
    contract.deploy({ zkappKey: zkAppPrivateKey });
    // contract.sign(zkAppPrivateKey); // depracated
  });
  await deployTxn.send();
  console.log('contract deployed.');

  return [contract, zkAppPrivateKey];
}

/**
 * Makes an update transaction
 * @param account message sender
 * @param contract target contract instance
 * @param zkAppPrivateKey private key of contract
 * @param newValue new state variable value
 */
async function updateTx(
  account: PrivateKey,
  contract: Square,
  zkAppPrivateKey: PrivateKey,
  newValue: Field
) {
  const tx = await Mina.transaction(account, () => {
    contract.requireSignature();
    contract.update(newValue);
    // contract.sign(zkAppPrivateKey); // depracated, use tx.sign
  });
  await tx.sign([zkAppPrivateKey]).send();
}

// dont use require.module here
main().then(() => console.log('Done'));
// .catch(() => console.log('Error!'));
