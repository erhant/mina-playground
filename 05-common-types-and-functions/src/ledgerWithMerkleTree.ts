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
    // assert initial state
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
    // (a) existing recipient
    const rootRecipientBefore = recipientWitness.calculateRoot(
      Poseidon.hash([Field(recipientBalanceBefore), Poseidon.hash(recipientPublicKey.toFields())])
    );
    // (b) new recipient (no public key)
    const rootRecipientBeforeEmpty = recipientWitness.calculateRoot(Field(0));
    const isNewRecipientAccount = rootSenderAfter.equals(rootRecipientBeforeEmpty);

    // check requirements on the recipient state before receiving
    const recipientAccountPassesRequirements = Circuit.if(
      isNewRecipientAccount,
      recipientBalanceBefore.equals(Field(0)), // new account has 0 balance
      rootSenderAfter.equals(rootRecipientBefore) // (?)
    );

    recipientAccountPassesRequirements.assertTrue();

    // compute the recipient state after receiving
    const rootRecipientAfter = recipientWitness.calculateRoot(
      Poseidon.hash([Field(recipientBalanceBefore).add(sendAmount), Poseidon.hash(recipientPublicKey.toFields())])
    );

    // set the new ledgerRoot
    this.ledgerRoot.set(rootRecipientAfter);
  }

  async sendBalanceTx(
    owner: PrivateKey,
    zkAppPrivateKey: PrivateKey,
    sendWitness: MerkleWitness20,
    recipientWitness: MerkleWitness20,
    senderInitialBalance: Field,
    recipientInitialBalance: Field,
    senderPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    senderSignature: Signature,
    sendAmount: Field
  ) {
    const tx = await Mina.transaction(owner, () => {
      this.sendBalance(
        sendWitness,
        recipientWitness,
        senderInitialBalance,
        recipientInitialBalance,
        senderPublicKey,
        recipientPublicKey,
        senderSignature,
        sendAmount
      );
      this.requireSignature();
    });
    await tx.sign([zkAppPrivateKey]).send();
  }

  static async deployTx(owner: PrivateKey, tree: MerkleTree): Promise<[LedgerContract, PrivateKey]> {
    // create a public/private key pair. The public key is our address and where we will deploy to
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();

    // create an instance of our smart contract and deploy it to zkAppAddress
    const contract = new LedgerContract(zkAppAddress);
    const deployTxn = await Mina.transaction(owner, () => {
      AccountUpdate.fundNewAccount(owner);
      contract.deploy({ zkappKey: zkAppPrivateKey });
      contract.initState(tree.getRoot());
      contract.requireSignature();
    });
    await deployTxn.sign([zkAppPrivateKey]).send();
    console.log('contract deployed.');

    return [contract, zkAppPrivateKey];
  }
}

/**
 * An example of sending funds between two accounts. Both accounts exist in the initial tree for this example,
 * but it would also work if the recipient did not exist in the initial tree; meaning that they have an initial
 * balance of 0.
 * @param owner contract deployer
 */
export async function ledgerContractExample(owner: PrivateKey) {
  // create a new merkle tree
  const tree = new MerkleTree(TREE_HEIGHT);

  // prepare sender account
  const senderAccountIndex = 10n;
  const senderPrivateKey = PrivateKey.random();
  const senderPublicKey = senderPrivateKey.toPublicKey();
  const senderInitialBalance = Field(100);

  // prepare recipient account
  const recipientAccountIndex = 500n;
  const recipientInitialBalance = Field(7);
  const recipientPrivateKey = PrivateKey.random();
  const recipientPublicKey = recipientPrivateKey.toPublicKey();

  // sender will send this much
  const sendAmount = Field(12);

  // initialize the local tree with the initial balances
  tree.setLeaf(senderAccountIndex, Poseidon.hash([senderInitialBalance, Poseidon.hash(senderPublicKey.toFields())]));
  tree.setLeaf(
    recipientAccountIndex,
    Poseidon.hash([recipientInitialBalance, Poseidon.hash(recipientPublicKey.toFields())])
  );

  /////////////// deploy the contract with the initial tree ///////////////
  const [contract, ledgerZkAppPrivateKey] = await LedgerContract.deployTx(owner, tree);

  /////////////// send from the sender to the recipient ///////////////
  // update balances
  const senderNewBalance = senderInitialBalance.sub(sendAmount);
  const recipientNewBalance = recipientInitialBalance.add(sendAmount);

  // make witnesses for the sender & update tree
  const sendWitness = new MerkleWitness20(tree.getWitness(senderAccountIndex));
  tree.setLeaf(senderAccountIndex, Poseidon.hash([senderNewBalance, Poseidon.hash(senderPublicKey.toFields())]));

  // make witnesses for the recipient & update tree
  const recipientWitness = new MerkleWitness20(tree.getWitness(recipientAccountIndex));
  tree.setLeaf(
    recipientAccountIndex,
    Poseidon.hash([recipientNewBalance, Poseidon.hash(recipientPublicKey.toFields())])
  );

  // sender should sign [root || amount || recipient]
  const signature = Signature.create(
    senderPrivateKey,
    [contract.ledgerRoot.get(), sendAmount].concat(recipientPublicKey.toFields())
  );

  // send transaction
  console.log('\tSending funds...');
  await contract.sendBalanceTx(
    owner,
    ledgerZkAppPrivateKey,
    sendWitness,
    recipientWitness,
    senderInitialBalance,
    recipientInitialBalance,
    senderPublicKey,
    recipientPublicKey,
    signature,
    sendAmount
  );

  console.log(`LedgerContract: local tree root hash after send1: ${tree.getRoot()}`);
  console.log(`LedgerContract: smart contract root hash after send1: ${contract.ledgerRoot.get()}`);
}
