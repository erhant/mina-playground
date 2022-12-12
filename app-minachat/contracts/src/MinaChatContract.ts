import {
  Field,
  MerkleTree,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  MerkleWitness,
  Signature,
  Circuit,
  Poseidon,
  Bool,
} from 'snarkyjs';
import type { TreeUpdateType } from './types';

const KEY_TREE_HEIGHT = 32;
// class MerkleWitnessForKeys extends MerkleWitness(KEY_TREE_HEIGHT) {}
export class OffchainStorageMerkleWitness extends MerkleWitness(KEY_TREE_HEIGHT) {}

export class MinaChatContract extends SmartContract {
  // off-chain storage public key
  @state(PublicKey) serverPublicKey = State<PublicKey>();
  // merkle tree to store encrypted symmetric keys
  @state(Field) keysNumber = State<Field>();
  @state(Field) keysRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(serverPublicKey: PublicKey) {
    this.serverPublicKey.set(serverPublicKey);

    this.keysNumber.set(Field(0));
    this.keysRoot.set(new MerkleTree(KEY_TREE_HEIGHT).getRoot());
  }

  @method update(
    leafIsEmpty: Bool,
    oldValue: Field,
    newValue: Field,
    witness: OffchainStorageMerkleWitness,
    storedNewRootNumber: Field,
    storedNewRootSignature: Signature
  ) {
    console.log('Asserting states...');
    let keysRoot = this.keysRoot.get();
    this.keysRoot.assertEquals(keysRoot);

    let keysNumber = this.keysNumber.get();
    this.keysNumber.assertEquals(keysNumber);

    let serverPublicKey = this.serverPublicKey.get();
    this.serverPublicKey.assertEquals(serverPublicKey);

    // newLeaf can be a function of the existing leaf
    // newLeaf[0].assertGt(leaf[0]);
    console.log('Asserting root updates...');
    const storedNewRoot = this.assertRootUpdates(
      keysNumber,
      keysRoot,
      [
        {
          leaf: [oldValue],
          leafIsEmpty,
          newLeaf: [newValue],
          newLeafIsEmpty: Bool(false),
          leafWitness: witness,
        },
      ],
      storedNewRootNumber,
      storedNewRootSignature
    );

    console.log('Updating state...');
    this.keysRoot.set(storedNewRoot);
    this.keysNumber.set(storedNewRootNumber);
    console.log('Done!');
  }

  assertRootUpdates(
    localRootNumber: Field,
    localRoot: Field,
    updates: TreeUpdateType[],
    serverNewRootNumber: Field,
    serverNewRootSignature: Signature
  ): Field {
    const EMPTY_LEAF = Field(0);
    for (let i = 0; i < updates.length; ++i) {
      const { leaf, leafIsEmpty, newLeaf, newLeafIsEmpty, leafWitness } = updates[i];

      // check the root is starting from the correct state
      console.log('Checking current leaf...');
      const currentLeafHash = Circuit.if(leafIsEmpty, EMPTY_LEAF, Poseidon.hash(leaf));
      leafWitness.calculateRoot(currentLeafHash).assertEquals(localRoot);

      // calculate the new root after setting the leaf
      console.log('Checking new leaf...');
      const newLeafHash = Circuit.if(newLeafIsEmpty, EMPTY_LEAF, Poseidon.hash(newLeaf));
      localRoot = leafWitness.calculateRoot(newLeafHash);
    }

    // check the server is storing the stored new root
    console.log('Verifying signature...');
    serverNewRootSignature.verify(this.serverPublicKey.get(), [localRoot, serverNewRootNumber]).assertTrue();
    localRootNumber.assertLt(serverNewRootNumber);
    return localRoot;
  }
}
