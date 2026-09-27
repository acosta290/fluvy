import {
  formatNumber,
  valueParts,
  type EntityView,
  type HomeAssistant,
  type ValueParts,
} from '@fluvy/core';

/**
 * Energy arithmetic shared by the three energy cards. Home Assistant lets every integration pick its
 * own unit — one house happily reports the grid in W, the inverter in kW and the meter in MWh — so
 * everything is brought to a base unit (W for power, Wh for energy) before it is compared, summed or
 * drawn, and a whole diagram is then displayed in ONE unit chosen from its largest figure.
 */

export type Family = 'power' | 'energy';

/** Every unit Home Assistant accepts on the `power` device class, in watts. */
const POWER = new Map<string, number>([
  ['mW', 1e-3],
  ['W', 1],
  ['kW', 1e3],
  ['MW', 1e6],
  ['GW', 1e9],
  ['TW', 1e12],
  ['BTU/h', 0.29307107],
]);

/** Every unit Home Assistant accepts on the `energy` device class, in watt-hours. */
const ENERGY = new Map<string, number>([
  ['mWh', 1e-3],
  ['Wh', 1],
  ['kWh', 1e3],
  ['MWh', 1e6],
  ['GWh', 1e9],
  ['TWh', 1e12],
  ['J', 1 / 3600],
  ['kJ', 1 / 3.6],
  ['MJ', 1e3 / 3.6],
  ['GJ', 1e6 / 3.6],
  ['cal', 4.184 / 3600],
  ['kcal', 4.184 / 3.6],
  ['Mcal', 4184 / 3.6],
  ['Gcal', 4.184e6 / 3.6],
]);

/** The unit decides; a sensor that carries none is read by its device class. Anything else is not ours to convert. */
export function family(view: EntityView): Family | null {
  const unit = view.unit.trim();
  if (unit) return POWER.has(unit) ? 'power' : ENERGY.has(unit) ? 'energy' : null;
  return view.deviceClass === 'power' ? 'power' : view.deviceClass === 'energy' ? 'energy' : null;
}

/**
 * Watts of a sensor the config declares as power (`solar_power`, `grid_power` …): no unit means W.
 * `null` when there is no usable number or the unit is not a power unit — a wrong figure is worse than "—".
 */
export function watts(view: EntityView): number | null {
  if (view.status !== 'ok' || view.number === null) return null;
  const unit = view.unit.trim();
  const factor = unit ? POWER.get(unit) : 1;
  return factor === undefined ? null : view.number * factor;
}

/** The base-unit value (W or Wh) of a sensor that may be either family, so rows can be compared and summed. */
export function baseValue(view: EntityView): number | null {
  const kind = family(view);
  if (!kind || view.status !== 'ok' || view.number === null) return null;
  const factor = (kind === 'power' ? POWER : ENERGY).get(view.unit.trim()) ?? 1;
  return view.number * factor;
}

export interface Scale {
  readonly unit: string;
  readonly divisor: number;
}

/**
 * One unit for a set of figures: the largest decides. 3 200 W and 400 W read as "3.2 kW" and
 * "0.4 kW", never as "3.2 kW" beside "400 W".
 */
export function scaleOf(values: readonly (number | null)[], base: 'W' | 'Wh'): Scale {
  let peak = 0;
  for (const v of values) if (v !== null && Number.isFinite(v)) peak = Math.max(peak, Math.abs(v));
  if (peak >= 1e9) return { unit: `G${base}`, divisor: 1e9 };
  if (peak >= 1e6) return { unit: `M${base}`, divisor: 1e6 };
  if (peak >= 1e3) return { unit: `k${base}`, divisor: 1e3 };
  return { unit: base, divisor: 1 };
}

/**
 * A base-unit figure in the set's unit, at the precision the design uses: "450" W, "3.2" kW, "286" kWh.
 * Scaled figures keep their decimal ("3.0", not "3") so a live readout does not change width as it
 * moves; a trickle in a big unit gets a second decimal rather than reading as nothing ("0.04" kW).
 * `null` prints the em dash: a missing number is never a 0.
 */
export function scaled(
  hass: HomeAssistant | undefined,
  value: number | null,
  scale: Scale,
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const v = value / scale.divisor;
  const abs = Math.abs(v);
  if (abs === 0) return formatNumber(hass, 0, { digits: 0 });
  if (scale.divisor === 1) return formatNumber(hass, v, { digits: abs < 10 ? 1 : 0 });
  const digits = abs >= 100 ? 0 : abs < 0.095 ? 2 : 1;
  return formatNumber(hass, v, { digits, minDigits: digits });
}

/** "Washing machine Energy today" → "Washing machine": a legend label is the device, not the sensor's full name. */
export function shortName(view: EntityView): string {
  const trimmed = view.name
    .replace(
      /\b(energy|energía|energia|power|potencia|today|hoy|day|día|dia|daily|consumption|consumo|yield|producción|produccion)\b/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
  const name = trimmed || view.name;
  // an 11/600 uppercase label holds about 11 characters in a 96 px column: "Kitchen speaker" becomes "Speaker", never "KITCHEN SPEA…"
  const words = name.split(' ');
  return name.length > 11 && words.length > 1 ? (words[words.length - 1] as string) : name;
}

/** Safe share: 0 when the total is 0 or missing, never NaN and never Infinity. */
export const share = (part: number, total: number): number =>
  total > 0 && Number.isFinite(part) ? Math.min(1, Math.max(0, part / total)) : 0;

/**
 * What a readout prints for a power or energy sensor: the unit its own figure asks for (3 200 W →
 * "3.2 kW", 11 200 Wh → "11.2 kWh", 450 W → "450 W"). Only the watt ladder is rescaled — a meter in
 * MJ or a price keeps Home Assistant's own unit and formatting, display precision included.
 */
export function readoutParts(
  hass: HomeAssistant | undefined,
  view: EntityView,
  raw?: number,
): ValueParts {
  const kind = family(view);
  const unit = view.unit.trim();
  const base = kind === 'power' ? 'W' : 'Wh';
  // `raw` is a figure in the entity's own unit (a point of its history); without it, the entity's reading
  const value =
    raw === undefined
      ? baseValue(view)
      : Number.isFinite(raw)
        ? raw * ((kind === 'power' ? POWER : ENERGY).get(unit) ?? 1)
        : null;
  if (!kind || value === null || (unit !== '' && !unit.endsWith(base)))
    return raw === undefined
      ? valueParts(hass, view)
      : { value: formatNumber(hass, raw, { digits: Math.abs(raw) >= 100 ? 0 : 1 }), unit };
  const scale = scaleOf([value], base);
  return { value: scaled(hass, value, scale), unit: scale.unit };
}

/**
 * A row of readouts read together: every energy figure in ONE unit and every power figure in ONE
 * unit, each chosen by the largest of its family ("0.2 kWh" beside "1.2 kWh", never "230 Wh"). A
 * sensor of any other kind keeps what Home Assistant would print.
 */
export function legendParts(
  hass: HomeAssistant | undefined,
  views: readonly EntityView[],
): ValueParts[] {
  const bases = views.map((view) => ({ kind: family(view), value: baseValue(view) }));
  const scale = (kind: Family): Scale =>
    scaleOf(
      bases.filter((b) => b.kind === kind).map((b) => b.value),
      kind === 'power' ? 'W' : 'Wh',
    );
  const scales = { power: scale('power'), energy: scale('energy') };
  return views.map((view, index) => {
    const { kind, value } = bases[index] ?? { kind: null, value: null };
    if (!kind || value === null) return readoutParts(hass, view);
    return { value: scaled(hass, value, scales[kind]), unit: scales[kind].unit };
  });
}

/** A price or a running cost: money is written to the cent ("0.30", not "0.3") unless the user set a precision. */
export function costParts(hass: HomeAssistant | undefined, view: EntityView): ValueParts {
  if (view.status !== 'ok' || view.number === null) return valueParts(hass, view);
  const digits = hass?.entities?.[view.id]?.display_precision ?? 2;
  return { value: formatNumber(hass, view.number, { digits, minDigits: digits }), unit: view.unit };
}
