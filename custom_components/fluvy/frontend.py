"""Serve the build and put it on every page: the static path, the module, the settings panel."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

import json
import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback

from .const import PANEL_ELEMENT, PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH, FluvyRuntime

_LOGGER = logging.getLogger(__name__)

# What a build cannot do without.
REQUIRED_FILES = ("fluvy.js", "loader.js")


def read_build(frontend_dir: Path) -> tuple[str, str] | None:
    """Return the build's version and stamp from its manifest, or None without a build to serve.

    Runs in the executor.
    """
    try:
        data = json.loads((frontend_dir / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    version, build = data.get("version"), data.get("build")
    if not isinstance(version, str) or not isinstance(build, str):
        return None
    if not all((frontend_dir / name).is_file() for name in REQUIRED_FILES):
        return None
    return version, build


def sweep_sidecars(frontend_dir: Path) -> int:
    """Delete compressed sidecars beside the scripts: aiohttp would serve one instead, stale or not.

    Runs in the executor.
    """
    count = 0
    for pattern in ("*.gz", "*.br"):
        for path in frontend_dir.rglob(pattern):
            path.unlink(missing_ok=True)
            count += 1
    return count


async def async_register_static(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Serve the build's folder under its own URL, cacheable for good (the URL changes with it)."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(runtime.url_base, str(runtime.frontend_dir), cache_headers=True)]
    )


@callback
def async_add_module(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Load the loader on every page (the next page load picks it up; no restart)."""
    frontend.add_extra_js_url(hass, runtime.loader_url)


@callback
def async_remove_module(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Stop loading the loader on every page."""
    frontend.remove_extra_js_url(hass, runtime.loader_url)


async def async_register_settings_panel(hass: HomeAssistant, runtime: FluvyRuntime) -> None:
    """Put Fluvy's settings in the sidebar, replacing a panel of the same path (YAML, a reload)."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=runtime.loader_url,
        require_admin=False,
    )


@callback
def async_remove_settings_panel(hass: HomeAssistant) -> None:
    """Take Fluvy's settings out of the sidebar."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
