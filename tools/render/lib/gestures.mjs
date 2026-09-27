/**
 * The gestures the interaction suites prove and the README clips show: one module, so a clip performs exactly the
 * sequence a test checks. Every gesture takes a `Pointer` (the plain mouse in a test, the drawn touch indicator in
 * a clip) and a geometry measured from the page; the suites read the page between phases through `phase`.
 *
 * @typedef {{ move(x: number, y: number, steps?: number): Promise<void>, down(): Promise<void>,
 *             up(): Promise<void>, wait(ms: number): Promise<void> }} Pointer
 * @typedef {(name: string) => Promise<void> | void} Phase
 */

/** The page's own mouse as a Pointer. */
export const mousePointer = (page) => ({
  move: (x, y, steps = 1) => page.mouse.move(x, y, { steps }),
  down: () => page.mouse.down(),
  up: () => page.mouse.up(),
  wait: (ms) => page.waitForTimeout(ms),
});

const step = async (phase, name, value) => {
  if (phase) await phase(name, value);
};

/**
 * A ruler's geometry: `at(pct)` is the x of a value on its scale, `y` its axis, `knobX()` the knob's centre now.
 * `ruler` locates the `.fv-ruler` box, `knob` its `.fv-knob`.
 */
export async function rulerGeometry(ruler, knob) {
  const box = await ruler.boundingBox();
  return {
    box,
    y: box.y + box.height / 2,
    at: (pct) => box.x + (box.width * pct) / 100,
    knobX: async () => {
      const k = await knob.boundingBox();
      return k.x + k.width / 2;
    },
  };
}

/** Grab the scale at `from` %, pass `via`, release at `to`: the value lands exactly on `to`. */
export async function dragTo(pointer, geo, { from, via, to, steps = [6, 12] }) {
  await pointer.move(geo.at(from), geo.y);
  await pointer.down();
  await pointer.move(geo.at(via), geo.y, steps[0]);
  await pointer.move(geo.at(to), geo.y, steps[1]);
  await pointer.up();
}

/** Grab away from the knob at `grab` % and slide to `to`: the drag is relative to the knob, never a jump. */
export async function relativeDrag(pointer, geo, { grab, to, nudge = grab + 1, steps = [3, 8] }) {
  await pointer.move(geo.at(grab), geo.y);
  await pointer.down();
  await pointer.move(geo.at(nudge), geo.y, steps[0]);
  await pointer.move(geo.at(to), geo.y, steps[1]);
  await pointer.up();
}

/**
 * The phone gesture: a thumb sliding to `to` drifts `drift` px off the axis (the value must not move), comes back,
 * then goes `far` off and travels `travel` % (finer), returns to the axis (no leap), pauses (the full scale stays),
 * and lets go. Phases: `onAxis`, `drifted`, `returned`, `far`, `back`, `paused`.
 */
export async function driftDrag(
  pointer,
  geo,
  { from = 87, to = 50, drift = 120, far = 260, travel = 20, pause = 800, phase },
) {
  await pointer.move(geo.at(from), geo.y);
  await pointer.down();
  await pointer.move(geo.at(to), geo.y, 14);
  await step(phase, 'onAxis');
  await pointer.move(geo.at(to), geo.y + drift, 10);
  await step(phase, 'drifted');
  await pointer.move(geo.at(to), geo.y, 10);
  await step(phase, 'returned');
  await pointer.move(geo.at(to), geo.y + far, 6);
  await pointer.move(geo.at(to + travel), geo.y + far, 10);
  await step(phase, 'far');
  await pointer.move(geo.at(to + travel), geo.y, 8);
  await step(phase, 'back');
  await pointer.wait(pause);
  await step(phase, 'paused');
  await pointer.up();
}

/**
 * Press on the knob and hold: the fine scale rises without the knob moving; `travel` % of the ruler is then one
 * unit; releasing glides the knob back to the full scale. Phases: `held`, `moved`, `released`, each given the x
 * the knob was pressed at; returned as well.
 */
export async function holdForFine(
  pointer,
  geo,
  { hold = 650, travel = 10, steps = 8, settle = 450, phase },
) {
  const xHold = await geo.knobX();
  await pointer.move(xHold, geo.y);
  await pointer.down();
  await pointer.wait(hold);
  await step(phase, 'held', xHold);
  await pointer.move(xHold + (geo.box.width * travel) / 100, geo.y, steps);
  await step(phase, 'moved', xHold);
  await pointer.up();
  await pointer.wait(settle);
  await step(phase, 'released', xHold);
  return xHold;
}

/** Drag a dial's knob straight up to `up` px above the centre (the middle of the sweep). */
export async function dialTo(pointer, { knob, dial }, { up = 84, steps = 10 } = {}) {
  const kb = await knob.boundingBox();
  const db = await dial.boundingBox();
  const cx = db.x + db.width / 2;
  const cy = db.y + db.width / 2;
  await pointer.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
  await pointer.down();
  await pointer.move(cx, cy - up, steps);
  await pointer.up();
}

/** A seek on a progress bar (`box`): grab at `from`, pass `via`, release at `to` (fractions of the bar). */
export async function seekTo(pointer, box, { from, via, to, steps = [6, 6], phase }) {
  const y = box.y + box.height / 2;
  await pointer.move(box.x + box.width * from, y);
  await pointer.down();
  await pointer.move(box.x + box.width * via, y, steps[0]);
  await pointer.move(box.x + box.width * to, y, steps[1]);
  await step(phase, 'during');
  await pointer.up();
}

/** Scrub a chart (`box`): press at `from` and drag to `to` (fractions of its width); the reading stays until `leaveChart`. */
export async function scrubPlot(pointer, box, { from, to, steps = 8 }) {
  const y = box.y + box.height / 2;
  await pointer.move(box.x + box.width * from, y);
  await pointer.down();
  await pointer.move(box.x + box.width * to, y, steps);
}

/** Let go and move off the chart (`box`): a mouse keeps the reading until it leaves. */
export async function leaveChart(pointer, box, { above = 60, steps = 1 } = {}) {
  await pointer.up();
  await pointer.move(box.x + box.width / 2, box.y - above, steps);
}

/* ---------- a finger on a touch screen ---------- */

/**
 * A finger on a page opened with a touch screen (`hasTouch`): down at the first point, through the others (each
 * after `wait` ms), a `hold` before letting go, then up. Real touch events, through the protocol: the page's
 * pointer events follow, so a drawn ring animates too.
 */
export async function finger(page, points, { wait = 16, hold = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const [first, ...rest] = points;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: first.x, y: first.y }],
  });
  for (const point of rest) {
    await page.waitForTimeout(wait);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y }],
    });
  }
  if (hold) await page.waitForTimeout(hold);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** `steps` points from `from` (excluded) to `to` (included), evenly. */
export const between = (from, to, steps) =>
  Array.from({ length: steps }, (_, i) => ({
    x: from.x + ((to.x - from.x) * (i + 1)) / steps,
    y: from.y + ((to.y - from.y) * (i + 1)) / steps,
  }));

/** A swipe: a drag from `from` to `to`, slow (a hold before letting go) unless `flick`. */
export const swipe = (page, from, to, { steps = 10, flick = false } = {}) =>
  finger(page, [from, ...between(from, to, steps)], {
    wait: flick ? 0 : 24,
    hold: flick ? 0 : 200,
  });
