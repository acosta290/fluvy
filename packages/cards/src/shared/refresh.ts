/** How long a card's history read stays fresh (core caches `fetchHistory` as long: asking sooner is a map lookup). */
export const HISTORY_FRESH = 5 * 60_000;

/**
 * One read per key (an entity and its window) — asked again once the answer is `fresh` old — whose late answers are
 * dropped: an answer for a key no longer wanted never reaches the card. The card keeps what it shows.
 */
export class Refresher<T> {
  private key = '';
  private at = 0;

  constructor(private readonly fresh = HISTORY_FRESH) {}

  /**
   * Reads `key` with `load` unless it was read less than `fresh` ago, handing the answer to `onAnswer` while `key` is
   * still the one wanted. Returns the key read before when it asks (the card may show its skeleton for a new one),
   * `null` when it does not.
   */
  request(key: string, load: () => Promise<T>, onAnswer: (value: T) => void): string | null {
    const now = Date.now();
    if (key === this.key && now - this.at < this.fresh) return null;
    const previous = this.key;
    this.key = key;
    this.at = now;
    void load().then((value) => {
      if (this.key === key) onAnswer(value);
    });
    return previous;
  }
}
