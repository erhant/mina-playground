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
  DeployArgs,
  Permissions,
  PrivateKey,
} from 'snarkyjs';

// The height variable determines how many leaves are available to your application.
// A height of 20 for example will lead to a tree with 2^(20-1), or 524,288 leaves.
const TREE_HEIGHT = 20;

class MerkleWitness20 extends MerkleWitness(TREE_HEIGHT) {}

export class BasicMerkleTreeContract extends SmartContract {
  @state(Field) treeRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(initialRoot: Field) {
    this.treeRoot.set(initialRoot);
  }

  @method update(leafWitness: MerkleWitness20, numberBefore: Field, incrementAmount: Field) {
    // assert current root
    const initialRoot = this.treeRoot.get();
    this.treeRoot.assertEquals(initialRoot);

    // assert initial state matches what we expect
    const rootBefore = leafWitness.calculateRoot(numberBefore);
    rootBefore.assertEquals(initialRoot);

    // assert that increment amount is < 10
    incrementAmount.assertLt(Field(10));

    // compute the root after incrementing & update state
    const rootAfter = leafWitness.calculateRoot(numberBefore.add(incrementAmount));
    this.treeRoot.set(rootAfter);
  }

  /**
   * Deploys a BasicMerkleTreeContract contract with a random private key
   * @param owner fee payer & deployer account
   * @param tree merkle tree for the initial root
   * @returns the contract instance and its private key
   */
  static async deployTx(owner: PrivateKey, tree: MerkleTree): Promise<[BasicMerkleTreeContract, PrivateKey]> {
    // create a public/private key pair. The public key is our address and where we will deploy to
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();

    // create an instance of our Square smart contract and deploy it to zkAppAddress
    const contract = new BasicMerkleTreeContract(zkAppAddress);
    const deployTxn = await Mina.transaction(owner, () => {
      AccountUpdate.fundNewAccount(owner);
      // contract.requireSignature();
      contract.deploy({ zkappKey: zkAppPrivateKey });
      contract.initState(tree.getRoot());
      contract.sign(zkAppPrivateKey);
    });
    await deployTxn.send();
    console.log('contract deployed.');

    return [contract, zkAppPrivateKey];
  }

  /**
   * Makes an update transaction
   * @param account message sender
   * @param zkAppPrivateKey private key of contract
   * @param witness witness
   * @param incrementAmount incrementAmount
   */
  async updateTx(account: PrivateKey, zkAppPrivateKey: PrivateKey, witness: MerkleWitness20, incrementAmount: Field) {
    const tx = await Mina.transaction(account, () => {
      // contract.requireSignature();
      this.update(
        witness,
        Field(0), // leafs in new trees start at a state of 0
        incrementAmount
      );
      this.sign(zkAppPrivateKey);
    });
    // await tx.sign([zkAppPrivateKey]).send();
    await tx.send();
  }
}

export async function basicMerkleTreeExample(owner: PrivateKey) {
  // create a new merkle tree
  const tree = new MerkleTree(TREE_HEIGHT);

  // deploy the smart contract
  const [contract, basicTreeZkAppPrivateKey] = await BasicMerkleTreeContract.deployTx(owner, tree);

  // set increment values
  const incrementIndex = 522n;
  const incrementAmount = Field(9);

  // get the witness for the current tree
  const witness = new MerkleWitness20(tree.getWitness(incrementIndex));

  // update the leaf locally
  tree.setLeaf(incrementIndex, incrementAmount);

  // update the smart contract
  await contract.updateTx(owner, basicTreeZkAppPrivateKey, witness, incrementAmount);

  // compare the root of the smart contract tree to our local tree
  console.log(`BasicMerkleTree: local tree root hash after tx: ${tree.getRoot()}`);
  console.log(`BasicMerkleTree: smart contract root hash after tx: ${contract.treeRoot.get()}`);
}
