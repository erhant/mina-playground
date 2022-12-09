import fs from 'fs';
import { generateKey } from 'crypto';
import { MinaChatContract } from './MinaChatContract';
import { Mina, isReady, PrivateKey, AccountUpdate, shutdown, PublicKey, fetchAccount } from 'snarkyjs';
import { OffchainStorageAPI } from './api/storage';

const KEY_TREE_HEIGHT = 32;
const STORAGE_SERVER_ADDR = 'http://localhost:3001';
const USE_LOCAL = true;
const TX_FEE = 100_000_000;

async function main() {
  const owner = await setup();

  // prepare keys
  const zkappPrivateKey = USE_LOCAL ? PrivateKey.random() : owner;
  const zkappPublicKey = zkappPrivateKey.toPublicKey();

  // prepare server key
  const offchainStorage = new OffchainStorageAPI(STORAGE_SERVER_ADDR);
  const serverPublicKey = await offchainStorage.getServerPublicKey();
  console.log('Off-chain Server Public Key:', serverPublicKey.toBase58());

  // prepare contract
  const contract = await prepareContract(owner, zkappPrivateKey, zkappPublicKey, serverPublicKey);

  // make an example transaction of setting keys
  // for the sake of example, the sender sends to themselves
  await initializeKeys(contract, zkappPrivateKey, zkappPublicKey, owner, owner.toPublicKey());

  await finish();
}

// Creates an encrypted symmetric key between sender and recipient, if it does not exist
async function initializeKeys(
  zkapp: MinaChatContract,
  zkappPrivateKey: PrivateKey,
  zkappPublicKey: PublicKey,
  sender: PrivateKey,
  recipient: PublicKey
) {
  const treeRoot = zkapp.storageTreeRoot.get();
  const idx2fields: Map<bigint, Field[]> = await OffChainStorage.get(
    STORAGE_SERVER_ADDR,
    zkappPublicKey,
    TREE_HEIGHT,
    treeRoot,
    NodeXMLHttpRequest
  );

  idx2fields.has(index);
}

// Sets up Mina local blockchain / Berkeley network, returns the fee payer.
async function setup(): Promise<PrivateKey> {
  const LABEL = 'Loading SnarkyJS...';
  console.time(LABEL);
  await isReady;
  console.timeEnd(LABEL);

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
    // TODO: read env?
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
): Promise<MinaChatContract> {
  // compile the contract if not local
  if (!USE_LOCAL) {
    console.log('Compiling smart contract...');
    await MinaChatContract.compile();
  }

  // instantiate
  const contract = new MinaChatContract(zkappPublicKey);

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

// Terminates Snarkyjs.
async function finish() {
  const LABEL = 'Shutting down SnarkyJS...';
  console.time(LABEL);
  await shutdown();
  console.timeEnd(LABEL);
}

main().then(() => console.log('Done'));
