import type { Request, Response } from 'express';
import { respond } from '../utilities/respond.js';
import { Field, MerkleTree, Poseidon } from 'snarkyjs';
import { storageClient } from '../clients/storage.js';
import { minaClient } from '../clients/mina.js';
import config from '../configurations/index.js';

// Returns the items for a given address and root
export async function getItems(request: Request, response: Response) {
  // get address and root from query
  const zkAppAddress58 = request.query.zkAppAddress;
  const root = request.query.root;

  respond.success(response, '', {
    items: storageClient().getItems(zkAppAddress58 as string, root as string),
  });
}

export async function setItems(request: Request, response: Response) {
  const height: number = request.body.height;
  const items: Array<[string, string[]]> = request.body.items;
  const zkAppAddress58: string = request.body.zkAppAddress;

  // check that given height does not exceed maximum
  if (height > config.Storage.MAX_HEIGHT) {
    respond.failure(
      response,
      `Height exceeds the max allowed ${config.Storage.MAX_HEIGHT}.`
    );
    return;
  }

  // check item count (should be max 2^{height}-1)
  if (items.length > 1 << (height - 1)) {
    respond.failure(response, 'Too many items for the given height.');
    return;
  }

  // TODO TODO: check that heights match
  // if (database[zkAppAddress58].height != height) {
  //   respond.failure(
  //     response,
  //     `Heights do not match. Expected: ${database[zkAppAddress58].height}, got ${height}`
  //   );
  //   return;
  // }

  // create a local merkle tree
  const tree = new MerkleTree(height);

  {
    // map strings to bigint and fields
    const fieldItems: Array<[bigint, Field[]]> = items.map(([idx, strs]) => [
      BigInt(idx),
      strs.map(Field.fromJSON),
    ]);

    // map bigint and fields to index and fields
    const idx2fields = new Map<bigint, Field[]>();
    fieldItems.forEach(([index, fields]) => {
      idx2fields.set(index, fields);
    });

    // populate the tree
    for (const [idx, fields] of idx2fields) {
      tree.setLeaf(idx, Poseidon.hash(fields));
    }
  }

  // TODO: try catch for tree height mismatch
  const [newRoot, newRootNumber] = storageClient().setItems(
    zkAppAddress58,
    tree,
    items
  );

  let newRootSignature = minaClient().sign([newRoot, Field(newRootNumber)]);
  console.log('Storing new root', newRoot.toString(), 'at', zkAppAddress58);

  respond.success(response, '', {
    newRootNumber: newRootNumber.toString(),
    newRootSignature: newRootSignature.toFields().map((f) => f.toString()),
  });
}
