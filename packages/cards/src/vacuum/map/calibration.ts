/*
 * Where a robot's coordinates fall on its map's picture, and back (#265). A map says it by pairs of the same place,
 * once as the robot counts it and once as a pixel of the picture: three pairs fix an affine map (a shift, a turn, a
 * scale each way: what a flat map needs), four a projective one (a picture seen at an angle). Both are one 3 × 3
 * matrix, built from the map that carries a unit triangle or a unit square onto each set of points, so no system is
 * solved by elimination; its inverse is the way back. Points on one line, or one that is no number, fix nothing: the
 * map is then not calibrated, and nothing is drawn or picked on it.
 */

export type Point = readonly [x: number, y: number];

/** A rectangle as the robots take it: two opposite corners, the lesser first. */
export type Rect = readonly [x1: number, y1: number, x2: number, y2: number];

/** A projective map of the plane, by rows. */
type Matrix = readonly [number, number, number, number, number, number, number, number, number];

/** The same place twice: on the picture (`map`, in its pixels) and as the robot counts it (`vacuum`). */
export interface CalibrationPair {
  readonly map: Point;
  readonly vacuum: Point;
}

/** A calibrated map: a place of the robot's as the picture's pixel, and a pixel as the robot's place. */
export interface Calibration {
  readonly toMap: (point: Point) => Point;
  readonly toRobot: (point: Point) => Point;
}

const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

/** A matrix's way back, up to a scale a projective map does not mind: its adjugate; none where it flattens the plane. */
function inverse(m: Matrix): Matrix | undefined {
  const back: Matrix = [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
  const det = m[0] * back[0] + m[1] * back[3] + m[2] * back[6];
  return Number.isFinite(det) && det !== 0 && back.every(Number.isFinite) ? back : undefined;
}

const apply = (m: Matrix, [x, y]: Point): Point => {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
};

/** Whether three points stand on one line, as near as their own size tells: they span no plane. */
function onOneLine(a: Point, b: Point, c: Point): boolean {
  const [ux, uy, vx, vy] = [b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]];
  const size = Math.max(ux * ux + uy * uy, vx * vx + vy * vy);
  return !(Math.abs(ux * vy - uy * vx) > 1e-9 * size);
}

/** The affine map that carries (0, 0), (1, 0) and (0, 1) onto three points; none where they stand on one line. */
function fromTriangle([a, b, c]: readonly [Point, Point, Point]): Matrix | undefined {
  return onOneLine(a, b, c)
    ? undefined
    : [b[0] - a[0], c[0] - a[0], a[0], b[1] - a[1], c[1] - a[1], a[1], 0, 0, 1];
}

/**
 * The projective map that carries the unit square's corners, in turn, onto four points (Heckbert's): none where
 * three of them stand on one line.
 */
function fromSquare([a, b, c, d]: readonly [Point, Point, Point, Point]): Matrix | undefined {
  if (onOneLine(a, b, c) || onOneLine(b, c, d) || onOneLine(c, d, a) || onOneLine(d, a, b))
    return undefined;
  const [dx1, dy1, dx2, dy2] = [b[0] - c[0], b[1] - c[1], d[0] - c[0], d[1] - c[1]];
  const [sx, sy] = [a[0] - b[0] + c[0] - d[0], a[1] - b[1] + c[1] - d[1]];
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [
    b[0] - a[0] + g * b[0],
    d[0] - a[0] + h * d[0],
    a[0],
    b[1] - a[1] + g * b[1],
    d[1] - a[1] + h * d[1],
    a[1],
    g,
    h,
    1,
  ];
}

/** The matrix that carries each of `from` onto its fellow of `to`: three points each, or four. */
function carrying(from: readonly Point[], to: readonly Point[]): Matrix | undefined {
  const [a, b, c, d] = from;
  const [p, q, r, s] = to;
  if (!a || !b || !c || !p || !q || !r) return undefined;
  const [source, target] =
    d && s
      ? [fromSquare([a, b, c, d]), fromSquare([p, q, r, s])]
      : [fromTriangle([a, b, c]), fromTriangle([p, q, r])];
  const back = source && inverse(source);
  return target && back ? multiply(target, back) : undefined;
}

/** A map whose picture is its own measure (a plain floor plan): a place is its pixel. */
export const PICTURE: Calibration = { toMap: (point) => point, toRobot: (point) => point };

/**
 * A map calibrated by its pairs: three fix it exactly as an affine map, four (the first four of more) as a
 * projective one; nothing where there are fewer, where one is no finite number, or where they stand on one line.
 */
export function calibrationOf(pairs: readonly CalibrationPair[]): Calibration | undefined {
  const used = pairs.slice(0, pairs.length < 4 ? 3 : 4);
  if (
    used.length < 3 ||
    !used.every((pair) => [...pair.map, ...pair.vacuum].every(Number.isFinite))
  )
    return undefined;
  const toMap = carrying(
    used.map((pair) => pair.vacuum),
    used.map((pair) => pair.map),
  );
  const toRobot = toMap && inverse(toMap);
  return toMap && toRobot
    ? { toMap: (point) => apply(toMap, point), toRobot: (point) => apply(toRobot, point) }
    : undefined;
}

/** A rectangle of the robot's from two opposite corners, in whole numbers, the lesser corner first. */
export const rectOf = (a: Point, b: Point): Rect => [
  Math.round(Math.min(a[0], b[0])),
  Math.round(Math.min(a[1], b[1])),
  Math.round(Math.max(a[0], b[0])),
  Math.round(Math.max(a[1], b[1])),
];

/** A rectangle's four corners, in turn. */
export const cornersOf = ([x1, y1, x2, y2]: Rect): readonly Point[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];
