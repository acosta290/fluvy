```yaml
type: custom:fluvy-web-card
url: https://www.lightningmaps.org/?lang=en#m=oss;t=3;s=0;o=0;b=;ts=0;y=41.39;x=2.17;z=8;d=2;dl=2;dc=0
title: Lightning
aspect_ratio: 4:3 # or fill (the view's height), or height in px
scale: 0.75       # the page drawn smaller, so a map shows more
refresh: 5        # minutes, while on screen
```

- `variant`: `plate` (under a head), `frame` (alone on the card) or `bare` (no card).
- `look: dark` inverts a page with no dark look (pictures too); `auto` only in dark mode.
- A page that refuses to be framed loads blank; the open round is the way out.
- An http page never loads on an https dashboard.

| `sandbox` | The page may |
| --- | --- |
| `standard` (the default) | What Home Assistant's iframe card allows |
| `strict` | Run scripts and take input, without cookies, storage, pop-ups or downloads |
| `off` | Anything: only for a page of your own |

Home Assistant's `type: iframe` card pastes in: `hide_background` is read as `variant: bare`, `disable_sandbox` as
`sandbox: off`.
