import { describe, expect, it } from 'vitest';
import {
  appActivity,
  appId,
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
    for (const integration of ['androidtv_remote', 'androidtv']) {
      expect(saidName('com.amazon.amazonvideo.livingroom', integration)).toBe('Prime Video');
      expect(saidName('com.netflix.ninja', integration)).toBe('Netflix');
      expect(saidName('com.example.launcher', integration)).toBe('');
    }
    for (const integration of ['androidtv_remote', 'webostv', undefined]) {
      expect(saidName('Prime Video', integration)).toBe('Prime Video');
      expect(saidName('My Netflix', integration)).toBe('My Netflix');
      expect(saidName('HDMI 1', integration)).toBe('HDMI 1');
      expect(saidName('', integration)).toBe('');
    }
  });

  it('says a name shaped like a package as it is where the integration names no app by its package', () => {
    // a radio's source, a web address: Android's integrations alone write a package where they know no name
    for (const integration of ['music_assistant', 'sonos', undefined]) {
      expect(saidName('bbc.co.uk', integration)).toBe('bbc.co.uk');
      expect(saidName('radio.net', integration)).toBe('radio.net');
      expect(sourceChips(['bbc.co.uk', 'HDMI 1'], false, integration)).toEqual([
        ['bbc.co.uk', 'bbc.co.uk'],
        ['HDMI 1', 'HDMI 1'],
      ]);
    }
    // a package a platform answers to is that platform's wherever it stands
    expect(saidName('com.netflix.ninja', 'sonos')).toBe('Netflix');
    expect(saidName('bbc.co.uk', 'androidtv_remote')).toBe('');
  });

  it('the sources as chips: a package by its platform’s name, an unknown one left out, the platforms left to the apps row where it draws them', () => {
    const sources = ['HDMI 1', 'com.netflix.ninja', 'com.example.box', 'Disney+'];
    expect(sourceChips(sources, false, 'androidtv')).toEqual([
      ['HDMI 1', 'HDMI 1'],
      ['com.netflix.ninja', 'Netflix'],
      ['Disney+', 'Disney+'],
    ]);
    expect(sourceChips(sources, true, 'androidtv')).toEqual([['HDMI 1', 'HDMI 1']]);
  });

  it('an Xbox opens a platform by its store id, Prime Video by the house’s country’s (#255)', () => {
    const on = (id: string, country?: string) => appId({}, platform(id), 'xbox', country);
    expect(on('netflix')).toBe('9WZDNCRFJ3TJ');
    expect(on('appletv')).toBe('9MW0ZWQFH0M2');
    expect(on('disneyplus')).toBe('9NXQXXLFST89');
    expect(on('jellyfin')).toBe('9P2DRTG62QF8');
    expect(on('plutotv')).toBe('9P9LV240KQ9R');
    expect(on('primevideo', 'GB')).toBe('9NHRLPH6FFCT');
    expect(on('primevideo', 'ES')).toBe('9P750F5JP2K0');
    expect(on('primevideo')).toBe('9P750F5JP2K0');
    // a country is a key of the table's own, never of every object's
    expect(on('primevideo', 'constructor')).toBe('9P750F5JP2K0');
    // a platform the store has no Xbox app of has none
    expect(on('movistarplus')).toBeUndefined();
    // every id is one the service call takes as it is
    for (const pf of PLATFORMS)
      for (const id of typeof pf.xbox === 'object' ? Object.values(pf.xbox) : [pf.xbox])
        if (id) expect(id, pf.id).toMatch(/^[0-9A-Z]{12}$/);
  });

  it('a person’s own app id wins on any player, where it is one word an id can be', () => {
    expect(appId({ app_id: '12' }, platform('netflix'), 'roku', undefined)).toBe('12');
    expect(appId({ app_id: 'com.netflix.ninja' }, undefined, 'androidtv_remote', undefined)).toBe(
      'com.netflix.ninja',
    );
    expect(appId({ app_id: '9NBLGGH4VGD7' }, platform('primevideo'), 'xbox', 'ES')).toBe(
      '9NBLGGH4VGD7',
    );
    // a space, a quote, a slash or too long: no id; the platform's where there is one
    for (const bad of ['9WZ DNC', 'x"y', 'a/b', 'x'.repeat(65), 7])
      expect(appId({ app_id: bad }, platform('netflix'), 'xbox', undefined)).toBe('9WZDNCRFJ3TJ');
    // another player's ids the table does not hold
    expect(appId({}, platform('netflix'), 'roku', undefined)).toBeUndefined();
  });
});
