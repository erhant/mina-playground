import config from '../configurations';
import { Client } from '.';
import { isReady, Mina, PrivateKey, PublicKey, shutdown } from 'snarkyjs';
import fs from 'fs';

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

    if (config.Mina.useLocal) {
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
    return;
  }

  /// No async destroy required
  public async destroy(): Promise<void> {
    await shutdown();
    return;
  }

  /// Check block number
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
}

export function minaClient(): MinaClient {
  return MinaClient.getInstance();
}
