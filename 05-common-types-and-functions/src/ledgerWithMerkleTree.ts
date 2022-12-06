import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  MerkleWitness,
  Poseidon,
  PublicKey,
  Signature,
  Circuit,
  Account,
  AccountUpdate,
  MerkleTree,
  Mina,
  PrivateKey,
} from 'snarkyjs';

// The height variable determines how many leaves are available to your application.
// A height of 20 for example will lead to a tree with 2^(20-1), or 524,288 leaves.
const TREE_HEIGHT = 20;
class MerkleWitness20 extends MerkleWitness(TREE_HEIGHT) {}

export class LedgerContract extends SmartContract {
  @state(Field) ledgerRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(initialLedgerRoot: Field) {
    this.ledgerRoot.set(initialLedgerRoot);
  }

  @method sendBalance(
    senderWitness: MerkleWitness20,
    recipientWitness: MerkleWitness20,
    senderBalanceBefore: Field,
    recipientBalanceBefore: Field,
    senderPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    senderSignature: Signature,
    sendAmount: Field
  ) {
    const initialLedgerRoot = this.ledgerRoot.get();
    this.ledgerRoot.assertEquals(initialLedgerRoot);

    // check the sender's signature
    senderSignature
      .verify(senderPublicKey, [initialLedgerRoot, sendAmount].concat(recipientPublicKey.toFields()))
      .assertTrue();

    // check the initial state matches what we expect
    const rootSenderBefore = senderWitness.calculateRoot(
      Poseidon.hash([Field(senderBalanceBefore), Poseidon.hash(senderPublicKey.toFields())])
    );
    rootSenderBefore.assertEquals(initialLedgerRoot);

    // sender should have enough funds
    senderBalanceBefore.assertGte(sendAmount);

    // compute the sender state after sending
    const rootSenderAfter = senderWitness.calculateRoot(
      Poseidon.hash([Field(senderBalanceBefore).sub(sendAmount), Poseidon.hash(senderPublicKey.toFields())])
    );

    // compute the possible recipient states before receiving
    const rootRecipientBefore = recipientWitness.calculateRoot(
      Poseidon.hash([Field(recipientBalanceBefore), Poseidon.hash(recipientPublicKey.toFields())])
    );
    const rootRecipientBeforeEmpty = recipientWitness.calculateRoot(Field(0));
    const isNewRecipientAccount = rootSenderAfter.equals(rootRecipientBeforeEmpty);

    // check requirements on the recipient state before receiving
    const recipientAccountPassesRequirements = Circuit.if(
      isNewRecipientAccount,
      (() => {
        // new account, balance before must be zero
        return recipientBalanceBefore.equals(Field(0));
      })(),
      (() => {
        // existing account, check existing account witness
        return rootSenderAfter.equals(rootRecipientBefore);
      })()
    );

    recipientAccountPassesRequirements.assertTrue();

    // compute the recipient state after receiving
    const rootRecipientAfter = recipientWitness.calculateRoot(
      Poseidon.hash([Field(recipientBalanceBefore).add(sendAmount), Poseidon.hash(recipientPublicKey.toFields())])
    );

    // set the new ledgerRoot
    this.ledgerRoot.set(rootRecipientAfter);
  }
}

export async function ledgerContractExample(owner: PrivateKey) {
  const ledgerZkAppPrivateKey = PrivateKey.random();
  const ledgerZkAppAddress = ledgerZkAppPrivateKey.toPublicKey();

  const tree = new MerkleTree(TREE_HEIGHT);

  const senderInitialBalance = Field(100);
  const recipientInitialBalance = Field(7);

  const senderPrivateKey = PrivateKey.random();
  const senderPublicKey = senderPrivateKey.toPublicKey();

  const recipientPrivateKey = PrivateKey.random();
  const recipientPublicKey = recipientPrivateKey.toPublicKey();

  const senderAccount = 10;
  const recipientAccount = 500;

  tree.setLeaf(BigInt(senderAccount), Poseidon.hash([senderInitialBalance, Poseidon.hash(senderPublicKey.toFields())]));
  tree.setLeaf(
    BigInt(recipientAccount),
    Poseidon.hash([recipientInitialBalance, Poseidon.hash(recipientPublicKey.toFields())])
  );

  const zkapp = new LedgerContract(ledgerZkAppAddress);

  const deployTxn = await Mina.transaction(owner, () => {
    AccountUpdate.fundNewAccount(owner);
    zkapp.deploy({ zkappKey: ledgerZkAppPrivateKey });
    zkapp.initState(tree.getRoot());
    zkapp.sign(ledgerZkAppPrivateKey);
  });
  await deployTxn.send();

  // --------------------------------------
  // send from the sender to the recipient

  const amount = Field(12);

  const newSenderBalance = senderInitialBalance.sub(amount);

  const sendWitness1 = new MerkleWitness20(tree.getWitness(BigInt(senderAccount)));
  tree.setLeaf(BigInt(senderAccount), Poseidon.hash([newSenderBalance, Poseidon.hash(senderPublicKey.toFields())]));
  const recipientWitness1 = new MerkleWitness20(tree.getWitness(BigInt(recipientAccount)));

  tree.setLeaf(
    BigInt(recipientAccount),
    Poseidon.hash([recipientInitialBalance.add(amount), Poseidon.hash(recipientPublicKey.toFields())])
  );

  const signature1 = Signature.create(
    senderPrivateKey,
    [zkapp.ledgerRoot.get(), amount].concat(recipientPublicKey.toFields())
  );

  const txn1 = await Mina.transaction(owner, () => {
    zkapp.sendBalance(
      sendWitness1,
      recipientWitness1,
      senderInitialBalance,
      recipientInitialBalance,
      senderPublicKey,
      recipientPublicKey,
      signature1,
      amount
    );
    zkapp.sign(ledgerZkAppPrivateKey);
  });
  await txn1.send();

  console.log(`LedgerContract: local tree root hash after send1: ${tree.getRoot()}`);
  console.log(`LedgerContract: smart contract root hash after send1: ${zkapp.ledgerRoot.get()}`);

  // --------------------------------------
  // send from the sender to a recipient that wasn't in the account before

  const newRecipientPublicKey = PrivateKey.random().toPublicKey();
  const newRecipientAccount = 10000;

  const sendWitness2 = new MerkleWitness20(tree.getWitness(BigInt(senderAccount)));
  tree.setLeaf(
    BigInt(senderAccount),
    Poseidon.hash([newSenderBalance.sub(amount), Poseidon.hash(senderPublicKey.toFields())])
  );
  const recipientWitness2 = new MerkleWitness20(tree.getWitness(BigInt(newRecipientAccount)));

  tree.setLeaf(BigInt(newRecipientAccount), Poseidon.hash([amount, Poseidon.hash(newRecipientPublicKey.toFields())]));

  const signature2 = Signature.create(
    senderPrivateKey,
    [zkapp.ledgerRoot.get(), amount].concat(newRecipientPublicKey.toFields())
  );

  const txn2 = await Mina.transaction(owner, () => {
    zkapp.sendBalance(
      sendWitness2,
      recipientWitness2,
      newSenderBalance,
      Field(0),
      senderPublicKey,
      newRecipientPublicKey,
      signature2,
      amount
    );
    zkapp.sign(ledgerZkAppPrivateKey);
  });
  await txn2.send();

  console.log(`LedgerContract: local tree root hash after send2: ${tree.getRoot()}`);
  console.log(`LedgerContract: smart contract root hash after send2: ${zkapp.ledgerRoot.get()}`);
}
