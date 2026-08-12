# Deployment Design

## Overview

SystemLens is deployed on **Vercel** as a single Next.js application. The frontend and backend (API Routes) are served from the same deployment. Every commit to the main branch triggers an automatic Vercel rebuild and deployment.

---

## Frontend

**Runs on:** Vercel

**Responsibilities:**
- Render UI (Next.js App Router with React Server Components)
- Collect repository URL from user
- Display real-time progress during analysis (SSE streaming)
- Display project profile (tech facts, understanding, key features)
- Display audience-specific explanations with Mermaid diagrams
- Render Mermaid diagrams with zoom and fullscreen support
- Display chat interface with streaming responses
- Maintain chat history in browser memory (per session)
- Theme management (light/dark mode with system preference detection)

### Frontend-Backend Communication

The frontend communicates only with the Next.js backend via **SSE (Server-Sent Events)** streaming:

```
Browser
    │
    ▼
Next.js Backend
```

The frontend **never** talks directly to:
- ❌ GitHub API
- ❌ Groq API

---

## Backend

**Runs inside:** Next.js API Routes (Vercel Serverless Functions)

**Responsibilities:**
- Receive API requests (POST with JSON body)
- Call GitHub API (via server-side `fetch`)
- Run Light Analyzer (manifest + Docker parsing)
- Call Groq API (via OpenAI-compatible SDK)
- Build Project Profile (profile builder)
- Stream responses back to the client via SSE

### API Endpoints

| Method | Endpoint | Transport | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/analyze` | SSE stream | Analyze a GitHub repository and build a Project Profile |
| POST | `/api/explain` | SSE stream / JSON (cached) | Generate (or retrieve cached) audience-specific explanation with Mermaid diagram |
| POST | `/api/chat` | SSE stream | Answer project/code questions with streaming text |

### API Response Format

All endpoints use **SSE (Server-Sent Events)**. Each event is a JSON object on its own line:

**Common event types:**
- `{ type: "status", step: "..." }` — progress indicator
- `{ type: "chunk", content: "..." }` — streaming text content
- `{ type: "progress", step: "..." }` — analysis progress steps
- `{ type: "result", data: {...} }` — final result (analyze)
- `{ type: "diagram", diagram: "..." }` — Mermaid diagram (explain)
- `{ type: "done" }` — stream complete
- `{ type: "truncated" }` — response hit token limit (chat)
- `{ type: "cached", ... }` — cached response (explain)
- `{ type: "error", error: "...", retryAfterSeconds?: number }` — error with optional rate-limit countdown

### Rate Limiting

When the AI provider returns a 429 (Too Many Requests) error:
- The route emits `{ type: "error", error: "...", retryAfterSeconds: N }`
- The frontend displays a countdown timer and disables the retry button until the cooldown expires
- The retry-after value is extracted from the `Retry-After` header or Groq-specific `x-ratelimit-reset-*` headers
- Falls back to 30 seconds if no header is available

---

## External Services

### GitHub API

External service. No key required, but a `GITHUB_TOKEN` is strongly recommended to avoid rate limits.

**Used for:**
- Repository metadata (`GET /repos/{owner}/{repo}`)
- Repository file tree (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`)
- File contents (`GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`)

**Flow:**
```
Backend
   │
   ▼
GitHub API
   │
   ▼
Repository Data
```

### Groq API

External AI service (OpenAI-compatible SDK).

**Used for:**
- Project Understanding (purpose, architecture, modules, key features, tech stack, data flow)
- Audience Explanation (content + Mermaid diagram)
- Chat Answers (general questions + code-aware answers)
- File Selection (determining if relevant source files are needed)

**Flow:**
```
Backend
   │
   ▼
Groq API
   │
   ▼
AI Response
```

---

## Caching Layers

### 1. Disk Cache (Analysis)

- **Location**: `.cache/analysis/` directory in project root
- **TTL**: 24 hours
- **Control**: Set `CACHE_ANALYSIS=false` to disable
- **Content**: Full `ProjectProfile` objects
- **Key**: SHA-256 hash of the repository URL

### 2. In-Memory Cache (Explanations)

- **TTL**: 30 minutes
- **Location**: Server-side (Next.js function instance)
- **Content**: `Explanation` objects per `{ owner/name, audience }`
- **Note**: Cache is per-function-instance. On Vercel, cold starts clear this cache.

### 3. In-Memory Cache (Chat)

- **TTL**: 30 minutes
- **Location**: Server-side (Next.js function instance)
- **Content**:
  - File tree cache per `{ owner/repo:branch }`
  - File content cache per `{ owner/repo:path:branch }`
  - File selection cache per `{ owner/repo:question }`
- **Note**: Same per-instance limitation as explanation cache.

---

## Environment Variables

Secrets stay only on the backend. Never exposed to the browser.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub personal access token | — | Recommended |
| `GROQ_API_KEY` | Groq API key for AI inference | — | Required for AI |
| `AI_API_KEY` | Alias for `GROQ_API_KEY` (takes priority) | — | Alternative |
| `AI_BASE_URL` | Override API base URL | `https://api.groq.com/openai/v1` | Optional |
| `AI_MODEL` | Override model name | `llama-3.3-70b-versatile` | Optional |
| `CACHE_ANALYSIS` | Set to `false` to disable disk cache | `true` | Optional |

**Flow:**
```
Browser
   │
   │ No access
   ▼

Vercel Environment Variables
   │
   ▼

Backend API Routes
```

---

## Deployment Rules

Frontend never talks directly to:
- ❌ GitHub API
- ❌ Groq API

Backend never exposes:
- ❌ API keys
- ❌ GitHub token
- ❌ Internal prompts
- ❌ Rate-limit headers

---

## Vercel Deployment Stack

| Part | Technology | Hosting |
| :--- | :--- | :--- |
| **Frontend** | Next.js | Vercel Free Tier |
| **Backend** | Next.js API Routes | Vercel Serverless Functions (Free Tier) |
| **Repository Access** | GitHub REST API | External (GitHub) |
| **AI** | Groq API | External (Groq) |
| **Diagram Rendering** | Mermaid.js (client-side lazy load) | Browser |
| **Database** | None | — |
| **Analysis Cache** | Filesystem (`.cache/analysis/`) | Temporary (Vercel) |

> **Note:** Vercel's serverless functions use ephemeral filesystems. The disk cache persists only within a single function instance and is lost on cold starts / function scaling. For production workloads with persistent caching, consider a Redis backend.