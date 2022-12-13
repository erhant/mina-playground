import { Encryption, Field, PublicKey } from 'snarkyjs';

/**
 * Given two public keys, maps them to a bigint. Use with a height 256 Merkle Tree.
 * @param p public key 1
 * @param q public key 2
 * @returns a bigint to be used as index in Merkle Tree
 */
export function publicKeysToIndex(p: PublicKey, q: PublicKey): bigint {
  return p.toGroup().add(q.toGroup()).x.toBigInt(); // (p + q).x
}

/**
 * Given two public keys an a random field element, encrypts the field element with both keys.
 * If p.x < q.x, returned elements are encrypted with p first and then q. Otherwise, vice versa.
 * @param p public key 1
 * @param q public key 2
 * @param f a random field element
 * @returns [len, c1, c2] as a single array length and two ciphertexts, first one encrypted by the smaller public key
 */
export function encryptSecret(p: PublicKey, q: PublicKey, f: Field): Field[] {
  let c1: Field[], c2: Field[];
  if (p.toGroup().x < q.toGroup().x) {
    c1 = Encryption.encrypt([f], p).cipherText;
    c2 = Encryption.encrypt([f], q).cipherText;
  } else {
    c1 = Encryption.encrypt([f], q).cipherText;
    c2 = Encryption.encrypt([f], p).cipherText;
  }
  const len1 = Field(c1.length);
  return [len1, ...c1, ...c2];
}
