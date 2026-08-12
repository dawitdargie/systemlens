# Container Responsibilities

## 1. Browser (Frontend)

### Technology

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Mermaid.js (client-side, lazy-loaded)

### Responsibilities

- Collect repository URL from user
- Display real-time progress during analysis (SSE streaming)
- Display project profile (technical facts, understanding, key features, data flow)
- Display audience-specific explanations with Mermaid diagrams
- Render Mermaid diagrams with zoom and fullscreen support
- Display chat interface with streaming responses
- Maintain chat history in browser memory
- Theme management (light/dark mode with system preference detection)
- Error display with rate-limit countdown timers

### SSE Event Handling

The frontend consumes SSE streams from all three API endpoints:
- `/api/analyze` — listens for `progress`, `result`, `error` events
- `/api/explain` — listens for `chunk`, `diagram`, `done`, `error` events (or receives a single JSON response if cached)
- `/api/chat` — listens for `status`, `chunk`, `truncated`, `done`, `error` events

The frontend **never** talks directly to GitHub or Groq. Everything goes through the backend.

## 2. Next.js Backend (API Routes)

This is the heart of SystemLens.

### Responsibilities

#### Repository Fetching

Uses GitHub REST API to retrieve:
- Repository metadata (name, owner, URL, default branch)
- File tree (recursive listing)
- Important files (README, manifest, Dockerfile, entry point)

File tree is fetched in parallel with repository metadata using `HEAD` as the initial ref, with fallback to `default_branch`.

#### Light Analyzer

Extracts deterministic facts (no AI). Combines:
- Manifest parsing (language + framework detection from `go.mod`, `package.json`, `requirements.txt`, etc.)
- Docker parsing (deployment detection from `Dockerfile`, `docker-compose.yml`)

Supported languages: Go, JavaScript/TypeScript, Python, Ruby, PHP, Java, Rust, and more.

#### Important File Identification

Identifies key files for analysis from the repository tree:
- **README**: `README.md` (case-insensitive)
- **Manifest**: First match from manifest patterns (`go.mod`, `package.json`, `requirements.txt`, `Cargo.toml`, `composer.json`, `Gemfile`, `build.gradle`, `pom.xml`)
- **Docker**: First match from Docker patterns (`Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`)
- **Entry point**: First match from entry point patterns (`main.go`, `app.js`, `index.ts`, `main.py`, server files, CLI files, etc.)

All important files are fetched **in parallel** for performance.

#### Project Profile Generation

Combines:
- Repository metadata
- Technical facts (from Light Analyzer)
- README content
- Entry point content

Sends them to Groq API.

Receives:
- Purpose
- Main modules (name + description)
- Architecture summary
- Key features
- Tech stack details
- Data flow

Stores the resulting Project Profile:
- **In-memory**: via disk cache (`lib/cache/analysis-cache.ts`, 24h TTL, env-gated)

#### AI Orchestration

Uses the **OpenAI-compatible SDK** (Groq as the default backend):
- `AI_API_KEY` or `GROQ_API_KEY` for authentication
- `AI_BASE_URL` for custom endpoint (defaults to Groq)
- `AI_MODEL` for model selection (defaults to `llama-3.3-70b-versatile`)

Capabilities:
- **generateUnderstanding**: Structured JSON response with project purpose, modules, architecture, features, tech stack, data flow
- **streamExplanation**: Streaming text + delimiter-separated Mermaid diagram
- **streamAnswer**: Streaming chat answers with conversation history + optional code context
- **chooseFiles**: AI determines if source files are needed to answer a question (returns JSON with `needsFiles` + `filePaths`)

All AI functions support:
- AbortController-based timeouts (50s for understanding, 30s for explanation/chat, 15s for file selection)
- Rate-limit error detection (429 → `RateLimitError` with `retryAfterSeconds`)
- Retry logic with repair prompts (explanation generation only)

#### Mermaid Diagram Handling

The AI frequently produces almost-valid Mermaid. The `mermaid-utils.ts` module provides:
- **stripCodeFences()**: Removes markdown code fences from diagram strings
- **sanitizeMermaid()**: Fixes common AI mistakes (sequence-diagram arrows in graph contexts, special characters in node labels, CRLF line endings)
- **isValidMermaid()**: Lightweight structural validation (not a full parser)
- **buildFallbackDiagram()**: Deterministic fallback diagram generated from the project's `mainModules` when AI output is unfixable

#### Rate Limit Handling

The `rate-limit.ts` module provides:
- `RateLimitError` class with `retryAfterSeconds` property
- `isRateLimitError()`: Detects OpenAI SDK 429 errors
- `getRetryAfterSeconds()`: Extracts retry-after from headers (retry-after, x-ratelimit-reset-tokens, x-ratelimit-reset-requests) with 30s fallback

All API routes propagate `retryAfterSeconds` in SSE error events for client-side countdown timers.

#### Caching

Three caching layers reduce latency and cost:

1. **Disk Cache** (`lib/cache/analysis-cache.ts`): Persists ProjectProfile to `.cache/analysis/` with 24h TTL. Controlled by `CACHE_ANALYSIS` env var. SHA-256 hash of repo URL as key.

2. **Explanation Cache** (`lib/ai/explanation-cache.ts`): In-memory cache for audience explanations with 30 min TTL. Keyed by `${owner}/${name}:${audience}`. Allows instant switching between audiences.

3. **Chat Cache** (`lib/ai/chat-cache.ts`): In-memory caches for:
   - File tree (`TreeItem[]`) per `{ owner/repo:branch }`
   - File content (`string`) per `{ owner/repo:path:branch }`
   - File selection (`ChooseFilesResult`) per `{ owner/repo:question }`

#### Chat Orchestration

For every user question:

**General questions** (profile-answerable):
```
Profile-question heuristic
    │
    ▼
Project Profile + Question
    │
    ▼
Groq API
    │
    ▼
Answer (streamed)
```

**Code questions** (need source files):
```
Question
    │
    ▼
Groq — chooseFiles (does this need code? which files?)
    │
    ▼
GitHub API — fetch selected files (cached)
    │
    ▼
Groq — answer using Profile + Retrieved code + Question
    │
    ▼
Answer (streamed, with truncation detection)
```

**Performance optimizations:**
- `isProfileQuestion()`: Heuristic that detects questions answerable from profile alone (e.g., "What does this project do?", "What's the architecture?") and skips the expensive `chooseFiles` AI round-trip
- File tree, file content, and file selection results are cached per-repository
- Chat history is capped to the last 10 messages to prevent context window overflow
- Answer token limit raised to 32768
- Pre-answer phase (tree fetch + file selection + file fetch) has a 30s hard timeout; streaming answer is never cut off mid-stream

## External Systems

### GitHub API

#### Responsibilities
- Repository metadata (`GET /repos/{owner}/{repo}`)
- Repository tree (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`)
- File contents (`GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`)

#### Authentication
- Uses `GITHUB_TOKEN` from environment variables (Bearer token)
- Falls back to unauthenticated requests (rate-limited to 60/hour)

### Groq API

#### Responsibilities
- Project understanding generation (JSON response format)
- Audience explanation generation (JSON + streaming variants)
- Chat answer generation (streaming with conversation history)
- File selection for code-aware questions (JSON response format)

#### Configuration
- API key: `AI_API_KEY` or `GROQ_API_KEY` env var
- Base URL: `AI_BASE_URL` env var (defaults to `https://api.groq.com/openai/v1`)
- Model: `AI_MODEL` env var (defaults to `llama-3.3-70b-versatile`)

Groq never accesses GitHub directly. The backend handles all GitHub API communication and passes results to Groq as context.

## Services Layer

The original design planned an `Analysis Service` in `lib/services/analyze-repository.ts`. In the actual implementation, this directory exists (`lib/services/index.ts`) but is an **empty stub** — the analysis orchestration logic lives in `lib/github/analyze-repository.ts` instead.