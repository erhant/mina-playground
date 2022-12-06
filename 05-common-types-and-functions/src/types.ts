import { Bool, UInt32, UInt64, Int64, Character, CircuitString, PrivateKey, Signature } from 'snarkyjs';

export function boolExample() {
  // two unsigned ints
  const a = UInt32.from(40);
  const b = UInt64.from(40);

  // a boolean indicating a == b
  const isEqual: Bool = a.toUInt64().equals(b);

  console.log(`a == b: ${isEqual.toString()}`);
  console.log(`Fields in a: ${a.toFields().length}`);
}

export function signedNumExample() {
  // two signed ints
  const a = Int64.from(-3);
  const b = Int64.from(45);
  const ab = a.add(b);

  console.log(`a + b: ${ab.toString()}`);
  console.log(`Fields in a: ${a.toFields().length}`);
}

export function charExample() {
  // two characters
  const c1 = Character.fromString('c');
  const c2 = Character.fromString('d');

  console.log(`c1: ${c1.toString()}`);
  console.log(`c1 == c2: ${c1.equals(c2).toString()}`);
  console.log(`Fields in c1: ${c1.toFields().length}`);
}

export function stringExample() {
  // a string, made circuit friendly via CircuitString
  const str = CircuitString.fromString('abc..xyz');
  console.log(`str: ${str.toString()}`);
  console.log(`Fields in str: ${str.toFields()}`);
}

export function demonstration() {
  const signedNumSum = Int64.from(-3).add(Int64.from(45));

  const data1 = Character.fromString('c').toFields().concat(signedNumSum.toFields());
  const data2 = Character.fromString('d').toFields().concat(CircuitString.fromString('abc..xyz').toFields());

  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();
  const signature = Signature.create(privateKey, data2);

  const verifiedData1 = signature.verify(publicKey, data1);
  const verifiedData2 = signature.verify(publicKey, data2);

  console.log(`Private key: ${privateKey.toBase58()}`);
  console.log(`Public key: ${publicKey.toBase58()}`);
  console.log(`Fields in private key: ${privateKey.toFields().length}`);
  console.log(`Fields in public key: ${publicKey.toFields().length}`);

  console.log(`Signature verified for data1: ${verifiedData1.toString()}`);
  console.log(`Signature verified for data2: ${verifiedData2.toString()}`);

  console.log(`Fields in signature: ${signature.toFields().length}`);
}
