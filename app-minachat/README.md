# Mina Chat

This is a chatting application that uses an off-chain storage of messages, and on-chain proofs.

## Usage

There are 3 folders:

- [`contracts`](./contracts/) folder has the main chatting smart contract.
- [`ui`](./ui/) has the NextJS frontend.
- [`storage`](./storage/) has the off-chain storage backend implementation.

## Methodology

Consider Alice and Bob, with secret and public key-pairs as $sk_a, pk_a$ and $sk_b, pk_b$ respectively. The first time they would like to chat, they create a random secret key to be used in a symmetric fashion. For this, they first put a common secret key $sk_{a,b}$ in a Merkle Tree:
s

```ts
// pk.x is the x coordinate of the group element for that key
keysTree[pk_a.x + pk_b.x] = [
  ENC(pk_a, sk_{a,b}), // encrypted for Alice
  ENC(pk_b, sk_{a,b})  // encrypted for Bob
]
```

In another Merkle Tree, they will be storing an array of their messages:

```ts
encryptedMsg = ENC(sk_{a,b}, msg)
signature = SIGN(encryptedMsg, pk_a) // or pk_b
msgsTree[pk_a XOR pk_b] = [
  encryptedMsg,          // must be encrypted with sk_{a,b}
  signature,             // must be signed by pk_a or pk_b
  timestamp              // must be larger than previous
]
```

TODO: draw diagrams
