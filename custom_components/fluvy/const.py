"""Constants of the Fluvy integration, and the record of the build it serves."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from homeassistant.util.hass_dict import HassKey

DOMAIN = "fluvy"

# Where the build is served from. Never a path under the settings panel's (`/fluvy`): aiohttp
# resolves the longest prefix, so a static route there would answer for the panel's page.
URL_BASE = "/fluvy-frontend"

PANEL_URL_PATH = "fluvy"
PANEL_ELEMENT = "fluvy-panel"
PANEL_TITLE = "Fluvy"
PANEL_ICON = "fluvy:palette"

THEME_NAME = "Fluvy"
THEME_DIR = "fluvy"
THEME_FILE = "fluvy.yaml"

# Where a manual install of the pre-integration era put the module.
LEGACY_LOCAL_PREFIX = "/local/fluvy/"

ISSUE_LEGACY_YAML = "legacy_yaml"
ISSUE_THEME_NOT_LOADED = "theme_not_loaded"
ISSUE_RESOURCES_YAML = "resources_yaml_mode"

DOCS_URL = "https://github.com/acosta290/fluvy/blob/main/docs/installation.md"


@dataclass(frozen=True, slots=True)
class FluvyRuntime:
    """The build this process serves: its version, its stamp and where its files are."""

    version: str
    build: str
    frontend_dir: Path
    theme_source: Path

    @property
    def url_base(self) -> str:
        """Return the folder the build is served from; a new build is a new folder, never stale."""
        return f"{URL_BASE}/{self.version}-{self.build}"

    @property
    def loader_url(self) -> str:
        """Return the module Home Assistant loads on every page (the settings panel's too)."""
        return f"{self.url_base}/loader.js"

    @property
    def bundle_url(self) -> str:
        """Return the build itself: the Lovelace resource, and what the loader imports."""
        return f"{self.url_base}/fluvy.js"


# None once setup found no build to serve.
FLUVY_DATA: HassKey[FluvyRuntime | None] = HassKey(DOMAIN)
