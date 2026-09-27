"""What a bug report needs to know about this installation."""

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

from __future__ import annotations

from typing import Any

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN, FLUVY_DATA
from .resources import is_fluvy_resource
from .theme import theme_loaded, theme_path


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return the build served, its URLs, the resource, the theme and the open issues."""
    runtime = hass.data.get(FLUVY_DATA)
    resources = hass.data[LOVELACE_DATA].resources
    items = resources.async_items() if getattr(resources, "loaded", True) else []
    return {
        "build": None
        if runtime is None
        else {
            "version": runtime.version,
            "build": runtime.build,
            "url_base": runtime.url_base,
            "loader_url": runtime.loader_url,
            "bundle_url": runtime.bundle_url,
        },
        "resources": {
            "mode": type(resources).__name__,
            "fluvy": [
                item.get("url") for item in items if is_fluvy_resource(str(item.get("url", "")))
            ],
        },
        "theme": {"path": str(theme_path(hass)), "loaded": theme_loaded(hass)},
        "issues": [
            issue.issue_id for issue in ir.async_get(hass).issues.values() if issue.domain == DOMAIN
        ],
    }
