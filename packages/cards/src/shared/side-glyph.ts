import { addGlyphs } from '@fluvy/ui';

/*
 * The dashboard sidebar's own glyph (1.21, #187): a page with a column at its side, drawn as `sidePanel` once this
 * file has run — by the sidebar itself (its drawer's round) and by the settings panel (its row and its section), each
 * in a chunk of its own, so neither carries the other.
 */
addGlyphs({
  sidePanel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/>',
});
