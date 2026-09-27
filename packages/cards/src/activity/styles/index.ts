import { pageStyles } from './page.js';
import { dayStyles } from './day.js';
import { toolStyles } from './tools.js';
import { timelineStyles } from './timeline.js';
import { cardStyles } from './card.js';
import { detailStyles } from './detail.js';
import { quietStyles } from './quiet.js';
import { floatingStyles } from './floating.js';
import { motionStyles } from './motion.js';

/**
 * The Activity view. The page's one scroll is the timeline's: under the bar, the day, the tools and the hours in a
 * centred column, the time rail sticky beside it (the rail is the scrollbar: the native one is hidden). Rows are the
 * language's two-line list rows (64: 12, the 40 circle, 12; 15/20 over 13/16) on the 4 grid, a wrapped line too; the node
 * column carries one spine through the day, through each hour's header, dashed across quiet stretches, down to the
 * start of the day. Motion is transform and opacity (and a fold's height); all of it stops with reduced motion.
 *
 * The parts are listed in the cascade's order: a later part may restate an earlier one's rule (a card's, a phone's).
 */
export const activityStyles = [
  pageStyles,
  dayStyles,
  toolStyles,
  timelineStyles,
  cardStyles,
  detailStyles,
  quietStyles,
  floatingStyles,
  motionStyles,
];
