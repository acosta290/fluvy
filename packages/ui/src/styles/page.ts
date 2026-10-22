import { unsafeCSS } from 'lit';
import { pageCss } from './generated/page.js';

/**
 * Page chrome (the bar and the floating layers): the Activity and History pages', never a card's — a module of its
 * own, so it travels with the pages.
 */
export const pageStyles = unsafeCSS(pageCss);
