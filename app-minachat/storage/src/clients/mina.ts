import config from '../configurations/index.js';
import { Client } from './index.js';
import {
  Field,
  isReady,
  Mina,
  PrivateKey,
  PublicKey,
  shutdown,
  Signature,
} from 'snarkyjs';
import fs from 'fs';

/**
 * A local Mina client that handles the private key, connections and such
 */
class MinaClient implements Client {
  private static instance: MinaClient;
  private serverPrivateKey: PrivateKey;
  private serverPublicKey: PublicKey;

  private constructor() {
    // TODO
  }

  /// No async setup required
  public async setup(): Promise<void> {
    console.log('Loading SnarkyJS...');
    await isReady;
    console.log('SnarkyJS loaded!\n');

    if (config.Mina.USE_LOCAL) {
      // use local blockchain
      const localBC = Mina.LocalBlockchain();
      Mina.setActiveInstance(localBC);

      // get default account
      this.serverPrivateKey = localBC.testAccounts[0].privateKey;
    } else {
      // connect to Berkeley
      const Berkeley = Mina.Network(
        'https://proxy.berkeley.minaexplorer.com/graphql'
      );
      Mina.setActiveInstance(Berkeley);

      // read deployer from file
      const deployAlias = process.argv[2];
      const deployerKeysFileContents = fs.readFileSync(
        `keys/${deployAlias}.json`,
        'utf8'
      );
      const deployerPrivateKeyBase58 = JSON.parse(deployerKeysFileContents)
        .privateKey as string;
      this.serverPrivateKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
    }

    // derive public key
    this.serverPublicKey = this.serverPrivateKey.toPublicKey();
    console.log('Server using public key', this.serverPublicKey.toBase58());

    return;
  }

  public async destroy(): Promise<void> {
    await shutdown();
    return;
  }

  public async healthcheck(): Promise<boolean> {
    return true;
  }

  /// Singleton accessor of MinaClient
  public static getInstance(): MinaClient {
    if (!MinaClient.instance) {
      // TODO: give args
      MinaClient.instance = new MinaClient();
    }
    return MinaClient.instance;
  }

  public getPublicKey(): PublicKey {
    return this.serverPublicKey;
  }

  public sign(fields: Field[]): Signature {
    return Signature.create(this.serverPrivateKey, fields);
    // let newRootSignature =
    // [
    //   newRoot,
    //   Field(newRootNumber),
    // ]);
  }
}

export function minaClient(): MinaClient {
  return MinaClient.getInstance();
}
