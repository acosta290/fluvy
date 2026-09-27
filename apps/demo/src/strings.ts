import type { LanguageCode } from '@fluvy/core';

/** The demo's own words (the cards, pages and panel carry theirs), in every language Fluvy ships. */
const en = {
  'brand.sub': 'Live demo',
  'family.home': 'Home',
  'family.devices': 'Devices',
  'family.climate': 'Climate',
  'family.energy': 'Energy',
  'family.media': 'Media',
  'family.time': 'Time',
  'family.helpers': 'Helpers',
  'page.panel': 'Settings',
  'page.activity': 'Activity',
  'page.history': 'History',
  'mode.light': 'Light',
  'mode.dark': 'Dark',
  'device.phone': 'Phone',
  'device.phone-l': 'Large phone',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Palette',
  'palette.custom': 'Your own accent, in the settings panel',
  'links.install': 'Install',
  'links.github': 'GitHub',
  'banner.text':
    "A simulated home: Marta's flat on a Thursday evening. Every card, page and setting here is the real one; Home Assistant is stood in for by a small stand-in that changes state 140 ms after a service call. Nothing is connected.",
  'banner.ok': 'Got it',
  'notice.more_info': 'Opens the details of {entity} in Home Assistant',
  'notice.navigate': 'Opens {path} in Home Assistant',
  'notice.auto':
    'The automatic dashboard is built inside Home Assistant; the Dashboard tab shows a preview of it',
} as const;

export type StringKey = keyof typeof en;
type Table = Readonly<Record<StringKey, string>>;

const es: Table = {
  'brand.sub': 'Demo en vivo',
  'family.home': 'Inicio',
  'family.devices': 'Dispositivos',
  'family.climate': 'Clima',
  'family.energy': 'Energía',
  'family.media': 'Multimedia',
  'family.time': 'Tiempo',
  'family.helpers': 'Ayudantes',
  'page.panel': 'Ajustes',
  'page.activity': 'Actividad',
  'page.history': 'Historial',
  'mode.light': 'Claro',
  'mode.dark': 'Oscuro',
  'device.phone': 'Móvil',
  'device.phone-l': 'Móvil grande',
  'device.tablet': 'Tableta',
  'device.desktop': 'Escritorio',
  'palette.title': 'Paleta',
  'palette.custom': 'Tu propio acento, en el panel de ajustes',
  'links.install': 'Instalar',
  'links.github': 'GitHub',
  'banner.text':
    'Una casa simulada: el piso de Marta un jueves por la noche. Cada tarjeta, página y ajuste es el real; a Home Assistant lo sustituye un doble pequeño que cambia el estado 140 ms después de cada llamada a un servicio. Nada está conectado.',
  'banner.ok': 'Entendido',
  'notice.more_info': 'Abre los detalles de {entity} en Home Assistant',
  'notice.navigate': 'Abre {path} en Home Assistant',
  'notice.auto':
    'El panel automático se construye dentro de Home Assistant; la pestaña Panel muestra una vista previa',
};

const de: Table = {
  'brand.sub': 'Live-Demo',
  'family.home': 'Zuhause',
  'family.devices': 'Geräte',
  'family.climate': 'Klima',
  'family.energy': 'Energie',
  'family.media': 'Medien',
  'family.time': 'Zeit',
  'family.helpers': 'Helfer',
  'page.panel': 'Einstellungen',
  'page.activity': 'Aktivität',
  'page.history': 'Verlauf',
  'mode.light': 'Hell',
  'mode.dark': 'Dunkel',
  'device.phone': 'Handy',
  'device.phone-l': 'Großes Handy',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Palette',
  'palette.custom': 'Deine eigene Akzentfarbe, im Einstellungsbereich',
  'links.install': 'Installieren',
  'links.github': 'GitHub',
  'banner.text':
    'Ein simuliertes Zuhause: Martas Wohnung an einem Donnerstagabend. Jede Karte, Seite und Einstellung hier ist die echte; Home Assistant wird von einem kleinen Stellvertreter ersetzt, der den Zustand 140 ms nach einem Dienstaufruf ändert. Nichts ist verbunden.',
  'banner.ok': 'Verstanden',
  'notice.more_info': 'Öffnet die Details von {entity} in Home Assistant',
  'notice.navigate': 'Öffnet {path} in Home Assistant',
  'notice.auto':
    'Das automatische Dashboard entsteht in Home Assistant; der Tab „Dashboard“ zeigt eine Vorschau',
};

const nl: Table = {
  'brand.sub': 'Live demo',
  'family.home': 'Thuis',
  'family.devices': 'Apparaten',
  'family.climate': 'Klimaat',
  'family.energy': 'Energie',
  'family.media': 'Media',
  'family.time': 'Tijd',
  'family.helpers': 'Helpers',
  'page.panel': 'Instellingen',
  'page.activity': 'Activiteit',
  'page.history': 'Geschiedenis',
  'mode.light': 'Licht',
  'mode.dark': 'Donker',
  'device.phone': 'Telefoon',
  'device.phone-l': 'Grote telefoon',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Palet',
  'palette.custom': 'Je eigen accentkleur, in het instellingenpaneel',
  'links.install': 'Installeren',
  'links.github': 'GitHub',
  'banner.text':
    'Een gesimuleerd huis: de flat van Marta op een donderdagavond. Elke kaart, pagina en instelling hier is de echte; Home Assistant wordt vervangen door een kleine stand-in die 140 ms na een service-aanroep van status verandert. Er is niets verbonden.',
  'banner.ok': 'Begrepen',
  'notice.more_info': 'Opent de details van {entity} in Home Assistant',
  'notice.navigate': 'Opent {path} in Home Assistant',
  'notice.auto':
    'Het automatische dashboard wordt in Home Assistant gebouwd; het tabblad Dashboard toont een voorbeeld',
};

const fr: Table = {
  'brand.sub': 'Démo en direct',
  'family.home': 'Accueil',
  'family.devices': 'Appareils',
  'family.climate': 'Climat',
  'family.energy': 'Énergie',
  'family.media': 'Médias',
  'family.time': 'Temps',
  'family.helpers': 'Assistants',
  'page.panel': 'Réglages',
  'page.activity': 'Activité',
  'page.history': 'Historique',
  'mode.light': 'Clair',
  'mode.dark': 'Sombre',
  'device.phone': 'Téléphone',
  'device.phone-l': 'Grand téléphone',
  'device.tablet': 'Tablette',
  'device.desktop': 'Ordinateur',
  'palette.title': 'Palette',
  'palette.custom': 'Votre propre accent, dans le panneau de réglages',
  'links.install': 'Installer',
  'links.github': 'GitHub',
  'banner.text':
    "Une maison simulée : l'appartement de Marta un jeudi soir. Chaque carte, page et réglage est le vrai ; Home Assistant est remplacé par une petite doublure qui change d'état 140 ms après chaque appel de service. Rien n'est connecté.",
  'banner.ok': 'Compris',
  'notice.more_info': 'Ouvre les détails de {entity} dans Home Assistant',
  'notice.navigate': 'Ouvre {path} dans Home Assistant',
  'notice.auto':
    "Le tableau de bord automatique se construit dans Home Assistant ; l'onglet Tableau de bord en montre un aperçu",
};

const it: Table = {
  'brand.sub': 'Demo dal vivo',
  'family.home': 'Casa',
  'family.devices': 'Dispositivi',
  'family.climate': 'Clima',
  'family.energy': 'Energia',
  'family.media': 'Media',
  'family.time': 'Tempo',
  'family.helpers': 'Helper',
  'page.panel': 'Impostazioni',
  'page.activity': 'Attività',
  'page.history': 'Cronologia',
  'mode.light': 'Chiaro',
  'mode.dark': 'Scuro',
  'device.phone': 'Telefono',
  'device.phone-l': 'Telefono grande',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Palette',
  'palette.custom': 'Il tuo accento, nel pannello delle impostazioni',
  'links.install': 'Installa',
  'links.github': 'GitHub',
  'banner.text':
    "Una casa simulata: l'appartamento di Marta un giovedì sera. Ogni scheda, pagina e impostazione qui è quella vera; Home Assistant è sostituito da una piccola controfigura che cambia stato 140 ms dopo ogni chiamata a un servizio. Niente è collegato.",
  'banner.ok': 'Capito',
  'notice.more_info': 'Apre i dettagli di {entity} in Home Assistant',
  'notice.navigate': 'Apre {path} in Home Assistant',
  'notice.auto':
    'La dashboard automatica si costruisce dentro Home Assistant; la scheda Dashboard ne mostra un’anteprima',
};

const ptBR: Table = {
  'brand.sub': 'Demo ao vivo',
  'family.home': 'Início',
  'family.devices': 'Dispositivos',
  'family.climate': 'Clima',
  'family.energy': 'Energia',
  'family.media': 'Mídia',
  'family.time': 'Tempo',
  'family.helpers': 'Auxiliares',
  'page.panel': 'Configurações',
  'page.activity': 'Atividade',
  'page.history': 'Histórico',
  'mode.light': 'Claro',
  'mode.dark': 'Escuro',
  'device.phone': 'Celular',
  'device.phone-l': 'Celular grande',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Paleta',
  'palette.custom': 'Seu próprio destaque, no painel de configurações',
  'links.install': 'Instalar',
  'links.github': 'GitHub',
  'banner.text':
    'Uma casa simulada: o apartamento da Marta numa quinta à noite. Cada cartão, página e configuração aqui é o real; o Home Assistant é substituído por um pequeno dublê que muda o estado 140 ms depois de cada chamada de serviço. Nada está conectado.',
  'banner.ok': 'Entendi',
  'notice.more_info': 'Abre os detalhes de {entity} no Home Assistant',
  'notice.navigate': 'Abre {path} no Home Assistant',
  'notice.auto':
    'O painel automático é construído dentro do Home Assistant; a aba Painel mostra uma prévia',
};

const TABLES: Readonly<Record<LanguageCode, Table>> = { en, es, de, nl, fr, it, 'pt-BR': ptBR };

/** A word of the demo in `language`. */
export const t = (
  language: LanguageCode,
  key: StringKey,
  values?: Record<string, string | number>,
): string => {
  const template = TABLES[language][key];
  return values
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    : template;
};
