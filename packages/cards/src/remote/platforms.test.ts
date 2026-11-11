import { describe, expect, it } from 'vitest';
import {
  appActivity,
  isPackage,
  MONOGRAMS,
  normalise,
  platform,
  PLATFORMS,
  platformOf,
  saidName,
  sourceChips,
} from './platforms.js';

describe('the platforms the remote knows by name (#143)', () => {
  it('matches a player’s source whatever its case and spacing', () => {
    expect(platformOf('Netflix')?.id).toBe('netflix');
    expect(platformOf('NETFLIX')?.id).toBe('netflix');
    expect(platformOf('net flix')?.id).toBe('netflix');
    expect(platformOf('Disney+')?.id).toBe('disneyplus');
    expect(platformOf('disney plus')?.id).toBe('disneyplus');
    expect(platformOf('Prime Video')?.id).toBe('primevideo');
    expect(platformOf('Amazon Prime Video')?.id).toBe('primevideo');
    expect(platformOf('YouTube Music')?.id).toBe('youtubemusic');
    expect(platformOf('Movistar Plus+')?.id).toBe('movistarplus');
    expect(platformOf('Rakuten TV')?.id).toBe('rakutentv');
  });

  it('matches an Android package and a platform’s id', () => {
    expect(platformOf('com.netflix.ninja')?.id).toBe('netflix');
    expect(platformOf('com.google.android.youtube.tv')?.id).toBe('youtube');
    expect(platformOf('hbomax')?.title).toBe('HBO Max');
    expect(platform('spotify')?.hex).toBe('#1ED760');
  });

  it('names no platform answers to are nobody’s: a tuner, an input, nothing', () => {
    expect(platformOf('TV')).toBeUndefined();
    expect(platformOf('HDMI 1')).toBeUndefined();
    expect(platformOf('')).toBeUndefined();
    expect(platformOf(undefined)).toBeUndefined();
  });

  it('every platform answers to its own id and title, each id once; the monograms are platforms without a mark’s colour', () => {
    const ids = PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLATFORMS) {
      expect(platformOf(p.id)?.id, p.id).toBe(p.id);
      expect(platformOf(p.title)?.id, p.title).toBe(p.id);
      expect(p.id).toBe(normalise(p.id));
    }
    for (const id of Object.keys(MONOGRAMS)) {
      expect(platform(id), id).toBeDefined();
      expect(platform(id)?.hex, id).toBe('');
    }
  });

  it('opens on Android TV by the deep links Home Assistant’s page gives, where the Play Store no longer opens a package', () => {
    const links = Object.fromEntries(PLATFORMS.filter((p) => p.link).map((p) => [p.id, p.link]));
    expect(links).toMatchObject({
      youtube: 'https://www.youtube.com',
      netflix: 'netflix://',
      primevideo: 'https://app.primevideo.com',
      disneyplus: 'https://www.disneyplus.com',
      plex: 'plex://',
      twitch: 'twitch://home',
    });
    for (const p of PLATFORMS) {
      // a link carries a scheme, as androidtvremote2 reads one (else it is sent as market://launch?id=…), and is one
      // word; a package carries none, and is matched to what the TV says is running
      if (p.link) expect(p.link, p.id).toMatch(/^[a-z][a-z0-9+.-]*:\/\/\S*$/);
      if (p.link)
        expect(p.android, `${p.id}: a link beside the package the TV reports`).toBeDefined();
      if (p.android) expect(p.android, p.id).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i);
    }
  });

  it('an app opens by the person’s own activity, else its platform’s link, else its package', () => {
    expect(appActivity({}, platform('netflix'))).toBe('netflix://');
    expect(appActivity({}, platform('kodi'))).toBe('org.xbmc.kodi');
    expect(appActivity({ activity: 'netflix://title/80057281' }, platform('netflix'))).toBe(
      'netflix://title/80057281',
    );
    expect(appActivity({ activity: 'com.example.app' }, undefined)).toBe('com.example.app');
    // a word with a space, or anything but a word, is no activity
    expect(appActivity({ activity: 'plex:// home' }, platform('plex'))).toBe('plex://');
    expect(appActivity({ activity: 42 }, platform('plex'))).toBe('plex://');
    expect(appActivity({ activity: '' }, undefined)).toBeUndefined();
    expect(appActivity({}, platform('filmin'))).toBeUndefined();
  });

  it('a package is an Android application id: dotted parts, each a letter then letters, figures or underscores, the first in lower case', () => {
    for (const id of [
      'com.amazon.amazonvideo.livingroom',
      'com.dazn',
      'tv.twitch.android.app',
      'org.xbmc.kodi',
      'dk.tv2.tv2playtv',
      'com.netflix.NGP.Pandora',
      'com.example.my_app',
    ])
      expect(isPackage(id), id).toBe(true);
    for (const name of [
      'Prime Video',
      'Netflix',
      'Apple TV+',
      'HDMI 1',
      'Plex.tv',
      'Dr. Who',
      'netflix://',
      'https://app.primevideo.com',
      'com',
      'com.',
      '.com.dazn',
      'com..dazn',
      'com.1dazn',
      'com.dazn-tv',
      ' com.dazn',
      '',
    ])
      expect(isPackage(name), name).toBe(false);
    for (const p of PLATFORMS) if (p.android) expect(isPackage(p.android), p.id).toBe(true);
  });

  it('says an app or a source, never a package: its platform’s title, or nothing; a name as it is', () => {
    expect(saidName('com.amazon.amazonvideo.livingroom')).toBe('Prime Video');
    expect(saidName('com.netflix.ninja')).toBe('Netflix');
    expect(saidName('com.example.launcher')).toBe('');
    expect(saidName('Prime Video')).toBe('Prime Video');
    expect(saidName('My Netflix')).toBe('My Netflix');
    expect(saidName('HDMI 1')).toBe('HDMI 1');
    expect(saidName('')).toBe('');
  });

  it('the sources as chips: a package by its platform’s name, an unknown one left out, the platforms left to the apps row where it draws them', () => {
    const sources = ['HDMI 1', 'com.netflix.ninja', 'com.example.box', 'Disney+'];
    expect(sourceChips(sources, false)).toEqual([
      ['HDMI 1', 'HDMI 1'],
      ['com.netflix.ninja', 'Netflix'],
      ['Disney+', 'Disney+'],
    ]);
    expect(sourceChips(sources, true)).toEqual([['HDMI 1', 'HDMI 1']]);
  });
});
