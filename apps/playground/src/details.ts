import { takeOverDetails } from '@fluvy/cards';
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';

/**
 * Home Assistant's details dialog, as the sheets stand it in: its history block (`ha-more-info-history`, the element
 * our takeover wraps, shaped as Home Assistant's — `hass` and `entityId` — drawing a plain stand-in of Home Assistant's
 * own block), and the dialog around it (`pg-details-dialog`, a frame's card): its head, the state row of its main view,
 * and the block at the dialog's full width as Home Assistant's main view lays it (24 out on each side, its own 24 in).
 * The page wears Fluvy as Home Assistant writes its theme (`--fluvy-theme` inline on `<html>`), so the real takeover
 * puts ours in its place. A frame freezes the block's clock, its window and a meter's reading (`now`, `hours`, `mode`),
 * set on our block once it stands in Home Assistant's.
 */

/** Home Assistant's own history block, as plain as the theme leaves it: its title, "Show more", its chart's room. */
class StandInHistory extends LitElement {
  static override properties = { hass: { attribute: false }, entityId: { attribute: false } };
  declare hass: HomeAssistant | undefined;
  declare entityId: string | undefined;

  static override styles = css`
    :host {
      font-family: var(--fluvy-font-sans, sans-serif);
      color: var(--fluvy-text);
    }
    /* Home Assistant pads its block's parts, never the block: ours is laid in the element's full width */
    .head,
    .chart {
      margin-inline: 24px;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 44px;
    }
    h2 {
      margin: 0;
      font-size: 20px;
      line-height: 24px;
      font-weight: 600;
    }
    a {
      color: var(--fluvy-accent);
      font-size: 14px;
      line-height: 20px;
    }
    .chart {
      height: 168px;
      margin-top: 8px;
      border-radius: 12px;
      background: var(--fluvy-page);
    }
  `;

  override render() {
    return this.entityId
      ? html`<div class="head">
            <h2>History</h2>
            <a href="/history">Show more</a>
          </div>
          <div class="chart"></div>`
      : nothing;
  }
}

/**
 * What a frame says of its dialog: the entity, its view (the main one with its state row, or a light's history view),
 * and our block's frozen clock, window and reading.
 */
interface DialogConfig extends LovelaceCardConfig {
  readonly entity: string;
  readonly view?: 'info' | 'history';
  /** Over the entity's name, as Home Assistant's head says it (its device). */
  readonly crumb?: string;
  readonly now?: string;
  readonly hours?: number;
  readonly mode?: 'gains' | 'total';
}

/** Our block's frozen properties, as a frame sets them. */
type Frozen = HTMLElement & { now?: number; hours?: number; mode?: string };

class StandInDialog extends LitElement {
  static override properties = { hass: { attribute: false }, config: { state: true } };
  declare hass: HomeAssistant | undefined;
  declare config: DialogConfig | undefined;

  setConfig(config: DialogConfig): void {
    this.config = config;
  }

  /**
   * The page wears Fluvy as Home Assistant's theme writes it on <html>, once a dialog stands on it: no other sheet's
   * page changes.
   */
  override connectedCallback(): void {
    super.connectedCallback();
    const root = document.documentElement.style;
    if (!root.getPropertyValue('--fluvy-theme')) root.setProperty('--fluvy-theme', '1');
  }

  getGridOptions(): { columns: number } {
    return { columns: 12 };
  }

  static override styles = css`
    :host {
      display: block;
      overflow: hidden;
      border-radius: var(--fluvy-radius-xl, 24px);
      background: var(--fluvy-card);
      box-shadow: inset 0 0 0 1px var(--fluvy-border);
      color: var(--fluvy-text);
      font-family: var(--fluvy-font-sans, sans-serif);
    }
    .head {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      align-items: center;
      gap: 4px;
      height: 64px;
      padding: 8px 8px 0;
      box-sizing: border-box;
    }
    .round {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--fluvy-text-secondary);
      font-size: 20px;
      line-height: 20px;
    }
    .crumb {
      margin: 0;
      overflow: hidden;
      color: var(--fluvy-text-secondary);
      font-size: 12px;
      line-height: 16px;
      font-weight: 500;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .title {
      margin: 0;
      overflow: hidden;
      font-size: 20px;
      line-height: 24px;
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .body {
      padding: 8px 24px 24px;
    }
    .state {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      height: 56px;
      margin-bottom: 16px;
    }
    .dot {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--fluvy-page);
    }
    .name {
      margin: 0;
      font-size: 16px;
      line-height: 20px;
    }
    .ago {
      margin: 0;
      color: var(--fluvy-text-secondary);
      font-size: 12px;
      line-height: 16px;
    }
    .value {
      font-size: 16px;
      line-height: 20px;
      font-variant-numeric: tabular-nums;
    }
    ha-more-info-history {
      display: block;
      margin-inline: -24px;
    }
  `;

  override render() {
    const config = this.config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const state = hass.states[config.entity];
    const name = String(state?.attributes['friendly_name'] ?? config.entity);
    const unit = state?.attributes['unit_of_measurement'];
    const history = config.view === 'history';
    return html`<div class="head" data-measure="skip">
        <span class="round">×</span>
        <div>
          <p class="crumb">${config.crumb ?? ''}</p>
          <p class="title">${history ? 'History' : name}</p>
        </div>
        <span class="round">⋮</span>
      </div>
      <div class="body">
        ${
          history
            ? nothing
            : html`<div class="state" data-measure="skip">
                <span class="dot"></span>
                <div>
                  <p class="name">${name}</p>
                  <p class="ago">47 seconds ago</p>
                </div>
                <span class="value">${state?.state ?? ''}${unit ? ` ${String(unit)}` : ''}</span>
              </div>`
        }
        <ha-more-info-history .hass=${hass} .entityId=${config.entity}></ha-more-info-history>
      </div>`;
  }

  /**
   * Our block's clock, window and reading, set on it once it stands in Home Assistant's (it is drawn after its file
   * lands).
   */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const config = this.config;
    if (!config) return;
    const block = this.renderRoot
      .querySelector('ha-more-info-history')
      ?.shadowRoot?.querySelector<Frozen>('fluvy-details-history');
    if (!block) {
      void customElements
        .whenDefined('fluvy-details-history')
        .then(() => requestAnimationFrame(() => this.requestUpdate()));
      return;
    }
    const now = config.now ? Date.parse(config.now) : undefined;
    if (now !== undefined && block.now !== now) block.now = now;
    if (config.hours !== undefined && block.hours !== config.hours) block.hours = config.hours;
    if (config.mode && block.mode !== config.mode) block.mode = config.mode;
  }
}

if (!customElements.get('ha-more-info-history'))
  customElements.define('ha-more-info-history', StandInHistory);
if (!customElements.get('pg-details-dialog'))
  customElements.define('pg-details-dialog', StandInDialog);

void takeOverDetails();
