import { IncrementSecret } from './IncrementSecret.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  // PublicKey,
  AccountUpdate,
  // Poseidon,
} from 'snarkyjs';

async function main() {
  const localBC = await setup();

  // a pre-funded account
  const owner = localBC.testAccounts[0].privateKey;

  // make a random salt
  const salt = Field.random();

  // deploy contract
  const [contract, zkAppPrivateKey] = await deployTx(owner, salt, Field(750));

  // get the initial state of IncrementSecret after deployment
  console.log('state after init:', contract.x.get().toString());

  // make a transaction
  await updateTx(owner, contract, zkAppPrivateKey, salt, Field(750));

  // check the new state
  console.log('state after txn1:', contract.x.get().toString());

  await finish();
}

/**
 * Deploys a IncrementSecret contract with a random private key
 * @param owner fee payer & deployer account
 * @param salt a random salt against hash precompute attacks
 * @param firstSecret initial secret
 * @returns the contract instance and its private key
 */
async function deployTx(
  owner: PrivateKey,
  salt: Field,
  firstSecret: Field
): Promise<[IncrementSecret, PrivateKey]> {
  // create a public/private key pair. The public key is our address and where we will deploy to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // create an instance of our Square smart contract and deploy it to zkAppAddress
  const contract = new IncrementSecret(zkAppAddress);
  const deployTxn = await Mina.transaction(owner, () => {
    AccountUpdate.fundNewAccount(owner);
    // contract.requireSignature();
    contract.deploy({ zkappKey: zkAppPrivateKey });
    contract.initState(salt, firstSecret);
    contract.sign(zkAppPrivateKey);
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
  contract: IncrementSecret,
  zkAppPrivateKey: PrivateKey,
  salt: Field,
  secret: Field
) {
  const tx = await Mina.transaction(account, () => {
    // contract.requireSignature();
    contract.incrementSecret(salt, secret);
    contract.sign(zkAppPrivateKey);
  });
  // await tx.sign([zkAppPrivateKey]).send();
  await tx.send();
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
