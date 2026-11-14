import {
  areaOf,
  floorsInOrder,
  localize,
  registryText,
  roomRank,
  type EntityName,
  type HomeAssistant,
} from '@fluvy/core';
import { chips, type ChipItem } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { fittedColumns, type ChipFit } from './chips.js';
import { groupsOf, itemsOf, type Group, type Grouped } from './lists.js';

/*
 * A list in groups (1.21, #189): which room a light or a scene belongs to. What a card of tiles or of scenes lays its
 * list out by when its config asks (`Grouped`) — its own sections, or the house's rooms and floors in the house's
 * order — with the names short inside a group, and the scenes as chips. A chunk of its own (`groups`), fetched by the
 * first card asked for groups (`groupsModule`), with the automatic dashboards (which write their groups themselves)
 * and with the heights they count with the house; a dashboard of plain lists never pays for it.
 */

/** What a list's item says for its group: its entity, and its name where the config gives one. */
export interface GroupItem {
  readonly entity: string;
  readonly name?: EntityName | undefined;
}

/* ---------- short names ---------- */

/** What stands between a name's words: spaces, and the marks people join them with. */
const MARKS = String.raw`[\s・：:·\-–—/／|&,_]`;
/** The marks a cut leaves at a name's start, and the particle that tied it to its place (「キッチンの照明」, 「厨房的灯」). */
const LEADING = new RegExp(`^(?:${MARKS}|[の的](?=.))+`, 'u');
const TRAILING = new RegExp(`${MARKS}+$`, 'u');
/**
 * What ties a thing to the place after it ("Lampe im Wohnzimmer", "Luz de la cocina", "Lampe de l’entrée", "Світло на
 * кухні"), as people write it, in lower case: the joining words the automatic dashboards read in every language
 * Fluvy speaks (the catalogues' `place_joins`: `groups.test.ts` holds this to them), the prepositions that stand
 * before a room besides, and an elision.
 */
const JOINS = new RegExp(
  String.raw`(?:\s+(?:${[
    'the|of|in|and|at|on|by|near|under|over',
    'der|die|das|dem|den|im|am|an|auf|bei|beim|zum|zur|vom|von|vor|und|unter|über|neben|hinter',
    'de|del|la|el|los|las|y|en|al|para|sobre|bajo',
    'du|le|les|des|et|au|aux|à|dans|sur|sous|près|chez',
    'di|della|dello|delle|degli|dei|il|lo|i|e|nel|nella|nello|sul|sulla|sullo|alla',
    'het|van|op|bij|aan|onder|boven|naast',
    'da|do|das|dos|a|o|no|na|nos|nas|em|ao',
    'w|we|oraz|przy|pod|nad|za|obok|z',
    'и|в|во|на|у|под|над|при|около|і|й|та|під|біля',
    'v|vo|pri|az|és|es|ve',
  ].join('|')}|\p{Ll}{1,4}['’]))+$`,
  'u',
);
/** A short word in lower case left at a name's end: a joining word nobody listed, or a thing's own ("fan", "tv"). */
const LOOSE = /\s\p{Ll}{1,3}$/u;
/** A letter or a figure of a script whose words stand apart: a cut between two of them would cut a word. */
const WORD = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]/u;
const inWord = (before: string | undefined, after: string | undefined): boolean =>
  WORD.test(before ?? '') && WORD.test(after ?? '');

/**
 * What a cut left of a name, in the name's case: a first word left lower-case ("Kitchen ceiling light" leaves
 * "ceiling light") takes a capital where the name began with one, never a word written in mixed case ("iPhone").
 */
function inCaseOf(name: string, rest: string): string {
  const first = /\p{L}/u.exec(name)?.[0] ?? '';
  const word = /[\p{L}\p{N}]+/u.exec(rest)?.[0] ?? '';
  if (first === first.toLowerCase() || word !== word.toLowerCase()) return rest;
  return rest.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

/**
 * A name without its group's at either end, as whole words ("Kitchenette lamp" in Kitchen stays whole; 「キッチン照明」
 * is 照明), nor the marks and the joining words that leaves there. It stays whole where nothing would be left of it,
 * and where what is left ends in a short word nobody can tell from a joining one ("Lampe ob Treppe", "Ceiling fan
 * Kitchen"): a name is never left hanging.
 */
function withoutGroup(name: string, group: string): string {
  const said = name.trim();
  const place = group.trim();
  const size = place.length;
  if (!size || said.length <= size) return said;
  const same = (part: string): boolean => part.toLowerCase() === place.toLowerCase();
  let rest = said;
  if (same(said.slice(0, size)) && !inWord(said[size - 1], said[size]))
    rest = said.slice(size).replace(LEADING, '');
  else if (same(said.slice(-size)) && !inWord(said.at(-size - 1), said.at(-size))) {
    rest = said.slice(0, -size).replace(TRAILING, '').replace(JOINS, '').replace(TRAILING, '');
    if (LOOSE.test(rest)) return said;
  }
  return rest ? inCaseOf(said, rest) : said;
}

/**
 * Names without a first word they all share ("Lights Cooking", "Lights Dinner", "Lights Evening"), where each keeps a
 * word: three names at least, since two that begin alike say nothing of how a house names its things ("Island
 * downlight", "Island uplight").
 */
function withoutSharedWord(names: readonly string[]): readonly string[] {
  if (names.length < 3) return names;
  const parts = names.map((name) => /^(\S+)\s+(\S.*)$/su.exec(name));
  const first = parts[0]?.[1]?.toLowerCase();
  if (!first || parts.some((found) => found?.[1]?.toLowerCase() !== first)) return names;
  const rest = parts.map((found, index) =>
    inCaseOf(names[index] as string, (found?.[2] ?? '').replace(LEADING, '')),
  );
  return rest.every(Boolean) ? rest : names;
}

/** How many names a list tells apart, whatever their case. */
const distinct = (names: readonly string[]): number =>
  new Set(names.map((name) => name.toLowerCase())).size;

/**
 * The names of a group, short: each without the group's own at either end, then without a first word they all share —
 * each step only where every name keeps a word and no two names it told apart come to read alike.
 */
export function shortNames(group: string, names: readonly string[]): readonly string[] {
  let short = names;
  for (const step of [
    (said: readonly string[]) => said.map((name) => withoutGroup(name, group)),
    withoutSharedWord,
  ]) {
    const next = step(short);
    if (distinct(next) === distinct(short)) short = next;
  }
  return short;
}

/* ---------- groups ---------- */

/**
 * A list's items by the house: a group a room, or a floor, of their entities, under its name, in the house's order of
 * its rooms (`roomRank`; the floors in theirs) — those it places alike as the list first names them — or A to Z; what
 * is in no room, or on no floor, last under "Other".
 */
function byHouse<T extends GroupItem>(
  hass: HomeAssistant,
  items: readonly T[],
  by: 'area' | 'floor',
  order: Grouped['group_order'],
): Group<T>[] {
  const rank = roomRank(hass);
  const floors = floorsInOrder(hass).map((floor) => floor.floor_id);
  const groups = new Map<string, { label: string; place: number; items: T[] }>();
  for (const item of items) {
    const area = hass.areas?.[areaOf(hass, item.entity) ?? ''];
    const floor = by === 'floor' ? hass.floors?.[area?.floor_id ?? ''] : undefined;
    const id = by === 'floor' ? floor?.floor_id : area?.area_id;
    let group = groups.get(id ?? '');
    if (!group) {
      const name = registryText((by === 'floor' ? floor : area)?.name);
      group = {
        label: name ?? localize(hass, 'distribution.other'),
        place: id === undefined ? Infinity : by === 'floor' ? floors.indexOf(id) : rank(id),
        items: [],
      };
      groups.set(id ?? '', group);
    }
    group.items.push(item);
  }
  const last = (group: { place: number }): number => Number(group.place === Infinity);
  return [...groups.values()].sort(
    (a, b) =>
      last(a) - last(b) ||
      (order === 'name' ? a.label.localeCompare(b.label, hass.language) : a.place - b.place),
  );
}

/**
 * A config's list as its card lays it out: in the house's groups where it asks for them (`group_by`), else in its own
 * sections (`groupsOf`: a list with none is one group under no label) — and each name short inside a group
 * (`shortNames`: Home Assistant's own for the entity; one the config gives is never touched) whose label is a room's or
 * a floor's of the house: a section of the person's own words ("Night") says nothing of what its names repeat
 * ("Good night"), so those stay whole unless the config asks (`short_names: true`), and none is short where it says
 * no.
 */
export function laidOut<T extends GroupItem>(
  hass: HomeAssistant | undefined,
  config: Grouped,
  list: unknown,
): Group<T>[] {
  const by = config.group_by;
  const groups =
    hass && (by === 'area' || by === 'floor')
      ? byHouse(hass, itemsOf<T>(Array.isArray(list) ? list : []), by, config.group_order)
      : groupsOf<T>(list);
  if (config.short_names === false) return groups;
  const places = new Set(
    [...Object.values(hass?.areas ?? {}), ...Object.values(hass?.floors ?? {})].map((place) =>
      String(registryText(place.name)).toLowerCase(),
    ),
  );
  const nameOf = (item: T): string | undefined => {
    const name: unknown = hass?.states[item.entity]?.attributes['friendly_name'];
    return item.name === undefined && typeof name === 'string' ? name : undefined;
  };
  return groups.map((group) => {
    const named = group.items.filter((item) => nameOf(item) !== undefined);
    const short = config.short_names === true || places.has(group.label.toLowerCase());
    if (!group.label || !short || !named.length) return group;
    const names = shortNames(
      group.label,
      named.map((item) => nameOf(item) as string),
    );
    return {
      label: group.label,
      items: group.items.map((item) => {
        const name = names[named.indexOf(item)];
        return name === undefined || name === nameOf(item) ? item : { ...item, name };
      }),
    };
  });
}

/* ---------- scenes as chips ---------- */

/** A scene as its chip draws it: the card's reading of it, and what its press runs. */
export interface SceneChip extends ChipItem {
  readonly onTap?: (() => void) | undefined;
}

/**
 * Scenes as chips on one card (the Scenes card's `variant: chips`): under each group's label its scenes as pills that
 * fill their rows — as many a row as hold every name whole (`fittedColumns`: four, else three, else two; a shorter last
 * row shares the width among its own), the last run one on the accent's fill.
 */
export function sceneChips(groups: readonly Group<SceneChip>[], fit: ChipFit): TemplateResult {
  return html`<article class="fv-card am-chips" data-card>
    ${groups.map(
      ({ label, items }) =>
        html`${label ? html`<h3 class="fv-group" data-name>${label}</h3>` : nothing}
        ${chips(
          items,
          (key) => items.find((item) => item.key === key)?.onTap?.(),
          '',
          true,
          fittedColumns(items, fit),
        )}`,
    )}
  </article>`;
}
