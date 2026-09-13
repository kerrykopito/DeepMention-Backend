from __future__ import annotations

import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from playwright.async_api import BrowserContext, Page, async_playwright
from playwright_stealth import Stealth

from .config import (
    HEADLESS,
    LOCALE,
    PROFILE_DIR,
    SLOW_MO_MS,
    TIMEZONE_ID,
    USER_AGENT,
    ensure_dirs,
)


COMMON_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--disable-dev-shm-usage",
    # SECURITY: --no-sandbox disables Chromium's renderer sandbox while it loads untrusted
    # third-party pages, so a renderer exploit reaches host code. It is kept because Chromium
    # will not launch as root inside the container without it; the compensating control is
    # that the scrape API now requires an auth token (see chatgpt_scraper.require_api_token).
    # If this runs as a non-root user (locally or via a container USER), remove this flag.
    "--no-sandbox",
]


# SECURITY: profile names become a Chromium `user_data_dir` on disk. Restrict them to a
# strict allow-list and confine the resolved path to PROFILE_DIR so an attacker-supplied
# `profile` (e.g. "../../etc") cannot escape the profile directory (path traversal).
_PROFILE_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def profile_path(profile_name: str) -> Path:
    ensure_dirs()
    if not isinstance(profile_name, str) or not _PROFILE_NAME_RE.match(profile_name):
        raise ValueError(
            "Invalid profile name: must match ^[A-Za-z0-9_-]{1,64}$"
        )
    base = PROFILE_DIR.resolve()
    candidate = (base / profile_name).resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError("Profile path escapes the profile directory")
    return candidate


@asynccontextmanager
async def persistent_context(
    profile_name: str,
    *,
    headless: bool | None = None,
    browser_channel: str | None = None,
) -> AsyncIterator[BrowserContext]:
    ensure_dirs()
    launch_options = {
        "user_data_dir": str(profile_path(profile_name)),
        "headless": HEADLESS if headless is None else headless,
        "slow_mo": SLOW_MO_MS,
        "args": COMMON_ARGS,
        "user_agent": USER_AGENT,
        "viewport": {"width": 1365, "height": 900},
        "locale": LOCALE,
        "timezone_id": TIMEZONE_ID,
    }
    if browser_channel:
        launch_options["channel"] = browser_channel

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(**launch_options)
        try:
            yield context
        finally:
            await context.close()


async def new_stealth_page(context: BrowserContext, *, apply_stealth: bool = True) -> Page:
    page = await context.new_page()
    if apply_stealth:
        await Stealth().apply_stealth_async(page)
    page.set_default_timeout(30000)
    return page
