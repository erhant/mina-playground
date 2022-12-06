import {
  Bool,
  UInt32,
  UInt64,
  Int64,
  Character,
  CircuitString,
  PrivateKey,
  Signature,
} from 'snarkyjs';

export function boolExample() {
  const num1 = UInt32.from(40);
  const num2 = UInt64.from(40);

  const num1EqualsNum2: Bool = num1.toUInt64().equals(num2);

  console.log('// --------------------------------------');
  console.log(`num1 == num2: ${num1EqualsNum2.toString()}`);
  console.log(`Fields in num1: ${num1.toFields().length}`);
}

export function signedNumExample() {
  const signedNum1 = Int64.from(-3);
  const signedNum2 = Int64.from(45);

  const signedNumSum = signedNum1.add(signedNum2);

  console.log(`signedNum1 + signedNum2: ${signedNumSum.toString()}`);
  console.log(`Fields in signedNum1: ${signedNum1.toFields().length}`);
}

export function charExample() {
  const char1 = Character.fromString('c');
  const char2 = Character.fromString('d');

  console.log(`char1: ${char1.toString()}`);
  console.log(`char1 == char2: ${char1.equals(char2).toString()}`);
  console.log(`Fields in char1: ${char1.toFields().length}`);
  console.log('// --------------------------------------');
}

export function stringExample() {
  const str1 = CircuitString.fromString('abc..xyz');
  console.log(`str1: ${str1.toString()}`);
  console.log(`Fields in str1: ${str1.toFields().length}`);
}

export function demonstration() {
  const signedNumSum = Int64.from(-3).add(Int64.from(45));
  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();

  const data1 = Character.fromString('c')
    .toFields()
    .concat(signedNumSum.toFields());
  const data2 = Character.fromString('d')
    .toFields()
    .concat(CircuitString.fromString('abc..xyz').toFields());

  const signature = Signature.create(privateKey, data2);

  const verifiedData1 = signature.verify(publicKey, data1);
  const verifiedData2 = signature.verify(publicKey, data2);

  console.log(`private key: ${privateKey.toBase58()}`);
  console.log(`public key: ${publicKey.toBase58()}`);
  console.log(`Fields in private key: ${privateKey.toFields().length}`);
  console.log(`Fields in public key: ${publicKey.toFields().length}`);

  console.log(`signature verified for data1: ${verifiedData1.toString()}`);
  console.log(`signature verified for data2: ${verifiedData2.toString()}`);

  console.log(`Fields in signature: ${signature.toFields().length}`);
}
