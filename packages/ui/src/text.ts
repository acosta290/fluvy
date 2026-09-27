/**
 * Text measured as the page will draw it. Deciding before a render whether a wording fits (a pill's width, a
 * title's size, "Showers · 60 %" in a narrow row) needs the width the layout will give it — and a canvas cannot
 * give it: it knows no `font-feature-settings`, and Fluvy's Inter is drawn with its single-storey a and open digits
 * (`cv11`, `ss01`), a pixel or two wider per word. So one hidden probe on the page lays each text out in the same
 * face and features, and every answer is cached (a web font that arrives clears them: what was measured in the
 * fallback face is wrong now).
 *
 * A face is a CSS `font` shorthand ("600 12px Inter, sans-serif") or its parts. Without a layout (unit tests) the
 * answer is a generous estimate.
 */
export interface TextFace {
  readonly size: number;
  readonly weight: number;
  /** Letter spacing in em. */
  readonly tracking?: number;
  readonly upper?: boolean;
  /** Tabular figures (values, times). */
  readonly tabular?: boolean;
  readonly family?: string;
}

const FEATURES = "'cv11', 'ss01'";
const FAMILY = 'Inter, system-ui, sans-serif';
const LIMIT = 2048;

let probe: HTMLSpanElement | undefined;
const widths = new Map<string, number>();
let listening = false;

/** Forget every width (the page's face changed). */
export const forgetTextWidths = (): void => widths.clear();

function listen(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.fonts?.addEventListener?.('loadingdone', forgetTextWidths);
}

function keyOf(face: TextFace | string): string {
  return typeof face === 'string'
    ? face
    : `${face.weight} ${face.size}px ${face.family ?? FAMILY}|${face.tracking ?? 0}|${face.upper ? 1 : 0}|${face.tabular ? 1 : 0}`;
}

/** The width `text` takes in `face`, in CSS px (fractional, as layout reports it). */
export function textWidth(text: string, face: TextFace | string): number {
  if (!text) return 0;
  if (typeof document === 'undefined') return text.length * 8;
  const key = `${keyOf(face)}|${text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  listen();
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;contain:layout style;white-space:pre';
  }
  if (!probe.isConnected) document.body.append(probe);
  const style = probe.style;
  if (typeof face === 'string') {
    style.font = face;
    style.letterSpacing = 'normal';
    style.textTransform = 'none';
    style.fontVariantNumeric = 'normal';
  } else {
    style.font = `${face.weight} ${face.size}px ${face.family ?? FAMILY}`;
    style.letterSpacing = face.tracking ? `${face.tracking}em` : 'normal';
    style.textTransform = face.upper ? 'uppercase' : 'none';
    style.fontVariantNumeric = face.tabular ? 'tabular-nums' : 'normal';
  }
  // set after the face: the `font` shorthand resets them to their defaults
  style.fontFeatureSettings = FEATURES;
  style.fontKerning = 'normal';
  style.fontOpticalSizing = 'auto';
  probe.textContent = text;
  const measured = probe.getBoundingClientRect().width;
  // no layout (a test page): a generous estimate, never cached
  if (!measured) return text.length * 8;
  if (widths.size > LIMIT) widths.clear();
  widths.set(key, measured);
  return measured;
}

/** The first candidate that fits `room` px; the last one (the shortest) when none does. */
export function firstFit(
  candidates: readonly string[],
  room: number,
  face: TextFace | string,
): string {
  for (const text of candidates) if (textWidth(text, face) <= room) return text;
  return candidates[candidates.length - 1] ?? '';
}

/** A pill's width: its text plus its sides (and the gaps between its parts), up to the 4 px grid. */
export function pillWidth(
  texts: readonly string[],
  face: TextFace | string,
  sides: number,
  gap = 0,
): number {
  const text = texts.reduce((sum, part) => sum + textWidth(part, face), 0);
  return Math.ceil((Math.ceil(text) + sides + gap * (texts.length - 1)) / 4) * 4;
}

/** The face an element draws its text in, from its computed longhands (a shorthand cannot say tabular figures). */
export function faceOf(element: Element): TextFace {
  const style = getComputedStyle(element);
  const size = parseFloat(style.fontSize) || 14;
  const spacing = parseFloat(style.letterSpacing);
  return {
    size,
    weight: Number(style.fontWeight) || 400,
    family: style.fontFamily || FAMILY,
    ...(Number.isFinite(spacing) && spacing ? { tracking: spacing / size } : {}),
    ...(style.textTransform === 'uppercase' ? { upper: true } : {}),
    ...(style.fontVariantNumeric.includes('tabular') ? { tabular: true } : {}),
  };
}

/**
 * How many lines `text` takes wrapped into `width`, as the browser wraps it: word by word at spaces and after a hyphen
 * ("power-on"), each candidate line measured whole (kerning and all) with `measure` — the one-line width of a string
 * in the face or class that draws it; a word wider than the line breaks inside itself (`overflow-wrap: anywhere`).
 */
export function linesNeeded(
  text: string,
  width: number,
  measure: (text: string) => number,
): number {
  if (width <= 0) return Number.POSITIVE_INFINITY;
  let lines = 0;
  let line = '';
  let glue = '';
  for (const token of text.trim().match(/[^\s-]*-(?=\S)|\S+/g) ?? []) {
    const candidate = line ? `${line}${glue}${token}` : token;
    glue = token.endsWith('-') ? '' : ' ';
    if (line && measure(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines += 1;
    const alone = measure(token);
    lines += Math.max(1, Math.ceil(alone / width)) - 1;
    line = alone > width ? '' : token;
    if (!line) lines += 1;
  }
  return lines + (line ? 1 : 0);
}
