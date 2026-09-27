import { parse } from 'yaml';

/**
 * Offline gate for a theme file. A malformed theme sends Home Assistant into recovery mode on
 * the next start (`frontend` is a critical integration), so nothing is copied to an instance
 * unless this returns no problems.
 */

const HEX = /^#[0-9a-f]{6}$/;

/** Variables Home Assistant reads from JavaScript (charts, energy, chrome): anything but #rrggbb breaks them. */
const HEX_ONLY = [
  /^state-.*-color$/,
  /^energy-.*-color$/,
  /^graph-color-\d+$/,
  /^app-theme-color$/,
  /^app-header-background-color$/,
  /^primary-color$/,
  /^accent-color$/,
];

const BANNED = [/^ha-animation-duration-/, /^md-sys-/, /^mdc-/, /^round-slider-/];

export interface ThemeProblem {
  readonly path: string;
  readonly message: string;
}

function checkMap(
  map: Record<string, unknown>,
  path: string,
  problems: ThemeProblem[],
  allowModes: boolean,
): void {
  for (const [k, value] of Object.entries(map)) {
    const where = `${path}.${k}`;
    if (k === 'modes' && allowModes) continue;
    if (k.startsWith('--'))
      problems.push({ path: where, message: 'keys are written without the leading "--"' });
    if (BANNED.some((re) => re.test(k))) problems.push({ path: where, message: 'banned variable' });
    if (typeof value !== 'string') {
      problems.push({
        path: where,
        message: `value must be a string, got ${value === null ? 'null' : typeof value}`,
      });
      continue;
    }
    if (value.trim() === '') problems.push({ path: where, message: 'empty value' });
    if (HEX_ONLY.some((re) => re.test(k)) && !HEX.test(value)) {
      problems.push({
        path: where,
        message: `must be #rrggbb (read from JavaScript), got "${value}"`,
      });
    }
  }
}

export function validateThemeYaml(source: string): readonly ThemeProblem[] {
  const problems: ThemeProblem[] = [];
  let doc: unknown;
  try {
    doc = parse(source, { schema: 'core', uniqueKeys: true });
  } catch (error) {
    return [{ path: '$', message: `YAML does not parse: ${(error as Error).message}` }];
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return [{ path: '$', message: 'top level must be a map of theme name → variables' }];
  }
  const themes = Object.entries(doc as Record<string, unknown>);
  if (themes.length === 0) problems.push({ path: '$', message: 'no theme declared' });
  for (const [name, body] of themes) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      problems.push({ path: name, message: 'theme body must be a map' });
      continue;
    }
    const theme = body as Record<string, unknown>;
    checkMap(theme, name, problems, true);
    const modes = theme['modes'];
    if (modes === undefined) {
      problems.push({ path: name, message: 'no "modes": the theme would be light-only' });
      continue;
    }
    if (modes === null || typeof modes !== 'object' || Array.isArray(modes)) {
      problems.push({ path: `${name}.modes`, message: 'must be a map with "light" and "dark"' });
      continue;
    }
    const modeMap = modes as Record<string, unknown>;
    for (const extra of Object.keys(modeMap)) {
      if (extra !== 'light' && extra !== 'dark')
        problems.push({ path: `${name}.modes.${extra}`, message: 'unknown mode' });
    }
    for (const mode of ['light', 'dark'] as const) {
      const vars = modeMap[mode];
      if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) {
        problems.push({ path: `${name}.modes.${mode}`, message: 'missing or not a map' });
        continue;
      }
      checkMap(vars as Record<string, unknown>, `${name}.modes.${mode}`, problems, false);
    }
    const light = Object.keys((modeMap['light'] ?? {}) as object)
      .sort()
      .join('|');
    const dark = Object.keys((modeMap['dark'] ?? {}) as object)
      .sort()
      .join('|');
    if (light !== dark)
      problems.push({ path: `${name}.modes`, message: 'light and dark declare different keys' });
  }
  return problems;
}
