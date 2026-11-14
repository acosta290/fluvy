/*
 * A configuration as YAML, for a dashboard kept in a file: the table the panel made, written as a person would write
 * it, to copy beside `views:`. Tables and lists in block style, a word plain where YAML reads it back as that word and
 * quoted where it would not (a number, `true`, `off`, a colon, a leading mark).
 */

/** What YAML would read as something other than the word: a number, a truth value, nothing. */
const NOT_A_WORD = /^(?:[-+]?(?:\d|\.\d)[\d._eE+-]*|true|false|yes|no|on|off|null|~|)$/i;
/**
 * A word YAML takes plain: it starts with a letter or a slash, and holds nothing that would end it (a colon only
 * inside a word, as in `custom:fluvy-clock-card`). One that starts with a digit is quoted whatever follows: Home
 * Assistant's YAML reads `07:30` as a number of minutes and `2026-11-14` as a date.
 */
const PLAIN = /^[\p{L}_/](?:[^#:[\]{},&*!|>'"%@`\n]|:(?=\S))*$/u;

const scalar = (value: unknown): string => {
  if (typeof value === 'string')
    return PLAIN.test(value) && !NOT_A_WORD.test(value) && value === value.trim()
      ? value
      : JSON.stringify(value);
  return value === undefined ? 'null' : JSON.stringify(value);
};

const isTable = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A key as YAML takes it: plain where it is a word, quoted otherwise. */
const keyOf = (key: string): string => (/^[\w-]+$/.test(key) ? key : JSON.stringify(key));

/** A value's lines at a depth: a table a key a line, a list a dash an item, anything else on its key's line. */
function lines(value: unknown, depth: number): string[] {
  const pad = '  '.repeat(depth);
  if (Array.isArray(value))
    return value.flatMap((item) => {
      if ((isTable(item) && Object.keys(item).length) || (Array.isArray(item) && item.length)) {
        const [first = '', ...rest] = lines(item, depth + 1);
        return [`${pad}- ${first.trimStart()}`, ...rest];
      }
      return [`${pad}- ${empty(item)}`];
    });
  if (isTable(value))
    return Object.entries(value).flatMap(([key, item]) =>
      (isTable(item) && Object.keys(item).length) || (Array.isArray(item) && item.length)
        ? [`${pad}${keyOf(key)}:`, ...lines(item, depth + 1)]
        : [`${pad}${keyOf(key)}: ${empty(item)}`],
    );
  return [`${pad}${scalar(value)}`];
}

/** What has nothing in it, or is no table: on one line. */
const empty = (value: unknown): string =>
  Array.isArray(value) ? '[]' : isTable(value) ? '{}' : scalar(value);

/** A value as YAML under its key (`fluvy_sidebar:` and the table under it). */
export const toYaml = (key: string, value: unknown): string =>
  lines({ [key]: value }, 0).join('\n');
