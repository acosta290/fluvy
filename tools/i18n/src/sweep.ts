/**
 * One-off, after `migrate`: every `createStrings({ en, es })` table in the cards becomes `strings('<namespace>')`
 * over the catalogue — the same variable, the same signature, so no card changes — and the imports the tables
 * needed go. Rewrites the source with the TypeScript compiler's positions; formatting is Prettier's job after.
 *
 *   pnpm --filter @fluvy/i18n exec tsx src/sweep.ts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CARDS = join(ROOT, 'packages', 'cards', 'src');

/** What a table spreads, by the identifier it spreads: the namespace to look up after the card's own. */
const SHARED: Record<string, string> = { PAGE_WORDS: 'page', WEATHER_WORDS: 'weather' };

function namespaceOf(file: string, exported: string): string {
  const folder = basename(dirname(file));
  if (folder === 'alarm' && exported === 'k') return 'keypad';
  return folder;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function spreadsOf(literal: ts.ObjectLiteralExpression): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isSpreadAssignment(node)) {
      const e = node.expression;
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression))
        out.push(e.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(literal);
  return out;
}

const files: string[] = [];
for (const folder of await readdir(CARDS, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  for (const name of ['strings.ts', 'rows.ts']) {
    const file = join(CARDS, folder.name, name);
    if (
      await readFile(file, 'utf8').then(
        () => true,
        () => false,
      )
    )
      files.push(file);
  }
}

let changed = 0;
for (const file of files.sort()) {
  const text = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const edits: Edit[] = [];
  const spreadNames = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createStrings'
    ) {
      const call = node.initializer;
      const argument = call.arguments[0];
      const namespaces = [namespaceOf(file, node.name.text)];
      if (argument && ts.isObjectLiteralExpression(argument)) {
        // a shorthand `en` names a literal declared above: its spreads count too
        const literals = [argument];
        for (const property of argument.properties)
          if (ts.isShorthandPropertyAssignment(property)) {
            const found = source.statements
              .filter(ts.isVariableStatement)
              .flatMap((s) => s.declarationList.declarations)
              .find((d) => ts.isIdentifier(d.name) && d.name.text === property.name.text);
            let init = found?.initializer;
            while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)))
              init = init.expression;
            if (init && ts.isObjectLiteralExpression(init)) {
              literals.push(init);
              edits.push({
                start: found!.parent.parent.getStart(),
                end: found!.parent.parent.getEnd(),
                text: '',
              });
            }
          }
        for (const literal of literals)
          for (const name of spreadsOf(literal)) {
            spreadNames.add(name);
            const shared = SHARED[name];
            if (shared && !namespaces.includes(shared)) namespaces.push(shared);
          }
      }
      edits.push({
        start: call.getStart(),
        end: call.getEnd(),
        text: `strings(${namespaces.map((n) => `'${n}'`).join(', ')})`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!edits.length) continue;

  // imports: createStrings → strings; the spread tables' imports go
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings) continue;
    const bindings = statement.importClause.namedBindings;
    if (!ts.isNamedImports(bindings)) continue;
    const names = bindings.elements.map((e) => e.name.text);
    if (names.includes('createStrings')) {
      const element = bindings.elements.find((e) => e.name.text === 'createStrings')!;
      edits.push({ start: element.getStart(), end: element.getEnd(), text: 'strings' });
    }
    if (names.some((n) => spreadNames.has(n)) && names.every((n) => spreadNames.has(n)))
      edits.push({ start: statement.getStart(), end: statement.getEnd(), text: '' });
  }
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  await writeFile(file, out);
  changed++;
  console.log(`${file.replace(ROOT, '.')}: ${edits.length} edits`);
}
console.log(`${changed} files swept`);
