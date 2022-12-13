import { Mina, isReady, PublicKey, PrivateKey, Field, fetchAccount } from "snarkyjs";
import type { MinaKeyShareContract } from "../../contracts/src/MinaKeyShareContract";
type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

export type WorkerFunctions = keyof typeof functions;
export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};
export type ZkappWorkerReponse = {
  id: number;
  data: any;
};

const state = {
  MinaKeyShareContract: null as null | typeof MinaKeyShareContract,
  zkapp: null as null | MinaKeyShareContract,
  transaction: null as null | Transaction,
};

const functions = {
  loadSnarkyJS: async (args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (args: {}) => {
    const Berkeley = Mina.Network("https://proxy.berkeley.minaexplorer.com/graphql");
    Mina.setActiveInstance(Berkeley);
  },
  loadContract: async (args: {}) => {
    const { MinaKeyShareContract } = await import("../../contracts/build/src/MinaKeyShareContract.js");
    state.MinaKeyShareContract = MinaKeyShareContract;
  },
  compileContract: async (args: {}) => {
    const res = await state.MinaKeyShareContract!.compile();
    console.log("Verification key hash:", res.verificationKey.hash);
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.MinaKeyShareContract!(publicKey);
  },
  getRoot: async (args: {}) => {
    const currentRoot = await state.zkapp!.keysRoot.get();
    return JSON.stringify(currentRoot.toJSON());
  },
  getRootNumber: async (args: {}) => {
    const currentRootNumber = await state.zkapp!.keysNumber.get();
    return JSON.stringify(currentRootNumber.toJSON());
  },
  createUpdateTransaction: async (args: {}) => {
    const transaction = await Mina.transaction(() => {
      state.zkapp!.update(); // TODO
    });
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// changed `process.browser` to `typeof window !== 'undefined'`
if (typeof window !== "undefined") {
  addEventListener("message", async (event: MessageEvent<ZkappWorkerRequest>) => {
    const returnData = await functions[event.data.fn](event.data.args);

    const message: ZkappWorkerReponse = {
      id: event.data.id,
      data: returnData,
    };
    postMessage(message);
  });
}
