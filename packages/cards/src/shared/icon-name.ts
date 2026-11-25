/**
 * An icon as Home Assistant names them (`mdi:home`, `fluvy:sun`, a platform's `app:netflix`): a set and a name, each of
 * letters, figures, `_` and `-`. What a config's own icon is checked against before a card draws it (a dashboard
 * sidebar's views, a remote's keys): the shared chunk's, as the two are fetched later.
 */
export const isIcon = (value: unknown): value is `${string}:${string}` =>
  typeof value === 'string' && /^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(value);
