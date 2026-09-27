#!/usr/bin/env node
/**
 * Geometry dump for the alignment audit: every painted box and every text line of every card
 * on a playground sheet, with rects relative to its card and Inter's ink metrics for each line.
 *
 *   node geometry.mjs --page 'http://127.0.0.1:5184/?sheet=energy&width=360' \
 *     --out ../../apps/playground/out/geometry/energy-360.json [--frame '[data-frame]'] [--txt]
 *
 * Output: { frames: [{ label, cards: [{ tag, rect, nodes: [{ path, tag, cls, rect, text, font, ink, cs }] }] }] }
 *   rect = { x, y, w, h } relative to the card's top-left (2 decimals)
 *   ink  = for a text line: { capTop, xTop, baseline, capMid, xMid } relative to the card — Inter metrics
 *          (ascender 0.969, descender 0.241, cap height 0.727, x-height 0.545 em), so an optical
 *          centre can be compared against an icon's centre or a sibling's ink.
 *   cs   = the computed values that decide alignment (display, alignItems, justifyContent, textAlign,
 *          padding, margin, gap, fontSize, lineHeight, fontWeight).
 * `--txt` also writes a readable listing next to the JSON.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs, launchOptions } from './lib.mjs';
import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2), {
  page: '',
  frame: '[data-frame]',
  width: '1700',
  out: '',
  txt: '',
});
if (!args.page) throw new Error('--page is required');

function dump(frameSel) {
  const kids = (el) =>
    Array.from(el.shadowRoot ? el.shadowRoot.children : el.children).filter(
      (c) => c.tagName !== 'STYLE',
    );
  const r2 = (n) => Math.round(n * 100) / 100;
  const ASC = 0.969,
    DESC = 0.241,
    CAP = 0.727,
    XH = 0.545;

  const alphaOf = (color) => {
    const inside = /^rgba?\(([^)]+)\)$/.exec(color);
    if (!inside) return color === 'transparent' ? 0 : 1;
    const parts = inside[1].split(/[,/\s]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  };
  const paints = (el, cs) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg' || tag === 'img' || tag === 'canvas') return true;
    if (alphaOf(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none')
      return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) =>
        parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none',
    );
  };
  const cls = (el) =>
    typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean).join('.')
      : '';
  const rel = (rect, origin) => ({
    x: r2(rect.left - origin.left),
    y: r2(rect.top - origin.top),
    w: r2(rect.width),
    h: r2(rect.height),
  });

  /** Every line box of the element's own text nodes. */
  const textLines = (el) => {
    const lines = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (rect.width > 0) lines.push(rect);
    }
    return lines;
  };

  const ink = (line, fontSize, origin) => {
    // line box height = line-height; the em box is centred in it; baseline = top + half-leading + ascender
    const lh = line.height;
    const halfLeading = (lh - (ASC + DESC) * fontSize) / 2;
    const baseline = line.top + halfLeading + ASC * fontSize;
    const capTop = baseline - CAP * fontSize;
    const xTop = baseline - XH * fontSize;
    return {
      capTop: r2(capTop - origin.top),
      xTop: r2(xTop - origin.top),
      baseline: r2(baseline - origin.top),
      capMid: r2((capTop + baseline) / 2 - origin.top),
      xMid: r2((xTop + baseline) / 2 - origin.top),
    };
  };

  const frames = [];
  for (const frame of document.querySelectorAll(frameSel)) {
    const label = frame.getAttribute('data-frame') || frame.dataset.title || '';
    const cards = [];
    for (const host of kids(frame)) {
      const hostRect = host.getBoundingClientRect();
      if (hostRect.width === 0) continue;
      const nodes = [];
      const walk = (el, path) => {
        for (const child of kids(el)) {
          const cs = getComputedStyle(child);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const rect = child.getBoundingClientRect();
          const name = child.tagName.toLowerCase() + (cls(child) ? '.' + cls(child) : '');
          const here = path ? `${path} > ${name}` : name;
          const fontSize = parseFloat(cs.fontSize);
          const lines = textLines(child).map((line) => ({
            rect: rel(line, hostRect),
            ink: ink(line, fontSize, hostRect),
          }));
          const own = Array.from(child.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .filter(Boolean)
            .join(' ');
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            (paints(child, cs) ||
              lines.length ||
              child.hasAttribute('data-measure') ||
              /fv-|ef-|so-|dk-|md-|cl-|ca-|in-|am-|sl-|hm-/.test(cls(child)))
          ) {
            nodes.push({
              path: here,
              rect: rel(rect, hostRect),
              text: own || undefined,
              lines: lines.length ? lines : undefined,
              cs: {
                display: cs.display,
                position: cs.position,
                alignItems: cs.alignItems,
                justifyContent: cs.justifyContent,
                textAlign: cs.textAlign,
                padding: cs.padding,
                margin: cs.margin,
                gap: cs.gap,
                fontSize: cs.fontSize,
                lineHeight: cs.lineHeight,
                fontWeight: cs.fontWeight,
                letterSpacing: cs.letterSpacing,
                textTransform: cs.textTransform,
                borderRadius: cs.borderRadius,
              },
            });
          }
          if (child.tagName.toLowerCase() !== 'svg') walk(child, here);
        }
      };
      walk(host, '');
      cards.push({
        tag: host.tagName.toLowerCase(),
        rect: {
          x: r2(hostRect.left),
          y: r2(hostRect.top),
          w: r2(hostRect.width),
          h: r2(hostRect.height),
        },
        nodes,
      });
    }
    frames.push({ label, cards });
  }
  return frames;
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: Number(args.width), height: 1000 },
  deviceScaleFactor: 1,
});
await page.goto(args.page, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500); // entrance animations settle
const frames = await page.evaluate(dump, args.frame);
await browser.close();

const report = { page: args.page, frames };
const write = async (path, text) => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), text);
};
if (args.out) await write(args.out, JSON.stringify(report, null, 1) + '\n');
if (args.txt) {
  const lines = [];
  for (const frame of frames) {
    lines.push(`## ${frame.label}`);
    for (const card of frame.cards) {
      lines.push(`### ${card.tag} ${card.rect.w}×${card.rect.h}`);
      for (const node of card.nodes) {
        const depth = node.path.split(' > ').length - 1;
        const r = node.rect;
        const t = node.text ? ` "${node.text.slice(0, 40)}"` : '';
        const inkText = node.lines
          ? ' ink[' +
            node.lines
              .map((l) => `cap ${l.ink.capTop}–${l.ink.baseline} mid ${l.ink.capMid}`)
              .join(' | ') +
            ']'
          : '';
        lines.push(
          `${'  '.repeat(depth)}${node.path.split(' > ').pop()} @(${r.x},${r.y}) ${r.w}×${r.h}${t}${inkText}  ${node.cs.fontSize}/${node.cs.lineHeight} ${node.cs.display} ai=${node.cs.alignItems} ta=${node.cs.textAlign}`,
        );
      }
    }
  }
  await write(args.txt, lines.join('\n') + '\n');
}
console.log(`${frames.length} frames, ${frames.reduce((n, f) => n + f.cards.length, 0)} cards`);
