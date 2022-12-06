import {
  Field,
  SmartContract,
  state,
  State,
  method,
  MerkleWitness,
  AccountUpdate,
  MerkleTree,
  Mina,
  Account,
} from 'snarkyjs';

// The height variable determines how many leaves are available to your application.
//  A height of 20 for example will lead to a tree with 2^(20-1), or 524,288 leaves.
const TREE_HEIGHT = 20;

class MerkleWitness20 extends MerkleWitness(TREE_HEIGHT) {}

export class BasicMerkleTreeContract extends SmartContract {
  @state(Field) treeRoot = State<Field>();

  @method init(initialRoot: Field) {
    this.treeRoot.set(initialRoot);
  }

  @method update(
    leafWitness: MerkleWitness20,
    numberBefore: Field,
    incrementAmount: Field
  ) {
    const initialRoot = this.treeRoot.get();
    this.treeRoot.assertEquals(initialRoot);

    incrementAmount.assertLt(Field(10));

    // check the initial state matches what we expect
    const rootBefore = leafWitness.calculateRoot(numberBefore);
    rootBefore.assertEquals(initialRoot);

    // compute the root after incrementing
    const rootAfter = leafWitness.calculateRoot(
      numberBefore.add(incrementAmount)
    );

    // set the new root
    this.treeRoot.set(rootAfter);
  }
}

export async function basicMerkleTreeExample(deployerAccount: Account) {
  // initialize the zkapp
  const zkapp = new BasicMerkleTreeContract(basicTreeZkAppAddress);

  // create a new tree
  const tree = new MerkleTree(TREE_HEIGHT);
  class MerkleWitness20 extends MerkleWitness(TREE_HEIGHT) {}

  // deploy the smart contract
  const deployTxn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkapp.deploy({ zkappKey: basicTreeZkAppPrivateKey });
    // get the root of the new tree to use as the initial tree root
    zkapp.initState(tree.getRoot());
    zkapp.sign(basicTreeZkAppPrivateKey);
  });
  await deployTxn.send();

  const incrementIndex = 522n;
  const incrementAmount = Field(9);

  // get the witness for the current tree
  const witness = new MerkleWitness20(tree.getWitness(incrementIndex));

  // update the leaf locally
  tree.setLeaf(incrementIndex, incrementAmount);

  // update the smart contract
  const txn1 = await Mina.transaction(deployerAccount, () => {
    zkapp.update(
      witness,
      Field(0), // leafs in new trees start at a state of 0
      incrementAmount
    );
    zkapp.sign(basicTreeZkAppPrivateKey);
  });
  await txn1.send();

  // compare the root of the smart contract tree to our local tree
  console.log(
    `BasicMerkleTree: local tree root hash after send1: ${tree.getRoot()}`
  );
  console.log(
    `BasicMerkleTree: smart contract root hash after send1: ${zkapp.treeRoot.get()}`
  );
}
