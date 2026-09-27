import { emptyState } from './shared.js';

/**
 * The notifications drawer: a white header without a hairline, the list 16 px in, and the empty state as the cards
 * draw it (on the drawer's page fill, so a page-alt panel). Inside the floating frame the drawer already stands in
 * its 16 px: Home Assistant's safe-area padding (the same 16) is not added again.
 */
export const notificationsCss = `ha-header-bar { border-bottom: 0; --header-bar-padding: calc(var(--safe-area-inset-top, 0px) - var(--fluvy-frame, 0px)) calc(var(--safe-area-inset-right, 0px) - var(--fluvy-frame, 0px)) 0 calc(var(--safe-area-inset-left, 0px) - var(--fluvy-frame, 0px)); }
.notifications { background-color: var(--primary-background-color); --fluvy-empty-surface: var(--fluvy-page-alt); --fluvy-empty-margin: 8px 16px 0;
  padding-left: calc(var(--safe-area-inset-left, 0px) - var(--fluvy-frame, 0px)); padding-inline-start: calc(var(--safe-area-inset-left, 0px) - var(--fluvy-frame, 0px)); padding-bottom: calc(var(--safe-area-inset-bottom, 0px) - var(--fluvy-frame, 0px));
  height: calc(100% - var(--header-height) - var(--safe-area-inset-top, 0px) + var(--fluvy-frame, 0px)); }
.list-container { padding-top: 8px; }
.notification { padding: 0 16px 12px; }
.notification-actions { border-top: 0; padding: 4px 16px 16px; }
${emptyState('.empty', 'check')}
.empty > div { display: none; }`;

/** The header bar of a drawer: the title as a card title (20/600), not a 400 line. */
export const headerBarCss =
  '.title, [slot="title"], ::slotted([slot="title"]) { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }';

/** A notification card: the header as our card head (16/600), the body 14/20, the actions on the card's own rhythm. */
export const notificationItemCss = `ha-card .header { font-size: 16px; font-weight: 600; line-height: 20px; letter-spacing: -0.006em; padding: 20px 20px 0; }
.contents { padding: 8px 20px 16px; font-size: 14px; line-height: 20px; }
.actions { border-top: 0; padding: 0 12px 12px; }`;
