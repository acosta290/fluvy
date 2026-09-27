"""Install Fluvy's theme in the folder Home Assistant reads, reload it and check it is listed."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

import contextlib
import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.frontend import DATA_THEMES
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util.file import write_utf8_file_atomic

from .const import THEME_DIR, THEME_FILE, THEME_NAME, FluvyRuntime

_LOGGER = logging.getLogger(__name__)


def theme_path(hass: HomeAssistant) -> Path:
    """Where the theme lives on this instance: `<config>/themes/fluvy/fluvy.yaml`."""
    return Path(hass.config.path("themes", THEME_DIR, THEME_FILE))


def sync_theme_file(source: Path, target: Path) -> bool:
    """Install the theme when the one installed differs or is missing; True when it was written.

    Written atomically, so a reload can never read half a file. Runs in the executor.
    """
    data = source.read_bytes()
    try:
        if target.read_bytes() == data:
            return False
    except OSError:
        pass
    target.parent.mkdir(parents=True, exist_ok=True)
    write_utf8_file_atomic(str(target), data, mode="wb")
    return True


def remove_theme_file(target: Path) -> None:
    """Delete the theme and its folder when that leaves it empty. Runs in the executor."""
    target.unlink(missing_ok=True)
    with contextlib.suppress(OSError):
        target.parent.rmdir()


@callback
def theme_loaded(hass: HomeAssistant) -> bool:
    """Return whether Home Assistant lists the Fluvy theme (`frontend: themes:` must include it)."""
    return THEME_NAME in hass.data.get(DATA_THEMES, {})


async def async_reload_themes(hass: HomeAssistant) -> bool:
    """Ask the frontend to read the themes again; False when the configuration could not be read."""
    try:
        await hass.services.async_call(frontend.DOMAIN, "reload_themes", blocking=True)
    except HomeAssistantError as err:
        _LOGGER.warning("Themes could not be reloaded: %s", err)
        return False
    return True


async def async_install_theme(hass: HomeAssistant, runtime: FluvyRuntime) -> bool:
    """Install the theme this build ships and make Home Assistant list it; True when it does."""
    written = await hass.async_add_executor_job(
        sync_theme_file, runtime.theme_source, theme_path(hass)
    )
    if written or not theme_loaded(hass):
        await async_reload_themes(hass)
    return theme_loaded(hass)


async def async_remove_theme(hass: HomeAssistant) -> None:
    """Take the theme away and let Home Assistant forget it."""
    await hass.async_add_executor_job(remove_theme_file, theme_path(hass))
    await async_reload_themes(hass)
