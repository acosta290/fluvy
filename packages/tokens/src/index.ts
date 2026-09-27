/** Public API of `@fluvy/tokens`. */

export {
  BRAND,
  cssVar,
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  PALETTE_MODES,
  PALETTE_NAMES,
  THEME_NAME,
  THEME_SENTINEL,
  type PaletteName,
} from './config.js';

export {
  GRAPH_SERIES_COUNT,
  RAMP_STEPS,
  SEMANTIC_ROLES,
  STATE_KEYS,
  type AccentColors,
  type Hex,
  type Palette,
  type PaletteMode,
  type PaletteModeColors,
  type PaletteSeed,
  type Ramp,
  type RampStep,
  type RoleColors,
  type SemanticRole,
  type StateKey,
  type SurfaceColors,
  type TextColors,
  type UnavailableColors,
} from './types.js';

export * from './color/index.js';
export * from './scales/index.js';

export { getSeed, seedList, seeds } from './palettes/index.js';
export { derivePalette, GATES, UNAVAILABLE_ALPHA } from './build/derive.js';
export { derivePalettes } from './build/palettes.js';

export { emitLabCss } from './emit/css.js';
export {
  buildPaletteSummary,
  emitPalettesJson,
  emitPalettesScript,
  emitTokensJson,
  PALETTE_GLOBAL,
} from './emit/json.js';
export {
  buildReports,
  checkContrast,
  checkStructure,
  collectHexValues,
  contrastGates,
  countFailures,
  renderContrastReport,
  type ContrastGate,
  type ContrastResult,
  type PaletteReport,
  type StructuralResult,
} from './emit/contrast.js';
export {
  allPaletteVars,
  brandColorVars,
  scaleVars,
  type CssDeclaration,
  type VarGroup,
} from './emit/vars.js';
export { HA_GROUPS, haModeVars, haSharedVars, type HaGroup } from './ha/groups.js';
export { RELEASE_VERSION } from './release.js';
