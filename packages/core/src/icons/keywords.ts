/*
 * The words a person searches Home Assistant's icon picker by beyond a glyph's own name, which the picker reads itself
 * word by word (`battery-low` is found by "battery"): what the glyph draws ("sofa" finds `fluvy:living-room`), what
 * else it is called ("bath" finds the bathroom) and what reads it ("rssi" finds a signal's bars). Kept beside the index
 * of the set's parts, in the chunk the picker's list fetches anyway.
 */

const CHARGE = 'charge level power';
const SIGNAL = 'wifi rssi strength reception wireless dbm bars';
const VALVE = 'water pipe tap shutoff';
const METER = 'counter consumption utility';

/**
 * Each glyph's words, space-separated (a phrase hyphenated, as the picker reads what is typed: "air conditioner" is
 * `air-conditioner`): the glyphs of 1.23 (#226), the appliances a person picks and the signal Fluvy drew before them.
 */
const KEYWORDS: Readonly<Record<string, string>> = {
  signal: SIGNAL,
  // the appliances a person picks
  washer: 'washing-machine laundry',
  dryer: 'tumble-dryer laundry',
  dishwasher: 'dishes',
  fridge: 'refrigerator',
  oven: 'cooker baking',
  hob: 'stove cooktop',
  coffee: 'espresso machine',
  kettle: 'tea',
  fryer: 'air-fryer',
  toaster: 'bread',
  // the levels
  'battery-empty': `${CHARGE} dead flat`,
  'battery-low': CHARGE,
  'battery-half': CHARGE,
  'battery-full': CHARGE,
  'battery-charging': `${CHARGE} charger plugged`,
  'signal-none': SIGNAL,
  'signal-weak': SIGNAL,
  'signal-fair': SIGNAL,
  'signal-good': SIGNAL,
  'signal-strong': SIGNAL,
  'signal-off': `${SIGNAL} offline disconnected`,
  'valve-open': VALVE,
  'valve-shut': `${VALVE} closed`,
  // energy
  'battery-alert': `${CHARGE} warning`,
  'solar-panel': 'sun photovoltaic pv inverter production',
  'battery-home': `${CHARGE} storage house`,
  'ev-plug': 'car charger charging electric-vehicle station',
  'electric-meter': `${METER} electricity energy power grid`,
  'gas-meter': `${METER} flame`,
  'water-meter': `${METER} drop`,
  socket: 'outlet plug power wall',
  // devices
  router: 'wifi network internet modem access-point',
  ethernet: 'lan network cable port',
  bluetooth: 'wireless',
  phone: 'mobile smartphone cellphone',
  tablet: 'screen',
  laptop: 'computer notebook',
  desktop: 'computer monitor screen pc',
  watch: 'smartwatch wearable',
  'speaker-smart': 'assistant voice',
  remote: 'control television tv',
  'game-controller': 'gamepad console gaming',
  server: 'nas rack network',
  printer: 'print paper',
  // climate and air
  radiator: 'heating heater',
  boiler: 'heating furnace hot-water',
  aircon: 'air-conditioner ac cooling hvac',
  dehumidifier: 'humidity damp',
  purifier: 'air filter',
  co2: 'carbon-dioxide',
  'air-quality': 'lungs breathe aqi',
  particles: 'pm25 pm10 dust pollution',
  voc: 'molecule chemical',
  pressure: 'barometer gauge',
  uv: 'ultraviolet sun',
  'rain-gauge': 'precipitation',
  'thermo-high': 'temperature thermometer hot warm',
  'thermo-low': 'temperature thermometer cold',
  'humid-high': 'humidity',
  'humid-low': 'humidity dry',
  // water and safety
  tank: 'water cistern',
  leak: 'water pipe drip',
  flood: 'water',
  doorbell: 'bell ring visitor',
  intercom: 'entry phone',
  siren: 'alarm',
  smoke: 'fire detector',
  'co-alarm': 'carbon-monoxide detector',
  'alarm-panel': 'security',
  keypad: 'code pin',
  fingerprint: 'biometric',
  safe: 'vault',
  parcel: 'package delivery box',
  // outdoors
  mailbox: 'letter post mail',
  pool: 'swimming',
  sprinkler: 'irrigation watering lawn',
  mower: 'lawn grass',
  plant: 'pot leaf',
  tree: 'nature',
  bbq: 'barbecue grill',
  'outdoor-light': 'lantern porch lamp',
  recycle: 'bin waste',
  // home
  'ceiling-light': 'lamp pendant',
  'desk-lamp': 'light reading',
  'led-strip': 'light',
  curtains: 'window drapes',
  shutter: 'roller blind',
  awning: 'shade',
  freezer: 'fridge cold',
  hood: 'extractor cooker',
  // rooms
  kitchen: 'stove pot cooking',
  bedroom: 'bed sleep',
  bathroom: 'shower bath bathtub',
  'kids-room': 'child children nursery baby teddy',
  office: 'desk study work',
  dining: 'table eat food',
  laundry: 'washing clothes utility',
  garden: 'yard flower',
  'living-room': 'sofa couch lounge',
  hallway: 'corridor coat entrance',
  stairs: 'steps',
  toilet: 'wc restroom',
};

/** A glyph's words for the icon picker; none for a glyph its name says whole. */
export const keywordsOf = (name: string): string[] =>
  Object.hasOwn(KEYWORDS, name) ? (KEYWORDS[name] ?? '').split(' ') : [];
