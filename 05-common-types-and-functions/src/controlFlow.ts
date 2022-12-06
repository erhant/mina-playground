import { Int64, Circuit } from 'snarkyjs';

export function ifExample() {
  const input1 = Int64.from(10);
  const input2 = Int64.from(-15);

  const inputSum = input1.add(input2);

  const inputSumAbs = Circuit.if(
    inputSum.isPositive(),
    inputSum,
    inputSum.mul(Int64.minusOne)
  );

  console.log(`inputSum: ${inputSum.toString()}`);
  console.log(`inputSumAbs: ${inputSumAbs.toString()}`);

  const input3 = Int64.from(22);

  const input1largest = input1
    .sub(input2)
    .isPositive()
    .and(input1.sub(input3).isPositive());
  const input2largest = input2
    .sub(input1)
    .isPositive()
    .and(input2.sub(input3).isPositive());
  const input3largest = input3
    .sub(input1)
    .isPositive()
    .and(input3.sub(input2).isPositive());

  const largest = Circuit.switch(
    [input1largest, input2largest, input3largest],
    Int64,
    [input1, input2, input3]
  );

  console.log(`largest: ${largest.toString()}`);
}

/** alternative way:
const result = Circuit.if(
  a.gt(b),
  (() => {
    // TRUE
    return a;
  })(),
  (() => {
    // FALSE
    return b;
  })()
);
*/
