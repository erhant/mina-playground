import "../styles/globals.css";
import { useEffect, useState } from "react";
import "./reactCOIServiceWorker";

import ZkappWorkerClient from "./zkappWorkerClient";

import { PublicKey, Field } from "snarkyjs";
import Head from "next/head";
import SetupInfo from "../components/SetupInfo";
import AccountDoesNotExist from "../components/AccountDoesNotExist";

const TX_FEE = 0.1;
const ZKAPP_ADDRESS = "B62qph2VodgSo5NKn9gZta5BHNxppgZMDUihf1g7mXreL4uPJFXDGDA";
// see: https://berkeley.minaexplorer.com/wallet/B62qph2VodgSo5NKn9gZta5BHNxppgZMDUihf1g7mXreL4uPJFXDGDA

export default function App() {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

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
      const zkappPublicKey = PublicKey.fromBase58(ZKAPP_ADDRESS);
      await zkappWorkerClient.initZkappInstance(zkappPublicKey);

      // fetch initial contract state
      console.log("getting zkApp state...");
      await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
      const currentNum = await zkappWorkerClient.getNum();
      console.log("current state:", currentNum.toString());

      setState((state) => ({
        ...state,
        zkappWorkerClient,
        hasWallet: true,
        hasBeenSetup: true,
        publicKey,
        zkappPublicKey,
        accountExists,
        currentNum,
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
    // update UI to indicate transaction
    setState({ ...state, creatingTransaction: true });
    console.log("sending a transaction...");

    //
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.publicKey!,
    });
    await state.zkappWorkerClient!.createUpdateTransaction();
    console.log("creating proof...");
    await state.zkappWorkerClient!.proveUpdateTransaction();

    console.log("getting Transaction JSON...");
    const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON();

    console.log("requesting send transaction...");
    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: TX_FEE, // pay a fixed fee
        memo: "",
      },
    });
    console.log("see transaction at https://berkeley.minaexplorer.com/transaction/" + hash);
    setState({ ...state, creatingTransaction: false });
  };

  // handle refresh state
  const onRefreshCurrentNum = async () => {
    console.log("getting zkApp state...");
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const currentNum = await state.zkappWorkerClient!.getNum();
    console.log("current state:", currentNum.toString());

    setState({ ...state, currentNum });
  };

  // TODO: refactor -> move this into components
  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <div>
        <button onClick={onSendTransaction} disabled={state.creatingTransaction}>
          Send Transaction
        </button>
        <div> Current Number in zkApp: {state.currentNum!.toString()} </div>
        <button onClick={onRefreshCurrentNum}> Get Latest State </button>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>Mina - Tutorial 4</title>
        <meta name="description" content="UI of the Mina Protocol Tutorial Series: 4" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SetupInfo hasBeenSetup={state.hasBeenSetup} hasWallet={state.hasWallet} />
      <AccountDoesNotExist accountExists={state.accountExists} hasBeenSetup={state.hasBeenSetup} />
      {mainContent}
    </div>
  );
}
