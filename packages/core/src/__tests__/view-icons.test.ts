import { describe, expect, it } from 'vitest';
import { viewIcon, viewIconName } from '../look/view-icons.js';

describe('the icon a view’s name says', () => {
  it('reads the name in any of Fluvy’s languages, then the path', () => {
    const named = (title: string, path?: string) => viewIconName(title, path);
    expect(['Home', 'Luces', 'Clima', 'Energia', 'Baterias', 'Hab 1'].map((t) => named(t))).toEqual(
      ['home', 'bulb', 'thermo', 'bolt', 'battery', 'rooms'],
    );
    expect(named('Licht')).toBe('bulb');
    expect(named('Sécurité')).toBe('shield');
    expect(named('Camera da letto')).toBe('rooms');
    expect(named('Cameras')).toBe('camera');
    expect(named('Planta baja')).toBe('rooms');
    expect(named('Plantas')).toBe('leaf');
    expect(named('Automatizaciones')).toBe('automation');
    expect(named('Mutfak')).toBe('rooms');
    // what round 3 of the design review found
    expect(named('Accueil')).toBe('home');
    expect(named('Kameras')).toBe('camera');
    expect(named('Kameralar')).toBe('camera');
    expect(named('Panel principal')).toBe('home');
    expect(named('Işıklar')).toBe('bulb');
    expect(named('Oturma odası')).toBe('rooms');
    expect(named('Ana sayfa')).toBe('home');
    expect(
      ['Wohnzimmer', 'Badezimmer', 'Woonkamer', 'Slaapkamer', 'Séjour', 'Camere'].map((t) =>
        named(t),
      ),
    ).toEqual(['rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms']);
    expect(['Weather', 'Wetter', 'Météo', 'Weer', 'Hava durumu'].map((t) => named(t))).toEqual([
      'cloud',
      'cloud',
      'cloud',
      'cloud',
      'cloud',
    ]);
    // a bathroom is a room in every language; air and ventilation are not the weather
    expect(
      ['Baño', 'Bathroom', 'Badkamer', 'Badezimmer', 'Salle de bain', 'Bagno', 'Banyo'].map((t) =>
        named(t),
      ),
    ).toEqual(['rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms', 'rooms']);
    expect(['Badkamers', 'Slaapkamers'].map((t) => named(t))).toEqual(['rooms', 'rooms']);
    expect(named('Solaire')).toBe('sun');
    expect(named('Accus')).toBe('battery');
    expect(named('Havalandırma')).not.toBe('cloud');
    expect(named('Hava kalitesi')).not.toBe('cloud');
    // Japanese names, their words found anywhere (no spaces between words); the lights before the room, as in English
    expect(
      [
        '照明',
        'リビングの電気',
        '電気代',
        '空調',
        'エアコン',
        'バッテリー',
        '天気',
        '太陽光発電',
        'セキュリティ',
        '防犯カメラ',
        '寝室',
        '2階',
        '玄関の鍵',
        'メディア',
        'テレビ',
        '庭',
        'オートメーション',
        '車',
        'カレンダー',
        '家族',
        '人感センサー',
        '水道',
        '換気',
        'ブラインド',
        '掃除機',
        'ホーム',
        '家電',
        'ＬＥＤ照明',
      ].map((t) => named(t)),
    ).toEqual([
      'bulb',
      'bulb',
      'bolt',
      'thermo',
      'thermo',
      'battery',
      'cloud',
      'sun',
      'shield',
      'camera',
      'rooms',
      'rooms',
      'rooms',
      'speaker',
      'film',
      'leaf',
      'automation',
      'car',
      'calendar',
      'person',
      'chart',
      'drop',
      'fan',
      'blinds',
      'vacuum',
      'home',
      undefined,
      'bulb',
    ]);
    // Polish, its ł and its accents read plain
    const polish: ReadonlyArray<readonly [string, string]> = [
      ['Światła', 'bulb'],
      ['Ogrzewanie', 'thermo'],
      ['Pogoda', 'cloud'],
      ['Fotowoltaika', 'sun'],
      ['Bezpieczeństwo', 'shield'],
      ['Łazienka', 'rooms'],
      ['Sypialnia', 'rooms'],
      ['Kamery', 'camera'],
      ['Ogród', 'leaf'],
      ['Garaż', 'car'],
      ['Rolety', 'blinds'],
      ['Odkurzacz', 'vacuum'],
      ['Czujniki', 'chart'],
      ['Dom', 'home'],
      ['Strona główna', 'home'],
    ];
    expect(polish.map(([t]) => named(t))).toEqual(polish.map(([, icon]) => icon));
    // Simplified Chinese, its words found anywhere; a robot vacuum and a body sensor are no person, the household's
    // appliances no home
    const chinese: ReadonlyArray<readonly [string, string | undefined]> = [
      ['客厅灯光', 'bulb'],
      ['空调', 'thermo'],
      ['储能电池', 'battery'],
      ['天气', 'cloud'],
      ['光伏发电', 'sun'],
      ['能源', 'bolt'],
      ['安防', 'shield'],
      ['主卧', 'rooms'],
      ['二楼', 'rooms'],
      ['监控', 'camera'],
      ['门锁', 'lock'],
      ['音乐', 'speaker'],
      ['电视', 'film'],
      ['花园', 'leaf'],
      ['场景', 'automation'],
      ['车库', 'car'],
      ['日历', 'calendar'],
      ['家人', 'person'],
      ['人体传感器', 'chart'],
      ['浇水', 'drop'],
      ['新风', 'fan'],
      ['窗帘', 'blinds'],
      ['扫地机器人', 'vacuum'],
      ['首页', 'home'],
      ['家电', undefined],
    ];
    expect(chinese.map(([t]) => named(t))).toEqual(chinese.map(([, icon]) => icon));
    // Traditional Chinese in Taiwan's words; a robot vacuum (機器人) and a body sensor (人體) are no person here either
    const traditional: ReadonlyArray<readonly [string, string | undefined]> = [
      ['客廳燈光', 'bulb'],
      ['冷氣', 'thermo'],
      ['儲能電池', 'battery'],
      ['天氣', 'cloud'],
      ['太陽光電', 'sun'],
      ['用電', 'bolt'],
      ['保全', 'shield'],
      ['主臥', 'rooms'],
      ['二樓', 'rooms'],
      ['監視器', 'camera'],
      ['門鎖', 'lock'],
      ['音樂', 'speaker'],
      ['電視', 'film'],
      ['花園', 'leaf'],
      ['場景', 'automation'],
      ['車庫', 'car'],
      ['行事曆', 'calendar'],
      ['家人', 'person'],
      ['人體感應器', 'chart'],
      ['澆水', 'drop'],
      ['循環扇', 'fan'],
      ['窗簾', 'blinds'],
      ['掃地機器人', 'vacuum'],
      ['總覽', 'home'],
      ['家電', undefined],
    ];
    expect(traditional.map(([t]) => named(t))).toEqual(traditional.map(([, icon]) => icon));
    // Russian, a word by its start in any case (the kitchen's кухня and кухне), ё read as е and й as itself
    const russian: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Свет', 'bulb'],
      ['Освещение', 'bulb'],
      ['Тёплый пол', 'thermo'],
      ['Отопление', 'thermo'],
      ['Аккумулятор', 'battery'],
      ['Погода', 'cloud'],
      ['Солнечные панели', 'sun'],
      ['Энергия', 'bolt'],
      ['Охрана', 'shield'],
      ['Гостиная', 'rooms'],
      ['На кухне', 'rooms'],
      ['2 этаж', 'rooms'],
      ['Камеры', 'camera'],
      ['Замки', 'lock'],
      ['Музыка', 'speaker'],
      ['ТВ', 'film'],
      ['Сад', 'leaf'],
      ['Сценарии', 'automation'],
      ['Гараж', 'car'],
      ['Календарь', 'calendar'],
      ['Семья', 'person'],
      ['Полив', 'drop'],
      ['Вентиляция', 'fan'],
      ['Шторы', 'blinds'],
      ['Пылесос', 'vacuum'],
      ['Датчики', 'chart'],
      ['Главная', 'home'],
      ['Мой дом', 'home'],
      ['Садовник Иван', undefined],
    ];
    expect(russian.map(([t]) => named(t))).toEqual(russian.map(([, icon]) => icon));
    // Ukrainian, a word by its start, ї read as і, an apostrophe written any of its three ways or left out
    const ukrainian: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Світло', 'bulb'],
      ['Освітлення', 'bulb'],
      ['Тепла підлога', 'thermo'],
      ['Опалення', 'thermo'],
      ['Акумулятор', 'battery'],
      ['Погода', 'cloud'],
      ['Сонячні панелі', 'sun'],
      ['Енергія', 'bolt'],
      ['Електрика', 'bolt'],
      ['Безпека', 'shield'],
      ['Вітальня', 'rooms'],
      ['Їдальня', 'rooms'],
      ['2 поверх', 'rooms'],
      ['Камери', 'camera'],
      ['Двері', 'lock'],
      ['Музика', 'speaker'],
      ['Кіно', 'film'],
      ['Подвір’я', 'leaf'],
      ["Подвір'я", 'leaf'],
      ['Подвірʼя', 'leaf'],
      ['Подвіря', 'leaf'],
      ['Автоматизації', 'automation'],
      ['Гараж', 'car'],
      ['Розклад', 'calendar'],
      ['Сім’я', 'person'],
      ["Сім'я", 'person'],
      ['Сімʼя', 'person'],
      ['Сімя', 'person'],
      ['Полив', 'drop'],
      ['Рівень води', 'drop'],
      ['Вентиляція', 'fan'],
      ['Штори', 'blinds'],
      ['Пилосос', 'vacuum'],
      ['Датчики', 'chart'],
      ['Головна', 'home'],
      ['Мій дім', 'home'],
      ['Садівник Іван', undefined],
    ];
    expect(ukrainian.map(([t]) => named(t))).toEqual(ukrainian.map(([, icon]) => icon));
    // Bulgarian, a word by its start: the room with its article (банята), the count form, a short word whole
    const bulgarian: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Осветление', 'bulb'],
      ['Светлини', 'bulb'],
      ['Лунички', 'bulb'],
      ['Отопление', 'thermo'],
      ['Подово отопление', 'thermo'],
      ['Климатици', 'thermo'],
      ['Батерии', 'battery'],
      ['Времето', 'cloud'],
      ['Слънчеви панели', 'sun'],
      ['ФЕЦ', 'sun'],
      ['Енергия', 'bolt'],
      ['Консумация', 'bolt'],
      ['Дневна консумация', 'bolt'],
      ['Сигурност', 'shield'],
      ['Аларма', 'shield'],
      ['Всекидневна', 'rooms'],
      ['Дневна', 'rooms'],
      ['Спалня', 'rooms'],
      ['Банята', 'rooms'],
      ['Етаж 2', 'rooms'],
      ['Мазе', 'rooms'],
      ['Камери', 'camera'],
      ['Врати', 'lock'],
      ['Ключалки', 'lock'],
      ['Музика', 'speaker'],
      ['Медия', 'speaker'],
      ['Телевизор', 'film'],
      ['Градина', 'leaf'],
      ['Външно', 'leaf'],
      ['Автоматизации', 'automation'],
      ['Гараж', 'car'],
      ['Паркинг', 'car'],
      ['Разписание', 'calendar'],
      ['Хора', 'person'],
      ['Семейство', 'person'],
      ['Напояване', 'drop'],
      ['Вентилация', 'fan'],
      ['Щори', 'blinds'],
      ['Прозорци', 'blinds'],
      ['Прахосмукачка', 'vacuum'],
      ['Сензори', 'chart'],
      ['Начало', 'home'],
      ['Общ преглед', 'home'],
      // a current (ток) and a car (кола) are whole words: neither a toque nor a name
      ['Ток', 'bolt'],
      ['Токачка', undefined],
      ['Кола', 'car'],
      ['Коларов', undefined],
      ['Хоризонт', undefined],
    ];
    expect(bulgarian.map(([t]) => named(t))).toEqual(bulgarian.map(([, icon]) => icon));
    // Swedish, å, ä and ö read as a, a and o, a room and a floor by a compound's end (vardagsrum, övervåning)
    const swedish: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Belysning', 'bulb'],
      ['Ljus', 'bulb'],
      ['Golvvärme', 'thermo'],
      ['Väder', 'cloud'],
      ['Solceller', 'sun'],
      ['El', 'bolt'],
      ['Förbrukning', 'bolt'],
      ['Säkerhet', 'shield'],
      ['Larm', 'shield'],
      ['Vardagsrum', 'rooms'],
      ['Kök', 'rooms'],
      ['Hall', 'rooms'],
      ['Övervåning', 'rooms'],
      ['Källare', 'rooms'],
      ['Kameror', 'camera'],
      ['Dörrar', 'lock'],
      ['Hemmabio', 'film'],
      ['Trädgård', 'leaf'],
      ['Växter', 'leaf'],
      ['Scener', 'automation'],
      ['Bilar', 'car'],
      ['Schema', 'calendar'],
      ['Familjen', 'person'],
      ['Bevattning', 'drop'],
      ['Fläktar', 'fan'],
      ['Persienner', 'blinds'],
      ['Dammsugare', 'vacuum'],
      ['Mätvärden', 'chart'],
      ['Hem', 'home'],
      ['Översikt', 'home'],
      ['Hallon', undefined],
      ['Elin', undefined],
    ];
    expect(swedish.map(([t]) => named(t))).toEqual(swedish.map(([, icon]) => icon));
    // a stem under four letters is a whole word: the hall (хол, зал) and the home (дім, дом) never inside a longer one
    const short: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Хол', 'rooms'],
      ['Хол 2', 'rooms'],
      ['Хол_1', 'rooms'],
      ['Холодильник', undefined],
      ['Холостий хід', undefined],
      ['Зал', 'rooms'],
      ['Залізниця', undefined],
      ['Дім', 'home'],
      ['Дімка', undefined],
      ['Дом', 'home'],
      ['Доміно', undefined],
    ];
    expect(short.map(([t]) => named(t))).toEqual(short.map(([, icon]) => icon));
    // a name it does not know reads its path
    expect(named('Mi sitio', 'fotovoltaica')).toBe('sun');
    expect(named('Xyzzy', 'qwerty')).toBeUndefined();
  });

  it('gives the icon as a mask image of the fluvy set', () => {
    expect(viewIcon('Luces')).toMatch(
      /^url\("data:image\/svg\+xml;utf8,<svg .*<path d='M[^']+'\/><\/svg>"\)$/,
    );
    expect(viewIcon('Xyzzy')).toBeUndefined();
  });
});
