import { describe, expect, it } from 'vitest';
import {
  calibrationOf,
  cornersOf,
  PICTURE,
  rectOf,
  type CalibrationPair,
  type Point,
} from './calibration.js';

/*
 * The map's maths (#265): three pairs fix an affine map exactly, four a projective one, each with its way back;
 * points on one line or one that is no number fix nothing.
 */

const pair = (vacuum: Point, map: Point): CalibrationPair => ({ vacuum, map });
const near = (got: Point, want: Point, digits = 6): void => {
  expect(got[0]).toBeCloseTo(want[0], digits);
  expect(got[1]).toBeCloseTo(want[1], digits);
};

describe('three pairs: an affine map', () => {
  // Xiaomi Cloud Map Extractor's own shape: 50 mm a pixel, the picture's y running down as the robot's runs up
  const extractor = calibrationOf([
    pair([25500, 25500], [200, 300]),
    pair([26500, 25500], [220, 300]),
    pair([25500, 26500], [200, 280]),
  ]);

  it('carries each pair onto its fellow, both ways', () => {
    near(extractor?.toMap([25500, 25500]) as Point, [200, 300]);
    near(extractor?.toMap([26500, 25500]) as Point, [220, 300]);
    near(extractor?.toMap([25500, 26500]) as Point, [200, 280]);
    near(extractor?.toRobot([220, 300]) as Point, [26500, 25500]);
  });

  it('carries every other place by the same rule', () => {
    near(extractor?.toMap([27500, 24000]) as Point, [240, 330]);
    near(extractor?.toRobot([240, 330]) as Point, [27500, 24000]);
    near(extractor?.toRobot([0, 0]) as Point, [15500, 40500]);
  });

  it('holds a turn and a scale that differs each way', () => {
    // a quarter turn, 10 units a pixel across and 20 down, the origin at (50, 60)
    const turned = calibrationOf([
      pair([0, 0], [50, 60]),
      pair([100, 0], [50, 65]),
      pair([0, 100], [40, 60]),
    ]);
    near(turned?.toMap([200, 300]) as Point, [20, 70]);
    near(turned?.toRobot([20, 70]) as Point, [200, 300]);
  });

  it('comes back to where it left from anywhere on the plane', () => {
    for (const place of [
      [24245, 25190],
      [27495, 27940],
      [0, 0],
      [-3200, 51000],
    ] as const)
      near(extractor?.toRobot(extractor.toMap(place)) as Point, place, 4);
  });
});

describe('four pairs: a projective map', () => {
  /** A picture seen at an angle: a known projective map, the pairs read off it. */
  const seen = ([x, y]: Point): Point => {
    const w = 0.0004 * x - 0.0002 * y + 1;
    return [(1.2 * x + 0.3 * y + 40) / w, (-0.1 * x + 0.9 * y + 25) / w];
  };
  const corners: readonly Point[] = [
    [0, 0],
    [400, 0],
    [400, 300],
    [0, 300],
  ];
  const map = calibrationOf(corners.map((corner) => pair(corner, seen(corner))));

  it('carries each corner onto its fellow', () => {
    for (const corner of corners) near(map?.toMap(corner) as Point, seen(corner));
  });

  it('carries a place inside, and outside, as the picture is seen', () => {
    near(map?.toMap([120, 210]) as Point, seen([120, 210]));
    near(map?.toMap([520, -80]) as Point, seen([520, -80]));
  });

  it('and back', () => {
    near(map?.toRobot(seen([333, 77])) as Point, [333, 77], 4);
  });

  it('is the affine map where the four are a parallelogram’s', () => {
    const flat = calibrationOf([
      pair([0, 0], [10, 10]),
      pair([100, 0], [60, 10]),
      pair([100, 100], [60, 60]),
      pair([0, 100], [10, 60]),
    ]);
    near(flat?.toMap([50, 20]) as Point, [35, 20]);
  });

  it('takes the first four of more', () => {
    const five = calibrationOf([
      ...corners.map((corner) => pair(corner, seen(corner))),
      pair([1, 1], [9999, 9999]),
    ]);
    near(five?.toMap([120, 210]) as Point, seen([120, 210]));
  });
});

describe('not calibrated', () => {
  it('fewer than three pairs fix nothing', () => {
    expect(calibrationOf([])).toBeUndefined();
    expect(calibrationOf([pair([0, 0], [0, 0]), pair([1, 1], [2, 2])])).toBeUndefined();
  });

  it('three places on one line fix nothing, the robot’s or the picture’s', () => {
    expect(
      calibrationOf([pair([0, 0], [0, 0]), pair([100, 100], [5, 9]), pair([200, 200], [3, 1])]),
    ).toBeUndefined();
    expect(
      calibrationOf([pair([0, 0], [0, 0]), pair([100, 0], [10, 10]), pair([0, 100], [20, 20])]),
    ).toBeUndefined();
    // the same place twice
    expect(
      calibrationOf([pair([5, 5], [1, 1]), pair([5, 5], [1, 1]), pair([0, 100], [20, 0])]),
    ).toBeUndefined();
  });

  it('four with three on one line fix nothing', () => {
    expect(
      calibrationOf([
        pair([0, 0], [0, 0]),
        pair([50, 0], [5, 0]),
        pair([100, 0], [10, 0]),
        pair([0, 100], [0, 10]),
      ]),
    ).toBeUndefined();
  });

  it('a place that is no finite number fixes nothing', () => {
    expect(
      calibrationOf([pair([0, 0], [0, 0]), pair([NaN, 0], [10, 0]), pair([0, 100], [0, 10])]),
    ).toBeUndefined();
    expect(
      calibrationOf([pair([0, 0], [0, 0]), pair([100, 0], [Infinity, 0]), pair([0, 100], [0, 10])]),
    ).toBeUndefined();
  });
});

describe('a plain floor plan', () => {
  it('is its own measure', () => {
    expect(PICTURE.toMap([120, 80])).toEqual([120, 80]);
    expect(PICTURE.toRobot([120, 80])).toEqual([120, 80]);
  });
});

describe('a rectangle of the robot’s', () => {
  it('is two corners in whole numbers, the lesser first, whichever way it was drawn', () => {
    expect(rectOf([26500.4, 26499.6], [25499.5, 25000.2])).toEqual([25500, 25000, 26500, 26500]);
  });

  it('has four corners, in turn', () => {
    expect(cornersOf([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 2],
      [3, 4],
      [1, 4],
    ]);
  });
});
