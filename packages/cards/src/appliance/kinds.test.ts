import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { PRINTER_HOUSE } from '../printer/fixtures.js';
import { printerDevices } from '../printer/roles.js';
import { allFixtures, houseOf, laterFixtures } from './fixtures/index.js';
import {
  APPLIANCE_KINDS,
  applianceDevices,
  byWords,
  KIND_DEFAULTS,
  kindOf,
  LG_MODEL,
  signalsOf,
  type KindSignals,
} from './kinds.js';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const FIXTURES = allFixtures(NOW);
const HOUSE = houseOf(FIXTURES, NOW);

/** Signals with nothing in them but what a test says. */
const signals = (given: Partial<KindSignals>): KindSignals => ({
  keys: new Set(),
  objects: [],
  domains: new Set(),
  programs: [],
  tops: [],
  ...given,
});

describe('what an appliance is', () => {
  it.each(FIXTURES.map((fixture) => [fixture.title, fixture]))('knows %s', (_, fixture) => {
    const verdict = kindOf(signalsOf(HOUSE, fixture.device.id));
    if (fixture.expected.excluded) expect(verdict).toEqual({ excluded: fixture.expected.excluded });
    else if (fixture.expected.kind) expect(verdict).toMatchObject({ kind: fixture.expected.kind });
    else expect(verdict).toBeUndefined();
  });

  it('asks in order: the card, then the model, then LG’s type, then the keys, then the name', () => {
    // the card's word over everything, even what is never an appliance
    expect(kindOf(signals({ model: 'Robot vacuum cleaner', platform: 'miele' }), 'oven')).toEqual({
      kind: 'oven',
      by: 'config',
    });
    // Miele's model over its keys and its name
    expect(
      kindOf(
        signals({
          platform: 'miele',
          model: 'Washer dryer',
          keys: new Set(['salt_level']),
          name: 'Spüli',
        }),
      ),
    ).toEqual({ kind: 'washer_dryer', by: 'model' });
    // LG's type over its keys
    expect(
      kindOf(
        signals({
          platform: 'lg_thinq',
          model: 'X (DEVICE_OVEN)',
          keys: new Set(['express_fridge']),
        }),
      ),
    ).toEqual({ kind: 'oven', by: 'lg' });
    // the keys over the name
    expect(
      kindOf(
        signals({ platform: 'home_connect', keys: new Set(['salt_lack']), name: 'Waschmaschine' }),
      ),
    ).toEqual({ kind: 'dishwasher', by: 'keys' });
    expect(kindOf(signals({ platform: 'shelly', name: 'Lavastoviglie' }))).toEqual({
      kind: 'dishwasher',
      by: 'words',
    });
    // 'auto' asks the appliance
    expect(kindOf(signals({ name: 'Kettle' }), 'auto')).toEqual({ kind: 'kettle', by: 'words' });
  });

  it('reads its maker’s words where its name and its model say nothing (#115), never over them', () => {
    // the DE1 as its plugin names it, then renamed by its owner
    const de1 = { platform: 'mqtt', model: 'DE1PRO', manufacturer: 'Decent Espresso' };
    expect(kindOf(signals({ ...de1, name: 'Decent Espresso DE1PRO' }))).toEqual({
      kind: 'coffee',
      by: 'words',
    });
    expect(kindOf(signals({ ...de1, name: 'DE1' }))).toEqual({ kind: 'coffee', by: 'words' });
    expect(kindOf(signals({ ...de1, name: 'Wasserkocher' }))).toEqual({
      kind: 'kettle',
      by: 'words',
    });
    // a maker of anything says nothing
    expect(kindOf(signals({ platform: 'shelly', name: 'Plug 3', manufacturer: 'Shelly' }))).toBe(
      undefined,
    );
    // nor does one whose name says a robot or a charger: it rules out no appliance its plug powers
    for (const manufacturer of ['Allterco Robotics', 'Ecovacs Robotics', 'Wallbox'])
      expect(
        kindOf(signals({ platform: 'shelly', name: 'Plug 3', manufacturer })),
        manufacturer,
      ).toBe(undefined);
  });

  it('reads LG’s type off its model, both integrations’ forms, and a WashTower’s half off its name', () => {
    expect(LG_MODEL.exec('WM4000HWA (DEVICE_WASHER)')?.[1]).toBe('WASHER');
    expect(LG_MODEL.exec('F4V5VYP0W (TOWER_DRYER)')?.[1]).toBe('TOWER_DRYER');
    expect(LG_MODEL.exec('WM4000HWA')).toBeNull();
    const tower = (name: string) =>
      kindOf(signals({ platform: 'lg_thinq', model: 'WKEX200 (DEVICE_WASHTOWER)', name }));
    expect(tower('Turm washer')).toMatchObject({ kind: 'washer' });
    expect(tower('Turm dryer')).toMatchObject({ kind: 'dryer' });
    // a WashTower not split in two is both
    expect(tower('Turm')).toMatchObject({ kind: 'washer_dryer' });
    expect(kindOf(signals({ model: 'WM6998 (DEVICE_WASHCOMBO_MAIN)' }))).toMatchObject({
      kind: 'washer_dryer',
    });
    expect(kindOf(signals({ model: 'WM6998 (DEVICE_WASHCOMBO_MINI)' }))).toMatchObject({
      kind: 'washer',
    });
  });

  it('reads Home Connect’s programmes: a dishwasher’s, a washer-dryer’s, a microwave’s all microwave, an oven with a microwave an oven', () => {
    const programs = (...list: string[]) =>
      kindOf(signals({ platform: 'home_connect', programs: list }));
    expect(programs('laundry_care_washer_dryer_program_mix')).toMatchObject({
      kind: 'washer_dryer',
    });
    expect(programs('laundry_care_dryer_program_cotton')).toMatchObject({ kind: 'dryer' });
    expect(programs('cooking_oven_program_microwave_600_watt')).toMatchObject({
      kind: 'microwave',
    });
    expect(
      programs(
        'cooking_oven_program_microwave_600_watt',
        'cooking_oven_program_heating_mode_hot_air',
      ),
    ).toMatchObject({ kind: 'oven' });
    expect(programs('consumer_products_cleaning_robot_program_cleaning_clean_all')).toEqual({
      excluded: 'vacuum',
    });
  });

  it('tells Matter’s compartments and cavities by their ranges', () => {
    expect(kindOf(signals({ platform: 'matter', tops: [7, -15] }))).toMatchObject({
      kind: 'fridge',
    });
    expect(kindOf(signals({ platform: 'matter', tops: [-15] }))).toMatchObject({ kind: 'freezer' });
    expect(kindOf(signals({ platform: 'matter', tops: [250] }))).toMatchObject({ kind: 'oven' });
  });

  it('reads a name in any language Fluvy speaks, accents or none, the more particular kind first', () => {
    const names: ReadonlyArray<readonly [string, string]> = [
      ['Washing machine', 'washer'],
      ['Waschmaschine', 'washer'],
      ['Lave-linge', 'washer'],
      ['lave_linge', 'washer'],
      ['Lavadora', 'washer'],
      ['Wasmachine', 'washer'],
      ['Lavatrice', 'washer'],
      ['Máquina de lavar', 'washer'],
      ['Çamaşır makinesi', 'washer'],
      ['Waschtrockner', 'washer_dryer'],
      ['Lavasecadora', 'washer_dryer'],
      ['Kurutmalı çamaşır makinesi', 'washer_dryer'],
      ['Dishwasher', 'dishwasher'],
      ['Geschirrspüler', 'dishwasher'],
      ['Lave-vaisselle', 'dishwasher'],
      ['Lavavajillas', 'dishwasher'],
      ['Vaatwasser', 'dishwasher'],
      ['Lava-louças', 'dishwasher'],
      ['Máquina de lavar loiça', 'dishwasher'],
      ['Máquina de lavar louça', 'dishwasher'],
      ['Bulaşık makinesi', 'dishwasher'],
      ['Wäschetrockner', 'dryer'],
      ['Sèche-linge', 'dryer'],
      ['Asciugatrice', 'dryer'],
      ['Kurutma makinesi', 'dryer'],
      ['Microwave oven', 'microwave'],
      ['Forno a microonde', 'microwave'],
      ['Magnetron', 'microwave'],
      ['Backofen', 'oven'],
      ['Horno', 'oven'],
      ['Four', 'oven'],
      ['Fırın', 'oven'],
      ['Kochfeld', 'hob'],
      ['Placa de inducción', 'hob'],
      ['Piano cottura', 'hob'],
      ['Dunstabzugshaube', 'hood'],
      ['Hotte', 'hood'],
      ['Weinkühlschrank', 'wine'],
      ['Wine fridge', 'wine'],
      ['Adega', 'wine'],
      ['Garrafeira', 'wine'],
      ['Kühlschrank', 'fridge'],
      ['Fridge freezer', 'fridge'],
      ['Frigorífico', 'fridge'],
      ['Koelkast', 'fridge'],
      ['Geladeira', 'fridge'],
      ['Buzdolabı', 'fridge'],
      ['Gefrierschrank', 'freezer'],
      ['Congélateur', 'freezer'],
      ['Vriezer', 'freezer'],
      ['Kaffeevollautomat', 'coffee'],
      ['Cafetera', 'coffee'],
      ['Koffiezetapparaat', 'coffee'],
      ['Wasserkocher', 'kettle'],
      ['Bouilloire', 'kettle'],
      ['Waterkoker', 'kettle'],
      ['Air fryer', 'air_fryer'],
      ['Heißluftfritteuse', 'air_fryer'],
      ['Friggitrice ad aria', 'air_fryer'],
      // Japanese, in kanji and kana as a name is written, or in the romaji an entity id carries
      ['洗濯機', 'washer'],
      ['sentakuki', 'washer'],
      ['ドラム式洗濯乾燥機', 'washer_dryer'],
      ['食洗機', 'dishwasher'],
      ['食器洗い乾燥機', 'dishwasher'],
      ['shokusenki', 'dishwasher'],
      ['乾燥機', 'dryer'],
      ['電子レンジ', 'microwave'],
      ['オーブンレンジ', 'microwave'],
      ['オーブン', 'oven'],
      ['ＩＨクッキングヒーター', 'hob'],
      ['ガスコンロ', 'hob'],
      ['ガスレンジ', 'hob'],
      ['レンジフード', 'hood'],
      ['冷蔵庫', 'fridge'],
      ['reizouko', 'fridge'],
      ['冷凍庫', 'freezer'],
      ['コーヒーメーカー', 'coffee'],
      ['電気ケトル', 'kettle'],
      ['ノンフライヤー', 'air_fryer'],
      ['オーブントースター', 'toaster'],
      ['ホットサンドメーカー', 'sandwich_maker'],
      ['ミキサー', 'blender'],
      ['ワインセラー', 'wine'],
      // Polish, its ł read as l: a Polish name keeps it, an entity id writes l
      ['Pralka', 'washer'],
      ['Pralko-suszarka', 'washer_dryer'],
      ['Zmywarka', 'dishwasher'],
      ['Suszarka', 'dryer'],
      ['Kuchenka mikrofalowa', 'microwave'],
      ['Piekarnik', 'oven'],
      ['Płyta indukcyjna', 'hob'],
      ['plyta_indukcyjna', 'hob'],
      ['Okap', 'hood'],
      ['Chłodziarka do win', 'wine'],
      ['Lodówka', 'fridge'],
      ['Chłodziarka', 'fridge'],
      ['Zamrażarka', 'freezer'],
      ['Ekspres do kawy', 'coffee'],
      ['Czajnik', 'kettle'],
      ['Frytkownica beztłuszczowa', 'air_fryer'],
      ['Toster', 'toaster'],
      ['Toster do kanapek', 'sandwich_maker'],
      ['Kuweta', 'litter_box'],
      // Slovak, with its accents or as an entity id carries it
      ['Práčka', 'washer'],
      ['Práčka so sušičkou', 'washer_dryer'],
      ['Umývačka riadu', 'dishwasher'],
      ['Sušička', 'dryer'],
      ['Mikrovlnná rúra', 'microwave'],
      ['Rúra', 'oven'],
      ['Indukčná doska', 'hob'],
      ['Digestor', 'hood'],
      ['Vinotéka', 'wine'],
      ['Chladnička', 'fridge'],
      ['chladnicka_kuchyna', 'fridge'],
      ['Mraznička', 'freezer'],
      ['Kávovar', 'coffee'],
      ['Rýchlovarná kanvica', 'kettle'],
      ['Teplovzdušná fritéza', 'air_fryer'],
      ['Dávkovač krmiva', 'feeder'],
      ['Fontána pre zvieratá', 'fountain'],
      ['Mačacia toaleta', 'litter_box'],
      // Czech, with its accents or as an entity id carries it
      ['Pračka', 'washer'],
      ['Pračka se sušičkou', 'washer_dryer'],
      ['Myčka nádobí', 'dishwasher'],
      ['Sušička', 'dryer'],
      ['Mikrovlnná trouba', 'microwave'],
      ['Trouba', 'oven'],
      ['Indukční deska', 'hob'],
      ['Digestoř', 'hood'],
      ['Vinotéka', 'wine'],
      ['Lednice', 'fridge'],
      ['lednice_kuchyne', 'fridge'],
      ['Mraznička', 'freezer'],
      ['Kávovar', 'coffee'],
      ['Rychlovarná konvice', 'kettle'],
      ['Horkovzdušná fritéza', 'air_fryer'],
      ['Topinkovač', 'toaster'],
      ['Sendvičovač', 'sandwich_maker'],
      ['Dávkovač krmiva', 'feeder'],
      ['Kočičí toaleta', 'litter_box'],
      // …and in the cases a name says it in: the washer's, the oven's, the fridge's temperature, a chest freezer
      ['Teplota pračky', 'washer'],
      ['zasuvka_trouby', 'oven'],
      ['Teplota v lednici', 'fridge'],
      ['Lednice na víno', 'wine'],
      ['Mraznice', 'freezer'],
      ['Sporák', 'hob'],
      ['Indukční plotna', 'hob'],
      ['Plotýnka', 'hob'],
      ['Blender', 'blender'],
      ['Toaleta pro kočky', 'litter_box'],
      ['Kuveta', 'litter_box'],
      // Danish, in its compounds, its ø, æ and å written or as an entity id carries them
      ['Vaskemaskine', 'washer'],
      ['Vaskemaskinen i bryggerset', 'washer'],
      ['Vasketørretumbler', 'washer_dryer'],
      ['Vaske-tørremaskine', 'washer_dryer'],
      ['Opvaskemaskine', 'dishwasher'],
      ['opvaskemaskine_kokken', 'dishwasher'],
      ['Opvasker', 'dishwasher'],
      ['Tørretumbler', 'dryer'],
      ['torretumbler', 'dryer'],
      ['Kondenstørretumbler', 'dryer'],
      ['Mikrobølgeovn', 'microwave'],
      ['mikrobolgeovn', 'microwave'],
      ['Ovn', 'oven'],
      ['Dampovn', 'oven'],
      ['Stegeovn', 'oven'],
      ['Bageovn', 'oven'],
      ['Komfurovn', 'oven'],
      ['Ovnen i køkkenet', 'oven'],
      ['Steam oven', 'oven'],
      ['Kogeplade', 'hob'],
      ['Induktionskogeplade', 'hob'],
      ['Komfur', 'hob'],
      ['Emhætte', 'hood'],
      ['emhaette', 'hood'],
      ['Vinkøleskab', 'wine'],
      ['Køleskab', 'fridge'],
      ['koleskab_kokken', 'fridge'],
      ['Køle-fryseskab', 'fridge'],
      ['Kølefryseskab', 'fridge'],
      ['Fryser', 'freezer'],
      ['Kummefryser', 'freezer'],
      ['Fryseskab i kælderen', 'freezer'],
      ['Kaffemaskine', 'coffee'],
      ['Elkedel', 'kettle'],
      ['Airfryer', 'air_fryer'],
      ['Varmluftsfritureskab', 'air_fryer'],
      ['Toastjern', 'sandwich_maker'],
      ['Brødrister', 'toaster'],
      ['Foodprocessor', 'blender'],
      ['Foderautomat', 'feeder'],
      ['Drikkefontæne til katten', 'fountain'],
      ['Kattebakke', 'litter_box'],
      // Swedish, its compounds whole, with å, ä and ö or as an entity id carries them
      ['Tvättmaskin', 'washer'],
      ['tvattmaskin_kallare', 'washer'],
      ['Tvätt- och torkmaskin', 'washer_dryer'],
      ['Tvätt/tork', 'washer_dryer'],
      ['Diskmaskin', 'dishwasher'],
      ['Torktumlare', 'dryer'],
      ['Torkskåp', 'dryer'],
      ['Mikrovågsugn', 'microwave'],
      ['Ugn', 'oven'],
      ['Ångugn', 'oven'],
      ['Induktionshäll', 'hob'],
      ['Spishäll', 'hob'],
      ['Köksfläkt', 'hood'],
      ['Vinkylskåp', 'wine'],
      ['Kylskåp', 'fridge'],
      ['Kyl/frys', 'fridge'],
      ['Kyl', 'fridge'],
      ['Frysbox', 'freezer'],
      ['Kaffemaskin', 'coffee'],
      ['Moccamaster', 'coffee'],
      ['Vattenkokare', 'kettle'],
      ['Varmluftsfritös', 'air_fryer'],
      ['Smörgåsgrill', 'sandwich_maker'],
      ['Brödrost', 'toaster'],
      ['Matberedare', 'blender'],
      ['Foderautomat', 'feeder'],
      ['Dricksfontän', 'fountain'],
      ['Kattlåda', 'litter_box'],
      ['kattoalett', 'litter_box'],
      // Simplified Chinese, its Han anywhere in the name
      ['洗衣机', 'washer'],
      ['洗烘一体机', 'washer_dryer'],
      ['厨房洗碗机', 'dishwasher'],
      ['干衣机', 'dryer'],
      ['微波炉', 'microwave'],
      ['蒸烤一体机', 'oven'],
      ['集成灶', 'hob'],
      ['抽油烟机', 'hood'],
      ['酒柜', 'wine'],
      ['冰箱', 'fridge'],
      ['冰柜', 'freezer'],
      ['咖啡机', 'coffee'],
      ['电水壶', 'kettle'],
      ['空气炸锅', 'air_fryer'],
      ['早餐机', 'sandwich_maker'],
      ['多士炉', 'toaster'],
      ['破壁机', 'blender'],
      ['自动喂食器', 'feeder'],
      ['宠物饮水机', 'fountain'],
      ['猫砂盆', 'litter_box'],
      // Traditional Chinese in Taiwan's words
      ['洗衣機', 'washer'],
      ['滾筒洗脫烘洗衣機', 'washer_dryer'],
      ['廚房洗碗機', 'dishwasher'],
      ['乾衣機', 'dryer'],
      ['微波爐', 'microwave'],
      ['微波烤箱', 'microwave'],
      ['蒸烤箱', 'oven'],
      ['電磁爐', 'hob'],
      ['IH爐', 'hob'],
      ['排油煙機', 'hood'],
      ['紅酒櫃', 'wine'],
      ['冰箱', 'fridge'],
      ['冷凍櫃', 'freezer'],
      ['咖啡機', 'coffee'],
      ['快煮壺', 'kettle'],
      ['氣炸鍋', 'air_fryer'],
      ['氣炸烤箱', 'air_fryer'],
      ['熱壓吐司機', 'sandwich_maker'],
      ['烤麵包機', 'toaster'],
      ['果汁機', 'blender'],
      ['自動餵食器', 'feeder'],
      ['寵物飲水機', 'fountain'],
      ['自動貓砂機', 'litter_box'],
      // Russian, in any case a name says it in, ё or е
      ['Стиральная машина', 'washer'],
      ['Стиралка', 'washer'],
      ['Стирально-сушильная машина', 'washer_dryer'],
      ['Посудомоечная машина', 'dishwasher'],
      ['Посудомойка на кухне', 'dishwasher'],
      ['Сушильная машина', 'dryer'],
      ['Микроволновая печь', 'microwave'],
      ['СВЧ', 'microwave'],
      ['Духовой шкаф', 'oven'],
      ['Духовка', 'oven'],
      ['Варочная панель', 'hob'],
      ['Индукционная плита', 'hob'],
      ['Вытяжка', 'hood'],
      ['Винный шкаф', 'wine'],
      ['Холодильник для вина', 'wine'],
      ['Холодильник', 'fridge'],
      ['Холодильник с морозильной камерой', 'fridge'],
      ['Морозильный ларь', 'freezer'],
      ['Кофемашина', 'coffee'],
      ['Электрочайник', 'kettle'],
      ['Аэрогриль', 'air_fryer'],
      ['Сэндвичница', 'sandwich_maker'],
      ['Тостер', 'toaster'],
      ['Блендер', 'blender'],
      ['Автокормушка', 'feeder'],
      ['Поилка для кошки', 'fountain'],
      ['Кошачий туалет', 'litter_box'],
      // Ukrainian, in any case a name says it in, ї or і
      ['Пральна машина', 'washer'],
      ['Пралка', 'washer'],
      ['Прально-сушильна машина', 'washer_dryer'],
      ['Посудомийна машина', 'dishwasher'],
      ['Посудомийка на кухні', 'dishwasher'],
      ['Сушильна машина', 'dryer'],
      ['Мікрохвильова піч', 'microwave'],
      ['НВЧ-піч', 'microwave'],
      ['Духова шафа', 'oven'],
      ['Духовка', 'oven'],
      ['Варильна поверхня', 'hob'],
      ['Індукційна плита', 'hob'],
      ['Витяжка', 'hood'],
      ['Винна шафа', 'wine'],
      ['Холодильник для вина', 'wine'],
      ['Холодильник з морозильною камерою', 'fridge'],
      ['Морозильна камера', 'freezer'],
      ['Кавомашина', 'coffee'],
      ['Кавоварка', 'coffee'],
      ['Електрочайник', 'kettle'],
      ['Аерогриль', 'air_fryer'],
      ['Сендвічниця', 'sandwich_maker'],
      ['Тостер', 'toaster'],
      ['Блендер', 'blender'],
      ['Автогодівниця', 'feeder'],
      ['Поїлка для кішки', 'fountain'],
      ['Котячий туалет', 'litter_box'],
      // Bulgarian, as written and as Home Assistant writes it into an entity id (ъ and ь gone, щ shch, х kh, ц ts)
      ['Пералня', 'washer'],
      ['peralnia_mokro_pomeshchenie', 'washer'],
      ['Пералня със сушилня', 'washer_dryer'],
      ['peralnia_ss_sushilnia', 'washer_dryer'],
      ['Съдомиялна', 'dishwasher'],
      ['sdomiialna', 'dishwasher'],
      ['Миялна машина', 'dishwasher'],
      ['Сушилня', 'dryer'],
      ['sushilnia', 'dryer'],
      ['Микровълнова фурна', 'microwave'],
      ['mikrovlnova_furna', 'microwave'],
      ['Фурната', 'oven'],
      ['furna_kukhnia', 'oven'],
      ['Готварска печка', 'oven'],
      ['Индукционен плот', 'hob'],
      ['induktsionen_plot', 'hob'],
      ['Котлони', 'hob'],
      ['Абсорбатор', 'hood'],
      ['absorbator', 'hood'],
      ['Хладилник за вино', 'wine'],
      ['khladilnik_za_vino', 'wine'],
      ['Хладилник с фризер', 'fridge'],
      ['khladilnik_kukhnia', 'fridge'],
      ['Фризер мазе', 'freezer'],
      ['frizer_maze', 'freezer'],
      ['Кафемашина', 'coffee'],
      ['kafemashina', 'coffee'],
      ['Електрическа кана', 'kettle'],
      ['elektricheska_kana', 'kettle'],
      ['Каната', 'kettle'],
      ['Еър фрайър', 'air_fryer'],
      ['er_frair', 'air_fryer'],
      ['Сандвич тостер', 'sandwich_maker'],
      ['sandvich_toster', 'sandwich_maker'],
      ['Тостер', 'toaster'],
      ['Пасатор', 'blender'],
      ['Хранилка за котки', 'feeder'],
      ['khranilka_za_kotki', 'feeder'],
      ['Поилка', 'fountain'],
      ['Котешка тоалетна', 'litter_box'],
      ['koteshka_toaletna', 'litter_box'],
    ];
    for (const [name, kind] of names) expect(byWords(name), name).toEqual({ kind, by: 'words' });
    // a name that says no kind says none: a solar panel is no hob ("placa"), a brand ("marca") no freezer ("arca")
    expect(byWords('Steckdose Flur')).toBeUndefined();
    expect(byWords('Placa solar')).toBeUndefined();
    expect(byWords('Placas solares')).toBeUndefined();
    expect(byWords('Marca X tomada')).toBeUndefined();
    // a word of another: a hood is not a "neighbourhood", a hob not a "hobby"
    expect(byWords('Neighbourhood lamp')).toBeUndefined();
    expect(byWords('Hobby room plug')).toBeUndefined();
    // Slovak's cooling ("chladenie") is no fridge ("chladnička")
    expect(byWords('Chladenie obývačka')).toBeUndefined();
    // the laundry room and the detergent are no washer; a home's water dispenser no pet fountain
    expect(byWords('洗衣房插座')).toBeUndefined();
    expect(byWords('洗衣液')).toBeUndefined();
    expect(byWords('饮水机')).toBeUndefined();
    // Bulgarian's channel ("канал") is no kettle ("кана"), a worktop's light no hob ("плот")
    expect(byWords('Канал 2')).toBeUndefined();
    expect(byWords('Осветление плот')).toBeUndefined();
    // a printer's paper tray (лоток) is no litter box, a sauna's stove (печь) no oven, a laundry room no washer
    expect(byWords('Лоток принтера')).toBeUndefined();
    expect(byWords('Печь в бане')).toBeUndefined();
    expect(byWords('Розетка в прачечной')).toBeUndefined();
    // nor a printer's tray (лоток), a sauna's stove (піч), a laundry room (пральня) in Ukrainian
    expect(byWords('Лоток принтера')).toBeUndefined();
    expect(byWords('Піч у лазні')).toBeUndefined();
    expect(byWords('Розетка в пральні')).toBeUndefined();
    expect(byWords('Пральня')).toBeUndefined();
    // a Danish wood stove and a panel heater are no ovens, a heat lamp no appliance
    expect(byWords('Brændeovn')).toEqual({ excluded: 'name' });
    expect(byWords('Panelovn soveværelse')).toEqual({ excluded: 'name' });
    expect(byWords('Stikkontakt gang')).toBeUndefined();
    // nor, in Swedish, a laundry room (tvättstuga), a hallway (hall: a hob is "häll"), a sauna's stove (bastuugn),
    // the cooling of a room (kylning) or a calm mode (lugnt)
    for (const name of ['Tvättstuga uttag', 'Hall', 'Bastuugn', 'Kylning vardagsrum', 'Lugnt läge'])
      expect(byWords(name), name).toBeUndefined();
    // nor a Czech or Slovak word with Danish's "ovn" or English's "oven" inside it: a workroom's or a house's socket,
    // a working day, horizontal blinds, a comparison, a level
    for (const name of [
      'Pracovní zásuvka',
      'Domovní zásuvka',
      'Pracovna',
      'Pracovní den',
      'Vodorovné žaluzie',
      'Srovnání',
      'Úroveň',
      'Pracovné dni',
      'Porovnať',
    ])
      expect(byWords(name), name).toBeUndefined();
    // nor Czech's last days ("posledních" holds "lednic"), its temperature probe ("teplotní" holds "plotn") or Swedish
    // vacuuming ("dammsugning" holds "ugn")
    for (const name of ['Posledních 24 hodin', 'Teplotní sonda', 'Dammsugning'])
      expect(byWords(name), name).toBeUndefined();
    // a Danish child lock is no French charging post ("borne"), a coffee maker no Swedish jetty
    expect(byWords('Børnesikring')).toBeUndefined();
    expect(byWords('Kaffebryggare')).toEqual({ kind: 'coffee', by: 'words' });
  });

  it('never takes a vacuum, a charger, a hair dryer or what waits for 1.10 for an appliance', () => {
    for (const name of [
      'Saugroboter',
      'Robot vacuum',
      'Staubsauger',
      'Aspirateur',
      'Wallbox',
      'Haartrockner',
      'Hair dryer',
      'Suszarka do włosów',
      'Odkurzacz',
      'Wärmeschublade',
      'Styler',
      'ロボット掃除機',
      'ドライヤー',
      '布団乾燥機',
      '扫地机器人',
      '吹风机',
      'Робот-пылесос',
      'Фен',
      'Сушилка для обуви',
      'Зарядная станция',
      'Робот-пилосос',
      'Сушарка для рук',
      'Зарядна станція',
      'Robotický vysavač',
      'Robotická sekačka',
      'Nabíječka elektromobilu',
      'RoboVac',
      'Robot mower',
      'Pool robot',
      'Robotický vysávač',
      'Robotická kosačka',
      'Robot sprzątający',
      'Robot koszący',
      'Прахосмукачка робот',
      'prakhosmukachka',
      'Сешоар',
      'Сушилник за дрехи',
      'Косачка',
      'Зарядна станция за електромобил',
      'zariadna_stantsiia',
      'Robotstøvsuger',
      'Robotplæneklipper',
      'Hårtørrer',
      'Ladeboks',
      'Billader',
      'Robotdammsugare',
      'Robotgräsklippare',
      'Hårtork',
      'Laddbox',
      'Elbilsladdare',
      '掃地機器人',
      '吸塵器',
      '吹風機',
      '烘碗機',
      '電動車充電座',
    ])
      expect(byWords(name), name).toEqual({ excluded: 'name' });
    // a robot that cleans or mows is never one; the kitchen's (a food processor) is a blender, in every language
    for (const name of ['Kuchyňský robot', 'Kuchynský robot', 'Robot kuchenny', 'Robot planetarny'])
      expect(byWords(name), name).toEqual({ kind: 'blender', by: 'words' });
    expect(kindOf(signals({ domains: new Set(['vacuum']), name: 'Waschmaschine' }))).toEqual({
      excluded: 'vacuum',
    });
    expect(
      kindOf(signals({ keys: new Set(['lost', 'lifted']), platform: 'home_connect' })),
    ).toEqual({
      excluded: 'vacuum',
    });
    expect(
      kindOf(
        signals({ keys: new Set(['stick_cleaner_operating_state']), platform: 'smartthings' }),
      ),
    ).toEqual({ excluded: 'vacuum' });
    expect(kindOf(signals({ keys: new Set(['evse_plug']), platform: 'matter' }))).toEqual({
      excluded: 'charger',
    });
    expect(kindOf(signals({ printer: true, name: 'Waschmaschine' }))).toEqual({
      excluded: 'printer',
    });
  });

  it('gives every kind its defaults: a glyph, a tone, a hero, what it shows', () => {
    for (const kind of APPLIANCE_KINDS) expect(KIND_DEFAULTS[kind], kind).toBeDefined();
    expect(KIND_DEFAULTS.washer.steps).toEqual(['wash', 'rinse', 'spin']);
    expect(KIND_DEFAULTS.fridge).toMatchObject({ hero: 'cold', doorAlert: 60, unload: false });
    // a big appliance's whole card (the reporter's design, #47); what lives on a plug, a row
    expect(KIND_DEFAULTS.coffee.variant).toBe('full');
    for (const kind of ['toaster', 'blender', 'sandwich_maker', 'kettle', 'microwave'] as const)
      expect(KIND_DEFAULTS[kind].variant, kind).toBe('row');
  });

  it('knows a toaster, a blender and a sandwich maker by their names, in every language, the sandwich maker first', () => {
    const said = (name: string) => byWords(name);
    expect(said('Toaster Küche')).toEqual({ kind: 'toaster', by: 'words' });
    expect(said('Grille-pain')).toEqual({ kind: 'toaster', by: 'words' });
    expect(said('Sandwichtoaster')).toEqual({ kind: 'sandwich_maker', by: 'words' });
    expect(said('Tosti-ijzer')).toEqual({ kind: 'sandwich_maker', by: 'words' });
    expect(said('Standmixer')).toEqual({ kind: 'blender', by: 'words' });
    expect(said('Liquidificador')).toEqual({ kind: 'blender', by: 'words' });
    expect(said('Ekmek kızartma makinesi')).toEqual({ kind: 'toaster', by: 'words' });
  });

  it('reads the longest of a name’s words that overlap, whatever the kinds’ order, in kana and in Latin letters', () => {
    const said = (name: string) => byWords(name);
    // an oven toaster is a toaster (listed after the oven), a gas range a hob (after the microwave), a range hood a hood
    expect(said('オーブントースター')).toEqual({ kind: 'toaster', by: 'words' });
    expect(said('ガスレンジ')).toEqual({ kind: 'hob', by: 'words' });
    expect(said('レンジフード')).toEqual({ kind: 'hood', by: 'words' });
    expect(said('電子レンジ')).toEqual({ kind: 'microwave', by: 'words' });
    expect(said('電気ポット')).toEqual({ kind: 'kettle', by: 'words' });
    // a longer never-word beats the kind inside it
    for (const name of [
      '布団乾燥機',
      'ヘアドライヤー',
      'Hair dryer',
      'Haartrockner',
      'Kimchi refrigerator',
    ])
      expect(said(name), name).toEqual({ excluded: 'name' });
    // and a never-word wins outright, even where a longer kind's word overlaps it: a laundry-folding machine's 洗濯物
    // (the laundry) inside the washer's 全自動洗濯
    expect(said('全自動洗濯物たたみ機')).toEqual({ excluded: 'name' });
    expect(said('全自動洗濯機')).toEqual({ kind: 'washer', by: 'words' });
    // in Latin letters: the dishwasher's word holds the washer's, the washer-dryer's the dryer's
    expect(said('Dishwasher')).toEqual({ kind: 'dishwasher', by: 'words' });
    expect(said('Waschtrockner')).toEqual({ kind: 'washer_dryer', by: 'words' });
    expect(said('Lave-vaisselle')).toEqual({ kind: 'dishwasher', by: 'words' });
    // words that stand apart keep the kinds' order, the more particular first
    expect(said('Wine fridge')).toEqual({ kind: 'wine', by: 'words' });
    expect(said('Fridge freezer')).toEqual({ kind: 'fridge', by: 'words' });
  });
});

describe('the house’s appliances', () => {
  it('lists every device that is one, strictly, once, and nothing else', () => {
    const listed = FIXTURES.filter((fixture) => fixture.expected.listed).map(
      (fixture) => fixture.device.id,
    );
    expect([...applianceDevices(HOUSE)].sort()).toEqual([...listed].sort());
    for (const fixture of laterFixtures(NOW))
      expect(applianceDevices(houseOf([fixture], NOW)), fixture.title).toEqual(
        fixture.expected.listed ? [fixture.device.id] : [],
      );
  });

  it('never lists a printer, and the printer card never lists one of them: every fixture of each', () => {
    expect(applianceDevices(PRINTER_HOUSE)).toEqual([]);
    expect(printerDevices(HOUSE)).toEqual([]);
    // in one house, each finds its own
    const both = houseOf(FIXTURES, NOW, PRINTER_HOUSE);
    const printers = printerDevices(both);
    const appliances = applianceDevices(both);
    expect(printers.filter((id) => appliances.includes(id))).toEqual([]);
    expect([...appliances].sort()).toEqual([...applianceDevices(HOUSE)].sort());
    expect([...printers].sort()).toEqual([...printerDevices(PRINTER_HOUSE)].sort());
  });

  it('reads a model, a model id, a maker and a name an integration writes as numbers as they are written (#129)', () => {
    // the reporter's fuel station beside the house's appliances: its model a number, and no appliance
    const house = {
      ...HOUSE,
      entities: {
        ...HOUSE.entities,
        'sensor.station_gazole': {
          entity_id: 'sensor.station_gazole',
          device_id: 'station',
          platform: 'prix_carburant',
        },
      },
      devices: {
        ...HOUSE.devices,
        station: {
          id: 'station',
          name: 'Station Bapdis Sas',
          name_by_user: null,
          area_id: null,
          manufacturer: 'Leclerc',
          model: 76380002 as never,
        },
        thermo: {
          id: 'thermo',
          name: 4711 as never,
          name_by_user: null,
          area_id: null,
          manufacturer: 1234 as never,
          model: 3 as never,
          model_id: 7 as never,
        },
      },
    } as HomeAssistant;
    expect([...applianceDevices(house)].sort()).toEqual([...applianceDevices(HOUSE)].sort());
    expect(signalsOf(house, 'station')).toMatchObject({
      model: '76380002',
      manufacturer: 'Leclerc',
    });
    expect(signalsOf(house, 'thermo')).toMatchObject({
      name: '4711',
      model: '3',
      modelId: '7',
      manufacturer: '1234',
    });
  });

  it('reads the house again only when its registries change, not on every state', () => {
    const first = applianceDevices(HOUSE);
    const ticked = { ...HOUSE, states: { ...HOUSE.states } } as HomeAssistant;
    expect(applianceDevices(ticked)).toBe(first);
    const renamed = { ...HOUSE, entities: { ...HOUSE.entities } } as HomeAssistant;
    expect(applianceDevices(renamed)).not.toBe(first);
    expect(applianceDevices(renamed)).toEqual(first);
  });
});
