import json
import os
import time
from typing import Optional, Dict, Any
import redis

REDIS_URL = os.getenv("REDIS_URL", "")

class JobStore:
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        if REDIS_URL:
            try:
                self._redis = redis.Redis.from_url(REDIS_URL, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None
        self._memory_store: Dict[str, Dict[str, Any]] = {}

    def set_job(self, job_id: str, data: dict, ttl: int = 3600) -> None:
        if self._redis:
            self._redis.setex(f"job:{job_id}", ttl, json.dumps(data))
        else:
            data["_expires_at"] = time.time() + ttl
            self._memory_store[job_id] = data
            self._prune_memory()

    def get_job(self, job_id: str) -> Optional[dict]:
        if self._redis:
            raw = self._redis.get(f"job:{job_id}")
            return json.loads(raw) if raw else None
        
        job = self._memory_store.get(job_id)
        if job and job.get("_expires_at", 0) < time.time():
            self._memory_store.pop(job_id, None)
            return None
        return job

    def update_job(self, job_id: str, updates: dict, ttl: int = 3600) -> Optional[dict]:
        job = self.get_job(job_id)
        if not job:
            return None
        job.update(updates)
        self.set_job(job_id, job, ttl=ttl)
        return job

    def append_log(self, job_id: str, message: str) -> None:
        job = self.get_job(job_id)
        if job:
            timestamp = time.strftime("%H:%M:%S")
            job.setdefault("logs", []).append(f"[{timestamp}] {message}")
            self.set_job(job_id, job)

    def _prune_memory(self) -> None:
        now = time.time()
        expired = [k for k, v in self._memory_store.items() if v.get("_expires_at", 0) < now]
        for k in expired:
            self._memory_store.pop(k, None)

job_store = JobStore()