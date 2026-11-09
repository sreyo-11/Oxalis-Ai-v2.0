# Oxalis AI: Autonomous Multi Agent Blueprint Generator

> A lightweight multi agent orchestration platform that generates production ready technical blueprints for complex tasks through collaborative reasoning, hybrid web search, and vector RAG retrieval.

---

##  Key Features

* **3 Agent Orchestration Pipeline**: Sequential collaboration loop featuring a **Planner** (milestone mapping), **Retriever** (hybrid RAG + web search), and **Executor** (blueprint synthesis).
* **Optimized Hybrid RAG Engine**: Combines real time DuckDuckGo web search with historical vector similarity retrieval via **Qdrant Cloud** and **ONNX optimized sentence-transformers**, maintaining a minimal memory footprint (<250MB RAM).
* **Distributed Job Architecture**: Non-blocking asynchronous task execution backed by **Upstash Redis** for robust state persistence across server restarts and concurrent loads.
* **Modern Minimalist UI**: High-performance React application featuring live agent log streaming, dynamic progress tracking, and markdown exports.
* **Production Containerization**: Fully containerized with multi stage Docker builds, configured for free tier deployment on **Render** and **Vercel**.

---

##  System Architecture & Workflow

```text
   [ React Frontend ] 
           │ (REST API + Polling)
           ▼
[ FastAPI Backend (Render / Docker) ]
           ├── 1. Planner Agent  ──► Maps chronological milestones
           ├── 2. Retriever Agent ──► Hybrid Search (Qdrant Vector DB + DuckDuckGo Web)
           └── 3. Executor Agent  ──► Synthesizes final Markdown Blueprint & auto-indexes into Vector DB

```

---

## Tech Stack

* **Backend**: Python, FastAPI, Uvicorn, Pydantic, OpenAI/Groq Async Client
* **AI & RAG**: Groq LLM API (`gpt-oss-20b` / `gpt-4o-mini`), Sentence-Transformers (ONNX Runtime), Qdrant Vector DB, DuckDuckGo Search
* **State Management & Queue**: Upstash Redis
* **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, React-Markdown
* **Infrastructure**: Docker, Docker Compose, Render (Backend), Vercel (Frontend)

---

## Project Structure

```text
oxalis-ai/
├── Dockerfile                  # Backend container specification
├── docker-compose.yml          # Local container orchestration
├── requirements.txt            # Python dependencies
├── main.py                     # FastAPI application & agent pipeline
├── storage.py                  # Redis / Memory job state manager
├── vector_storage.py           # Vector RAG service (Qdrant + ONNX)
└── frontend/                   # React SPA
    ├── Dockerfile              # Frontend container specification
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── index.css
        └── App.jsx

```

---

## Environment Variables

Create a `.env` file in the root directory using the following template:

```env
# LLM Provider (Groq / OpenAI Compatible)
LLM_API_KEY=gsk_your_api_key_here
LLM_BASE_URL=[https://api.groq.com/openai/v1](https://api.groq.com/openai/v1)
LLM_MODEL=openai/gpt-oss-20b

# Vector DB & RAG Configuration
QDRANT_URL=[https://your-cluster-id.cloud.qdrant.io](https://your-cluster-id.cloud.qdrant.io)
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=oxalis_blueprints_local
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Persistence & Networking
REDIS_URL=rediss://default:your_password@your_redis_instance.upstash.io:6379
ALLOWED_ORIGINS=http://localhost:3000,[http://127.0.0.1:3000](http://127.0.0.1:3000)
BACKEND_PORT=8000
FRONTEND_PORT=3000

```

---

## Getting Started Locally

### Option 1: Run with Docker Compose (Recommended)

Ensure [Docker](https://docs.docker.com/get-docker/) and Docker Compose are installed, then run:

```bash
# Clone the repository
git clone [https://github.com/YOUR_USERNAME/oxalis-ai.git](https://github.com/YOUR_USERNAME/oxalis-ai.git)
cd oxalis-ai

# Build and spin up containers
docker-compose up --build

```

* **Frontend UI**: Open `http://localhost:3000`
* **Backend API Docs**: Open `http://localhost:8000/docs`

### Option 2: Manual Local Development

1. **Backend**:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

```


2. **Frontend**:
```bash
cd frontend
npm install
npm run dev

```



---

## Deployment Guide

### 1. Backend Deployment (Render)

1. Push your code to GitHub.
2. Create a new **Web Service** on [Render](https://dashboard.render.com/).
3. Connect your repository and select **Docker** environment.
4. Add all production environment variables from your `.env` file under the Environment settings.
5. Deploy! Copy your live backend URL (e.g., `https://oxalis-backend.onrender.com`).

### 2. Frontend Deployment (Vercel)

1. Import your repository into [Vercel](https://vercel.com/).
2. Set the **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. Add Environment Variable:
* `VITE_BACKEND_URL` = `https://oxalis-backend.onrender.com`


5. Deploy and have fun generating projects!

### 3. Live Demo of the App 

![Watch the Demo](https://github.com/user-attachments/assets/e0981d5e-0356-455d-9d69-8722b0b6abd9)(https://1drv.ms/v/c/c86aaf3a2ed5b40e/IQAEcGKcIksvS7x8orEKAOnLAbFABekFKCzsn4nQ6-bbEQo?e=ozwPdU)


---

## License

Distributed under the MIT License. See `LICENSE` for more information.
