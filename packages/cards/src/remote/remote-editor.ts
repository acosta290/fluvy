import {
  strings,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import {
  DEFAULT_CONTROLS,
  DEFAULT_GROUPS,
  DEFAULT_KEYS,
  REMOTE_GROUPS,
  remoteGroups,
} from '../remote-family.js';
import { HEAD_BASE } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  editorWord,
  entityField,
  fieldRow,
  iconField,
  nameIconFields,
  onlyWhen,
  orderedField,
  selectField,
  headFields,
  textField,
} from '../shared/form.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { KEYS, type Key } from './keys.js';
import { PLATFORMS, platform } from './platforms.js';
import {
  DEFAULT_GAMEPAD,
  DEFAULT_NAV,
  DEFAULT_TRANSPORT,
  DPADS,
  type RemoteCardConfig,
} from './remote-card.js';

/** The remote card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('remote');

type Data = Readonly<Record<string, unknown>>;

const variantOf = (data: Data): string => String(data['variant'] ?? 'full');
const full = (data: Data): boolean => variantOf(data) === 'full';
const compact = (data: Data): boolean => variantOf(data) === 'compact';
const row = (data: Data): boolean => variantOf(data) === 'row';
/** The group is drawn: the full card names it (or says nothing, and it is a default), or the pad is the variant. */
const draws =
  (group: string) =>
  (data: Data): boolean =>
    (full(data) && (remoteGroups(data['groups']) as readonly string[]).includes(group)) ||
    (group === 'dpad' && variantOf(data) === 'pad');
const ring = (data: Data): boolean => draws('dpad')(data) && (data['dpad'] ?? 'ring') === 'ring';
/** The apps are drawn as circles, whose names may go. */
const circles = (data: Data): boolean =>
  draws('apps')(data) && (data['apps_style'] ?? 'circles') === 'circles';

/** A key's word of the card's own namespace. */
const keyWord = (key: Key): MessageKey => `remote.key.${key}`;
/** The keys as the ordered fields offer them, each by its word in the editor's language. */
const keyOptions = (): ReadonlyArray<{ value: string; label: string }> =>
  KEYS.map((key) => ({ value: key, label: editorWord(keyWord(key)) }));
const keyChoices = (): ReadonlyArray<readonly [string, MessageKey]> =>
  KEYS.map((key) => [key, keyWord(key)]);
/** The platforms, each by its own name; a name of the person's own may be typed as well. */
const platformField = (): HaFormSchemaItem => ({
  name: 'app',
  selector: {
    select: {
      mode: 'dropdown',
      custom_value: true,
      options: PLATFORMS.map((p) => ({ value: p.id, label: p.title })),
    },
  },
});

/** The logos' chunk, so the apps' rows draw their marks. */
const logos = (): Promise<unknown> => import('../app-logos/paths.js');

/**
 * An app's fields; its `app_id` goes to the card's player and its `activity` to the card's remote, each asked for only
 * where the card names one.
 */
const APP_FIELDS: readonly HaFormSchemaItem[] = [
  platformField(),
  fieldRow(textField('name'), iconField()),
  textField('image'),
  accentField('color', { item: 'own' }),
  fieldRow(textField('source'), choiceField('key', keyChoices())),
  textField('app_id'),
  textField('activity'),
  // its tap opens it where none is chosen
  actionFields({ tap: null, hold: 'none' }),
];
const appFields = (card: Data | undefined): readonly HaFormSchemaItem[] =>
  APP_FIELDS.filter(
    (field) =>
      (field.name !== 'app_id' || Boolean(card?.['entity'])) &&
      (field.name !== 'activity' || Boolean(card?.['remote'])),
  );

export const base = HEAD_BASE;

export const keys = configKeys<RemoteCardConfig>()([
  'remote',
  'volume_entity',
  'variant',
  'dpad',
  'ok_label',
  'side_keys',
  'off_keys',
  'volume',
  'apps_style',
  'apps_tint',
  'apps_names',
  'gamepad_tint',
  'groups',
  'nav',
  'transport',
  'keys',
  'controls',
  'gamepad_keys',
  'apps',
  'custom',
  'commands',
  'icons',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  dpad: 'ring',
  ok_label: 'word',
  side_keys: 'auto',
  off_keys: 'live',
  volume: 'auto',
  apps_style: 'circles',
  apps_tint: 'open',
  apps_names: true,
  gamepad_tint: 'console',
  groups: [...DEFAULT_GROUPS],
  nav: [...DEFAULT_NAV],
  transport: [...DEFAULT_TRANSPORT],
  keys: [...DEFAULT_KEYS],
  controls: [...DEFAULT_CONTROLS],
  gamepad_keys: [...DEFAULT_GAMEPAD],
});

export const lists: readonly RowsListSpec[] = [
  {
    key: 'apps',
    title: 'remote.editor.apps',
    helper: 'remote.editor.apps_helper',
    idKey: 'app',
    picker: platformField(),
    schema: APP_FIELDS,
    schemaOf: (_item, card) => appFields(card),
    keys: [
      'app',
      'name',
      'icon',
      'image',
      'color',
      'source',
      'key',
      'app_id',
      'activity',
      'tap_action',
      'hold_action',
      'double_tap_action',
    ],
    when: draws('apps'),
    rowIcon: (item) => {
      const own = item['icon'];
      if (typeof own === 'string' && own) return own;
      const p = platform(String(item['app'] ?? ''));
      return p ? `app:${p.id}` : undefined;
    },
    ready: logos,
  },
  {
    key: 'custom',
    title: 'remote.editor.custom',
    helper: 'remote.editor.custom_helper',
    idKey: 'name',
    schema: [
      { ...textField('name'), required: true },
      fieldRow(iconField(), choiceField('key', keyChoices())),
      // its tap presses its key where none is chosen
      actionFields({ tap: null, hold: 'none' }),
    ],
    keys: ['name', 'icon', 'key', 'tap_action', 'hold_action', 'double_tap_action'],
    when: draws('custom'),
  },
];

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['media_player'], 'entity', false),
      fieldRow(
        entityField(['remote'], 'remote', false),
        entityField(['media_player'], 'volume_entity', false),
      ),
      nameIconFields(),
      headFields(),
      fieldRow(
        choiceField('variant', [
          ['full', 'option.full'],
          ['compact', 'option.compact'],
          ['pad', 'remote.option.pad'],
          ['row', 'option.row'],
        ]),
        choiceField('off_keys', [
          ['live', 'option.live'],
          ['power', 'remote.option.power'],
        ]),
      ),
      onlyWhen(
        full,
        orderedField(
          'groups',
          REMOTE_GROUPS.map((group) => ({
            value: group,
            label: editorWord(`remote.group.${group}`),
          })),
        ),
      ),
      onlyWhen(
        draws('dpad'),
        fieldRow(
          selectField('dpad', DPADS),
          choiceField('ok_label', [
            ['word', 'remote.option.word'],
            ['plain', 'option.plain'],
          ]),
        ),
      ),
      onlyWhen(
        ring,
        choiceField('side_keys', [
          ['auto', 'option.auto'],
          ['sides', 'remote.option.sides'],
          ['row', 'option.row'],
        ]),
      ),
      onlyWhen(draws('dpad'), orderedField('nav', keyOptions())),
      onlyWhen(draws('transport'), orderedField('transport', keyOptions())),
      onlyWhen(
        draws('gamepad'),
        choiceField('gamepad_tint', [
          ['console', 'remote.option.console'],
          ['plain', 'option.plain'],
        ]),
      ),
      onlyWhen(draws('gamepad'), orderedField('gamepad_keys', keyOptions())),
      onlyWhen(
        draws('volume'),
        choiceField('volume', [
          ['auto', 'option.auto'],
          ['ruler', 'option.ruler'],
          ['keys', 'remote.option.keys'],
          ['stepper', 'remote.option.stepper'],
        ]),
      ),
      onlyWhen(
        draws('apps'),
        fieldRow(
          choiceField('apps_style', [
            ['circles', 'remote.option.circles'],
            ['chips', 'option.chips'],
          ]),
          choiceField('apps_tint', [
            ['open', 'remote.option.open'],
            ['always', 'option.always'],
          ]),
        ),
      ),
      onlyWhen(circles, boolField('apps_names')),
      onlyWhen(compact, orderedField('keys', keyOptions())),
      onlyWhen(row, orderedField('controls', keyOptions())),
      // a key's command for this device, and its icon, over the table's: edited as YAML (Home Assistant's object field)
      { name: 'commands', selector: { object: {} } },
      { name: 'icons', selector: { object: {} } },
      ...colourFields(),
      actionFields({ icon: true }),
    ],
    ...editorLabels(s, {
      remote: 'editor.remote',
      volume_entity: 'editor.volume_entity',
      dpad: 'editor.dpad',
      ok_label: 'editor.ok_label',
      side_keys: 'editor.side_keys',
      off_keys: 'editor.off_keys',
      volume: 'editor.volume',
      apps_style: 'editor.apps_style',
      apps_tint: 'editor.apps_tint',
      apps_names: 'editor.apps_names',
      gamepad_tint: 'editor.gamepad_tint',
      gamepad_keys: 'editor.gamepad_keys',
      groups: 'editor.groups',
      nav: 'editor.nav',
      transport: 'editor.transport',
      keys: 'editor.keys',
      controls: 'editor.controls',
      commands: 'editor.commands',
      icons: 'editor.icons',
      app: 'editor.app',
      image: 'editor.image',
      source: 'editor.source',
      key: 'editor.key',
      app_id: 'editor.app_id',
      activity: 'editor.activity',
    }),
    computeHelper: (schema) => {
      const helpers: Partial<Record<string, Parameters<typeof s>[1]>> = {
        remote: 'editor.remote_helper',
        volume_entity: 'editor.volume_entity_helper',
        side_keys: 'editor.side_keys_helper',
        off_keys: 'editor.off_keys_helper',
        volume: 'editor.volume_helper',
        commands: 'editor.commands_helper',
        icons: 'editor.icons_helper',
        image: 'editor.image_helper',
        app_id: 'editor.app_id_helper',
        activity: 'editor.activity_helper',
      };
      const key = helpers[schema.name];
      return key ? s(editorLanguage(), key) : undefined;
    },
  };
}
