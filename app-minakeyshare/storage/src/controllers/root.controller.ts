import type { Request, Response } from 'express';
import { respond } from '../utilities/respond.js';
import { minaClient } from '../clients/mina.js';

// Returns the public key
export async function getPublicKey(request: Request, response: Response) {
  return respond.success(response, '', {
    publicKey: minaClient().getPublicKey().toBase58(),
  });
}
