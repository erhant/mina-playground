import "../styles/globals.css";
import { useEffect, useState } from "react";
import "./reactCOIServiceWorker";

import ZkappWorkerClient from "./zkappWorkerClient";

import { PublicKey, Field, PrivateKey, Bool, MerkleTree, Poseidon } from "snarkyjs";
import Head from "next/head";
import SetupInfo from "../components/SetupInfo";
import AccountDoesNotExist from "../components/AccountDoesNotExist";
import MainDisplay from "../components/MainDisplay";
import { OffchainStorageAPI } from "../api/storage";
import { TextInput } from "@mantine/core";
import constants from "../constants";
import { MinaKeyShareContract, OffchainStorageMerkleWitness } from "../../contracts/src/MinaKeyShareContract";
import { encryptSecret, publicKeysToIndex } from "../utils";

async function initializeKey(
  senderSk: PrivateKey,
  recipientPk: PublicKey,
  contract: MinaKeyShareContract,
  offchainStorage: OffchainStorageAPI
) {
  // for the sake of example, the sender sends to themselves
  const senderPk = senderSk.toPublicKey();

  // index is (senderPk + recipientPk).x.toFields()
  const index = publicKeysToIndex(senderPk, recipientPk);
  const randomFields = [Field.random(), Field.random(), Field.random()];
  // console.log('\tSETTING:', randomFields.toString());
  const encryptedRandomFields = encryptSecret(senderPk, recipientPk, randomFields);
  // console.log(`SET ${index.toString()} --> ${newValue.toString()}`);
  // current root
  const root = contract.keysRoot.get();

  // get off-chain stored tree
  const idx2fields = await offchainStorage.getItems(constants.KEY_TREE_HEIGHT, root);

  // generate local tree
  const tree = new MerkleTree(constants.KEY_TREE_HEIGHT);
  for (const [idx, fields] of idx2fields) {
    tree.setLeaf(idx, Poseidon.hash(fields));
  }

  // check current value at index
  const leafIsEmpty = Bool(!idx2fields.has(index));
  const oldValue: Field[] = leafIsEmpty.toBoolean() ? [Field(0)] : idx2fields.get(index)!;

  // make a witness on the current tree
  const witness = tree.getWitness(index);
  const circuitWitness = new OffchainStorageMerkleWitness(witness);

  // update tree & get new root
  tree.setLeaf(index, Poseidon.hash(encryptedRandomFields));
  // const newRoot = tree.getRoot(); // what to do with this guy?
  idx2fields.set(index, encryptedRandomFields);

  // store off-chain
  const [newRootNumber, newRootSignature] = await offchainStorage.setItems(constants.KEY_TREE_HEIGHT, idx2fields);

  return {
    leafIsEmpty,
    oldValueHash: Poseidon.hash(oldValue),
    newValueHash: Poseidon.hash(encryptedRandomFields),
    circuitWitness,
    newRootNumber,
    newRootSignature,
  };
}

export default function App() {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentRoot: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
    offchainStorage: null as null | OffchainStorageAPI,
  });
  // some public key to share key with
  let [peerPublicKey, setPeerPublicKey] = useState("B62qk1gXnUqtzjw9Ygr6DGGuVzTUaqsRgRSHGyyChpdoQeb8sRyCkWB");

  // setup snarkyjs, mina connection, and the blockchain
  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup) return;

      // load snarkyJS
      const zkappWorkerClient = new ZkappWorkerClient();
      console.log("Loading SnarkyJS...");
      await zkappWorkerClient.loadSnarkyJS();
      console.log("done");
      await zkappWorkerClient.setActiveInstanceToBerkeley();

      // instantiate Mina
      const mina = (window as any).mina;
      if (mina == null) {
        setState((state) => ({ ...state, hasWallet: false }));
        return;
      }

      // load user account
      const publicKeyBase58: string = (await mina.requestAccounts())[0];
      const publicKey = PublicKey.fromBase58(publicKeyBase58);
      console.log("using key", publicKey.toBase58());

      // check account
      console.log("checking if account exists...");
      const res = await zkappWorkerClient.fetchAccount({
        publicKey: publicKey!,
      });
      const accountExists = res.error == null;

      // load & compile the contract from files
      console.log("loading contract...");
      await zkappWorkerClient.loadContract();
      console.log("compiling zkApp");
      await zkappWorkerClient.compileContract();
      console.log("zkApp compiled");

      // initialize zkApp with the compiled file at the given address
      const zkappPublicKey = PublicKey.fromBase58(constants.ZKAPP_ADDRESS);
      await zkappWorkerClient.initZkappInstance(zkappPublicKey);

      // fetch initial contract state
      console.log("getting zkApp state...");
      await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
      const currentRoot = await zkappWorkerClient.getRoot();
      console.log("current state:", currentRoot.toString());

      setState((state) => ({
        ...state,
        zkappWorkerClient,
        hasWallet: true,
        hasBeenSetup: true,
        publicKey,
        zkappPublicKey,
        accountExists,
        currentRoot,
        offchainStorage: new OffchainStorageAPI(constants.STORAGE_SERVER_ADDR, zkappPublicKey),
      }));
    })();
  }, [state.hasBeenSetup]);

  // wait for account to exist, if it didn't exist before.
  useEffect(() => {
    (async () => {
      if (!(state.hasBeenSetup && !state.accountExists)) return;

      // attempt to connect indefinitely
      while (true) {
        console.log("checking if account exists...");
        const res = await state.zkappWorkerClient!.fetchAccount({
          publicKey: state.publicKey!,
        });

        // if there is no error, then account exists for sure
        if (res.error == null) break;

        // wait few seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // update state with the account
      setState({ ...state, accountExists: true });
    })();
  }, [state, state.hasBeenSetup]);

  // handle send transaction
  const onSendTransaction = async () => {
    if (!state.zkappWorkerClient || peerPublicKey == "") return;

    // update UI to indicate transaction
    setState({ ...state, creatingTransaction: true });
    console.log("sending a transaction...");

    // fetch account, create & prove tx
    await state.zkappWorkerClient.fetchAccount({
      publicKey: state.publicKey!,
    });

    await state.zkappWorkerClient.createUpdateTransaction();
    console.log("creating proof...");
    await state.zkappWorkerClient.proveUpdateTransaction();
    console.log("getting Transaction JSON...");
    const transactionJSON = await state.zkappWorkerClient.getTransactionJSON();

    // send tx
    console.log("requesting send transaction...");
    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: constants.TX_FEE_DECIMAL, // pay a fixed fee
        memo: "",
      },
    });
    console.log("see transaction at https://berkeley.minaexplorer.com/transaction/" + hash);

    // update state
    setState({ ...state, creatingTransaction: false });
  };

  // handle refresh state
  const onRefreshCurrentRoot = async () => {
    console.log("getting zkApp state...");
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const currentRoot = await state.zkappWorkerClient!.getRoot();
    console.log("current root:", currentRoot.toString());

    setState({ ...state, currentRoot });
  };

  return (
    <>
      <Head>
        <title>Mina Key-Share</title>
        <meta name="description" content="A key-sharing app with Mina" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <SetupInfo hasBeenSetup={state.hasBeenSetup} hasWallet={state.hasWallet} />
        <AccountDoesNotExist
          accountExists={state.accountExists}
          hasBeenSetup={state.hasBeenSetup}
          address={state.publicKey}
        />
        <MainDisplay
          accountExists={state.accountExists}
          hasBeenSetup={state.hasBeenSetup}
          onSendTransaction={onSendTransaction}
          onRefreshCurrentRoot={onRefreshCurrentRoot}
          currentRoot={state.currentRoot}
          creatingTransaction={state.creatingTransaction}
        />
        <TextInput
          label="Public Key (base58)"
          value={peerPublicKey}
          onChange={(event) => setPeerPublicKey(event.currentTarget.value)}
        />
      </main>
    </>
  );
}
