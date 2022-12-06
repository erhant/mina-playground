import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
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
}
