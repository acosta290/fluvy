// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { startLook } from '../look/start.js';
import { writeDevice } from '../settings/device.js';

/*
 * The sidebar beside the page comes in its own file (`dock.ts`), fetched once this device chose it. A file that does not
 * load (a HACS update under an open tablet, a bad network) is asked for again at the next navigation, once each, and
 * said once, where the page never asked again until it was reloaded. (A file that landed is the module cache's: the
 * story is one test.)
 */
const dock = vi.hoisted(() => ({ fetched: 0, failing: 3, watched: 0 }));
vi.mock('../look/dock.js', () => {
  dock.fetched += 1;
  if (dock.fetched <= dock.failing) throw new Error('chunk 404');
  return {
    watchSidebar: () => {
      dock.watched += 1;
      return () => undefined;
    },
  };
});

const navigate = (): void => {
  window.dispatchEvent(new Event('location-changed'));
};

describe('the sidebar beside the page, whose file did not load', () => {
  it('is asked for again at each navigation until it lands, never in a loop, said once, and not once the look stopped', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeDevice({ dock: true });
    const stopped = startLook()!;
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(1);
    stopped.stop();
    navigate();
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(1);

    const look = startLook()!;
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(2);
    // nothing asks again by itself
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dock.fetched).toBe(2);
    navigate();
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[fluvy\] dock did not load: Error/);
    // the back button is a navigation too; this time it lands, and the menus are answered
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(4);
    expect(dock.watched).toBe(1);
    // a navigation, a choice saved again, after it landed: nothing more is fetched
    navigate();
    look.wearDevice();
    await vi.dynamicImportSettled();
    expect(dock.fetched).toBe(4);
    look.stop();
    localStorage.clear();
  });
});
