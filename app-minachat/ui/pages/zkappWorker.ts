import { Mina, isReady, PublicKey, PrivateKey, Field, fetchAccount } from "snarkyjs";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { Add } from "../../contracts/src/Add";

const state = {
  Add: null as null | typeof Add,
  zkapp: null as null | Add,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  loadSnarkyJS: async (args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (args: {}) => {
    // changed from `Mina.BerkeleyQANet` to `Mina.Network`
    const Berkeley = Mina.Network("https://proxy.berkeley.minaexplorer.com/graphql");
    Mina.setActiveInstance(Berkeley);
  },
  loadContract: async (args: {}) => {
    const { Add } = await import("../../contracts/build/src/Add.js");
    state.Add = Add;
  },
  compileContract: async (args: {}) => {
    const res = await state.Add!.compile();
    console.log("VK:", res.verificationKey.hash);
    console.log("Expected:", "4851262813207464979627140462974063613924095144061541973375101057533539242846");
    // should be: 4851262813207464979627140462974063613924095144061541973375101057533539242846
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Add!(publicKey);
  },
  getNum: async (args: {}) => {
    const currentNum = await state.zkapp!.num.get();
    return JSON.stringify(currentNum.toJSON());
  },
  createUpdateTransaction: async (args: {}) => {
    const transaction = await Mina.transaction(() => {
      state.zkapp!.update();
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

// ---------------------------------------------------------------------------------------

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
