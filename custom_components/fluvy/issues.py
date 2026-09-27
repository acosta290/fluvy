"""Say through Repairs what only the person can do: old YAML, a theme not included, resources."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

from homeassistant.components import frontend
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, DATA_PANELS
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import issue_registry as ir

from .const import (
    DOCS_URL,
    DOMAIN,
    ISSUE_LEGACY_YAML,
    ISSUE_RESOURCES_YAML,
    ISSUE_THEME_NOT_LOADED,
    LEGACY_LOCAL_PREFIX,
    PANEL_URL_PATH,
)
from .resources import ResourceOutcome
from .theme import theme_path


def _issue(hass: HomeAssistant, issue_id: str, placeholders: dict[str, str]) -> None:
    ir.async_create_issue(
        hass,
        DOMAIN,
        issue_id,
        is_fixable=False,
        severity=ir.IssueSeverity.WARNING,
        translation_key=issue_id,
        translation_placeholders=placeholders,
        learn_more_url=DOCS_URL,
    )


@callback
def async_check_legacy_yaml(hass: HomeAssistant) -> list[str]:
    """Retire the panel and module a manual install put in configuration.yaml, and say so.

    Returns the YAML lines the person has to delete (the file is theirs; nothing here edits it).
    """
    lines: list[str] = []
    panel = hass.data.get(DATA_PANELS, {}).get(PANEL_URL_PATH)
    config = getattr(panel, "config", None) or {}
    module_url = (config.get("_panel_custom") or {}).get("module_url", "")
    if isinstance(module_url, str) and module_url.startswith(LEGACY_LOCAL_PREFIX):
        # replaced by ours right after (the register removes it first)
        lines.append(f"panel_custom: the entry with url_path: {PANEL_URL_PATH}")
    manager = hass.data.get(DATA_EXTRA_MODULE_URL)
    for url in list(getattr(manager, "urls", ())):
        if url.startswith(LEGACY_LOCAL_PREFIX):
            frontend.remove_extra_js_url(hass, url)
            lines.append(f"frontend: extra_module_url: {url}")
    if lines:
        _issue(hass, ISSUE_LEGACY_YAML, {"lines": "\n".join(f"- `{line}`" for line in lines)})
    else:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_LEGACY_YAML)
    return lines


@callback
def async_sync_theme_issue(hass: HomeAssistant, loaded: bool) -> None:
    """Raise or clear the issue about a theme Home Assistant does not list."""
    if loaded:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_THEME_NOT_LOADED)
        return
    _issue(
        hass,
        ISSUE_THEME_NOT_LOADED,
        {
            "path": str(theme_path(hass)),
            "yaml": "```yaml\nfrontend:\n  themes: !include_dir_merge_named themes\n```",
        },
    )


@callback
def async_sync_resource_issue(hass: HomeAssistant, outcome: ResourceOutcome, url: str) -> None:
    """Raise or clear the issue about resources that live in YAML."""
    if outcome is ResourceOutcome.YAML_MODE:
        _issue(hass, ISSUE_RESOURCES_YAML, {"url": url})
    else:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_RESOURCES_YAML)


@callback
def async_clear_issues(hass: HomeAssistant) -> None:
    """Forget every issue of ours (the integration is gone)."""
    for issue_id in (ISSUE_LEGACY_YAML, ISSUE_THEME_NOT_LOADED, ISSUE_RESOURCES_YAML):
        ir.async_delete_issue(hass, DOMAIN, issue_id)
