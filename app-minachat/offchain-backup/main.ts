import { OffChainStorageTestContract } from "./OffChainStorageTestContract.js";
import {
  isReady,
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleTree,
  MerkleWitness,
  Poseidon,
  fetchAccount,
  Bool,
} from "snarkyjs";

import { OffChainStorage } from "./index.js";

const height = 2;
import XMLHttpRequestTs from "xmlhttprequest-ts";
const NodeXMLHttpRequest =
  XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

let transactionFee = 10_000_000;

(async function main() {
  await isReady;

  console.log("SnarkyJS loaded");

  const USE_LOCAL = true;

  const Local = Mina.LocalBlockchain();
  if (USE_LOCAL) {
    Mina.setActiveInstance(Local);
  } else {
    const Berkeley = Mina.Network(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);
  }

  let deployerAccount: PrivateKey;
  let zkAppPrivateKey: PrivateKey;
  if (USE_LOCAL) {
    deployerAccount = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
  } else {
    deployerAccount = PrivateKey.fromBase58(process.argv[2]);
    zkAppPrivateKey = PrivateKey.fromBase58(process.argv[3]);

    let response = await fetchAccount({
      publicKey: deployerAccount.toPublicKey(),
    });
    if (response.error) throw Error(response.error.statusText);
    let { nonce, balance } = response.account;
    console.log(
      `Using fee payer account with nonce ${nonce}, balance ${balance}`
    );
  }

  // ----------------------------------------------------

  class OffchainStorageMerkleWitness extends MerkleWitness(height) {} // why 2?

  // create a destination we will deploy the smart contract to
  const zkAppAccount = zkAppPrivateKey.toPublicKey();

  console.log("using zkApp account at", zkAppAccount.toBase58());

  const serverAddress = "http://localhost:3001";

  const serverPublicKey = await OffChainStorage.getPublicKey(
    serverAddress,
    NodeXMLHttpRequest
  );

  if (!USE_LOCAL) {
    console.log("Compiling smart contract...");
    await OffChainStorageTestContract.compile();
  }

  let isDeployed = false;
  if (!USE_LOCAL) {
    let response = await fetchAccount({ publicKey: zkAppAccount });
    if (response.error == null) {
      isDeployed = true;
    }
  }

  const zkAppInstance = new OffChainStorageTestContract(
    zkAppAccount,
    serverPublicKey
  );

  // deploy zkapp if not deployed before
  if (!isDeployed) {
    console.log("Deploying zkapp...");
    const deploy_txn = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
        zkAppInstance.sign(zkAppPrivateKey);
      }
    );
    const res = await deploy_txn.send();

    if (!USE_LOCAL) {
      const hash = await res.hash(); // This will change in a future version of SnarkyJS
      if (hash == null) {
        console.log("error sending transaction (see above)");
      } else {
        console.log(
          "See deploy transaction at",
          "https://berkeley.minaexplorer.com/transaction/" + hash
        );
      }
    } else {
      isDeployed = true;
    }
  }

  // if deploying, wait for it to be deployed
  while (!isDeployed) {
    console.log("waiting for zkApp to be deployed...");
    let response = await fetchAccount({ publicKey: zkAppAccount });
    isDeployed = response.error == null;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // get the initial state of IncrementSecret after deployment
  let root;
  if (USE_LOCAL) {
    root = await zkAppInstance.root.get();
  } else {
    root = (await zkAppInstance.root.fetch())!;
  }
  console.log("state after init:", root.toString());

  const make_transaction = async (root: Field) => {
    const tree = new MerkleTree(height);

    const idx2fields = await OffChainStorage.get(
      serverAddress,
      zkAppAccount,
      height,
      root,
      NodeXMLHttpRequest
    );

    for (let [idx, fields] of idx2fields) {
      tree.setLeaf(BigInt(idx), Poseidon.hash(fields));
    }

    const index = BigInt(Math.floor(Math.random() * (height - 1)));
    const leafIsEmpty = Bool(!idx2fields.has(index));

    const oldNum = leafIsEmpty.toBoolean()
      ? Field(0)
      : idx2fields.get(index)![0];
    const newNum = oldNum.add(1); // increments by 1
    const witness = tree.getWitness(BigInt(index));
    const circuitWitness = new OffchainStorageMerkleWitness(witness);
    tree.setLeaf(BigInt(index), Poseidon.hash([newNum]));
    const newRoot = tree.getRoot();

    console.log(
      "updating",
      index,
      "from",
      oldNum.toString(),
      "to",
      newNum.toString()
    );

    console.log("updating to new root", newRoot.toString()); // new root
    console.log("root from ", zkAppInstance.root.get().toString()); // old root

    // update local tree
    idx2fields.set(index, [newNum]);

    // store these on the off-chain storage
    const [newRootNumber, newRootSignature] =
      await OffChainStorage.requestStore(
        serverAddress,
        zkAppAccount,
        height,
        idx2fields,
        NodeXMLHttpRequest
      );

    // fetch account if not local
    if (!USE_LOCAL) {
      await fetchAccount({ publicKey: deployerAccount.toPublicKey() });
    }

    // create transaction
    const txn1 = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: transactionFee },
      () => {
        zkAppInstance.update(
          leafIsEmpty,
          oldNum,
          newNum,
          circuitWitness,
          newRoot,
          newRootNumber,
          newRootSignature
        );
        zkAppInstance.sign(zkAppPrivateKey);
      }
    );

    // create proof
    if (!USE_LOCAL) {
      console.log("Creating an execution proof...");
      const time0 = Date.now();
      await txn1.prove();
      const time1 = Date.now();
      console.log("creating proof took", (time1 - time0) / 1e3, "seconds");
    }

    // send transaction
    console.log("Sending the transaction...");
    const res = await txn1.send();

    let root2: Field;
    if (!USE_LOCAL) {
      const hash = await res.hash(); // This will change in a future version of SnarkyJS
      if (hash == null) {
        console.log("error sending transaction (see above)");
      } else {
        console.log(
          "See transaction at",
          "https://berkeley.minaexplorer.com/transaction/" + hash
        );
      }

      let stateChange = false;

      while (!stateChange) {
        console.log(
          "waiting for zkApp state to change... (current state: ",
          root.toString() + ")"
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        root2 = await zkAppInstance.root.fetch();
        stateChange = root2 != null && root2.equals(root).not().toBoolean();
      }
    } else {
      root2 = await zkAppInstance.root.get();
    }

    console.log("state after txn:", root2.toString());

    return root2;
  };

  let nextRoot = root;
  for (;;) {
    nextRoot = await make_transaction(nextRoot);
  }

  // ----------------------------------------------------

  // console.log('Shutting down');

  // await shutdown();
})().catch((e) => {
  console.log("error", e);
});
