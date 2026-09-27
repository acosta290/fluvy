/*
 * Icon set for the review sheets.
 *
 * Hand-drawn 24-grid outlines, not an icon font: a font would be a network dependency and
 * a second rendering system to keep aligned with the token scale. Every glyph inherits
 * `currentColor`, so a filled tile tints its icon with no extra rules.
 *
 * A classic script assigning a global, for the same `file://` reason as the token payload.
 */
(() => {
  'use strict';

  const draw = (body, width) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width || 1.6}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  globalThis.LAB_GLYPHS = {
    lamp: draw(
      '<path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7v.5h5.6v-.5c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z"/>' +
        '<path d="M10 19.2h4"/><path d="M10.6 21.3h2.8"/>',
    ),
    off: draw('<circle cx="12" cy="12" r="8"/><path d="M6.7 6.7 17.3 17.3"/>'),
    plug: draw(
      '<path d="M9 3v4.5"/><path d="M15 3v4.5"/>' +
        '<path d="M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0Z"/><path d="M12 16.5V21"/>',
    ),
    blinds: draw(
      '<rect x="4" y="4" width="16" height="16" rx="2"/>' +
        '<path d="M4 9h16"/><path d="M4 13h16"/><path d="M4 17h16"/>',
    ),
    chevronUp: draw('<path d="m7 14 5-5 5 5"/>'),
    chevronDown: draw('<path d="m7 10 5 5 5-5"/>'),
    prev: draw('<path d="M18 5.5v13L9 12Z"/><path d="M6 5.5v13"/>'),
    pause: draw('<path d="M9.5 5.5v13"/><path d="M14.5 5.5v13"/>', 2),
    next: draw('<path d="M6 5.5v13L15 12Z"/><path d="M18 5.5v13"/>'),
    home: draw(
      '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.8V20h12V9.8"/><path d="M10 20v-5h4v5"/>',
    ),
    areas: draw(
      '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/>' +
        '<rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    ),
    bolt: draw('<path d="M13 3 5.5 13.5H11l-.5 7.5L18.5 10.5H13Z"/>'),
    sliders: draw(
      '<path d="M4 8h16"/><path d="M4 16h16"/><circle cx="9.5" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
    ),
    trendUp: draw('<path d="M4 16.5 9.5 11l3.5 3.5L20 7.5"/><path d="M15.5 7.5H20V12"/>'),
    trendDown: draw('<path d="M4 7.5 9.5 13l3.5-3.5L20 16.5"/><path d="M15.5 16.5H20V12"/>'),
    sun: draw(
      '<circle cx="12" cy="12" r="4"/><path d="M12 2.8V5"/><path d="M12 19v2.2"/>' +
        '<path d="m4.4 4.4 1.6 1.6"/><path d="m18 18 1.6 1.6"/><path d="M2.8 12H5"/>' +
        '<path d="M19 12h2.2"/><path d="M4.4 19.6 6 18"/><path d="m18 6 1.6-1.6"/>',
    ),
    wifi: draw(
      '<path d="M3.2 9.2a13.5 13.5 0 0 1 17.6 0"/><path d="M6.4 12.8a8.6 8.6 0 0 1 11.2 0"/>' +
        '<path d="M9.5 16.4a4 4 0 0 1 5 0"/><path d="M12 19.8h.01"/>',
    ),
    signal: draw(
      '<path d="M4 19v-3"/><path d="M9.3 19v-6.5"/><path d="M14.7 19V9"/><path d="M20 19V5.5"/>',
      2,
    ),
    battery: draw(
      '<rect x="2.5" y="8" width="16" height="8" rx="2.5"/><path d="M21 11v2"/>' +
        '<path d="M5.5 10.5h8v3h-8z" fill="currentColor" stroke="none"/>',
    ),
    flame: draw(
      '<path d="M12 3c3.2 3.6 5 6.2 5 8.8a5 5 0 0 1-10 0C7 9.2 8.8 6.6 12 3Z"/>' +
        '<path d="M12 12.5c1.1 1.2 1.7 2.1 1.7 3a1.7 1.7 0 0 1-3.4 0c0-.9.6-1.8 1.7-3Z"/>',
    ),
    snow: draw(
      '<path d="M12 3v18"/><path d="m4.2 7.5 15.6 9"/><path d="M19.8 7.5 4.2 16.5"/>' +
        '<path d="m9.5 5.2 2.5 2.4 2.5-2.4"/><path d="m9.5 18.8 2.5-2.4 2.5 2.4"/>',
    ),
    auto: draw('<path d="M5.5 18 11 6l5.5 12"/><path d="M7.6 13.8h6.8"/>'),
  };
})();
