# Mina Playground

This repository has the code I have written as I follow through the tutorials at. I started with hopes to join [zkIgnite, Cohort 0](https://minaprotocol.com/blog/zkignite-cohort0)! Before you start, you may have to do the following:

- Install [`zkapp-cli`](https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp#install-mina-zkapp-cli).
- Install [Auro Wallet](https://www.aurowallet.com/).
- Fund your wallet from the [Berkeley Faucet](https://faucet.minaprotocol.com/).

## Tutorials

1. [Hello World](https://docs.minaprotocol.com/zkapps/tutorials/hello-world)
2. [Private Inputs and Hash Functions](https://docs.minaprotocol.com/zkapps/tutorials/private-inputs-hash-functions)
3. [Deploying to a Live Network](https://docs.minaprotocol.com/zkapps/tutorials/deploying-to-a-network)
4. [Building a zkApp UI in the Browser with React (NextJS)](https://docs.minaprotocol.com/zkapps/tutorials/zkapp-ui-with-react). See my submission [here](https://github.com/erhant/mina-sample-zkapp-ui).
5. [Common Types and Functions](https://docs.minaprotocol.com/zkapps/tutorials/common-types-and-functions)
6. [Off-Chain Storage](https://docs.minaprotocol.com/zkapps/tutorials/offchain-storage)
7. [Oracles TODO](https://docs.minaprotocol.com/zkapps/tutorials/oracle)
8. [Custom Tokens TODO](https://docs.minaprotocol.com/zkapps/tutorials/custom-tokens)

In all examples, I have done the following:

```sh
# remove git because I am using a top-level git repo instead
rm -rf .git
# remove CI because I will do it later
rm -rf .github
# remove husky because it requires git in there
rm -rf .husky
npm remove husky
```

Some tutorials require further detail:

- Tutorial 5 includes a Ledger Contract that uses Merkle Trees.
- Tutorial 6 uses a single-server solution to data storage. This is useful for prototyping zkApps and building zkApps where some trust guarantees are reasonable, but should not be used for zkApps that require trustlessness. It is intended as one of several options for data availability on Mina. See the server implementation [here](https://github.com/es92/zkApp-offchain-storage).

## Custom Applications

I also have an example app: `offchain-chatting`.
