/*
 * What a name says, among classes of words that may hide inside each other. A class is a regex of its stems, as the
 * naming words are generated (`tools/i18n/src/build.ts`: the stem found is the first group that takes part in the
 * match, never the separator a word shape consumes; a hand-written regex without a group counts its whole match).
 * Every class is run on the name, never the first to hit alone. Of two words that overlap in the name the longer
 * wins, whatever the lists' order: 電気ケトル is a kettle, not the light 電気; ガスレンジ a hob, not the microwave レンジ;
 * "hair dryer" no dryer; 家庭 (the household) no garden 庭. Words that stand apart each hold, and the first class
 * listed wins ("wine fridge" is the wine cooler listed before the fridge; 庭のライト is outdoors to the place question
 * and a light to the kind question). A class is read by its first word in the name. A rule's regex is never global.
 */

/** A class and the regex of its words. */
export type Rules<T> = ReadonlyArray<readonly [T, RegExp]>;

/** The class a name says, or none where no class finds a word in it. */
export function says<T>(name: string, rules: Rules<T>): T | undefined {
  const found = rules.flatMap(([said, pattern]) => {
    const match = pattern.exec(name);
    const stem = match?.slice(1).find((group) => group !== undefined) ?? match?.[0];
    if (!match || !stem) return [];
    const at = match.index + match[0].indexOf(stem);
    return [{ said, at, to: at + stem.length }];
  });
  return found.find(
    (own) =>
      !found.some(
        (other) => other.to - other.at > own.to - own.at && other.at < own.to && own.at < other.to,
      ),
  )?.said;
}
