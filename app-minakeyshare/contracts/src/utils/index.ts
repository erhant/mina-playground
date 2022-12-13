import { Encryption, Field, Group, PrivateKey, PublicKey } from 'snarkyjs';

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
 * @param yourPk your public key
 * @param peerPk peer public key
 * @param f a random field element
 * @returns [c1.x, c1.y, c2.x, c2.y, c1.len, ...c1, ...c2] as a single array.
 * c1 is ciphertext from the smaller key, c2 with the other.
 */
export function encryptSecret(yourPk: PublicKey, peerPk: PublicKey, f: Field[]): Field[] {
  let c1: {
      publicKey: Group;
      cipherText: Field[];
    },
    c2: {
      publicKey: Group;
      cipherText: Field[];
    };
  if (yourPk.toGroup().x < peerPk.toGroup().x) {
    c1 = Encryption.encrypt(f, yourPk);
    c2 = Encryption.encrypt(f, peerPk);
  } else {
    c1 = Encryption.encrypt(f, peerPk);
    c2 = Encryption.encrypt(f, yourPk);
  }
  const len1 = Field(c1.cipherText.length);
  return [c1.publicKey.x, c1.publicKey.y, c2.publicKey.x, c2.publicKey.y, len1, ...c1.cipherText, ...c2.cipherText];
}

/**
 * Decrypts a ciphertext encrypted with some public key.
 * @see {encryptSecret} for more details
 * @param yourSk your private key
 * @param peerPk peer public key
 * @param s [c1.x, c1.y, c2.x, c2.y, c1.len, ...c1, ...c2] as a single array.
 * c1 is ciphertext from the smaller key, c2 with the other.
 * @returns decrypted field
 */
export function decryptSecret(yourSk: PrivateKey, peerPk: PublicKey, s: Field[]): Field[] {
  const yourPk = yourSk.toPublicKey();
  const c1pk = Group.fromJSON({ x: s[0].toString(), y: s[1].toString() })!;
  const c2pk = Group.fromJSON({ x: s[2].toString(), y: s[3].toString() })!;
  const len1 = Number(s[4]);
  const c1 = s.slice(5, 5 + len1);
  const c2 = s.slice(5 + len1);
  const pt = Encryption.decrypt(
    {
      publicKey: yourPk.toGroup().x < peerPk.toGroup().x ? c1pk : c2pk,
      cipherText: yourPk.toGroup().x < peerPk.toGroup().x ? c1 : c2,
    },
    yourSk
  );

  return pt;
}

/**
 * Compares two arrays of fields
 * @param a array of fields
 * @param b array of fields
 * @returns true if they are equal
 */
export function equalFields(a: Field[], b: Field[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (!a[i].equals(b[i]).toBoolean()) return false;
  }
  return true;
}
