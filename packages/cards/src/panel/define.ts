// the preview shows the real cards: the catalogue is defined first (in the build it already is)
import '../index.js';
import { FluvyPanel } from './panel.js';

/** Fluvy's settings panel as Home Assistant's custom panel names it (`panel_custom`: `fluvy-panel`). */
if (!customElements.get('fluvy-panel')) customElements.define('fluvy-panel', FluvyPanel);

export { FluvyPanel };
