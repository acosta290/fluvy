import { css } from 'lit';

/**
 * The engine's sheet: everything a chart or a gauge drawn by it is styled with, one copy for every card that draws
 * one. The classic classes keep their names (`fv-curve`, `curve-line`, `curve-area`, `curve-dot`, `curve-cursor`,
 * `curve-fill-a/b`, `fv-vbar`, `ax-grid`, `ax-tick`, `ax-unit`: the suites and the cards' own rules query them); the
 * engine's own are `fc-*`. A series' ink is the tone its group carries (`--tone-ink`; on `fc-set`, the mode's of the two
 * colours a house's set carries), the accent where none; the fills, the soft copy and the bars derive from it here,
 * once. A card in a lazy chunk adds `chartStyles` to its styles; a core card has the engine adopt it as it lands
 * (`adopt`).
 */
export const chartStyles = css`
  /* ---------- the classic curve (1.0): its line, its fill, its cursor and its dot ---------- */
  .fv-curve .curve-line {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .fv-curve .curve-fill-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.28;
  }
  .fv-curve .curve-fill-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0;
  }
  .fv-curve .curve-cursor {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }
  .fv-curve .curve-dot {
    fill: var(--tone-ink, var(--fluvy-accent));
    stroke: var(--fluvy-card);
    stroke-width: 3;
  }
  /* the line draws itself in, then its fill, its dot and its cursor arrive */
  .fv-curve .curve-line {
    stroke-dasharray: 1;
    animation: fv-draw 900ms var(--fv-ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms);
  }
  .fv-curve .curve-area,
  .fv-curve .curve-dot,
  .fv-curve .curve-cursor {
    animation: fv-fade 500ms var(--fv-ease) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
  }

  /* ---------- the styles (1.11): the line, its soft copy, its fill, the forecast, the marks ---------- */
  /* a style's fills are read from the chart's --fc-fill (the house's 18 %, a flat one two thirds of it, several 16 %);
     in dark mode they take six points more */
  .fc-chart {
    --fc-boost: 0;
  }
  :host([dark]) .fc-chart,
  [data-mode='dark'] .fc-chart {
    --fc-boost: 0.06;
  }
  /* a colour of the house's own set carries itself fitted to the light card and the dark one: it wears the mode's */
  .fc-set {
    --tone-ink: var(--fc-light);
  }
  :host([dark]) .fc-set,
  [data-mode='dark'] .fc-set {
    --tone-ink: var(--fc-dark);
  }
  .fc-line {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    animation: fv-draw 900ms var(--fv-ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms);
  }
  /* the soft copy: the ink at 55 % over the card, at the house's strength (its stroke-opacity) */
  .fc-glow {
    fill: none;
    stroke: color-mix(in srgb, var(--tone-ink, var(--fluvy-accent)) 55%, var(--fluvy-card));
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fc-fill-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: calc(var(--fc-fill, 0.18) + var(--fc-boost));
  }
  .fc-fill-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0;
  }
  .fc-area--flat {
    fill: var(--tone-ink, var(--fluvy-accent));
    fill-opacity: calc(var(--fc-fill, 0.12) + var(--fc-boost));
  }
  .fc-band {
    fill: var(--tone-ink, var(--fluvy-accent));
    fill-opacity: calc(0.14 + var(--fc-boost));
  }
  .fc-area,
  .fc-band,
  .fc-glow,
  .fc-future,
  .fc-now,
  .fc-cursor,
  .fc-chart .curve-dot,
  .fc-knob {
    animation: fv-fade 500ms var(--fv-ease) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
  }
  /* the forecast: dashed in the disabled ink, or the line's own, faint */
  .fc-future {
    fill: none;
    stroke: var(--fluvy-text-disabled);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 4 5;
  }
  .fc-future--faint {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-dasharray: none;
    stroke-opacity: 0.35;
  }
  /* every reading drawn: the classic dot, smaller, its stroke the card's */
  .fv-curve .fc-point {
    stroke-width: 2;
  }
  /* Fluvy's knob on a chart (controls.css draws it): placed by the drawing's coordinates, never taking a pointer */
  .fc-knob {
    pointer-events: none;
  }
  .fc-now,
  .fc-cursor {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1;
  }

  /* ---------- grids and scales: hairlines in the border's colour, the zero line strong, ticks 11/500 ---------- */
  .fc-grid {
    stroke: var(--fluvy-border);
    stroke-width: 1;
  }
  .fc-grid--dashed {
    stroke-dasharray: 3 3;
  }
  .fc-grid--zero {
    stroke: var(--fluvy-border-strong);
    stroke-dasharray: none;
  }
  .ax-grid {
    stroke: var(--fluvy-border);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .ax-tick,
  .ax-unit,
  .fc-tick {
    font-size: 11px;
    font-weight: 500;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    fill: var(--fluvy-text-secondary);
  }
  /* a scale is read, so the hours under a scaled chart take the secondary ink too, as the ticks do */
  .is-scaled + .fv-axis {
    color: var(--fluvy-text-secondary);
  }

  /* ---------- bars: the classic gradient, the ink, the quiet ones beside the highest, the hollow forecast ---------- */
  .fv-vbar {
    transform-origin: 50% 100%;
    animation: fv-grow-y 560ms var(--fv-ease-out) both;
  }
  .fv-vbar--on {
    fill: var(--tone-ink, var(--fluvy-accent));
  }
  .fv-vbar--off {
    fill: var(--fluvy-border-strong);
  }
  .fv-vbar--forecast {
    fill: var(--tone-fill, var(--fluvy-accent-fill));
  }
  .fc-bar {
    fill: var(--tone-ink, var(--fluvy-accent));
    transform-origin: 50% 100%;
    animation: fv-grow-y 560ms var(--fv-ease-out) both;
  }
  .fc-bar--quiet {
    fill: var(--fluvy-border);
  }
  .fc-bar--hollow {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 1;
    stroke-dasharray: 3 2;
    stroke-opacity: 0.6;
  }
  .fc-bar-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.6;
  }
  .fc-bar-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.48;
  }
  .fc-value {
    font-size: 12px;
    font-weight: 500;
    fill: var(--fluvy-text);
    font-variant-numeric: tabular-nums;
  }
  .fc-value.is-lit {
    font-weight: 600;
  }
  .fc-max {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 1;
    stroke-dasharray: 2 4;
    stroke-opacity: 0.7;
  }
  .fc-max__word {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    fill: var(--tone-ink, var(--fluvy-accent));
  }

  /* ---------- the bubble in the series' tone, the highlight pill, the legend ---------- */
  .fv-bubble--tone {
    background: var(--tone-ink, var(--fluvy-accent));
    color: #fff;
  }
  .fv-bubble--tone::after {
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: 12px;
    background: var(--tone-fill, var(--fluvy-accent-fill));
    color: var(--tone-on, var(--fluvy-accent-on-fill));
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .fc-pill__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    color: var(--fluvy-text-secondary);
  }
  .fc-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .fc-legend__swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-legend__name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .fc-legend__value {
    color: var(--fluvy-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ---------- gauges: the ring and the reading in its middle (the dial and the ruler are the controls') ---------- */
  .fc-gauge {
    position: relative;
    margin: 0 auto;
  }
  .fc-gauge > svg {
    display: block;
    overflow: visible;
  }
  .fc-ring__track,
  .fc-ring__lit {
    fill: none;
  }
  .fc-ring__track {
    stroke: var(--fluvy-border);
  }
  .fc-ring__lit {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-linecap: round;
  }
  .fc-gauge__value {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    text-align: center;
  }
  .fc-gauge__value b {
    font-size: 32px;
    font-weight: 700;
    line-height: 36px;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--fluvy-text);
  }
  .fc-gauge__value span {
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    color: var(--fluvy-text-secondary);
  }
  .fc-gauge__label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .fc-gauge--small .fc-gauge__value b {
    font-size: 22px;
    line-height: 28px;
  }

  /* a chart told not to move: its resting frame at once, whatever the system says of motion */
  .fc-chart.is-still,
  .fc-chart.is-still *,
  .fc-chart.is-still ~ .fc-knob {
    animation: none !important;
  }
`;

/**
 * The engine's sheet into a card's shadow root, once, beside the card's own (as the light card's colour controls
 * adopt theirs): a core card fetches the engine on demand and adopts it as it lands.
 */
export function adopt(root: ShadowRoot): void {
  const sheet = chartStyles.styleSheet;
  if (sheet) {
    if (!root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else if (!root.querySelector('style[data-fluvy-chart]')) {
    // no constructible sheets: a style element ahead of what Lit renders, where its own fallback puts them
    const element = document.createElement('style');
    element.dataset['fluvyChart'] = '';
    element.textContent = chartStyles.cssText;
    root.prepend(element);
  }
}
