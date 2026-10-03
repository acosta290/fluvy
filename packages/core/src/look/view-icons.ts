import { ICON_PATHS } from '../icons/generated.js';

/*
 * A view without an icon, in a tab row asked for icons: the icon its name says, read in Fluvy's eight languages at
 * once (as the automatic dashboard reads a house), from its title and then its path ("Luces" → the bulb, "Hab 1" →
 * the rooms, "paneles" → the sun). A name it does not know keeps its words. Fetched on demand, its own chunk.
 */

/**
 * Each icon and the words that call for it, first match wins (a word of four letters or more matches as the start of
 * a word: "batter" finds "batteries"; a shorter one, or one ending in `$`, only as a whole word; one starting with `*`
 * as the end of a word: "*zimmer" finds "Wohnzimmer"). Words are written without accents.
 */
const TABLE: ReadonlyArray<readonly [icon: string, words: readonly string[]]> = [
  [
    'bulb',
    [
      'light',
      'lamp',
      'luz',
      'luces',
      'ilumina',
      'licht',
      'leucht',
      'beleucht',
      'lumiere',
      'eclairage',
      'luce',
      'luci',
      'illumina',
      'verlicht',
      'lichten',
      'luzes',
      'isik',
      'aydinlat',
    ],
  ],
  [
    'thermo',
    [
      'climate',
      'clima',
      'klima',
      'climat',
      'klimaat',
      'iklim',
      'heating',
      'calefac',
      'calor',
      'heizung',
      'chauffage',
      'riscalda',
      'verwarm',
      'aquecim',
      'isitma',
      'temperat',
      'sicaklik',
      'hvac',
      'thermostat',
      'termostat',
      'aire',
    ],
  ],
  [
    'battery',
    ['batter', 'bateri', 'akku', 'accu$', 'accus$', 'pil', 'piller', 'storage', 'almacena'],
  ],
  [
    'cloud',
    [
      'weather',
      'wetter',
      'meteo',
      'weer',
      'hava durumu',
      'tiempo$',
      'tempo$',
      'previsao',
      'previsione',
      'forecast',
      'pronostic',
    ],
  ],
  [
    'sun',
    [
      'solar',
      'solaire',
      'sun',
      'sol',
      'sonne',
      'soleil',
      'sole',
      'zon',
      'zonne',
      'gunes',
      'pv',
      'fotovolta',
      'photovolta',
    ],
  ],
  [
    'bolt',
    [
      'energy',
      'energi',
      'energie',
      'enerji',
      'power',
      'potencia',
      'strom',
      'puissance',
      'stroom',
      'elektri',
      'electric',
      'consum',
      'verbrauch',
      'verbruik',
      'tuketim',
    ],
  ],
  [
    'shield',
    [
      'security',
      'segur',
      'sicher',
      'securite',
      'sicurez',
      'beveilig',
      'guvenlik',
      'alarm',
      'allarm',
    ],
  ],
  // an Italian "camera da letto" is a bedroom, before "camera" is a camera
  [
    'rooms',
    [
      'room',
      'rooms',
      'hab',
      'habitac',
      'dormitor',
      'cuarto',
      'salon',
      'sala',
      'living',
      'cocina',
      'kitchen',
      'bedroom',
      'zimmer',
      'raum',
      'raume',
      'kuche',
      'piece',
      'pieces',
      'chambre',
      'cuisine',
      'stanza',
      'stanze',
      'camera da letto',
      'cucina',
      'soggiorno',
      'kamer$',
      'kamers$',
      'keuken',
      'quarto',
      'comodo',
      'cozinha',
      'oda',
      'odalar',
      'odasi$',
      'bath',
      'bano',
      'bad$',
      'banheir',
      'bagno',
      'banyo',
      '*zimmer',
      '*kamer',
      '*kamers',
      'sejour',
      'salle',
      'camere',
      'mutfak',
      'office',
      'despacho',
      'oficina',
      'buro',
      'bureau',
      'ufficio',
      'kantoor',
      'escritorio',
      'ofis',
      'planta$',
      'floor',
      'etage',
      'piso',
      'piano',
      'verdieping',
      'andar',
      'kat',
    ],
  ],
  ['camera', ['camera', 'cameras', 'camara', 'kamera', 'telecamer', 'videovigil', 'cctv']],
  [
    'lock',
    [
      'lock',
      'locks',
      'cerradur',
      'schloss',
      'serrure',
      'serratur',
      'slot',
      'sloten',
      'fechadur',
      'kilit',
      'door',
      'puerta',
    ],
  ],
  [
    'speaker',
    [
      'media',
      'multimedia',
      'music',
      'musica',
      'musik',
      'musique',
      'muziek',
      'muzik',
      'audio',
      'sonos',
      'radio',
    ],
  ],
  ['film', ['tv', 'tele', 'television', 'fernseh', 'cinema', 'cine', 'kino', 'sinema']],
  [
    'leaf',
    [
      'garden',
      'jardin',
      'jardim',
      'garten',
      'giardin',
      'tuin',
      'bahce',
      'plant',
      'pflanz',
      'piant',
      'bitki',
      'outdoor',
      'exterior',
      'aussen',
      'buiten',
      'esterno',
      'dis',
    ],
  ],
  ['automation', ['automat', 'otomas', 'scene', 'escena', 'szene', 'scena', 'cena', 'sahne']],
  [
    'car',
    [
      'garage',
      'garaje',
      'garagem',
      'garaj',
      'car',
      'coche',
      'auto',
      'voiture',
      'carro',
      'araba',
      'charger',
      'cargador',
      'wallbox',
    ],
  ],
  [
    'calendar',
    ['agenda', 'calendar', 'calendario', 'kalender', 'calendrier', 'takvim', 'schedule', 'horario'],
  ],
  [
    'person',
    [
      'people',
      'person',
      'family',
      'familia',
      'famili',
      'famille',
      'famiglia',
      'gezin',
      'aile',
      'presen',
      'kisi',
    ],
  ],
  ['drop', ['water', 'agua', 'wasser', 'eau', 'acqua', 'su', 'riego', 'irriga']],
  ['fan', ['fan', 'fans', 'ventila', 'vantilat']],
  [
    'blinds',
    [
      'blind',
      'cover',
      'persian',
      'cortina',
      'rollo',
      'jalousie',
      'volet',
      'tapparell',
      'rolluik',
      'panjur',
      'store',
    ],
  ],
  ['vacuum', ['vacuum', 'aspira', 'staubsaug', 'stofzuig', 'supurge', 'robot']],
  [
    'chart',
    ['sensor', 'capteur', 'history', 'historia', 'histori', 'statist', 'estadist', 'gecmis'],
  ],
  [
    'home',
    [
      'home',
      'inicio',
      'casa',
      'hogar',
      'overview',
      'resumen',
      'start',
      'ubersicht',
      'accueil',
      'maison',
      'panoramica',
      'overzicht',
      'thuis',
      'visao geral',
      'ana sayfa',
      'ev',
      'anasayfa',
      'genel',
      'main',
      'principal',
    ],
  ],
];

/** Lower case, no accents (a Turkish ı too), separators as spaces: "Habitación_1" → "habitacion 1". */
const plain = (text: string): string =>
  text
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_./-]+/g, ' ')
    .trim();

const matchers: ReadonlyArray<readonly [string, RegExp]> = TABLE.map(([icon, words]) => {
  const ending = words.filter((w) => w.startsWith('*')).map((w) => w.slice(1));
  const rest = words.filter((w) => !w.startsWith('*'));
  const whole = (w: string): boolean => w.length < 4 || w.endsWith('$');
  const long = rest.filter((w) => !whole(w));
  const short = rest.filter(whole).map((w) => w.replace(/\$$/, ''));
  const parts = [
    ...(long.length ? [`(?:^|\\s)(?:${long.join('|')})`] : []),
    ...(short.length ? [`(?:^|\\s)(?:${short.join('|')})(?=\\s|\\d|$)`] : []),
    ...(ending.length ? [`(?:^|\\s)\\S*(?:${ending.join('|')})(?=\\s|\\d|$)`] : []),
  ];
  return [icon, new RegExp(parts.join('|'))] as const;
});

/** The icon a view's name (else its path) says, as a fluvy icon name; undefined when neither says one. */
export function viewIconName(title: string, path = ''): string | undefined {
  for (const text of [plain(title), plain(path)]) {
    if (!text) continue;
    const found = matchers.find(([, pattern]) => pattern.test(text));
    if (found) return found[0];
  }
  return undefined;
}

/** That icon as a CSS image for a mask (the fluvy set's filled outline on the 24 grid); undefined when none. */
export function viewIcon(title: string, path = ''): string | undefined {
  const name = viewIconName(title, path);
  const d = name ? ICON_PATHS[name] : undefined;
  return d
    ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}'/></svg>")`
    : undefined;
}
