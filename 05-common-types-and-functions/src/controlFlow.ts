import { Int64, Circuit } from 'snarkyjs';

export function ifAndSwitchExample() {
  // few signed integers
  const a = Int64.from(10);
  const b = Int64.from(-15);
  const c = Int64.from(22);

  // addition
  const ab = a.add(b);

  // if else usage to get absolute value
  const abAbsolute = Circuit.if<Int64>(ab.isPositive(), ab, ab.mul(Int64.from(-1)));

  console.log(` a + b : ${ab.toString()}`);
  console.log(`|a + b|: ${abAbsolute.toString()}`);

  // a > b && a > c
  const aLargest = a.sub(b).isPositive().and(a.sub(c).isPositive());
  // b > a && b > c
  const bLargest = b.sub(a).isPositive().and(b.sub(c).isPositive());
  // c > a && c > b
  const cLargest = c.sub(a).isPositive().and(c.sub(b).isPositive());

  // find the largest via switch
  const largest = Circuit.switch<Int64, typeof Int64>([aLargest, bLargest, cLargest], Int64, [a, b, c]);
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
