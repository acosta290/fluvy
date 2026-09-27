import {
  isActive,
  stateText,
  TOGGLE_DOMAINS,
  toggleEntity,
  valueParts,
  formatNumber,
  relativeTime,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  activateKey,
  clickPress,
  ico,
  preventMenu,
  readout,
  type RulerChangeDetail,
  sheetStyles,
  startPress,
  textWidth,
  toggle,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card } from '../shared/base.js';

import { currentTone, glyphFor, toneFor } from '../shared/domain.js';

import {
  actionField,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  selectField,
  toneField,
} from '../shared/form.js';

import { formEditor } from '../shared/rows-editor.js';

export type TileSize = 'large' | 'compact' | 'mini';
export const TILE_SIZES: readonly TileSize[] = ['large', 'compact', 'mini'];

/** One tile's own settings — the single card's config, or one item of a tiles group. */
export interface TileItem {
  entity: string;
  name?: string;
  icon?: string;
  tone?: Tone;
  /** Up to two entities shown as small readouts in the foot of a large tile (a plug's power and energy today); the first one joins the state line of a small tile. */
  readouts?: readonly string[];
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

export interface TileCardConfig extends FluvyCardConfig, Omit<TileItem, 'entity'> {
  /** `large` (default): icon + switch, name, state and a foot. `compact`: one 76 px row. `mini`: icon over name, 108 px. */
  size?: TileSize;
}

const LIGHT_BRIGHTNESS_MODES = new Set([
  'brightness',
  'color_temp',
  'hs',
  'xy',
  'rgb',
  'rgbw',
  'rgbww',
  'white',
]);
const COVER_SET_POSITION = 4;
const FAN_SET_SPEED = 1;
const MORE_INFO: ActionConfig = { action: 'more-info' };
const TOGGLE: ActionConfig = { action: 'toggle' };
/** A large tile's head holds its icon circle, 8 of air and the switch; a narrower tile's circle is the switch. */
const HEAD_ROOM = 44 + 8 + 48;
/** Two readouts share a foot from this inner width; under it the first one has the foot to itself. */
const TWO_READOUTS = 120;

/**
 * The tile. Large (172 × 168): icon circle + switch, name, state, and a foot that is either a compact
 * ruler (brightness, cover position, fan speed) or two small readouts. Compact (76 tall) and mini
 * (108 tall, icon over name) are the same tile without the switch: the whole surface toggles on tap
 * and opens the details on hold — the Mushroom-sized buttons people group in pairs and threes.
 * Active = the tone's pastel fill in every size.
 */
export class FluvyTileCard extends Card<TileCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      .fv-tile {
        display: block;
        height: 168px;
        text-align: left;
      }
      .fv-tile > fluvy-ruler {
        margin-top: -4px;
      }
      .fv-tile__foot {
        grid-template-columns: minmax(0, 46%) minmax(0, 54%);
      }
      .fv-tile__foot--one {
        grid-template-columns: minmax(0, 1fr);
      }
      /* a foot under the state line: a name that would end in an ellipsis steps down to 14 px first (as the compact tiles' does) */
      .fv-tile--tight .fv-tile__name {
        font-size: 14px;
      }
      /* nothing under the state line: the name may take the foot's room, two balanced lines, before an ellipsis */
      .fv-tile--footless .fv-tile__name {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        white-space: normal;
        text-wrap: balance;
      }
      .fv-tile--off {
        display: flex;
        height: 76px;
      }
      .fv-tile--compact {
        display: flex;
        height: 76px;
      }
      .fv-tile--mini {
        display: flex;
        height: 108px;
        text-align: center;
      }
      .fv-tile__body {
        display: block;
        cursor: pointer;
      }
    `,
  ];

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(),
        nameIconFields(),
        fieldRow(selectField('size', TILE_SIZES), toneField()),
        entitiesField('readouts', ['sensor']),
        actionField(),
        actionField('hold_action'),
      ],
      ...formLabels({
        readouts: 'editor.entities',
        hold_action: 'editor.hold_action',
      }),
    };
  }

  /** The editor shows the size the card draws by default. */
  static getConfigElement(): HTMLElement {
    return formEditor(this.getConfigForm(), () => ({ size: 'large' }));
  }
  static getStubConfig(_hass: unknown, entities: readonly string[]): TileCardConfig {
    const entity =
      entities.find((id) => /^(light|switch|cover|fan)\./.test(id)) ?? entities[0] ?? '';
    return { type: 'custom:fluvy-tile-card', entity };
  }

  protected override prepare(config: TileCardConfig): TileCardConfig {
    if (!config.entity) throw new Error('fluvy-tile-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return this.size() === 'large' ? 3 : 1;
  }

  override getGridOptions(): LovelaceGridOptions {
    switch (this.size()) {
      case 'mini':
        return { columns: 3, rows: 'auto', min_columns: 3 };
      case 'compact':
        return { columns: 6, rows: 'auto', min_columns: 4 };
      default:
        return { columns: 6, rows: 'auto', min_columns: 6 };
    }
  }

  protected size(): TileSize {
    const size = this.config?.size;
    return size && TILE_SIZES.includes(size) ? size : 'large';
  }

  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', ...(this.config?.readouts ?? [])];
  }

  /** What the foot ruler controls for this entity, if anything. */
  private level(
    view: EntityView,
  ): { value: number; commit: (value: number) => void; label: string } | null {
    if (view.domain === 'light') {
      const modes = view.attr<string[]>('supported_color_modes') ?? [];
      if (!modes.some((m) => LIGHT_BRIGHTNESS_MODES.has(m))) return null;
      const brightness = view.attr<number>('brightness');
      return {
        value: brightness ? Math.round((brightness / 255) * 100) : 0,
        commit: (v) => this.call('light', 'turn_on', { brightness_pct: v }, view.id),
        label: this.t('light.brightness'),
      };
    }
    if (view.domain === 'cover' && view.supports(COVER_SET_POSITION)) {
      return {
        value: view.attr<number>('current_position') ?? 0,
        commit: (v) => this.call('cover', 'set_cover_position', { position: v }, view.id),
        label: this.t('cover.position'),
      };
    }
    if (view.domain === 'fan' && view.supports(FAN_SET_SPEED)) {
      return {
        value: view.attr<number>('percentage') ?? 0,
        commit: (v) => this.call('fan', 'set_percentage', { percentage: v }, view.id),
        label: this.t('fan.speed'),
      };
    }
    return null;
  }

  /**
   * The line under the name. State is said once: when the head already shows the reading (a sensor
   * on a large tile), this line carries context — the room, or when it last moved — never the same
   * figure again. A small tile has no head figure, so there the reading IS the line.
   */
  private stateLine(
    view: EntityView,
    on: boolean,
    level: number | null,
    valueInHead: boolean,
    small = false,
  ): string {
    if (view.status !== 'ok') {
      // a small tile has room for the word, not for "· 16 h ago" as well
      const since =
        view.stateObj && !small
          ? ` · ${relativeTime(this.hass, new Date(view.stateObj.last_changed))}`
          : '';
      return `${stateText(this.hass, view)}${since}`;
    }
    if (valueInHead) {
      if (view.areaName) return view.areaName;
      return view.stateObj ? relativeTime(this.hass, new Date(view.stateObj.last_changed)) : '';
    }
    const text = stateText(this.hass, view);
    return on && level !== null && level > 0
      ? `${text} · ${formatNumber(this.hass, level, { digits: 0 })} %`
      : text;
  }

  /** The reading of the first readout ("142 W"), for a small tile's state line. */
  private readoutText(item: TileItem): string {
    const id = item.readouts?.[0];
    if (!id) return '';
    const view = this.entity(id);
    if (view.status !== 'ok') return '';
    const parts = valueParts(this.hass, view);
    return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
  }

  private flip(view: EntityView, next: boolean): void {
    if (!this.hass) return;
    this.expect(
      view.id,
      next
        ? view.domain === 'cover'
          ? 'open'
          : view.domain === 'lock'
            ? 'unlocked'
            : 'on'
        : view.domain === 'cover'
          ? 'closed'
          : view.domain === 'lock'
            ? 'locked'
            : 'off',
    );
    void toggleEntity(this.hass, view.id);
  }

  /** Runs a tile action; a toggle goes through the optimistic flip so the fill answers under the finger. */
  private act(view: EntityView, on: boolean, action: ActionConfig): void {
    if (action.action === 'toggle' && !action.entity) this.flip(view, !on);
    else this.tap(view.id, action);
  }

  protected renderCard(): TemplateResult {
    const config = this.config as TileCardConfig & { entity: string };
    return this.renderTile(config, this.size());
  }

  /** The width one tile gets: the card's own (a tiles group divides its width). */
  protected tileWidth(): number {
    return this.width;
  }

  /** Whether the name reads whole at the large tile's 16/600 (2 px of margin for a fallback face). */
  private nameFits(name: string): boolean {
    const family = getComputedStyle(this).fontFamily;
    return textWidth(name, `600 16px ${family}`) <= this.tileWidth() - 32 - 2;
  }

  /** One tile of the given size — the single card, or each item of a tiles group. */
  protected renderTile(item: TileItem, size: TileSize): TemplateResult {
    const view = this.entity(item.entity);
    const name = item.name ?? view.name;
    const glyph = item.icon ?? glyphFor(view);
    const small = size !== 'large';
    const sizeClass = small ? ` fv-tile--${size}` : '';

    if (view.status === 'missing' || view.status === 'unavailable') {
      const open = (): void => this.tap(view.id, item.tap_action ?? MORE_INFO);
      return html`<article
        class="fv-tile fv-tile--off fv-tile--tap${sizeClass}"
        data-card
        role="button"
        tabindex="0"
        aria-label=${name}
        @click=${open}
        @keydown=${activateKey(open)}
      >
        ${ico('ban', 'off')}
        <div class="${small ? 'fv-tile__text' : 'fv-row__text'}">
          <h3 class="fv-tile__name">${name}</h3>
          <p class="fv-tile__state">${this.stateLine(view, false, null, false, small)}</p>
        </div>
      </article>`;
    }

    const state = this.stateOf(view);
    const on =
      state === view.state
        ? isActive(view)
        : !['off', 'closed', 'locked', 'idle', 'docked', 'paused'].includes(state);
    const tone = item.tone ?? toneFor(view);
    const level = this.level(view);
    const canToggle = TOGGLE_DOMAINS.has(view.domain);
    const sensorLike = view.domain === 'sensor' || view.domain === 'binary_sensor' || !canToggle;
    const iconTone =
      currentTone(view, on ? tone : 'accent') === 'neutral' ? 'accent' : on ? tone : 'accent';
    const classes = `fv-tile fv-tile--${tone} fv-tile--tap${sizeClass} ${on ? 'is-on' : ''}`;

    if (small) {
      // the whole tile is the button: tap toggles what toggles (opens what does not), hold opens the details
      const tapAction = item.tap_action ?? (canToggle ? TOGGLE : MORE_INFO);
      const holdAction = item.hold_action ?? MORE_INFO;
      const tapNow = (): void => this.act(view, on, tapAction);
      const holdNow = (): void => this.act(view, on, holdAction);
      let line = this.stateLine(view, on, level ? level.value : null, false);
      const reading = this.readoutText(item);
      if (reading) line = `${line} · ${reading}`;
      return html`<article
        class=${classes}
        data-card
        role="button"
        tabindex="0"
        aria-label=${name}
        .fvTap=${tapNow}
        .fvHold=${holdAction.action === 'none' ? undefined : holdNow}
        @pointerdown=${startPress}
        @click=${clickPress}
        @contextmenu=${preventMenu}
        @keydown=${activateKey(tapNow)}
      >
        ${ico(glyph, iconTone)}
        <div class="fv-tile__text">
          <h3 class="fv-tile__name">${name}</h3>
          <p class="fv-tile__state">${line}</p>
        </div>
      </article>`;
    }

    // everything in a large tile is drawn to its inner width (its own less 16 px sides): a tile squeezed narrow
    // folds its switch into the icon circle, gives its value to the state line, keeps one readout
    const inner = Math.floor(this.tileWidth()) - 32;
    const family = getComputedStyle(this).fontFamily;
    const parts = sensorLike ? valueParts(this.hass, view) : null;
    const valueInHead =
      parts !== null &&
      44 + 8 + textWidth(`${parts.value} ${parts.unit}`.trim(), `600 16px ${family}`) <= inner;
    const switchApart = canToggle && inner >= HEAD_ROOM;
    const flip = (event: Event): void => {
      event.stopPropagation();
      this.flip(view, !on);
    };
    const lead =
      canToggle && !switchApart
        ? ico(glyph, iconTone, { onTap: flip, label: name, checked: on })
        : ico(glyph, iconTone);
    const trailing = switchApart
      ? toggle(on, tone, (next) => this.flip(view, next), name)
      : parts && valueInHead
        ? html`<span class="fv-tile__value"
            >${parts.value}${parts.unit ? html` <span class="fv-unit">${parts.unit}</span>` : nothing}</span
          >`
        : nothing;

    let foot: TemplateResult | typeof nothing = nothing;
    if (level) {
      foot = html`<fluvy-ruler
        class=${on ? '' : 'fv-ruler--off'}
        ?on-fill=${on}
        .value=${on ? level.value : 0}
        .min=${0}
        .max=${100}
        .step=${1}
        .length=${Math.max(24, inner)}
        .knob=${28}
        .minor=${1 / 12}
        .major=${1 / 4}
        .tone=${on ? tone : 'neutral'}
        ?inactive=${!on}
        wake
        unit="%"
        .label=${`${name} · ${level.label}`}
        .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
        @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => level.commit(e.detail.value)}
        @click=${(e: Event) => e.stopPropagation()}
      ></fluvy-ruler>`;
    } else if (item.readouts?.length) {
      const shown = inner >= TWO_READOUTS ? 2 : 1;
      foot = html`<div class="fv-tile__foot ${shown === 1 ? 'fv-tile__foot--one' : ''}">
        ${item.readouts.slice(0, shown).map((id) => {
          const r = this.entity(id);
          const p = valueParts(this.hass, r);
          const short =
            r.deviceClass === 'power'
              ? this.t('energy.power')
              : r.deviceClass === 'energy'
                ? this.t('energy.today')
                : r.name.replace(name, '').trim() || r.name;
          return readout({ label: short, value: p.value, unit: p.unit, size: 'xs' });
        })}
      </div>`;
    }

    const open = (): void => this.tap(view.id, item.tap_action);
    return html`<article
      class=${`${classes}${foot === nothing ? ' fv-tile--footless' : this.nameFits(name) ? '' : ' fv-tile--tight'}`}
      data-card
      role="button"
      tabindex="0"
      aria-label=${name}
      @click=${open}
      @keydown=${activateKey(open)}
    >
      <div class="fv-tile__head">${lead}${trailing}</div>
      <h3 class="fv-tile__name">${name}</h3>
      <p class="fv-tile__state">
        ${this.stateLine(view, on, level ? level.value : null, valueInHead)}
      </p>
      ${foot}
    </article>`;
  }
}
