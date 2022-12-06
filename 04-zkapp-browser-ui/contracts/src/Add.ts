import { Field, SmartContract, state, State, method, DeployArgs, Permissions } from 'snarkyjs';

export class Add extends SmartContract {
  @state(Field) num = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init() {
    // super.init() // do not uncomment, it will result in a wrong verifier key
    // which will not match the deployed contract for tutorial 4
    this.num.set(Field(1));
  }

  @method update() {
    // assert that current state is valid
    const currentState = this.num.get();
    this.num.assertEquals(currentState);

    // assert that next state is valid
    const newState = currentState.add(2);
    newState.assertEquals(currentState.add(2));
    this.num.set(newState);
  }
}
