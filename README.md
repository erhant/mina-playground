# Mina Playground

This repository has the code I have written as I follow through the tutorials at. I started with hopes to join [zkIgnite, Cohort 0](https://minaprotocol.com/blog/zkignite-cohort0)! Before you start, you may have to do the following:

- Install [`zkapp-cli`](https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp#install-mina-zkapp-cli).
- Install [Auro Wallet](https://www.aurowallet.com/).
- Fund your wallet from the [Berkeley Faucet](https://faucet.minaprotocol.com/).

1. [Hello World](https://docs.minaprotocol.com/zkapps/tutorials/hello-world)
2. [Private Inputs and Hash Functions](https://docs.minaprotocol.com/zkapps/tutorials/private-inputs-hash-functions)
3. [Deploying to a Live Network](https://docs.minaprotocol.com/zkapps/tutorials/deploying-to-a-network)
4. [Building a zkApp UI in the Browser with React (NextJS)](https://docs.minaprotocol.com/zkapps/tutorials/zkapp-ui-with-react). See my submission [here](https://github.com/erhant/mina-sample-zkapp-ui).
5. [Common Types and Functions](https://docs.minaprotocol.com/zkapps/tutorials/common-types-and-functions)
6. [Off-Chain Storage](https://docs.minaprotocol.com/zkapps/tutorials/offchain-storage)
7. [Oracles](https://docs.minaprotocol.com/zkapps/tutorials/oracle)
8. [Custom Tokens](https://docs.minaprotocol.com/zkapps/tutorials/custom-tokens)

In all examples, I have done the following:

```sh
# remove git because I am using a top-level git repo
rm -rf .git
# remove husky because it requires git in there
rm -rf .husky
npm remove husky
```

## To-do

The compiler tells us that the `contract.sign()` is deprecated in favor of `contract.requireSignature()`. Here is an example from the first tutorial:

```typescript
const tx = await Mina.transaction(account, () => {
  contract.requireSignature();
  contract.update(newValue);
  // contract.sign(zkAppPrivateKey); // depracated, use tx.sign
});
//       ____: sign here!
await tx.sign([zkAppPrivateKey]).send();
```

That works alright on the first tutorial, but it gives an error in the second tutorial:

```typescript
const tx = await Mina.transaction(account, () => {
  contract.requireSignature();
  contract.incrementSecret(salt, secret);
  // contract.sign(zkAppPrivateKey);
});
await tx.sign([zkAppPrivateKey]).send();
```

with the error:

```sh
Error: Transaction verification failed: Cannot update field 'appState' because permission for this field is 'Either', but the required authorization was not provided or is invalid.
```

I wonder why?
