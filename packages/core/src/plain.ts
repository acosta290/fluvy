/**
 * The letters Unicode gives no decomposition, as the plain letters a name is read by: a Turkish ı is i, a Polish ł is
 * l, a German ß is ss. Taking a name's accents off leaves them as they are, so every plain reading folds them here.
 */
export const plainLetters = (text: string): string =>
  text.replace(/ı/g, 'i').replace(/[łŁ]/g, 'l').replace(/ß/g, 'ss');

/**
 * A name as Fluvy's words read it (an appliance's kind, a dashboard's naming words, a view's icon, and the words' build
 * in `tools/i18n`): lower case, in ordinary width, its accents taken off ("Kühlschrank" is "kuhlschrank", "Płyta" is
 * "plyta", "ＬＥＤ" is "led", half-width "ｶﾞﾚｰｼﾞ" is "ガレージ", "Счётчик" is "счетчик", as Russian writes ё as е as
 * often as not); a kana keeps its voicing mark (が is not か) and a Cyrillic й its breve (й is no и), each composed
 * again.
 */
export const plain = (text: string): string =>
  plainLetters(
    text
      .normalize('NFKC')
      .normalize('NFD')
      .replace(/(?![゙゚\u0306])\p{M}/gu, '')
      .replace(/(?<![иИ])\u0306/g, '')
      .normalize('NFC'),
  ).toLowerCase();
