import { Bool, Field, MerkleWitness } from 'snarkyjs';

export class MerkleWitness4 extends MerkleWitness(4) {}
export class MerkleWitness8 extends MerkleWitness(8) {}
export class MerkleWitness16 extends MerkleWitness(16) {}
export class MerkleWitness24 extends MerkleWitness(24) {}
export class MerkleWitness32 extends MerkleWitness(32) {}
export class MerkleWitness64 extends MerkleWitness(64) {}
export class MerkleWitness128 extends MerkleWitness(128) {}
export class MerkleWitness256 extends MerkleWitness(256) {}

export type TreeUpdateType = {
  leaf: Field[];
  leafIsEmpty: Bool;
  newLeaf: Field[];
  newLeafIsEmpty: Bool;
  leafWitness: MerkleWitness8;
};
