import type { HassEntity } from '@fluvy/core';

/**
 * The corner of Jinja the playground answers `render_template` with, as Home Assistant would for the templates a
 * row's text and a template card are likely to carry: `states('x')`, `state_attr('x', 'a')`, `is_state('x', 'v')`,
 * the variables Fluvy hands over (`entity`, `user`), strings, numbers, `true`, `false` and `none`, `~` to join, the
 * arithmetic (`+`, `-`, `*`, `/`, `//`, a sign, parentheses: Mushroom's `(state_attr(entity, 'brightness') / 2.55) |
 * round(0)`), the comparisons (`==`, `!=`, `<`, `>`, `<=`, `>=`), `and`, `or` and `not`, the inline `a if b else c`,
 * the filters `round(n)`, `int`, `float`, `upper`, `lower`, `title` and `capitalize`, inside `{{ … }}` with plain
 * text around, and `{% if %}`, `{% elif %}`, `{% else %}`, `{% endif %}` round the text, each bound as Jinja binds it
 * (a filter tightest, then a sign, `*` `/` `//`, `~`, `+` `-`, the comparisons). Only what is chosen is worked out, as
 * Jinja does; a number is written as JavaScript writes it (`2`, where Python writes a division's `2.0`). A name the
 * template reads that is not defined is nothing, said as a warning, as Home Assistant says it under `strict: false`;
 * anything else is an error, as Home Assistant reports one. The rendered text is then stripped and read as Home
 * Assistant reads it: a number, True / False or None come back as such.
 */

export class TemplateError extends Error {}

/** What a template renders to, once the text has been read as Home Assistant reads it. */
export type Rendered = string | number | boolean | null;

/** A value in the template: undefined is Jinja's undefined, which writes nothing; null is None. */
type Value = unknown;

/** A part of an expression, parsed once and worked out when it is asked (an `else` branch not taken never is). */
type Thunk = () => Value;

interface Scope {
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly variables: Readonly<Record<string, unknown>>;
  /** Says a warning, as Home Assistant's `log_fn` does while it renders. */
  readonly warn: (message: string) => void;
}

interface Token {
  readonly kind: 'string' | 'number' | 'name' | 'punct';
  readonly text: string;
}

const TOKEN =
  /'([^']*)'|"([^"]*)"|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(==|!=|<=|>=|<|>|\/\/|[-+*/()|~,])/y;

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

/** A value as Jinja writes it into the text: undefined as nothing, None, True and False as Python says them. */
const str = (value: Value): string =>
  value === undefined
    ? ''
    : value === null
      ? 'None'
      : typeof value === 'boolean'
        ? value
          ? 'True'
          : 'False'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

/** Python's truth: nothing, none, false, 0 and the empty text are false. */
const truthy = (value: Value): boolean =>
  value !== undefined && value !== null && value !== false && value !== 0 && value !== '';

/** The words that are values: Jinja writes them in lower case, Python's spelling is read too. */
const LITERALS: Readonly<Record<string, Value>> = {
  true: true,
  True: true,
  false: false,
  False: false,
  none: null,
  None: null,
};

/** Python's comparisons: equal across kinds is false, an order across kinds an error. */
function compare(operator: string, a: Value, b: Value): boolean {
  if (operator === '==') return a === b;
  if (operator === '!=') return a !== b;
  const comparable =
    (typeof a === 'number' && typeof b === 'number') ||
    (typeof a === 'string' && typeof b === 'string');
  if (!comparable)
    throw new TemplateError(`'${operator}' not supported between ${str(a)} and ${str(b)}`);
  const [x, y] = [a as number | string, b as number | string];
  return operator === '<' ? x < y : operator === '>' ? x > y : operator === '<=' ? x <= y : x >= y;
}

/**
 * Python's arithmetic on what the template hands it: numbers, and `+` joining two texts; anything else an error, as
 * Python's `TypeError` (`None / 2.55`, an attribute a light that is off does not have) and its division by zero are.
 */
function arithmetic(operator: string, a: Value, b: Value): number | string {
  if (operator === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
  if (typeof a !== 'number' || typeof b !== 'number')
    throw new TemplateError(`unsupported operand type(s) for ${operator}: ${str(a)} and ${str(b)}`);
  if ((operator === '/' || operator === '//') && b === 0)
    throw new TemplateError('division by zero');
  return operator === '+'
    ? a + b
    : operator === '-'
      ? a - b
      : operator === '*'
        ? a * b
        : operator === '/'
          ? a / b
          : Math.floor(a / b);
}

/**
 * `or` over `and` over `not` over a comparison of sums (`+`, `-`) of `~`-joined products (`*`, `/`, `//`) of signed
 * operands, an operand being `atom ('|' filter)*`; the whole may be `a if b else c`. Each part is parsed into a thunk,
 * worked out only when its value is needed.
 */
class Parser {
  private at = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly scope: Scope,
  ) {}

  /** The whole expression: nothing may be left after it. */
  expression(): Thunk {
    const value = this.conditional();
    const left = this.tokens[this.at];
    if (left) throw new TemplateError(`unexpected '${left.text}'`);
    return value;
  }

  /** `a if b else c`; without its `else`, nothing when `b` is false. */
  private conditional(): Thunk {
    const value = this.or();
    if (!this.word('if')) return value;
    const test = this.or();
    const otherwise: Thunk = this.word('else') ? this.conditional() : () => undefined;
    return () => (truthy(test()) ? value() : otherwise());
  }

  private or(): Thunk {
    let left = this.and();
    while (this.word('or')) {
      const [a, b] = [left, this.and()];
      left = () => {
        const value = a();
        return truthy(value) ? value : b();
      };
    }
    return left;
  }

  private and(): Thunk {
    let left = this.not();
    while (this.word('and')) {
      const [a, b] = [left, this.not()];
      left = () => {
        const value = a();
        return truthy(value) ? b() : value;
      };
    }
    return left;
  }

  private not(): Thunk {
    if (!this.word('not')) return this.comparison();
    const value = this.not();
    return () => !truthy(value());
  }

  private comparison(): Thunk {
    let left = this.sum();
    for (let operator = this.operator(); operator; operator = this.operator()) {
      const [a, b, op] = [left, this.sum(), operator];
      left = () => compare(op, a(), b());
    }
    return left;
  }

  private sum(): Thunk {
    let left = this.concat();
    for (let op = this.among('+', '-'); op; op = this.among('+', '-')) {
      const [a, b, operator] = [left, this.concat(), op];
      left = () => arithmetic(operator, a(), b());
    }
    return left;
  }

  private concat(): Thunk {
    const parts = [this.product()];
    while (this.take('~')) parts.push(this.product());
    if (parts.length === 1) return parts[0] as Thunk;
    return () => parts.map((part) => str(part())).join('');
  }

  private product(): Thunk {
    let left = this.signed();
    for (let op = this.among('*', '/', '//'); op; op = this.among('*', '/', '//')) {
      const [a, b, operator] = [left, this.signed(), op];
      left = () => arithmetic(operator, a(), b());
    }
    return left;
  }

  /** A sign, then the operand's filters: Jinja filters what is signed (`-x | round` rounds `-x`). */
  private signed(filtered = true): Thunk {
    const sign = this.among('-', '+');
    let value: Thunk;
    if (sign) {
      const inner = this.signed(false);
      value = () => {
        const number = inner();
        if (typeof number !== 'number')
          throw new TemplateError(`bad operand type for unary ${sign}: ${str(number)}`);
        return sign === '-' ? -number : number;
      };
    } else value = this.atom();
    if (filtered) while (this.take('|')) value = this.filter(value);
    return value;
  }

  private atom(): Thunk {
    const token = this.next();
    if (token.kind === 'string') return () => token.text;
    if (token.kind === 'number') return () => Number(token.text);
    if (token.kind === 'punct' && token.text === '(') {
      const inner = this.conditional();
      this.expect(')');
      return inner;
    }
    if (token.kind === 'name') {
      const name = token.text;
      if (this.peek('(')) return this.call(name);
      if (Object.hasOwn(LITERALS, name)) return () => LITERALS[name];
      // a variable handed over as undefined never reaches Home Assistant (JSON leaves it out): it is not defined
      return () => {
        const variable = this.scope.variables[name];
        if (variable === undefined) this.scope.warn(`'${name}' is undefined`);
        return variable;
      };
    }
    throw new TemplateError(`unexpected '${token.text}'`);
  }

  private call(name: string): Thunk {
    const args = this.args();
    if (!['states', 'state_attr', 'is_state'].includes(name))
      throw new TemplateError(`'${name}' is undefined`);
    return () => {
      const values = args.map((arg) => arg());
      const state = this.scope.states[String(values[0])];
      if (name === 'states') return state?.state ?? 'unknown';
      if (name === 'state_attr') return state?.attributes[String(values[1])] ?? null;
      return state?.state === String(values[1]);
    };
  }

  /**
   * Home Assistant's `round` (an int at precision 0, else a float, written with its decimals as Python writes one),
   * Jinja's `int` and `float`, each refusing what is not a number, as they do without a default; and Jinja's `upper`,
   * `lower`, `title` and `capitalize`, on the value as it is written.
   */
  private filter(value: Thunk): Thunk {
    const name = this.next();
    if (name.kind !== 'name') throw new TemplateError("a filter is expected after '|'");
    const args = this.peek('(') ? this.args() : [];
    const text = (input: Value): string => str(input);
    const words: Readonly<Record<string, (input: string) => string>> = {
      upper: (input) => input.toUpperCase(),
      lower: (input) => input.toLowerCase(),
      title: (input) =>
        input.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (m) => m.toUpperCase()),
      capitalize: (input) => input.charAt(0).toUpperCase() + input.slice(1).toLowerCase(),
    };
    const word = words[name.text];
    if (word) return () => word(text(value()));
    if (!['round', 'int', 'float'].includes(name.text))
      throw new TemplateError(`No filter named '${name.text}'`);
    return () => {
      const input = value();
      const number = Number(input);
      if (
        input === null ||
        input === undefined ||
        input === '' ||
        typeof input === 'boolean' ||
        Number.isNaN(number)
      )
        throw new TemplateError(`${name.text}: ${str(input)} is not a number`);
      if (name.text === 'int') return Math.trunc(number);
      if (name.text === 'float') return number;
      const digits = Number(args[0]?.() ?? 0);
      return digits === 0 ? Math.round(number) : number.toFixed(digits);
    };
  }

  private args(): Thunk[] {
    this.expect('(');
    const args: Thunk[] = [];
    if (!this.peek(')'))
      do args.push(this.conditional());
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

  /** One of these operators next: taken, and said which. */
  private among(...texts: readonly string[]): string | undefined {
    return texts.find((text) => this.take(text));
  }

  /** A keyword (`if`, `and`, `not` …) next: taken. */
  private word(text: string): boolean {
    const token = this.tokens[this.at];
    if (token?.kind !== 'name' || token.text !== text) return false;
    this.at += 1;
    return true;
  }

  private operator(): string | undefined {
    const token = this.tokens[this.at];
    if (token?.kind !== 'punct' || !['==', '!=', '<', '>', '<=', '>='].includes(token.text))
      return undefined;
    this.at += 1;
    return token.text;
  }

  private expect(text: string): void {
    if (!this.take(text)) throw new TemplateError(`'${text}' expected`);
  }
}

/** A template's parts: its text, what it prints (`{{ … }}`), and its `{% if %}` blocks, each branch with its test. */
type Part = string | Thunk | readonly Branch[];
interface Branch {
  /** None: the `else`. */
  readonly test?: Thunk;
  readonly body: Part[];
}

/** The template's parts, its blocks nested as they are opened and closed. */
function parse(template: string, scope: Scope): Part[] {
  const root: Part[] = [];
  /** The open `if` blocks, innermost last: the branches so far, where the next part goes. */
  const open: Array<{ branches: Branch[]; body: Part[] }> = [];
  const into = (): Part[] => open.at(-1)?.body ?? root;
  const expression = (source: string): Thunk => new Parser(tokenize(source), scope).expression();
  let at = 0;
  for (const match of template.matchAll(/\{\{(.*?)\}\}|\{%-?\s*(.*?)\s*-?%\}/gs)) {
    into().push(template.slice(at, match.index));
    at = match.index + match[0].length;
    const [, printed, statement] = match;
    if (printed !== undefined) {
      into().push(expression(printed));
      continue;
    }
    const [, keyword = '', rest = ''] = /^(\w+)\s*(.*)$/s.exec(statement ?? '') ?? [];
    const block = open.at(-1);
    if (keyword === 'if') {
      const body: Part[] = [];
      const branches: Branch[] = [{ test: expression(rest), body }];
      into().push(branches);
      open.push({ branches, body });
    } else if ((keyword === 'elif' || keyword === 'else') && block) {
      block.body = [];
      block.branches.push(
        keyword === 'elif' ? { test: expression(rest), body: block.body } : { body: block.body },
      );
    } else if (keyword === 'endif' && block) open.pop();
    else throw new TemplateError(`unexpected '{% ${statement} %}'`);
  }
  if (open.length) throw new TemplateError("unexpected end of template: '{% endif %}' expected");
  const tail = template.slice(at);
  if (tail.includes('{{') || tail.includes('{%'))
    throw new TemplateError('unexpected end of template');
  root.push(tail);
  return root;
}

/** The parts written out: each block's first branch whose test holds (or its `else`), the rest never worked out. */
const write = (parts: readonly Part[]): string =>
  parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part === 'function') return str(part());
      const branch = part.find(({ test }) => !test || truthy(test()));
      return branch ? write(branch.body) : '';
    })
    .join('');

/** The rendered text as Home Assistant reads it back: a number, True / False, None, else the text. */
const read = (text: string): Rendered =>
  /^-?\d+(\.\d+)?$/.test(text)
    ? Number(text)
    : text === 'True' || text === 'False'
      ? text === 'True'
      : text === 'None'
        ? null
        : text;

/**
 * `template` rendered against `states` (and the variables the caller hands over); a `TemplateError` when it cannot be.
 * `warn` hears what Home Assistant would say as a warning while it renders (a name that is not defined).
 */
export function renderTemplate(
  template: string,
  states: Readonly<Record<string, HassEntity>>,
  variables: Readonly<Record<string, unknown>> = {},
  warn: (message: string) => void = () => undefined,
): Rendered {
  return read(write(parse(template.trim(), { states, variables, warn })).trim());
}
