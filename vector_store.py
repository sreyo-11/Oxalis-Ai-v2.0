import asyncio
import os
import threading
import time

from typing import Any, Dict, List
import numpy as np

QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "oxalis_blueprints_local")
EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

class VectorRAGService:
    def __init__(self):
        self.qdrant_client = None
        self._in_memory_docs: List[Dict[str, Any]] = []
        self._encoder = None
        self._encoder_lock = threading.Lock()

        if QDRANT_URL and QDRANT_API_KEY:
            try:
                from qdrant_client import QdrantClient
                self.qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
            except Exception as exc:
                print(f"[VectorDB Warning] Could not initialize Qdrant: {exc}. Falling back to In-Memory.")
                self.qdrant_client = None

    async def _get_embedding(self, text: str) -> List[float]:
        """Generate embeddings locally so chat-provider credentials are not used for RAG."""
        text_clean = text.replace("\n", " ")[:8000]
        return await asyncio.to_thread(self._encode, text_clean)

    def _encode(self, text: str) -> List[float]:
        from sentence_transformers import SentenceTransformer

        if self._encoder is None:
            with self._encoder_lock:
                if self._encoder is None:
                    self._encoder = SentenceTransformer(EMBEDDING_MODEL)

        embedding = self._encoder.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def _ensure_collection(self, vector_size: int) -> None:
        if self.qdrant_client is None:
            return

        from qdrant_client.models import Distance, VectorParams

        collections = [c.name for c in self.qdrant_client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            self.qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )

    def _search_qdrant(self, query_vector: List[float], top_k: int) -> List[Dict[str, Any]]:
        if self.qdrant_client is None:
            return []

        query_points = getattr(self.qdrant_client, "query_points", None)
        if callable(query_points):
            response = query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=top_k,
                with_payload=True,
            )
            hits = response.points
        else:
            legacy_search = getattr(self.qdrant_client, "search", None)
            if not callable(legacy_search):
                raise RuntimeError("Qdrant client provides neither query_points nor search.")
            hits = legacy_search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=top_k,
            )

        return [
            {
                "topic": (hit.payload or {}).get("topic", "Past Blueprint"),
                "content": (hit.payload or {}).get("content", ""),
                "score": hit.score,
            }
            for hit in hits
        ]

    async def search_similar(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search similar context or past blueprints for a given topic."""
        try:
            query_vector = await self._get_embedding(query)
            
            if self.qdrant_client:
                self._ensure_collection(len(query_vector))
                return self._search_qdrant(query_vector, top_k)
            else:
                # In-Memory Cosine Similarity Fallback
                if not self._in_memory_docs:
                    return []
                
                scores = []
                for doc in self._in_memory_docs:
                    sim = float(np.dot(query_vector, doc["vector"]) / (
                        np.linalg.norm(query_vector) * np.linalg.norm(doc["vector"])
                    ))
                    scores.append((sim, doc))
                
                scores.sort(key=lambda x: x[0], reverse=True)
                return [
                    {
                        "topic": doc["topic"],
                        "content": doc["content"],
                        "score": score
                    }
                    for score, doc in scores[:top_k]
                ]
        except Exception as exc:
            print(f"[RAG Search Error] {exc}")
            return []

    async def index_blueprint(self, topic: str, content: str) -> None:
        """Store completed blueprint vectors into Vector DB for future retrieval."""
        try:
            vector = await self._get_embedding(f"{topic}\n{content[:1000]}")
            doc_id = str(int(time.time()))

            if self.qdrant_client:
                self._ensure_collection(len(vector))
                from qdrant_client.models import PointStruct
                self.qdrant_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[
                        PointStruct(
                            id=hash(doc_id) % (2**31),
                            vector=vector,
                            payload={"topic": topic, "content": content[:3000]}
                        )
                    ]
                )
            else:
                self._in_memory_docs.append({
                    "topic": topic,
                    "content": content[:3000],
                    "vector": vector
                })
        except Exception as exc:
            print(f"[RAG Indexing Error] {exc}")

rag_service = VectorRAGService()