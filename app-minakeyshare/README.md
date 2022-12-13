# Mina Key-Share

This is a key-sharing application that uses an off-chain storage.

## Usage

There are 3 folders:

- [`contracts`](./contracts/) folder has the main chatting smart contract.
- [`ui`](./ui/) has the NextJS frontend. **WORK IN PROGRESS**.
- [`storage`](./storage/) has the off-chain storage backend implementation.

## Methodology

Consider Alice and Bob, with secret and public key-pairs as $sk_a, pk_a$ and $sk_b, pk_b$ respectively. They would like to share a secret key $s$ between them. The basic idea is as follows:

```ts
// pk.x is the x coordinate of the group element for that key
keysTree[pk_a.x + pk_b.x] = [
  ENC(pk_a, sk_{a,b}), // encrypted for Alice
  ENC(pk_b, sk_{a,b})  // encrypted for Bob
]
```

Within the code though, both $s$ and the value of that mapping is expected to be a field array. Furhtermore, encryption results in a new public key to be used in decryption. For that, we have two [utilities](./contracts/src/utils/index.ts):

```ts
export function encryptSecret(
  yourPk: PublicKey,
  peerPk: PublicKey,
  f: Field[]
): Field[] {
  let c1: {
      publicKey: Group;
      cipherText: Field[];
    },
    c2: {
      publicKey: Group;
      cipherText: Field[];
    };
  // first ciphertext is encrypted with the smaller public key
  if (yourPk.toGroup().x < peerPk.toGroup().x) {
    c1 = Encryption.encrypt(f, yourPk);
    c2 = Encryption.encrypt(f, peerPk);
  } else {
    c1 = Encryption.encrypt(f, peerPk);
    c2 = Encryption.encrypt(f, yourPk);
  }
  const len1 = Field(c1.cipherText.length);
  return [
    // x, y of first generated public key
    c1.publicKey.x,
    c1.publicKey.y,
    // x, y of second generated public key
    c2.publicKey.x,
    c2.publicKey.y,
    // length of first ciphertext
    len1,
    // first ciphertext
    ...c1.cipherText,
    // second ciphertext
    ...c2.cipherText,
  ];
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
export function decryptSecret(
  yourSk: PrivateKey,
  peerPk: PublicKey,
  s: Field[]
): Field[] {
  const yourPk = yourSk.toPublicKey();

  // get x, y of first generated public key
  const c1pk = Group.fromJSON({ x: s[0].toString(), y: s[1].toString() })!;
  // get x, y of second generated public key
  const c2pk = Group.fromJSON({ x: s[2].toString(), y: s[3].toString() })!;
  // get length of first ciphertext
  const len1 = Number(s[4]);
  // first ciphertext
  const c1 = s.slice(5, 5 + len1);
  // second ciphertext
  const c2 = s.slice(5 + len1);

  const pt = Encryption.decrypt(
    {
      publicKey: yourPk.toGroup().x < peerPk.toGroup().x ? c1pk : c2pk,
      cipherText: yourPk.toGroup().x < peerPk.toGroup().x ? c1 : c2,
    },
    yourSk // your private key
  );

  return pt;
}
```
