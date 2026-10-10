import logging
import os
import re
import time
import uuid
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI, APIStatusError, APITimeoutError, APIConnectionError
from pydantic import BaseModel, Field

load_dotenv()

from storage import job_store
from vector_store import rag_service


def _clean(value: str) -> str:
    return value.strip().strip("\"'").strip()

API_KEY = _clean(os.getenv("LLM_API_KEY", ""))
MODEL = _clean(os.getenv("LLM_MODEL", ""))
BASE_URL = re.sub(r"/chat/completions/?$", "", _clean(os.getenv("LLM_BASE_URL", ""))).rstrip("/")

MAX_HANDOFF_CHARS = 5000
JOB_TTL_SECONDS = 3600

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
logger = logging.getLogger("oxalis")

app = FastAPI(title="Oxalis AI Engine")

# CORS setup for future React deployment (Vercel / Localhost)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanRequest(BaseModel):
    project_topic: str = Field(..., min_length=3, max_length=300)
    timeframe: str = "1 Month Phase"
    additional_context: str = Field("", max_length=2000)


_async_client: AsyncOpenAI = None

def get_async_client() -> AsyncOpenAI:
    global _async_client
    if _async_client is None:
        _async_client = AsyncOpenAI(
            api_key=API_KEY,
            base_url=BASE_URL,
            timeout=httpx.Timeout(
                float(os.getenv("LLM_TIMEOUT", "60")),
                connect=float(os.getenv("LLM_CONNECT_TIMEOUT", "8")),
            ),
            max_retries=int(os.getenv("LLM_MAX_RETRIES", "2")),
        )
    return _async_client

async def ask_async(system: str, user: str, max_tokens: int) -> str:
    client = get_async_client()

    async def _call(messages):
        started = time.time()
        response = await client.chat.completions.create(
            model=MODEL,
            temperature=0.3,
            max_tokens=max_tokens,
            messages=messages,
            stream=False,
        )
        content = response.choices[0].message.content or ""
        logger.info("Model answered in %.1fs (%d chars)", time.time() - started, len(content))
        return content.strip()

    try:
        text = await _call([
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ])
    except APIStatusError as exc:
        if exc.status_code == 400:
            text = await _call([{"role": "user", "content": f"{system}\n\n---\n\n{user}"}])
        else:
            raise

    if not text:
        raise RuntimeError("Model returned an empty response.")
    return text

def trim(text: str, limit: int = MAX_HANDOFF_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "\n...[trimmed]"

async def web_search_async(query: str, limit: int = 4) -> list[dict]:
    try:
        from ddgs import DDGS
        hits = DDGS().text(query, max_results=limit) or []
        return [
            {
                "title": h.get("title", "")[:120],
                "url": h.get("href", ""),
                "snippet": h.get("body", "")[:300],
            }
            for h in hits if h.get("href")
        ]
    except Exception as exc:
        logger.warning("Web search skipped for query '%s': %s", query, exc)
        return []

# System Prompts with RAG Context integration
PLANNER_SYSTEM = """You are the PLANNER of Oxalis AI, a strategic architect.
Given a goal, timeframe and constraints:
1. State the core domain in one line.
2. Produce a phased roadmap with concrete milestones.
Keep it under 450 words in Markdown.

Finish with exactly this block:
RESEARCH_QUERIES:
- <query 1>
- <query 2>"""

RETRIEVER_SYSTEM = """You are the RETRIEVER of Oxalis AI.
You receive:
1. A strategic roadmap.
2. Search results from live web queries.
3. Internal knowledge & past blueprints retrieved from the Vector Database.

Identify the optimal technologies, frameworks, and architecture patterns.
Distinguish between web findings and internal past blueprint references.
Keep it under 450 words, Markdown bullet points grouped by theme."""

EXECUTOR_SYSTEM = """You are the EXECUTOR of Oxalis AI, the implementation lead.
Merge the roadmap, web research, and vector DB blueprint context into a Markdown 'Project Blueprint':
# <Project title>
## Executive Summary
## Assumptions & Constraints
## Roadmap
## Timeline (Markdown Table)
## Tech Stack & Resources (Include Web Links + Reference Internal Blueprints if applicable)
## Risks & Mitigations (Markdown Table)
## Success Metrics
## Immediate Next Steps"""

def split_plan(text: str) -> tuple[str, list[str]]:
    marker = "RESEARCH_QUERIES:"
    if marker not in text:
        return text.strip(), []
    plan, _, tail = text.partition(marker)
    queries = []
    for line in tail.splitlines():
        query = re.sub(r"^[\s\-\*\d\.\)]+", "", line).strip()
        if query:
            queries.append(query)
    return plan.strip(), queries[:3]

async def run_pipeline_async(job_id: str, req: PlanRequest) -> None:
    job_store.update_job(job_id, {"status": "running", "stage": "Planner", "progress": 0.05})
    job_store.append_log(job_id, "Planner: mapping milestones...")

    try:
        # Step 1: Planner Agent
        user_input = f"Goal: {req.project_topic}\nTimeframe: {req.timeframe}\nContext: {req.additional_context or 'None'}"
        planner_res = await ask_async(PLANNER_SYSTEM, user_input, 1200)
        plan, queries = split_plan(planner_res)
        job_store.append_log(job_id, f"Planner complete. {len(queries)} search queries generated.")

        # Step 2: Retriever Agent (Hybrid RAG: Vector DB + Web Search)
        job_store.update_job(job_id, {"stage": "Retriever", "progress": 0.35})
        job_store.append_log(job_id, "Retriever: querying Vector DB for historical blueprints...")
        
        # Vector RAG Query
        rag_hits = await rag_service.search_similar(req.project_topic, top_k=2)
        vector_context = "\n---\n".join([f"Past Blueprint [{h['topic']}]:\n{h['content'][:1000]}" for h in rag_hits]) \
                         if rag_hits else "(No prior blueprints matched in Vector DB)"
        
        job_store.append_log(job_id, f"Retriever: found {len(rag_hits)} relevant internal vector match(es).")

        # Web Search
        queries = queries or [f"{req.project_topic} best practices tools"]
        web_sources = []
        for q in queries:
            job_store.append_log(job_id, f"Retriever: searching web for '{q}'")
            hits = await web_search_async(q)
            web_sources.extend(hits)

        formatted_web = "\n".join(
            f"[{i}] {s['title']} - {s['url']}\n {s['snippet']}"
            for i, s in enumerate(web_sources, 1)
        ) if web_sources else "(No web results found)"

        retriever_input = (
            f"Goal: {req.project_topic}\n\n"
            f"ROADMAP:\n{trim(plan, 2500)}\n\n"
            f"INTERNAL VECTOR DB MATCHES:\n{trim(vector_context, 2000)}\n\n"
            f"LIVE WEB SEARCH:\n{trim(formatted_web, 2500)}"
        )
        research = await ask_async(RETRIEVER_SYSTEM, retriever_input, 1200)
        job_store.append_log(job_id, "Retriever: synthesis complete.")

        # Step 3: Executor Agent
        job_store.update_job(job_id, {"stage": "Executor", "progress": 0.65})
        job_store.append_log(job_id, "Executor: generating final blueprint...")

        executor_input = (
            f"Goal: {req.project_topic}\nTimeframe: {req.timeframe}\n"
            f"PLAN:\n{trim(plan, 3000)}\nRESEARCH & RAG:\n{trim(research, 3000)}"
        )
        final_blueprint = await ask_async(EXECUTOR_SYSTEM, executor_input, 2500)

        # Step 4: Index completed blueprint back into Vector DB
        job_store.append_log(job_id, "Executor: indexing blueprint into Vector DB...")
        await rag_service.index_blueprint(req.project_topic, final_blueprint)

        job_store.update_job(job_id, {
            "status": "done",
            "stage": "Done",
            "progress": 1.0,
            "result": final_blueprint
        })
        job_store.append_log(job_id, "Executor: blueprint finished and vector indexed.")

    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        job_store.update_job(job_id, {"status": "error", "error": str(exc)})
        job_store.append_log(job_id, f"ERROR: {str(exc)}")


@app.get("/health")
def health():
    return {"status": "online", "model": MODEL, "base_url": BASE_URL}

@app.post("/plan", status_code=202)
async def create_plan(request: PlanRequest, background_tasks: BackgroundTasks):
    job_id = uuid.uuid4().hex[:12]
    initial_job = {
        "status": "queued",
        "stage": "Queued",
        "progress": 0.0,
        "logs": [],
        "result": None,
        "error": None,
        "created": time.time(),
    }
    job_store.set_job(job_id, initial_job, ttl=JOB_TTL_SECONDS)
    job_store.append_log(job_id, f"Job {job_id} queued: {request.project_topic}")

    background_tasks.add_task(run_pipeline_async, job_id, request)
    return {"job_id": job_id}

@app.get("/plan/{job_id}")
def get_plan(job_id: str):
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return job
