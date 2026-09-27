import type { HomeAssistant, UnsubscribeFunc } from '../ha/types.js';
import {
  HOUSE_DEFAULTS,
  parseHouse,
  parsePersonal,
  PERSONAL_DEFAULTS,
  resolveSettings,
  SETTINGS_KEY,
  type EffectiveSettings,
  type HouseSettings,
  type PersonalSettings,
} from './schema.js';
import { safeStorage } from '../storage.js';

/** What the store needs of Home Assistant: its websocket. */
export type SettingsHass = Pick<HomeAssistant, 'connection' | 'callWS'>;

/** Fields to change; an explicit `undefined` clears one (a person going back to the house's look). */
type Patch<T> = { [K in keyof Omit<T, 'version'>]?: T[K] | undefined };

/** The last settings this browser saw, so the next page load can apply the look before the websocket answers. */
const CACHE_KEY = 'fluvy:settings';

export function cachedSettings(
  storage: Storage | undefined = safeStorage(),
): EffectiveSettings | undefined {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const { house, personal } = JSON.parse(raw) as { house: unknown; personal: unknown };
    return resolveSettings(parseHouse(house), parsePersonal(personal));
  } catch {
    return undefined;
  }
}

/**
 * The house's and this person's settings, live: both are subscribed to (Home Assistant sends the current
 * value, then every change — a palette picked on the phone recolours the wall panel), parsed, resolved and
 * handed to the listener. Writes go through the same storage; an admin writes the house's.
 */
export class SettingsStore {
  private houseValue: HouseSettings = HOUSE_DEFAULTS;
  private personalValue: PersonalSettings = PERSONAL_DEFAULTS;
  private readonly unsubscribes: Promise<UnsubscribeFunc>[] = [];

  constructor(
    private readonly hass: () => SettingsHass | undefined,
    private readonly storage: Storage | undefined = safeStorage(),
  ) {}

  get house(): HouseSettings {
    return this.houseValue;
  }

  get personal(): PersonalSettings {
    return this.personalValue;
  }

  get effective(): EffectiveSettings {
    return resolveSettings(this.houseValue, this.personalValue);
  }

  /** Subscribes to both layers; `onChange` runs on the first answer of each and on every change after. */
  start(onChange: (settings: EffectiveSettings) => void): void {
    const hass = this.hass();
    if (!hass) return;
    const listen = (type: string, apply: (value: unknown) => void): Promise<UnsubscribeFunc> =>
      hass.connection.subscribeMessage<{ value: unknown }>(
        ({ value }) => {
          apply(value);
          this.cache();
          onChange(this.effective);
        },
        { type, key: SETTINGS_KEY },
      );
    this.unsubscribes.push(
      listen('frontend/subscribe_system_data', (value) => {
        this.houseValue = parseHouse(value);
      }),
      listen('frontend/subscribe_user_data', (value) => {
        this.personalValue = parsePersonal(value);
      }),
    );
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribes.splice(0))
      void unsubscribe.then((off) => off()).catch(() => undefined);
  }

  /** Changes the house's settings (Home Assistant refuses it to a non-admin). */
  async saveHouse(patch: Patch<HouseSettings>): Promise<void> {
    const next = parseHouse({ ...this.houseValue, ...patch });
    await this.hass()?.callWS({ type: 'frontend/set_system_data', key: SETTINGS_KEY, value: next });
  }

  /** Changes this person's settings; `palette: undefined` goes back to the house's look. */
  async savePersonal(patch: Patch<PersonalSettings>): Promise<void> {
    const merged: Record<string, unknown> = { ...this.personalValue, ...patch };
    for (const key of Object.keys(patch) as (keyof typeof patch)[])
      if (patch[key] === undefined) delete merged[key];
    const next = parsePersonal(merged);
    await this.hass()?.callWS({ type: 'frontend/set_user_data', key: SETTINGS_KEY, value: next });
  }

  private cache(): void {
    try {
      this.storage?.setItem(
        CACHE_KEY,
        JSON.stringify({ house: this.houseValue, personal: this.personalValue }),
      );
    } catch {
      // private mode or a full storage: the next load waits for the websocket instead
    }
  }
}
