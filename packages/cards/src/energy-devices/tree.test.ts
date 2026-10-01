import { describe, expect, it } from 'vitest';
import { barOf, deviceTree, percentOf, type DeviceItem } from './tree.js';

const item = (id: string, value: number | null, parent?: string): DeviceItem => ({
  key: id,
  id,
  value,
  ...(parent ? { parent } : {}),
});

/** The approved figure's day, in Wh: the kitchen's oven and dishwasher inside its 2.1 kWh. */
const DAY = [
  item('kitchen', 2100),
  item('oven', 900, 'kitchen'),
  item('dishwasher', 700, 'kitchen'),
  item('heat_pump', 5100),
  item('car', 3800),
];

const ids = (nodes: readonly { item: DeviceItem }[]): string[] => nodes.map((n) => n.item.id);

describe('deviceTree', () => {
  it('hangs children under their parent, biggest first at every level', () => {
    const tree = deviceTree(DAY, { total: 13_400 });
    expect(ids(tree.roots)).toEqual(['heat_pump', 'car', 'kitchen']);
    const kitchen = tree.roots[2];
    expect(ids(kitchen?.children ?? [])).toEqual(['oven', 'dishwasher']);
  });

  it('says what a parent’s devices leave unmeasured, and what the devices leave of the house', () => {
    const tree = deviceTree(DAY, { total: 13_400 });
    expect(tree.roots[2]?.rest).toBeCloseTo(500);
    expect(tree.rest).toBeCloseTo(2400);
    expect(tree.measured).toBeCloseTo(11_000 / 13_400);
    expect(percentOf(tree.measured, 1)).toBe(82);
    expect(percentOf(tree.rest, 13_400)).toBe(18);
    expect(percentOf(500, 2100)).toBe(24);
  });

  it('draws every bar on one scale: the house, else the biggest top-level device', () => {
    expect(deviceTree(DAY, { total: 13_400 }).scale).toBe(13_400);
    const bare = deviceTree(DAY);
    expect(bare.scale).toBe(5100);
    expect(bare.rest).toBeNull();
    expect(bare.measured).toBeNull();
    expect(bare.sum).toBe(11_000);
    expect(barOf(900, 13_400)).toBeCloseTo(0.067);
    expect(barOf(null, 13_400)).toBe(0);
  });

  it('guesses nothing: an unreadable child hides its parent’s rest, an unreadable device the house’s', () => {
    const child = deviceTree(
      DAY.map((d) => (d.id === 'dishwasher' ? { ...d, value: null } : d)),
      { total: 13_400 },
    );
    expect(child.roots[2]?.rest).toBeNull();
    expect(child.rest).toBeCloseTo(2400); // the kitchen itself still reads
    const root = deviceTree(
      DAY.map((d) => (d.id === 'car' ? { ...d, value: null } : d)),
      { total: 13_400 },
    );
    expect(root.rest).toBeNull();
    expect(root.measured).toBeNull();
    expect(ids(root.roots)).toEqual(['heat_pump', 'kitchen', 'car']); // the unreadable sinks
  });

  it('says no rest when there is none to speak of, or the devices read more than the meter', () => {
    const exact = deviceTree([item('a', 1000), item('b', 400, 'a'), item('c', 600, 'a')], {
      total: 1000.4,
    });
    expect(exact.roots[0]?.rest).toBeNull();
    expect(exact.rest).toBeNull();
    const over = deviceTree([item('a', 1200)], { total: 1000 });
    expect(over.rest).toBeNull();
    expect(over.measured).toBe(1);
    expect(over.scale).toBe(1200);
  });

  it('keeps a device whose parent is not listed, or that would close a loop, at the top', () => {
    const tree = deviceTree([
      item('car', 3800, 'garage'),
      item('a', 300, 'b'),
      item('b', 200, 'a'),
      item('self', 100, 'self'),
    ]);
    expect(ids(tree.roots).sort()).toEqual(['a', 'b', 'car', 'self'].sort());
  });

  it('nests as deep as the devices do', () => {
    const tree = deviceTree(
      [
        item('kitchen', 2100),
        item('counter', 500, 'kitchen'),
        item('kettle', 300, 'counter'),
        item('oven', 900, 'kitchen'),
      ],
      { sort: false },
    );
    const kitchen = tree.roots[0];
    expect(ids(kitchen?.children ?? [])).toEqual(['counter', 'oven']);
    expect(ids(kitchen?.children[0]?.children ?? [])).toEqual(['kettle']);
    expect(kitchen?.children[0]?.rest).toBeCloseTo(200);
    expect(kitchen?.rest).toBeCloseTo(700);
  });

  it('keeps the configured order when asked, and shows at most `limit` top-level devices', () => {
    expect(ids(deviceTree(DAY, { sort: false }).roots)).toEqual(['kitchen', 'heat_pump', 'car']);
    const two = deviceTree(DAY, { total: 13_400, limit: 2 });
    expect(ids(two.roots)).toEqual(['heat_pump', 'car']);
    // the rest of the house still counts every device, shown or not
    expect(two.rest).toBeCloseTo(2400);
  });
});
