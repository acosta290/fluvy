# Trying a build in Home Assistant

Two ways, both starting from a build (`pnpm build` writes it into `custom_components/fluvy/`).

## A throwaway instance (Docker)

```sh
mkdir -p tools/dev/ha-config
docker compose -f tools/dev/docker-compose.yml up -d        # first start: Home Assistant writes its configuration
```

Open http://127.0.0.1:8123, create the owner account, then make sure `tools/dev/ha-config/configuration.yaml`
includes the themes folder (most installations already do):

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

Install the build and restart:

```sh
pnpm build && pnpm ha:install --config tools/dev/ha-config
docker compose -f tools/dev/docker-compose.yml restart
```

Then Settings → Devices & services → Add integration → **Fluvy**, and reload the browser. To try a change to the
cards or the theme without restarting, `pnpm build && pnpm ha:install --config tools/dev/ha-config --frontend-only`
and reload with the browser's cache disabled (the running process keeps serving the folder under the URL of the build
it started with).

## Your own instance

Any configuration folder this machine can write to works the same way — a Samba share, an SSHFS mount, a bind
mount: `pnpm ha:install --config <that folder>`, then restart Home Assistant from its UI. Never copy anything from
your instance back into the repository: entity ids, names and tokens stay yours.

## What to check

- the **Fluvy** entry in the sidebar opens the settings panel without a restart after adding the integration;
- Settings → System → Repairs is empty (or says exactly what to add to `configuration.yaml`);
- your profile lists the **Fluvy** theme;
- the card picker lists the cards as "Fluvy · …";
- `/logbook` and `/history` show the Activity and History pages;
- the browser's console shows one `Fluvy v<version>` badge, never "already running".
