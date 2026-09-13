"""
India-first AI UI scraping API.

Start with:
    src\\scraping\\venv\\Scripts\\python -m uvicorn chatgpt_scraper:app --host 0.0.0.0 --port 8000 --reload

Before scraping an engine, log in once:
    src\\scraping\\venv\\Scripts\\python src\\scraping\\login.py --engine chatgpt
    src\\scraping\\venv\\Scripts\\python src\\scraping\\login.py --engine gemini
    src\\scraping\\venv\\Scripts\\python src\\scraping\\login.py --engine perplexity
"""
from __future__ import annotations

import asyncio
import os
import secrets
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent))

from scraper.models import BatchRequest, EngineName, ScrapeJob
from scraper.runner import run_batch, run_job

app = FastAPI(title="India AI UI Scraper")
executor = ThreadPoolExecutor(max_workers=1)


# SECURITY: the scrape endpoints drive real logged-in browser sessions, so they must not be
# open to the internet. Require a shared bearer token from the SCRAPER_API_TOKEN env var and
# FAIL CLOSED when it is unset (no token configured => every scrape request is rejected).
def require_api_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("SCRAPER_API_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Scraper API auth is not configured")
    prefix = "Bearer "
    provided = (
        authorization[len(prefix):]
        if authorization and authorization.startswith(prefix)
        else ""
    )
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API token")


class ScrapeRequest(BaseModel):
    prompt: str
    country_code: str = "IN"
    profile: str | None = None


class EngineScrapeRequest(ScrapeRequest):
    engine: EngineName = EngineName.CHATGPT


class ApiBatchRequest(BaseModel):
    prompts: list[str]
    engines: list[EngineName] = Field(
        default_factory=lambda: [
            EngineName.CHATGPT,
            EngineName.GEMINI,
            EngineName.PERPLEXITY,
        ]
    )
    brand: str | None = None
    competitors: list[str] = Field(default_factory=list)
    profile: str | None = None
    max_retries: int = 2
    min_delay_seconds: int = 30
    max_delay_seconds: int = 90


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "india-ui-profiles"}


@app.post("/scrape/chatgpt", dependencies=[Depends(require_api_token)])
async def scrape_chatgpt_endpoint(body: ScrapeRequest) -> dict:
    result = await run_job(
        ScrapeJob(
            prompt=body.prompt,
            engine=EngineName.CHATGPT,
            profile=body.profile,
        )
    )
    return result.to_legacy_response()


@app.post("/scrape/batch", dependencies=[Depends(require_api_token)])
async def scrape_batch_endpoint(body: ApiBatchRequest) -> dict:
    if body.min_delay_seconds > body.max_delay_seconds:
        raise HTTPException(status_code=400, detail="min_delay_seconds must be <= max_delay_seconds")

    results = await run_batch(
        BatchRequest(
            prompts=body.prompts,
            engines=body.engines,
            brand=body.brand,
            competitors=body.competitors,
            profile=body.profile,
            max_retries=body.max_retries,
        ),
        min_delay_seconds=body.min_delay_seconds,
        max_delay_seconds=body.max_delay_seconds,
    )
    return {"results": [result.model_dump(mode="json") for result in results]}


@app.post("/scrape/{engine}", dependencies=[Depends(require_api_token)])
async def scrape_engine_endpoint(engine: EngineName, body: ScrapeRequest) -> dict:
    result = await run_job(
        ScrapeJob(
            prompt=body.prompt,
            engine=engine,
            profile=body.profile,
        )
    )
    return result.model_dump(mode="json")


def scrape_chatgpt_sync(prompt: str, profile: str | None = None) -> dict:
    """Compatibility helper for older local scripts."""
    result = asyncio.run(
        run_job(
            ScrapeJob(
                prompt=prompt,
                engine=EngineName.CHATGPT,
                profile=profile,
            )
        )
    )
    return result.to_legacy_response()
