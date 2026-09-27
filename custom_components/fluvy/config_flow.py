"""Fluvy's config flow: there is nothing to configure, so one step creates the entry."""

# SPDX-License-Identifier: GPL-3.0-only

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class FluvyConfigFlow(ConfigFlow, domain=DOMAIN):
    """Set Fluvy up in one click."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Create the one entry (the manifest allows a single one; this guards the same)."""
        self._async_abort_entries_match()
        return self.async_create_entry(title="Fluvy", data={})
