import { Field, Struct } from 'snarkyjs';

/**
 * A point structure: a point (x, y) with coordinate field elements
 */
class Point extends Struct({
  x: Field,
  y: Field,
}) {
  /**
   * Adds two points
   * @param a (x1, y2)
   * @param b (x2, y2)
   * @returns (x1 + x2, y1 + y2)
   */
  static addPoints(a: Point, b: Point): Point {
    return new Point({ x: a.x.add(b.x), y: a.y.add(b.y) });
  }

  /**
   * Give the fields of point coordinates
   * @returns fields of x, fields of y
   */
  toFields(): [Field[], Field[]] {
    return [this.x.toFields(), this.y.toFields()];
  }
}

/**
 * An array of few points
 */
class Points4 extends Struct({
  points: [Point, Point, Point, Point],
}) {}

export function pointExample() {
  // two points
  const p = new Point({ x: Field(10), y: Field(4) });
  const q = new Point({ x: Field(1), y: Field(2) });

  // summing points
  const pq = Point.addPoints(p, q);
  console.log(
    'p + q Fields:',
    pq.toFields().map((p) => p.toString())
  );

  // create an array of points
  const points4 = new Points4({
    points: new Array(4).fill(null).map((_, i) => new Point({ x: Field(i), y: Field(i * 10) })),
  });
  console.log(`points8 Fields: ${JSON.stringify(points4)}`);
}
