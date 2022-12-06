import { Field, arrayProp, Struct } from 'snarkyjs';

class Point extends Struct({
  x: Field,
  y: Field,
}) {
  addPoints(a: Point, b: Point) {
    return new Point({ x: a.x.add(b.x), y: a.y.add(b.y) });
  }
}

class Points8 extends Struct({
  points: [Point, Point, Point, Point, Point, Point, Point, Point],
}) {}

export function pointExample() {
  const point1 = new Point({ x: Field(10), y: Field(4) });
  const point2 = new Point({ x: Field(1), y: Field(2) });
  const pointSum = Point.addPoints(point1, point2);

  console.log(
    `pointSum Fields: ${pointSum.toFields().map((p) => p.toString())}`
  );

  const pointsArray = new Array(8)
    .fill(null)
    .map((_, i) => new Point({ x: Field(i), y: Field(i * 10) }));
  const points8 = new Points8({ points: pointsArray });

  console.log(`points8 Fields: ${JSON.stringify(points8)}`);
  console.log('// --------------------------------------');
}
