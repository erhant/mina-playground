import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { Field, MerkleTree, PublicKey, Signature } from 'snarkyjs';

export class OffchainStorageAPI {
  private axios: AxiosInstance;
  public zkAppPublicKey: PublicKey;
  public zkAppAddress58: string;
  public serverAddress: string;

  constructor(serverAddress: string, zkAppPublicKey: PublicKey) {
    this.axios = axios.create({
      baseURL: serverAddress,
      validateStatus: () => true, // allow bad status codes
    });
    this.zkAppPublicKey = zkAppPublicKey;
    this.zkAppAddress58 = zkAppPublicKey.toBase58();
    this.serverAddress = serverAddress;

    // TODO: ping the server for healthcheck
  }

  /**
   * Requests the public key of the off-chain storage server
   * @returns public key of the off-chain storage
   */
  async getServerPublicKey(): Promise<PublicKey> {
    const res = await this.axios.get('/getPublicKey/');
    return PublicKey.fromBase58(res.data.data.publicKey);
  }

  /**
   * Request a tree with given height and root from the off-chain storage
   * @param height height of tree
   * @param root root of tree
   * @returns a mapping of node index to fields
   */
  async getItems(height: number, root: Field): Promise<Map<bigint, Field[]>> {
    const idx2fields = new Map<bigint, Field[]>();

    // check if root is that of an empty tree
    if (!new MerkleTree(height).getRoot().equals(root).toBoolean()) {
      // if not, get items from off-chain storage
      const res = await this.axios.get(`/storage/getItems?zkAppAddress=${this.zkAppAddress58}&root=${root}`);
      const items = res.data.data.items as Array<[string, string[]]>;
      items.forEach(([idx, fieldStrs]) => {
        idx2fields.set(
          BigInt(idx),
          fieldStrs.map((s) => Field.fromJSON(s))
        );
      });
    }

    return idx2fields;
  }

  /**
   * Sets the field values at given indices for some tree with the given height at the
   * off-chain storage server.
   * @param height height of the tree
   * @param idx2fields node indexes and their fields in the tree
   * @returns
   */
  async setItems(height: number, idx2fields: Map<bigint, Field[]>): Promise<[Field, Signature]> {
    // convert idx2fields to items (for the query)
    const items = [];
    for (let [idx, fields] of idx2fields) {
      items.push([idx.toString(), fields.map((f) => f.toJSON())]);
    }

    // make request
    const res = await this.axios.post('/storage/setItems', {
      zkAppAddress58: this.zkAppAddress58,
      items,
      height,
    });

    // parse response
    const newRootNumber = Field(res.data.data.newRootNumber);
    const newRootSignature = Signature.fromFields(res.data.data.newRootSignature.map((s: string) => Field.fromJSON(s)));
    return [newRootNumber, newRootSignature];
  }
}
