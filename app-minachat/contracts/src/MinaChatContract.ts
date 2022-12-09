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
} from 'snarkyjs';

const KEY_TREE_HEIGHT = 32;
class MerkleWitnessForKeys extends MerkleWitness(KEY_TREE_HEIGHT) {}
const MSG_TREE_HEIGHT = 32;
class MerkleWitnessForMsgs extends MerkleWitness(MSG_TREE_HEIGHT) {}

export class MinaChatContract extends SmartContract {
  // off-chain storage public key
  @state(PublicKey) serverPublicKey = State<PublicKey>();
  // merkle tree to store encrypted symmetric keys
  @state(Field) keysNumber = State<Field>();
  @state(Field) keysRoot = State<Field>();
  // merkle tree to store messages
  @state(Field) messagesNumber = State<Field>();
  @state(Field) messagesRoot = State<Field>();

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

    this.messagesNumber.set(Field(0));
    this.messagesRoot.set(new MerkleTree(MSG_TREE_HEIGHT).getRoot());
  }

  @method initializeKey(
    senderPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    signature: Signature,
    encryptedKeyForSender: Buffer,
    encryptedKeyForRecipient: Buffer,
    witness: MerkleWitnessForKeys,
    storedNewRootNumber: Field,
    storedNewRootSignature: Signature
  ) {
    // assert initial states
    const storedKeysRoot = this.keysRoot.get();
    this.keysRoot.assertEquals(storedKeysRoot);

    const storedKeysNumber = this.keysNumber.get();
    this.keysNumber.assertEquals(storedKeysNumber);

    const serverPublicKey = this.serverPublicKey.get();
    this.serverPublicKey.assertEquals(serverPublicKey);

    // add the two keys to obtain an index
    const indexKey = PublicKey.fromGroup(senderPublicKey.toGroup().add(recipientPublicKey.toGroup()));
    // TODO: assert root update valid
    // offchainStorage.assertKeyUpdateValid

    // update local strage
  }
}
