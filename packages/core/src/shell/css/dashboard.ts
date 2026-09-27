/*
 * A dashboard in edit mode, in the language's idioms: the edit bar keeps its accent fill (the mode reads at a
 * glance) with everything on it in the bar's ink; what edits a card, a section or the view's header is a quiet
 * control on the card fill with a hairline; what adds is a fine dashed accent outline, filling with the accent's
 * wash under the pointer; the frames of what can be edited are a fine dashed hairline.
 */

const ADD = `border: 1px dashed color-mix(in srgb, var(--fluvy-accent) 60%, transparent); color: var(--fluvy-accent); font-weight: 500;`;
const QUIET =
  'background: var(--fluvy-card); box-shadow: inset 0 0 0 1px var(--fluvy-border); color: var(--fluvy-text-secondary);';

/**
 * The edit bar (`hui-root`): its icons in the bar's ink (not the accent on the accent fill), Done as the primary
 * action (36 tall, the one tappable radius), the open view as a tile on the card fill holding its arrows and pencil
 * (no Material underline), the add-view plus a plain glyph.
 */
export const editBarCss = `.edit-mode .edit-icon { color: var(--app-header-edit-text-color); }
.edit-mode .edit-icon[disabled] { opacity: 0.4; }
.exit-edit-mode { flex: 0 0 auto; }
.exit-edit-mode::part(base) { height: 36px; padding-inline: 16px; border: 0; border-radius: var(--fluvy-radius-control); background-color: var(--fluvy-primary, var(--fluvy-accent)); color: var(--fluvy-on-primary, var(--fluvy-text-on-accent)); box-shadow: inset 0 0 0 1px var(--fluvy-primary-edge, transparent); font-weight: 600; }
.edit-mode ha-tab-group { --ha-tab-indicator-color: transparent; }
.tab-bar { padding-inline-start: 12px; }
.edit-mode ha-tab-group-tab[aria-selected="true"]::part(base) { height: 40px; margin-top: 8px; padding: 0 2px; border-radius: var(--fluvy-radius-control); background-color: var(--fluvy-card); color: var(--fluvy-text); font-weight: 600; }
.edit-mode ha-tab-group-tab[aria-selected="true"] .edit-icon { --ha-icon-button-size: 36px; padding: 0; color: var(--fluvy-text-secondary); }
#add-view ha-svg-icon { background-color: transparent; }`;

/** The view's header in edit mode: its frame a fine dashed hairline, Add title / Add badge as add pills, its actions quiet. */
export const viewHeaderCss = `.container.edit-mode { border: 1px dashed var(--fluvy-border-strong); }
.add { ${ADD} border-radius: var(--fluvy-radius-pill, 9999px); }
.add:hover { background-color: var(--fluvy-accent-wash, var(--fluvy-accent-fill)); }
.actions { bottom: -1px; ${QUIET} }`;
export const viewBadgesCss = `.add { ${ADD} border-radius: var(--fluvy-radius-pill, 9999px); }
.add:hover { background-color: var(--fluvy-accent-wash, var(--fluvy-accent-fill)); }`;

/** A section in edit mode: its frame a fine dashed hairline, its handle and menu a quiet tab on the frame's corner. */
export const sectionEditCss = `.section-wrapper { border: 1px dashed var(--fluvy-border-strong); }
.section-actions { bottom: -1px; ${QUIET} }`;

/** A card in edit mode: its edit and menu controls quiet rounds on the card fill. */
export const cardEditCss = `.control ha-svg-icon, .more ha-icon-button { ${QUIET} }`;

/** Add card, in a section: an add tile, the fine dashed accent outline on the tiles' radius. */
export const gridSectionAddCss = `.add { ${ADD} border-radius: var(--fluvy-radius-lg); }
.add:hover { background-color: var(--fluvy-accent-wash, var(--fluvy-accent-fill)); }`;

/** Create section and its drop helper: the add idiom on the sections' radius, the glyph in the accent. */
export const sectionsViewCss = `.create-section, .drop-helper { ${ADD} }
.create-section:hover { background-color: var(--fluvy-accent-wash, var(--fluvy-accent-fill)); }`;
