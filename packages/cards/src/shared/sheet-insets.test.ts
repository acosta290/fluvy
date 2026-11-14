// @vitest-environment happy-dom
import type { CSSResult, CSSResultGroup } from 'lit';
import { describe, expect, it } from 'vitest';
import { FluvyKeypad } from '../alarm/keypad.js';
import { FluvyAlertsSheet } from '../alerts/sheet/alerts-sheet.js';
import { FluvyScheduleSheet } from '../automations/sheet/schedule-sheet.js';
import { FluvyCamerasSheet } from '../camera/sheet/cameras-sheet.js';
import { FluvyDetailsLight } from '../details/light.js';
import { FluvyEnergyPeriodCard } from '../energy-period/energy-period-card.js';
import { FluvyItemsSheet } from '../items/sheet/items-sheet.js';
import { FluvyLightsColourSheet } from '../lights/sheet/lights-colour-sheet.js';
import { customiseStyles } from '../panel/customise/styles.js';
import { FluvyDriveSheet } from '../vacuum/drive/drive-sheet.js';
import { sheetInsets } from './sheet-insets.js';

/*
 * Where a modal sheet stands on a phone (#190): one rule that every sheet of ours shares — its foot over the system's
 * bar (the inset Home Assistant hands on from the Companion app, else the browser's), its top short of the status bar
 * or by 24, both in the screen's pixels whatever size the sheet is drawn at — and no sheet with a rule of its own for
 * either.
 */

const SHEETS: ReadonlyArray<readonly [string, { readonly styles?: CSSResultGroup }]> = [
  ['a details sheet', FluvyDetailsLight],
  ['the alerts’ sheet', FluvyAlertsSheet],
  ['the cameras’ sheet', FluvyCamerasSheet],
  ['an item’s sheet', FluvyItemsSheet],
  ['a schedule’s sheet', FluvyScheduleSheet],
  ['the room lights’ colours', FluvyLightsColourSheet],
  ['the robot’s drive', FluvyDriveSheet],
  ['the keypad', FluvyKeypad],
  ['the Energy period’s sheet', FluvyEnergyPeriodCard],
];

const sheetsOf = (group: CSSResultGroup | undefined): CSSResult[] =>
  [group ?? []].flat(Infinity as 1) as CSSResult[];
/** A stylesheet's text on one line, its spaces single. */
const line = (text: string): string => text.replace(/\s+/g, ' ');

describe('where a modal sheet stands on a phone', () => {
  it('keeps its foot over the system bar and its top under the status bar, in the screen’s pixels', () => {
    const rule = line(sheetInsets.cssText);
    expect(rule).toMatch(
      /padding-bottom: max\( ?16px, var\(--safe-area-inset-bottom, env\(safe-area-inset-bottom, 0px\)\) \/ var\(--fv-zoom, 1\) ?\)/,
    );
    expect(rule).toMatch(
      /max-height: calc\( ?100% - max\( ?24px, var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\) \/ var\(--fv-zoom, 1\) ?\) ?\)/,
    );
    expect(rule).toMatch(/^ ?dialog \.fv-sheet \{/);
  });

  it.each(SHEETS)(
    '%s stands by it, with no rule of its own for its foot or its top',
    (_, sheet) => {
      const styles = sheetsOf(sheet.styles);
      expect(styles).toContain(sheetInsets);
      const own = line(
        styles
          .filter((one) => one !== sheetInsets)
          .map((one) => one.cssText)
          .join('\n'),
      );
      // the browser's inset alone misses the Companion app's; a full height leaves no scrim to tap
      expect(own).not.toMatch(/(?<!var\(--safe-area-inset-(top|bottom), )env\(safe-area-inset/);
      expect(own).not.toMatch(/max-height: 100%/);
    },
  );

  it('stands Customise’s options sheet by it too', () => {
    const text = line(customiseStyles.cssText);
    expect(text).toContain(line(sheetInsets.cssText));
    const own = /\.cz-sheet \{[^}]*\}/.exec(text)?.[0] ?? '';
    expect(own).toContain('position: fixed');
    expect(own).not.toMatch(/max-height|padding-bottom/);
  });
});
