import { Client } from './index.js';
import fs from 'fs';
import config from '../configurations/index.js';
import { Field, MerkleTree } from 'snarkyjs';

class StorageClient implements Client {
  private static instance: StorageClient;
  public database: {
    [zkAppAddress: string]: {
      nextNumber: number;
      height: number;
      root2data: {
        [root: string]: {
          rootNumber: number;
          items: Array<[string, string[]]>;
        };
      };
    };
  };

  private constructor() {
    this.database = {};
  }

  public async setup(): Promise<void> {
    if (!fs.existsSync(config.Storage.SAVE_FILE)) return;

    // load db if exists
    const fileData = fs.readFileSync(config.Storage.SAVE_FILE, 'utf8');
    const data = JSON.parse(fileData);
    this.database = data.database;
    console.log('Loaded db from', config.Storage.SAVE_FILE);
  }

  public async destroy(): Promise<void> {
    // dump db
    fs.writeFileSync(
      config.Storage.SAVE_FILE,
      JSON.stringify({
        database: this.database,
      }),
      'utf8'
    );
    console.log('Dumped db...');
    return;
  }

  public getItems(
    zkAppAddress58: string,
    root: string
  ): Array<[string, string[]]> {
    return this.database[zkAppAddress58].root2data[root].items;
  }

  public setItems(
    zkAppAddress58: string,
    tree: MerkleTree,
    items: Array<[string, string[]]>
  ): [Field, number] {
    // initialize database for this zkApp if it does not exist yet
    if (!(zkAppAddress58 in this.database)) {
      this.database[zkAppAddress58] = {
        nextNumber: 1,
        height: tree.height,
        root2data: {},
      };
    }

    // update tree
    const newRoot = tree.getRoot(); // generate the new root
    const newRootNumber = this.database[zkAppAddress58].nextNumber;
    this.database[zkAppAddress58].nextNumber += 1; // increment number
    this.database[zkAppAddress58].root2data[newRoot.toString()] = {
      rootNumber: newRootNumber,
      items,
    };

    return [newRoot, newRootNumber];
  }

  public async healthcheck(): Promise<boolean> {
    return true;
  }

  /// Singleton accessor of MinaClient
  public static getInstance(): StorageClient {
    if (!StorageClient.instance) {
      // TODO: give args
      StorageClient.instance = new StorageClient();
    }
    return StorageClient.instance;
  }
}

export function storageClient(): StorageClient {
  return StorageClient.getInstance();
}
