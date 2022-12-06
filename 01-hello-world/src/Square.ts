import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  AccountUpdate,
  Mina,
  PrivateKey,
} from 'snarkyjs';

/**
 * A Square class, which updates the state only if
 * the new value is square of existing value.
 */
export class Square extends SmartContract {
  // state variable, not initialized at first
  @state(Field) num = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });

    // initialize variables
    this.num.set(Field(3));
  }

  /**
   * Updates the state variable
   * @param square square of the existing number
   */
  @method update(square: Field) {
    // assert the validity of current state
    const currentState = this.num.get();
    this.num.assertEquals(currentState);

    // assert the validity of next state
    square.assertEquals(currentState.mul(currentState));

    // update state
    this.num.set(square);
  }

  /**
   * Makes an update transaction
   * @param account message sender
   * @param zkAppPrivateKey private key of contract
   * @param newValue new state variable value
   */
  async updateTx(account: PrivateKey, zkAppPrivateKey: PrivateKey, newValue: Field) {
    const tx = await Mina.transaction(account, () => {
      //this.requireSignature();
      this.update(newValue);
      this.sign(zkAppPrivateKey); // depracated, use tx.sign
    });
    // await tx.sign([zkAppPrivateKey]).send();
    await tx.send();
  }

  /**
   * Deploys a Square contract with a random private key
   * @param owner fee payer & deployer account
   * @returns the contract instance and its private key
   */
  static async deployTx(owner: PrivateKey): Promise<[Square, PrivateKey]> {
    // create a public/private key pair. The public key is our address and where we will deploy to
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();

    // create an instance of our Square smart contract and deploy it to zkAppAddress
    const contract = new Square(zkAppAddress);
    const deployTxn = await Mina.transaction(owner, () => {
      AccountUpdate.fundNewAccount(owner); // pays for the fee
      // contract.requireSignature();
      contract.deploy({ zkappKey: zkAppPrivateKey });
      // contract.sign(zkAppPrivateKey); // depracated
    });
    await deployTxn.send();
    console.log('contract deployed.');

    return [contract, zkAppPrivateKey];
  }
}
