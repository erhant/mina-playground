import { 
  MerkleMap,
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
  

export class BasicMerkleMapContract extends SmartContract {
  @state(Field) mapRoot = State<Field>();

  @method init(initialRoot: Field) {
    this.mapRoot.set(initialRoot);
  }

  @method update(
    keyWitness: MerkleMapWitness,
    keyToChange: Field,
    valueBefore: Field,
    incrementAmount: Field
  ) {
    const initialRoot = this.mapRoot.get();
    this.mapRoot.assertEquals(initialRoot);

    incrementAmount.assertLt(Field(10));

    // check the initial state matches what we expect
    const [rootBefore, key] = mapWitness.computeRootAndKey(valueBefore);
    rootBefore.assertEquals(initialRoot);

    key.assertEquals(keyToChange);

    // compute the root after incrementing
    const [rootAfter, _] = mapWitness.computeRootAndKey(
      valueBefore.add(incrementAmount)
    );

    // set the new root
    this.treeRoot.set(rootAfter);
  }
}

export async function basicMerkleMapExample(deployerAccount: Account) {
  const map = new MerkleMap();

  const key = Field(100);
  const value = Field(50);

  map.set(key, value);

  console.log('value for key', key.toString() + ':', map.get(key));

  // get the witness for current map
  const witness = map.getWitness(key); 

  const txn1 = await Mina.transaction(deployerAccount, () => {
    zkapp.update(
      contract.update(
        witness,
        key,
        Field(0), //values start in state zero
        Field(5)
      );
    );
  });
}
