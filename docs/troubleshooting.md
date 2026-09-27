# Troubleshooting

## The integration is there but nothing looks different

Reload the browser twice: Home Assistant's service worker serves the previous page once. Then check your profile —
the theme has to be **Fluvy** for the pages to follow; the cards and the panel work with any theme.

## "Custom element doesn't exist: fluvy-…"

The dashboard rendered before the module arrived. Reload once. If it stays, look at **Settings → System → Repairs**:
if your dashboard resources are configured in YAML, the resource has to be added by hand (the issue shows it).

## The theme is not in the list

**Settings → System → Repairs** says why: `configuration.yaml` does not include the themes folder. Add

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

and run the action `frontend.reload_themes` (Developer tools → Actions). No restart is needed.

## The text is Roboto, not Inter

The fonts are loaded from the same folder as the build; a content blocker or a proxy that rewrites `/fluvy-frontend/`
stops them. The browser's network panel shows the request that failed.

## "Fluvy is already running; this copy stands down"

Two builds met in one page: usually a manual install from before the integration, still referenced by
`configuration.yaml` or by a resource under `/local/fluvy/`. **Settings → System → Repairs** lists the lines to
remove; the integration has already replaced them in memory.

## A Home Assistant page looks half Fluvy

A Home Assistant release changed that page. See [Everywhere](shell.md): type `__fluvy.shell.report()` in the console
and open an issue with the output.

## A page inside HACS looks plain

HACS runs in a frame of its own; the shell reaches it, but only once the frame has finished loading. Reload the page.

## Collecting a report

**Settings → Devices & services → Fluvy → ⋮ → Download diagnostics** gives the build served, its URLs, the dashboard
resource, the theme's state and any open issue — with nothing of your home in it. Add the browser's console lines that
mention `fluvy`, the Home Assistant version, the browser or app, and how Fluvy is installed.
