"""Keep the Lovelace resource at the build's URL, so dashboards load Fluvy before they render."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

from enum import StrEnum

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant

from .const import LEGACY_LOCAL_PREFIX, URL_BASE


class ResourceOutcome(StrEnum):
    """What ensuring the resource did."""

    CREATED = "created"
    UPDATED = "updated"
    UNCHANGED = "unchanged"
    # Resources are configured in YAML: nothing can be written; the user adds the resource.
    YAML_MODE = "yaml_mode"


def is_fluvy_resource(url: str) -> bool:
    """Whether a resource URL is one of ours, from this integration or from a manual install."""
    return url.startswith(f"{URL_BASE}/") or url.startswith(LEGACY_LOCAL_PREFIX)


async def _async_storage(hass: HomeAssistant) -> ResourceStorageCollection | None:
    """Return the resource collection, loaded, when it can be written."""
    resources = hass.data[LOVELACE_DATA].resources
    if not isinstance(resources, ResourceStorageCollection):
        return None
    if not resources.loaded:
        await resources.async_load()
        resources.loaded = True
    return resources


async def async_ensure_resource(hass: HomeAssistant, url: str) -> ResourceOutcome:
    """Make the build's URL the one Fluvy resource: replace an older one, delete duplicates."""
    resources = await _async_storage(hass)
    if resources is None:
        return ResourceOutcome.YAML_MODE
    mine = [item for item in resources.async_items() if is_fluvy_resource(str(item.get("url", "")))]
    if not mine:
        await resources.async_create_item({"res_type": "module", "url": url})
        return ResourceOutcome.CREATED
    first, *extra = mine
    for item in extra:
        await resources.async_delete_item(item["id"])
    if first.get("url") != url or first.get("type") != "module":
        await resources.async_update_item(first["id"], {"res_type": "module", "url": url})
        return ResourceOutcome.UPDATED
    return ResourceOutcome.UNCHANGED


async def async_remove_resources(hass: HomeAssistant) -> int:
    """Delete every Fluvy resource; returns how many there were."""
    resources = await _async_storage(hass)
    if resources is None:
        return 0
    mine = [item for item in resources.async_items() if is_fluvy_resource(str(item.get("url", "")))]
    for item in mine:
        await resources.async_delete_item(item["id"])
    return len(mine)
