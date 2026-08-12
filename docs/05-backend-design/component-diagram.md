# Component Responsibilities

## 1. API Routes (`app/api/`)

Receives requests from the frontend and returns SSE-streamed responses.

### Endpoints

- `POST /api/analyze` — Analyzes a GitHub repository
- `POST /api/explain` — Generates (or retrieves cached) audience explanation
- `POST /api/chat` — Answers project/code questions with streaming

### Responsibilities

- **Validate input**: Check required fields (`repositoryUrl`, `projectProfile`, `audience`, `question`)
- **Stream responses**: Use `ReadableStream` with `TextEncoder` to emit SSE events line-by-line
- **Error handling**: Catch and propagate `RateLimitError`, `GitHubError`, and generic errors with appropriate SSE error events
- **Return SSE events**: All endpoints return SSE streams (Content-Type: `text/event-stream`)

### No business logic

API routes are thin — they delegate to services and only handle:
- Input validation
- SSE stream setup and response headers
- Error categorization (rate limit vs. GitHub error vs. generic)
- Cache checking (explain endpoint)
- Cache pruning (opportunistic)

---

## 2. Analysis Orchestration (`lib/github/analyze-repository.ts`)

The orchestrator for the repository analysis workflow.

### Responsibilities

- **URL parsing**: Parse GitHub URL into `{ owner, repo }` via `lib/github/parse-url.ts`
- **Parallel fetching**: Fetch repository metadata + HEAD file tree simultaneously
- **Important file identification**: Scan file tree for README, manifest, Docker, entry point files
- **Parallel file fetching**: Fetch all important files at once
- **Technical analysis**: Call `analyzeTechnicalFacts()` to extract deterministic facts
- **AI understanding**: Call `generateUnderstanding()` to get AI-generated project understanding
- **Profile building**: Call `buildProfile()` to combine all sources into a `ProjectProfile`
- **Disk caching**: Check `getCachedAnalysis()` before work, write `setCachedAnalysis()` after
- **Progress callbacks**: Emit `ProgressStep` events (`"Fetching repository metadata..."`, `"Analyzing technical facts..."`, `"Generating project understanding..."`, `"Complete"`)

### Progress Steps

```typescript
export type ProgressStep =
  | "Fetching repository metadata..."
  | "Scanning file tree..."
  | "Analyzing technical facts..."
  | "Generating project understanding..."
  | "Complete";
```

### Note on "Services Layer"

The original architecture planned an "Analysis Service" in `lib/services/`. This directory exists (`lib/services/index.ts`) but is an **empty stub**. All orchestration logic lives in `lib/github/analyze-repository.ts`.

---

## 3. GitHub Service (`lib/github/`)

Responsible only for GitHub API communication.

### Files

| File | Responsibility |
|------|---------------|
| `parse-url.ts` | Parse GitHub URLs into `{ owner, repo }` |
| `fetch-repository.ts` | Fetch repository metadata (`GET /repos/{owner}/{repo}`) |
| `fetch-tree.ts` | Fetch recursive file tree (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`) |
| `fetch-file.ts` | Fetch file contents (`GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`) |
| `identify-important-files.ts` | Scan tree for README, manifest, Docker, entry point files |
| `errors.ts` | `GitHubError` class and `GitHubErrors` factory |
| `analyze-repository.ts` | Orchestration (see component #2) |

### Responsibilities

- Fetch repository metadata (name, owner, URL, default branch)
- Fetch file tree (recursive)
- Fetch specific file contents (base64 → UTF-8 decoding)
- Identify important files from the tree (README, manifest, Docker, entry point)
- Throw typed errors (`GitHubError` with status codes for 404, 403 rate limit, network failures)

### Authentication
- Uses `GITHUB_TOKEN` from environment variables (Bearer token)
- Falls back to unauthenticated requests
- All requests have a timeout (5s for repo/file, 8s for tree) via `AbortController`

---

## 4. Light Analyzer (`lib/analyzer/`)

Performs deterministic analysis. **No AI involved.**

### Files

| File | Responsibility |
|------|---------------|
| `manifest-parser.ts` | Detect language + framework from `go.mod`, `package.json`, `requirements.txt` |
| `docker-parser.ts` | Detect Docker usage from `Dockerfile`, `docker-compose.yml` |
| `analyze.ts` | Orchestrates both parsers in parallel to produce `TechnicalFacts` |
| `index.ts` | Exports all parsers and `analyzeTechnicalFacts()` |

### Supported Languages

- Go (`go.mod` → Gin, Echo, Fiber, Chi, Gorilla Mux)
- JavaScript (`package.json` → Next.js, Express, Vue, Angular, Svelte, Fastify, React)
- TypeScript (`package.json` → same as JS, with `typescript` or `@types/*` detection)
- Python (`requirements.txt` → Django, Flask, FastAPI, Tornado)

### Manifest Detection Patterns

- `go.mod`
- `package.json`
- `requirements.txt`
- `Cargo.toml`
- `composer.json`
- `Gemfile`
- `build.gradle`
- `pom.xml`

### Docker Detection Patterns

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.yaml`

### Entry Point Patterns

- `main.go`, `cmd/main.go`
- `index.js`, `app.js`, `server.js`, `cli.js`
- `index.ts`, `main.ts`, `server.ts`
- `main.py`, `app.py`

---

## 5. AI Service (`lib/ai/`)

Responsible for **every Groq API interaction**.

### Files

| File | Responsibility |
|------|---------------|
| `ai-client.ts` | OpenAI-compatible client (defaults to Groq) |
| `generate-understanding.ts` | Generate project understanding (JSON response, 2 retries) |
| `generate-explanation.ts` | Generate audience explanation (JSON + streaming variants, 2 retries with repair prompt) |
| `answer-chat.ts` | Answer chat questions (streaming + non-streaming, 32768 max tokens) |
| `choose-files.ts` | AI determines if source files are needed for a question |
| `rate-limit.ts` | `RateLimitError`, `isRateLimitError()`, `getRetryAfterSeconds()` |
| `errors.ts` | `AIError` class and `AIErrors` factory |
| `mermaid-utils.ts` | `stripCodeFences()`, `sanitizeMermaid()`, `isValidMermaid()`, `buildFallbackDiagram()` |
| `explanation-cache.ts` | In-memory explanation cache (30 min TTL) |
| `chat-cache.ts` | In-memory caches for file tree, file content, file selection (30 min TTL) |
| `index.ts` | Barrel exports |

### Configuration

- **API key**: `AI_API_KEY` or `GROQ_API_KEY` (env var)
- **Base URL**: `AI_BASE_URL` (default: `https://api.groq.com/openai/v1`)
- **Model**: `AI_MODEL` (default: `llama-3.3-70b-versatile`)
- Uses the `openai` npm package with a custom `baseURL`

### Responsibilities

#### Generate project understanding (`generate-understanding.ts`)
- **Input**: `repository`, `technicalFacts`, `readmeContent`, `entryPointContent`
- **Output**: `ProjectUnderstanding` with `purpose`, `mainModules` (name + description), `architectureSummary`, `keyFeatures`, `techStackDetails`, `dataFlow`
- Uses JSON response format (`response_format: { type: "json_object" }`)
- 2 retry attempts with `AbortController` timeout (50s)
- Rate-limit errors propagate immediately (no retry on 429)

#### Generate audience explanations (`generate-explanation.ts`)
- **Input**: `projectProfile`, `audience`
- **Output**: `Explanation` with `content` (plain text) + `diagram` (Mermaid `graph TD`)
- Two variants:
  - `generateExplanation()` — non-streaming JSON response with repair prompt retry
  - `streamExplanation()` — streaming with delimiter-based format (`\n---DIAGRAM---\n`), `onContent` callback for progressive display
- Both retry twice; second attempt uses a repair prompt
- Diagrams sanitized via `sanitizeMermaid()` and validated via `isValidMermaid()`
- Fallback diagram generated via `buildFallbackDiagram()` if AI output is invalid

#### Answer questions (`answer-chat.ts`)
- **Input**: `question`, `projectProfile`, `audience`, `history`, optional `codeContext`
- **Output**: `string` (streamed via `onChunk` callback)
- Two variants:
  - `streamAnswer()` — streaming (used in production)
  - `answerQuestion()` — non-streaming (used in tests + fallback)
- Uses OpenAI messages array (system + history + user)
- `max_tokens: 32768` (raised from default)
- History capped to last 10 messages
- Detects `finish_reason: "length"` for truncation notice
- Rate-limit errors propagate with `retryAfterSeconds`

#### Choose files (`choose-files.ts`)
- **Input**: `question`, `projectProfile`, `fileTree`
- **Output**: `{ needsFiles: boolean, filePaths: string[] }`
- Fast (15s timeout), non-streaming, max_tokens: 512
- Rate-limit errors propagate (not silently swallowed)
- Graceful fallback: returns `{ needsFiles: false, filePaths: [] }` on non-rate-limit failures

### AI Error Handling

- `RateLimitError`: Thrown for 429 errors; carries `retryAfterSeconds`
- `AIError`: Thrown for timeouts and generic AI failures
- `isRateLimitError()`: Detects OpenAI SDK errors with `status: 429`
- `getRetryAfterSeconds()`: Extracts retry-after from headers (`retry-after`, `x-ratelimit-reset-tokens`, `x-ratelimit-reset-requests`); defaults to 30s

---

## 6. Profile Builder (`lib/profile/`)

Assembles the final Project Profile. Pure function — no side effects.

### Files

| File | Responsibility |
|------|---------------|
| `build-profile.ts` | `buildProfile(repository, technicalFacts, understanding)` → `ProjectProfile` |
| `index.ts` | Re-exports |

### Responsibilities

Combine:
- Repository (from GitHub Service)
- Technical Facts (from Light Analyzer)
- Project Understanding (from AI Service)

Return:
- Project Profile

---

## 7. Cache (`lib/cache/` + `lib/ai/`)

### Disk Cache (`lib/cache/analysis-cache.ts`)

- Persists full `ProjectProfile` objects to `.cache/analysis/`
- 24-hour TTL
- SHA-256 hash of repo URL as cache key
- Controlled by `CACHE_ANALYSIS` env var (default: enabled)
- Used by `analyzeRepository()` — skips all work on cache hit

### In-Memory Cache (`lib/ai/explanation-cache.ts`)

- Caches `Explanation` objects per `{ owner/name, audience }`
- 30-minute TTL
- Pruned via `pruneExpired()`
- Allows instant audience switching

### Chat Cache (`lib/ai/chat-cache.ts`)

- `TimedCache<T>` class with configurable TTL
- Three caches:
  - `fileTreeCache`: `TreeItem[]` per `{ owner/repo:branch }`
  - `fileContentCache`: `string` per `{ owner/repo:path:branch }`
  - `chooseFilesCache`: `ChooseFilesResult` per `{ owner/repo:question }`
- 30-minute TTL, pruned via `pruneChatCaches()`

---

## 8. Types (`types/`)

Shared domain models. Correspond directly to the six domain models.

| File | Model |
|------|-------|
| `repository.ts` | Repository |
| `technical-facts.ts` | TechnicalFacts |
| `project-understanding.ts` | ProjectUnderstanding + ModuleInfo |
| `project-profile.ts` | ProjectProfile |
| `explanation.ts` | Explanation + Audience |
| `chat-message.ts` | ChatMessage + MessageRole |
| `index.ts` | Barrel re-exports |

---

## Dependency Rules

```
API Routes
    │
    ▼
lib/github/analyze-repository.ts
    │
    ├──► lib/github/*       (GitHub Service)
    ├──► lib/analyzer/*     (Light Analyzer)
    ├──► lib/ai/*           (AI Service)
    ├──► lib/profile/*      (Profile Builder)
    └──► lib/cache/*        (Disk Cache)
    │
    └──► types/*           (Shared domain models)
```

- API Routes call `lib/github/analyze-repository.ts` and `lib/ai/*` functions directly.
- `analyze-repository.ts` may call GitHub, Analyzer, AI, Profile Builder, and Cache.
- GitHub, Analyzer, AI, Profile, and Cache may use shared Types.
- Components never call GitHub or Groq directly — they only communicate through `/api/analyze`, `/api/explain`, and `/api/chat`.