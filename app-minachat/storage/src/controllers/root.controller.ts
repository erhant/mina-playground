import type { Request, Response } from 'express';
import { respond } from '../utilities/respond';
import { minaClient } from '../clients/mina';

export async function getPublicKey(request: Request, response: Response) {
  return respond.success(response, '', {
    publicKey: minaClient().getPublicKey().toBase58(),
  });
}

export async function getIndexToFields(request: Request, response: Response) {
  // TODO:
  return respond.success(response, '', {});
}
