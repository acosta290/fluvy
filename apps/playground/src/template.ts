import type { HassEntity } from '@fluvy/core';

/**
 * The corner of Jinja the playground answers `render_template` with, as Home Assistant would for the templates a
 * row's text is likely to carry: `states('x')`, `state_attr('x', 'a')`, `is_state('x', 'v')`, the variables Fluvy
 * hands over (`entity`, `user`), strings and numbers, `~` to join, the filters `round(n)`, `int` and `float`, inside
 * `{{ … }}` with plain text around. Anything else is an error, as Home Assistant reports one. The rendered text is
 * then read as Home Assistant reads it: a number, True / False or None come back as such.
 */

export class TemplateError extends Error {}

/** What a template renders to, once the text has been read as Home Assistant reads it. */
export type Rendered = string | number | boolean | null;

type Value = unknown;

interface Scope {
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly variables: Readonly<Record<string, unknown>>;
}

interface Token {
  readonly kind: 'string' | 'number' | 'name' | 'punct';
  readonly text: string;
}

const TOKEN = /'([^']*)'|"([^"]*)"|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([()|~,])/y;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    if (/\s/.test(source[at] as string)) {
      at += 1;
      continue;
    }
    TOKEN.lastIndex = at;
    const match = TOKEN.exec(source);
    if (!match) throw new TemplateError(`unexpected '${source[at]}' in ${source.trim()}`);
    at = TOKEN.lastIndex;
    const [, single, double, number, name, punct] = match;
    const text = single ?? double;
    tokens.push(
      text !== undefined
        ? { kind: 'string', text }
        : number !== undefined
          ? { kind: 'number', text: number }
          : name !== undefined
            ? { kind: 'name', text: name }
            : { kind: 'punct', text: punct as string },
    );
  }
  return tokens;
}

/** A value as Jinja writes it into the text: None, True and False as Python says them. */
const str = (value: Value): string =>
  value === null || value === undefined
    ? 'None'
    : typeof value === 'boolean'
      ? value
        ? 'True'
        : 'False'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

/** `operand ('~' operand)*`, an operand being `atom ('|' filter)*`. */
class Parser {
  private at = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly scope: Scope,
  ) {}

  expression(): Value {
    const parts = [this.operand()];
    while (this.take('~')) parts.push(this.operand());
    const left = this.tokens[this.at];
    if (left) throw new TemplateError(`unexpected '${left.text}'`);
    return parts.length === 1 ? parts[0] : parts.map(str).join('');
  }

  private operand(): Value {
    let value = this.atom();
    while (this.take('|')) value = this.filter(value);
    return value;
  }

  private atom(): Value {
    const token = this.next();
    if (token.kind === 'string') return token.text;
    if (token.kind === 'number') return Number(token.text);
    if (token.kind === 'name') {
      if (this.peek('(')) return this.call(token.text);
      if (token.text in this.scope.variables) return this.scope.variables[token.text];
      throw new TemplateError(`'${token.text}' is undefined`);
    }
    throw new TemplateError(`unexpected '${token.text}'`);
  }

  private call(name: string): Value {
    const args = this.args();
    const state = this.scope.states[String(args[0])];
    switch (name) {
      case 'states':
        return state?.state ?? 'unknown';
      case 'state_attr':
        return state?.attributes[String(args[1])] ?? null;
      case 'is_state':
        return state?.state === String(args[1]);
      default:
        throw new TemplateError(`'${name}' is undefined`);
    }
  }

  /**
   * Home Assistant's `round` (an int at precision 0, else a float, written with its decimals as Python writes one),
   * Jinja's `int` and `float`; each refuses what is not a number, as they do without a default.
   */
  private filter(value: Value): Value {
    const name = this.next();
    if (name.kind !== 'name') throw new TemplateError("a filter is expected after '|'");
    const args = this.peek('(') ? this.args() : [];
    const number = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || Number.isNaN(number))
      throw new TemplateError(`${name.text}: ${str(value)} is not a number`);
    switch (name.text) {
      case 'round': {
        const digits = Number(args[0] ?? 0);
        return digits === 0 ? Math.round(number) : number.toFixed(digits);
      }
      case 'int':
        return Math.trunc(number);
      case 'float':
        return number;
      default:
        throw new TemplateError(`No filter named '${name.text}'`);
    }
  }

  private args(): Value[] {
    this.expect('(');
    const args: Value[] = [];
    if (!this.peek(')'))
      do args.push(this.operand());
      while (this.take(','));
    this.expect(')');
    return args;
  }

  private next(): Token {
    const token = this.tokens[this.at];
    if (!token) throw new TemplateError('unexpected end of expression');
    this.at += 1;
    return token;
  }

  private peek(text: string): boolean {
    const token = this.tokens[this.at];
    return token?.kind === 'punct' && token.text === text;
  }

  private take(text: string): boolean {
    if (!this.peek(text)) return false;
    this.at += 1;
    return true;
  }

  private expect(text: string): void {
    if (!this.take(text)) throw new TemplateError(`'${text}' expected`);
  }
}

/** The rendered text as Home Assistant reads it back: a number, True / False, None, else the text. */
const read = (text: string): Rendered =>
  /^-?\d+(\.\d+)?$/.test(text)
    ? Number(text)
    : text === 'True' || text === 'False'
      ? text === 'True'
      : text === 'None'
        ? null
        : text;

/** `template` rendered against `states` (and the variables the caller hands over); a `TemplateError` when it cannot be. */
export function renderTemplate(
  template: string,
  states: Readonly<Record<string, HassEntity>>,
  variables: Readonly<Record<string, unknown>> = {},
): Rendered {
  if (template.includes('{%')) throw new TemplateError('{% … %} statements are not supported here');
  const scope: Scope = { states, variables };
  let text = '';
  let at = 0;
  for (const match of template.matchAll(/\{\{(.*?)\}\}/gs)) {
    const expression = new Parser(tokenize(match[1] as string), scope).expression();
    text += template.slice(at, match.index) + str(expression);
    at = match.index + match[0].length;
  }
  text += template.slice(at);
  if (text.includes('{{') || text.includes('}}'))
    throw new TemplateError('unexpected end of template');
  return read(text);
}
