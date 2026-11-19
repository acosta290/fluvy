#!/usr/bin/env python3
"""Turns the fluvy stroke glyphs into filled outlines Home Assistant can draw (ha-svg-icon fills, it never strokes).

  .venv/bin/python tools/icons/outline.py glyphs.json packages/core/src/icons/generated.ts \
      packages/core/src/icons/generated-on-demand.ts packages/core/src/icons/parts

Every stroked element is sampled into a polyline and buffered by half the stroke (round caps and joins, like the
glyph's SVG), filled elements become polygons, the union is simplified to 0.02 units and written as one path per
glyph on the same 24 × 24 grid; what a glyph draws faint (`opacity`, a signal's bars it does not reach) is a second
path, which Home Assistant draws faint (`secondaryPath`). Core's part, the part `getIcon` fetches first (with the index
of the others) and each other part (`parts/<name>.ts`) are written apart. Needs shapely and svgpathtools
(tools/icons/requirements.txt)."""
import json, re, sys
from svgpathtools import parse_path
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

ELEMENT = re.compile(r'<(path|circle|ellipse|rect|line|g)\b([^>]*?)(/>|>)', re.S)
ATTR = re.compile(r'([a-zA-Z-]+)="([^"]*)"')

def attrs(s):
    return dict(ATTR.findall(s))

def sample(path, step=0.2):
    pts = []
    for seg in path:
        n = max(2, int(seg.length() / step) + 1)
        for i in range(n + 1):
            z = seg.point(i / n)
            pts.append((z.real, z.imag))
    # drop consecutive duplicates
    out = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - out[-1][0]) > 1e-6 or abs(p[1] - out[-1][1]) > 1e-6:
            out.append(p)
    return out

def transform_of(t):
    if not t: return (1, 0, 0, 1, 0, 0)
    m = re.match(r'translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)', t)
    if m: return (1, 0, 0, 1, float(m.group(1)), float(m.group(2)))
    m = re.match(r'matrix\(\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)\s*\)', t)
    if m: return tuple(float(x) for x in m.groups())
    raise ValueError('transform ' + t)

def apply(pts, m):
    a, b, c, d, e, f = m
    return [(a * x + c * y + e, b * x + d * y + f) for x, y in pts]

def shapes(body, default_stroke):
    """Yields (points, closed, filled, stroke_width, faint) per drawn element, transforms applied."""
    stack = [(1, 0, 0, 1, 0, 0)]
    for m in ELEMENT.finditer(body):
        tag, raw = m.group(1), m.group(2)
        a = attrs(raw)
        if tag == 'g':
            stack.append(transform_of(a.get('transform', '')))
            continue
        filled = a.get('fill', 'none') not in ('none', '') and a.get('stroke', '') == 'none'
        sw = float(a['stroke-width']) if 'stroke-width' in a else default_stroke
        faint = float(a.get('opacity', 1)) < 1
        if tag == 'path':
            d = a['d']
            p = parse_path(d)
            # sub-paths: split on move commands so each is sampled and closed on its own
            subs = []
            cur = []
            for seg in p:
                if cur and abs(seg.start - cur[-1].end) > 1e-6:
                    subs.append(cur); cur = []
                cur.append(seg)
            if cur: subs.append(cur)
            for segs in subs:
                pts = sample(segs)
                closed = abs(segs[0].start - segs[-1].end) < 1e-6 or bool(re.search(r'[zZ]\s*$', d))
                yield apply(pts, stack[-1]), closed, filled, sw, faint
        elif tag in ('circle', 'ellipse'):
            cx, cy = float(a['cx']), float(a['cy'])
            rx = float(a['r'] if tag == 'circle' else a['rx'])
            ry = float(a['r'] if tag == 'circle' else a['ry'])
            p = parse_path(f'M{cx + rx},{cy} A{rx},{ry} 0 1 1 {cx - rx},{cy} A{rx},{ry} 0 1 1 {cx + rx},{cy}')
            yield apply(sample(p), stack[-1]), True, filled, sw, faint
        elif tag == 'rect':
            x, y, w, h = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
            rx = float(a.get('rx', 0)); ry = float(a.get('ry', rx))
            if rx:
                d = (f'M{x + rx},{y} H{x + w - rx} A{rx},{ry} 0 0 1 {x + w},{y + ry} V{y + h - ry} A{rx},{ry} 0 0 1 {x + w - rx},{y + h} '
                     f'H{x + rx} A{rx},{ry} 0 0 1 {x},{y + h - ry} V{y + ry} A{rx},{ry} 0 0 1 {x + rx},{y} Z')
            else:
                d = f'M{x},{y} H{x + w} V{y + h} H{x} Z'
            yield apply(sample(parse_path(d)), stack[-1]), True, filled, sw, faint
        elif tag == 'line':
            pts = [(float(a['x1']), float(a['y1'])), (float(a['x2']), float(a['y2']))]
            yield apply(pts, stack[-1]), False, filled, sw, faint

def outline(body, default_stroke):
    """The glyph's path, and the path of what it draws faint ('' where it draws nothing faint)."""
    drawn = ([], [])
    for pts, closed, filled, sw, faint in shapes(body, default_stroke):
        if filled and len(pts) >= 3:
            drawn[faint].append(Polygon(pts).buffer(0))
        else:
            line = LineString(pts + ([pts[0]] if closed and pts[0] != pts[-1] else []))
            drawn[faint].append(line.buffer(sw / 2, cap_style=1, join_style=1, resolution=6))
    return tuple(rings(unary_union(geoms)) if geoms else '' for geoms in drawn)

def rings(geom):
    """A shape's rings as one path."""
    geom = geom.simplify(0.06, preserve_topology=True)
    polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    d = []
    SCALE = 10 / 9  # the cards draw the glyph's ink 3..21 in 24; beside Material icons (ink 2..22) the set is scaled about the centre
    for poly in polys:
        poly = orient(poly, 1.0)
        for ring in [poly.exterior, *poly.interiors]:
            # tenths of a unit, as whole numbers: the ring starts absolute, then goes by steps (small, repeating
            # numbers: the set is a quarter of the size of absolute points, the same shape to the tenth)
            tenths = [(round((12 + (x - 12) * SCALE) * 10), round((12 + (y - 12) * SCALE) * 10)) for x, y in ring.coords[:-1]]
            points = [p for i, p in enumerate(tenths) if p != tenths[i - 1]] or tenths[:1]
            steps = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:])]
            d.append('M' + numbers(points[0]) + ('l' + numbers(*steps) if steps else '') + 'z')
    return ''.join(d)

def number(tenths):
    """A tenth-unit count as SVG's shortest number: 15 → 1.5, 5 → .5, -5 → -.5, 20 → 2."""
    sign = '-' if tenths < 0 else ''
    whole, tenth = divmod(abs(tenths), 10)
    if not tenth:
        return f'{sign}{whole}'
    return f'{sign}{whole if whole else ""}.{tenth}'

def numbers(*pairs):
    """Numbers run together as SVG reads them: a space only where the next would otherwise join the last."""
    out = ''
    for value in (n for pair in pairs for n in pair):
        text = number(value)
        if out and not text.startswith('-') and not (text.startswith('.') and '.' in last):
            out += ' '
        out += text
        last = text
    return out

def kebab(name):
    return re.sub(r'([a-z0-9])([A-Z])', r'\1-\2', name).lower()

glyphs = json.load(open(sys.argv[1]))
# core's part (on every page: the shell draws from it), the part `getIcon` fetches first, and the set's other parts
parts = {}
for name, g in glyphs.items():
    body = g['body']
    # strip closing group tags (the opener sets the transform for what follows; every glyph has at most one group)
    body = body.replace('</g>', '')
    parts.setdefault(g.get('part', 'core'), {})[kebab(name)] = outline(body, float(g['strokeWidth']))

def entry(name, drawn):
    """An entry as the repository's formatter lays it out (the file is not formatted again): a key quoted only where
    it must be; a key of five or more characters breaks before a value that would run past 100; a glyph with a faint
    part is its two paths."""
    path, faint = drawn
    key = name if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', name) else f"'{name}'"
    if faint:
        return [f"  {key}: [", f"    '{path}',", f"    '{faint}',", '  ],']
    line = f"  {key}: '{path}',"
    if len(line) <= 100 or len(key) < 5:
        return [line]
    return [f"  {key}:", f"    '{path}',"]

HEAD = '/* Generated by tools/icons/outline.py from the glyphs of packages/ui — do not edit. */'
OUTLINE = 'string | readonly [path: string, faint: string]'

def entries(paths):
    return [line for name in sorted(paths) for line in entry(name, paths[name])]

def core(paths):
    """Core's part. The shell names its glyphs: the module also exports the union of the part's names as a type, and
    the part keyed by it, so a glyph the part does not hold is a type error where the code names it."""
    assert not any(faint for _, faint in paths.values()), 'nothing in core is drawn faint'
    return '\n'.join([HEAD, 'const paths = {', *entries(paths), '};',
                      "/** A glyph of this part by its name (`mask('check')`): a name it does not hold does not compile. */",
                      'export type IconName = keyof typeof paths;',
                      '/** The fluvy glyphs as filled outlines on the 24 grid: what `ha-icon` draws for `fluvy:<name>`. */',
                      'export const ICON_PATHS: Readonly<Record<IconName, string>> = paths;']) + '\n'

def first(paths, others):
    """The part `getIcon` fetches first: its own glyphs and, for each other part, the names it holds and its fetch."""
    assert not any(faint for _, faint in paths.values()), 'nothing in the first part is drawn faint'
    index = []
    for name in sorted(others):
        index += [f'  {name}: [', f"    '{' '.join(sorted(others[name]))}',", f"    () => import('./parts/{name}.js'),", '  ],']
    return '\n'.join([HEAD,
                      '/** The rest of the set, outlined the same: fetched by `getIcon` the first time one of them is asked for. */',
                      'export const ON_DEMAND_PATHS: Readonly<Record<string, string>> = {', *entries(paths), '};',
                      "/** The set's other parts, each fetched the first time one of its glyphs is asked for: the names it holds, its fetch. */",
                      'export const PARTS: Readonly<',
                      '  Record<string, readonly [names: string, load: () => Promise<{ PATHS: Readonly<Record<string, Outline>> }>]>',
                      '> = {', *index, '};',
                      '/** A glyph outlined: its path, or its path and the path of what it draws faint. */',
                      f'export type Outline = {OUTLINE};']) + '\n'

def part(paths, name):
    return '\n'.join([HEAD, "import type { Outline } from '../generated-on-demand.js';",
                      '',
                      f"/** The set's part `{name}`, outlined: fetched the first time Home Assistant asks for one of its glyphs. */",
                      'export const PATHS: Readonly<Record<string, Outline>> = {', *entries(paths), '};']) + '\n'

others = {name: paths for name, paths in parts.items() if name not in ('core', 'icons')}
open(sys.argv[2], 'w').write(core(parts['core']))
open(sys.argv[3], 'w').write(first(parts['icons'], others))
for name, paths in others.items():
    open(f'{sys.argv[4]}/{name}.ts', 'w').write(part(paths, name))
print(f"{len(parts['core'])} icons → {sys.argv[2]}, {len(parts['icons'])} → {sys.argv[3]}, "
      + ', '.join(f'{len(paths)} → {name}' for name, paths in others.items()))
