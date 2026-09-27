import { walkShadow } from './dom.js';

/**
 * `<ha-icon>` resolves a custom set's icon when it renders; if the set is not registered yet (the
 * sidebar and the view tabs render before a Lovelace resource runs) it marks the icon "legacy" and
 * draws a stub from then on. Setting the icon again, flag cleared, makes it look the icon up once more,
 * now that the set exists. Only icons of our set, only those that failed; run once after registration.
 * (The loader registers a waiting set before the app renders, so with it nothing ever fails.)
 */
export function refreshLegacyIcons(root: ParentNode, set = 'fluvy'): number {
  let refreshed = 0;
  walkShadow(root, (element) => {
    if (element.localName !== 'ha-icon') return;
    const icon = element as HTMLElement & { icon?: string; _legacy?: boolean };
    const name = icon.icon ?? element.getAttribute('icon') ?? '';
    if (!name.startsWith(`${set}:`) || !icon._legacy) return;
    icon._legacy = false;
    icon.icon = '';
    icon.icon = name;
    refreshed += 1;
  });
  return refreshed;
}
