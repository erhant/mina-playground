import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { PublicKey } from 'snarkyjs';

export class OffchainStorageAPI {
  private axios: AxiosInstance;

  constructor(baseURL: string) {
    this.axios = axios.create({
      baseURL,
      validateStatus: () => true, // allow bad status codes
    });

    // TODO: ping the server for healthcheck
  }

  async getServerPublicKey(): Promise<PublicKey> {
    const res = await this.axios.get('/getPublicKey/');
    return PublicKey.fromBase58(res.data.publicKey);
  }
}
