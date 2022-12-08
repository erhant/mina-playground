# Mina zkApp: 06 Off Chain Storage

This project implements a tree, where each leaf is either empty or stores a number, which will be our data. Updates to the tree can update a leaf, if the new number in the leaf is greater than the old number. The root of the tree is stored on chain, while the tree itself is stored on an off-chain storage server. Possible off-chain storage solution:

1. A single-server storage solution (this is what is presented here).
2. A multi-server storage solution that can be run by multiple parties for stronger trust guarantees.
3. A solution leveraging storage on modular blockchains.
4. A future hard fork to add purchasable on-chain data storage to Mina.
5. A future hard fork to add data-storage committees to Mina for horizontally scalable storage.

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
