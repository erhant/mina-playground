import {
  MerkleMap,
  Field,
  SmartContract,
  state,
  State,
  method,
  AccountUpdate,
  Mina,
  MerkleMapWitness,
  PrivateKey,
  Permissions,
  DeployArgs,
} from 'snarkyjs';

export class BasicMerkleMapContract extends SmartContract {
  @state(Field) mapRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(initialRoot: Field) {
    this.mapRoot.set(initialRoot);
  }

  @method update(keyWitness: MerkleMapWitness, keyToChange: Field, valueBefore: Field, incrementAmount: Field) {
    // assert current root
    const initialRoot = this.mapRoot.get();
    this.mapRoot.assertEquals(initialRoot);

    // assert initial state matches what we expect
    const [rootBefore, key] = keyWitness.computeRootAndKey(valueBefore);
    rootBefore.assertEquals(initialRoot);
    key.assertEquals(keyToChange);

    // assert that increment amount is < 10
    incrementAmount.assertLt(Field(10));

    // compute the root after incrementing & update state
    const rootAfter = keyWitness.computeRootAndKey(valueBefore.add(incrementAmount))[0];
    this.mapRoot.set(rootAfter);
  }

  /**
   * Deploys a BasicMerkleMapContract contract with a random private key
   * @param owner fee payer & deployer account
   * @param map merkle map for the initial root
   * @returns the contract instance and its private key
   */
  static async deployTx(owner: PrivateKey, map: MerkleMap): Promise<[BasicMerkleMapContract, PrivateKey]> {
    // create a public/private key pair. The public key is our address and where we will deploy to
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();

    // create an instance of our smart contract and deploy it to zkAppAddress
    const contract = new BasicMerkleMapContract(zkAppAddress);
    const deployTxn = await Mina.transaction(owner, () => {
      AccountUpdate.fundNewAccount(owner);
      contract.deploy({ zkappKey: zkAppPrivateKey });
      contract.initState(map.getRoot());
      // contract.sign(zkAppPrivateKey); // deprecated
      contract.requireSignature();
    });
    await deployTxn.sign([zkAppPrivateKey]).send();
    console.log('contract deployed.');

    return [contract, zkAppPrivateKey];
  }

  /**
   * Makes an update transaction
   * @param account message sender
   * @param zkAppPrivateKey private key of contract
   * @param witness witness
   * @param keyToChange key
   * @param incrementAmount incrementAmount
   */
  async updateTx(
    account: PrivateKey,
    zkAppPrivateKey: PrivateKey,
    witness: MerkleMapWitness,
    keyToChange: Field,
    incrementAmount: Field
  ) {
    const tx = await Mina.transaction(account, () => {
      this.update(
        witness,
        keyToChange,
        Field(0), // leafs in new trees start at a state of 0
        incrementAmount
      );
      // this.sign(zkAppPrivateKey);
      this.requireSignature();
    });
    await tx.sign([zkAppPrivateKey]).send();
  }
}

export async function basicMerkleMapExample(owner: PrivateKey) {
  // create a new merkle tree
  const map = new MerkleMap();

  // deploy the smart contract
  const [contract, basicTreeZkAppPrivateKey] = await BasicMerkleMapContract.deployTx(owner, map);

  // set increment values
  const incrementKey = Field(100);
  const incrementAmount = Field(2);

  // get the witness for the current tree
  const witness = map.getWitness(incrementKey);

  // update the map locally
  map.set(incrementKey, map.get(incrementKey).add(incrementAmount));

  // update the smart contract
  await contract.updateTx(owner, basicTreeZkAppPrivateKey, witness, incrementKey, incrementAmount);

  // compare the root of the smart contract map to our local map
  console.log(`BasicMerkleMap: local map root hash after tx: ${map.getRoot()}`);
  console.log(`BasicMerkleMap: smart contract map hash after tx: ${contract.mapRoot.get()}`);
}
