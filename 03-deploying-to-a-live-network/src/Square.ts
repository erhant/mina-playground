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

export class Square extends SmartContract {
  @state(Field) num = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.num.set(Field(3));
  }

  @method update(square: Field) {
    const currentState = this.num.get();
    this.num.assertEquals(currentState);
    square.assertEquals(currentState.mul(currentState));
    this.num.set(square);
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
      contract.deploy({ zkappKey: zkAppPrivateKey });
      // contract.sign(zkAppPrivateKey); // depracated
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
   * @param newValue new state variable value
   */
  async updateTx(account: PrivateKey, zkAppPrivateKey: PrivateKey, newValue: Field) {
    const tx = await Mina.transaction(account, () => {
      this.update(newValue);
      // this.sign(zkAppPrivateKey); // depracated, use tx.sign
      this.requireSignature();
    });
    await tx.sign([zkAppPrivateKey]).send();
  }
}
