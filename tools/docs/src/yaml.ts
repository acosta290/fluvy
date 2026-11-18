/**
 * A card's configuration as the YAML a person pastes into a dashboard: block style, two spaces, the keys in the order
 * the example names them. Home Assistant's loader speaks YAML 1.1, where an unquoted `on`, `yes` or `16:9` is not the
 * word it looks like (a boolean, a number in base sixty), so a string is written plain only where no reader could
 * take it for anything else, and in single quotes otherwise. A key that is there to be read and not loaded (a default
 * the house decides, an option with nothing to write) is a comment in its place.
 */

/** What YAML 1.1 reads as something other than a word: its booleans and its null, in any case. */
const KEYWORD = /^(?:y|n|yes|no|on|off|true|false|null|~)$/i;

/**
 * A string no YAML reader takes for anything but itself: it starts with a letter, an underscore or a slash (never a
 * digit, a sign or a dot: a number, a time, a ratio, a date), holds no `: ` and no ` #`, ends in neither a colon nor
 * a space, and is not a keyword.
 */
const plain = (text: string): boolean =>
  /^[\p{L}_/]/u.test(text) &&
  !/[\n\r\t]|: | #|[:\s]$/.test(text) &&
  !/[[\]{},`"]/.test(text) &&
  !KEYWORD.test(text);

/** A string as a YAML scalar: plain where it can be, in single quotes otherwise; one of several lines in double. */
export function scalar(text: string): string {
  if (plain(text)) return text;
  return /[\n\r\t]/.test(text) ? JSON.stringify(text) : `'${text.replaceAll("'", "''")}'`;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value on one line: a scalar, or an empty list or map. */
function inline(value: unknown): string | undefined {
  if (typeof value === 'string') return scalar(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return value.length ? undefined : '[]';
  return Object.keys(value).length ? undefined : '{}';
}

/** The lines of a value that takes several: a list's items, a map's keys, each `indent` in. */
function block(value: unknown, indent: string): string[] {
  if (Array.isArray(value))
    return value.flatMap((item: unknown) => {
      const one = inline(item);
      if (one !== undefined) return [`${indent}- ${one}`];
      // an item's first line stands beside its dash, the rest under it
      const [first = '', ...rest] = block(item, `${indent}  `);
      return [`${indent}- ${first.trimStart()}`, ...rest];
    });
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, held]) => {
    const one = inline(held);
    if (one !== undefined) return [`${indent}${scalar(key)}: ${one}`];
    return [`${indent}${scalar(key)}:`, ...block(held, `${indent}  `)];
  });
}

/**
 * A configuration as YAML, without a trailing line break. The keys of `unset` are written as comments, there to be
 * read and never loaded: each with its value, every line of one that takes several (`# card_opacity: 100`), or alone
 * where it has none (`# color:`). Taking the `# ` off a key's lines sets it.
 */
export const toYaml = (
  config: Readonly<Record<string, unknown>>,
  unset: ReadonlySet<string> = new Set(),
): string =>
  Object.entries(config)
    .flatMap(([key, held]) => {
      if (!unset.has(key)) return block({ [key]: held }, '');
      const lines = held === undefined ? [`${scalar(key)}:`] : block({ [key]: held }, '');
      return lines.map((line) => `# ${line}`);
    })
    .join('\n');
