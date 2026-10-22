import { describe, expect, it } from 'vitest';

import { cameraRatio, plateHeight } from '../devices-family.js';
import { plateLayout } from './plate.js';

/*
 * What fits inside a camera's plate: "Live" as wide as its word (never under 64), the rounds at the bottom end, the
 * clock at the top end, and in what order they give way on a narrow plate (design/language.md, "Camera (1.6)").
 */

/** "LIVE" in English (12 px, 600, spaced): a 68 pill. */
const LIVE = 30;
/** "STREAM UNAVAILABLE" in English: a 192 pill. */
const FAILED = 155;
const at16x9 = (width: number): number => plateHeight(width, cameraRatio('16:9'));

describe('a camera’s plate', () => {
  it('gives way in order across a 16:9 plate: the snapshot round, then "Live" to its dot', () => {
    const rows = [112, 132, 152, 171, 320].map((width) => ({
      width,
      height: at16x9(width),
      ...plateLayout(width, at16x9(width), LIVE, 2),
    }));
    expect(rows).toEqual([
      // under 100 high the rounds share "Live"'s rows: the snapshot round goes first, then the word folds
      { width: 112, height: 68, live: 68, dot: true, rounds: 1, clock: false },
      { width: 132, height: 76, live: 68, dot: true, rounds: 1, clock: false },
      { width: 152, height: 84, live: 68, dot: false, rounds: 1, clock: false },
      { width: 171, height: 96, live: 68, dot: false, rounds: 1, clock: false },
      // a tall plate: both rounds under "Live", and the clock beside it
      { width: 320, height: 180, live: 68, dot: false, rounds: 2, clock: true },
    ]);
  });

  it('keeps its clock from 108 high only, clear of "Live"', () => {
    expect(plateLayout(320, 104, LIVE, 2)).toEqual({
      live: 68,
      dot: false,
      rounds: 2,
      clock: false,
    });
    expect(plateLayout(320, 108, LIVE, 2)).toEqual({
      live: 68,
      dot: false,
      rounds: 2,
      clock: true,
    });
    // tall, but too narrow for the clock beside "Live" (68 + 12 + 8 + 80 + 12)
    expect(plateLayout(171, 128, LIVE, 2).clock).toBe(false);
    expect(plateLayout(180, 128, LIVE, 2).clock).toBe(true);
    // a low plate wide enough keeps both rounds beside "Live"
    expect(plateLayout(320, 96, LIVE, 2)).toEqual({
      live: 68,
      dot: false,
      rounds: 2,
      clock: false,
    });
  });

  it('measures "Live" by its word on the 4 grid, and folds a long one where it cannot fit at all', () => {
    expect(plateLayout(320, 180, 0, 2).live).toBe(64);
    expect(plateLayout(320, 180, FAILED, 2)).toEqual({
      live: 192,
      dot: false,
      rounds: 2,
      clock: true,
    });
    // taller than 100, so no round in its rows, but its words do not fit the plate
    expect(plateLayout(212, 128, FAILED, 2).dot).toBe(true);
    expect(plateLayout(216, 128, FAILED, 2).dot).toBe(false);
  });

  it('holds a tile’s one round as it holds the camera’s last', () => {
    expect([112, 132, 152, 171].map((w) => plateLayout(w, at16x9(w), LIVE, 1).dot)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(plateLayout(152, 84, LIVE, 1).rounds).toBe(1);
  });

  it('holds "Live" alone on a plate with no round (the Cameras card’s pictures alone): its dot where its word would not fit', () => {
    expect([91, 92, 101, 152].map((w) => plateLayout(w, 68, LIVE, 0))).toEqual([
      { live: 68, dot: true, rounds: 0, clock: false },
      { live: 68, dot: false, rounds: 0, clock: false },
      { live: 68, dot: false, rounds: 0, clock: false },
      { live: 68, dot: false, rounds: 0, clock: false },
    ]);
  });

  it('folds exactly as the camera card always has', () => {
    // the card's arithmetic before the plate was shared (1.9), at every width, height and word
    const before = (w: number, height: number, word: number) => {
      const live = Math.max(64, Math.ceil((26 + word + 10) / 4) * 4);
      const low = height < 100;
      const snapshot = !low || live + 12 + 8 + 96 + 12 <= w;
      return {
        live,
        dot: (low && !snapshot && live + 12 + 8 + 44 + 12 > w) || live + 24 > w,
        rounds: snapshot ? 2 : 1,
        clock: height >= 108 && live + 12 + 8 + 80 + 12 <= w,
      };
    };
    for (let w = 60; w <= 720; w += 3)
      for (let height = 68; height <= 200; height += 4)
        for (const word of [0, 24, LIVE, 52, 77, FAILED])
          expect(plateLayout(w, height, word, 2)).toEqual(before(w, height, word));
  });
});
