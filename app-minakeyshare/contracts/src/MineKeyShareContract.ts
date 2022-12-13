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
  Bool,
  Poseidon,
} from 'snarkyjs';
import type { TreeUpdateType } from './types';
import constants from './constants/index.js';

// class MerkleWitnessForKeys extends MerkleWitness(KEY_TREE_HEIGHT) {}
export class OffchainStorageMerkleWitness extends MerkleWitness(constants.KEY_TREE_HEIGHT) {}

export class MinaKeyShareContract extends SmartContract {
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
    this.keysRoot.set(new MerkleTree(constants.KEY_TREE_HEIGHT).getRoot());
  }

  @method update(
    leafIsEmpty: Bool,
    oldValueHash: Field,
    newValueHash: Field,
    witness: OffchainStorageMerkleWitness,
    storedNewRootNumber: Field,
    storedNewRootSignature: Signature
  ) {
    let keysRoot = this.keysRoot.get();
    this.keysRoot.assertEquals(keysRoot);

    let keysNumber = this.keysNumber.get();
    this.keysNumber.assertEquals(keysNumber);

    let serverPublicKey = this.serverPublicKey.get();
    this.serverPublicKey.assertEquals(serverPublicKey);

    // do not add a new key if it exists already
    leafIsEmpty.assertTrue();

    const storedNewRoot = this.assertRootUpdates(
      keysNumber,
      keysRoot,
      [
        {
          leafHash: oldValueHash,
          leafIsEmpty,
          newLeafHash: newValueHash,
          newLeafIsEmpty: Bool(false),
          leafWitness: witness,
        },
      ],
      storedNewRootNumber,
      storedNewRootSignature
    );

    this.keysRoot.set(storedNewRoot);
    this.keysNumber.set(storedNewRootNumber);
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
      const { leafHash, leafIsEmpty, newLeafHash, newLeafIsEmpty, leafWitness } = updates[i];

      // check the root is starting from the correct state
      leafWitness.calculateRoot(Circuit.if(leafIsEmpty, EMPTY_LEAF, leafHash)).assertEquals(localRoot);

      // calculate the new root after setting the leaf
      localRoot = leafWitness.calculateRoot(Circuit.if(newLeafIsEmpty, EMPTY_LEAF, newLeafHash));
    }

    // check the server is storing the stored new root
    serverNewRootSignature.verify(this.serverPublicKey.get(), [localRoot, serverNewRootNumber]).assertTrue();
    localRootNumber.assertLt(serverNewRootNumber);
    return localRoot;
  }
}
