import {
  SmartContract,
  Field,
  MerkleTree,
  state,
  State,
  method,
  DeployArgs,
  Signature,
  PublicKey,
  Permissions,
  Bool,
} from 'snarkyjs';

import { OffChainStorage, MerkleWitness8 } from 'experimental-zkapp-offchain-storage';

export class NumberTreeContract extends SmartContract {
  @state(PublicKey) storageServerPublicKey = State<PublicKey>();
  @state(Field) storageNumber = State<Field>();
  @state(Field) storageTreeRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(storageServerPublicKey: PublicKey) {
    this.storageServerPublicKey.set(storageServerPublicKey);
    this.storageNumber.set(Field(0));

    const emptyTreeRoot = new MerkleTree(8).getRoot();
    this.storageTreeRoot.set(emptyTreeRoot);
  }

  @method update(
    leafIsEmpty: Bool,
    oldNum: Field,
    num: Field,
    path: MerkleWitness8,
    storedNewRootNumber: Field,
    storedNewRootSignature: Signature
  ) {
    // assert current state
    const storedRoot = this.storageTreeRoot.get();
    this.storageTreeRoot.assertEquals(storedRoot);

    const storedNumber = this.storageNumber.get();
    this.storageNumber.assertEquals(storedNumber);

    const storageServerPublicKey = this.storageServerPublicKey.get();
    this.storageServerPublicKey.assertEquals(storageServerPublicKey);

    // new leaf must be greater than the old leaf
    let leaf = [oldNum];
    let newLeaf = [num];
    newLeaf[0].assertGt(leaf[0]);

    // update off-chain state
    // this function checks that when the update is applied to the tree represented by the
    // existing on-chain tree root, the data for the new tree is being stored by the storage server.
    const storedNewRoot = OffChainStorage.assertRootUpdateValid(
      storageServerPublicKey,
      storedNumber,
      storedRoot,
      [
        {
          leaf,
          leafIsEmpty,
          newLeaf,
          newLeafIsEmpty: Bool(false),
          leafWitness: path,
        },
      ],
      storedNewRootNumber,
      storedNewRootSignature
    );

    // update on-chain state
    this.storageTreeRoot.set(storedNewRoot);
    this.storageNumber.set(storedNewRootNumber);
  }
}
