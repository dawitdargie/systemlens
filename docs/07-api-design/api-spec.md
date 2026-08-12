# API Overview

| Method | Endpoint | Transport | Purpose |
| --- | --- | --- | --- |
| POST | /api/analyze | SSE stream | Analyze a GitHub repository and build a Project Profile |
| POST | /api/explain | SSE stream / JSON (cached) | Generate (or retrieve cached) audience-specific explanation with Mermaid diagram |
| POST | /api/chat | SSE stream | Answer project and code questions with streaming text |

All endpoints use **POST** because they trigger analysis or AI generation. All requests use **JSON**. All responses use **SSE (Server-Sent Events)** streaming — see below.

---

## SSE Streaming Convention

Every endpoint returns `Content-Type: text/event-stream` (or `application/json` for cached explanations). The client reads newline-delimited JSON objects from the `ReadableStream`.

**Common event types across all endpoints:**

| Event Type | Fields | Description |
|------------|--------|-------------|
| `progress` | `step: string` | Real-time step label during long-running operations |
| `chunk` | `content: string` | A text chunk from the AI stream (explain + chat) |
| `diagram` | `diagram: string` | Mermaid diagram syntax (explain only) |
| `done` | — | Stream complete |
| `truncated` | — | Response hit the token limit (chat only) |
| `error` | `error: string`, `retryAfterSeconds?: number` | Error with optional rate-limit countdown |

**Frontend reading pattern:**
```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    // Handle event.type, event.content, event.error, etc.
  }
}
// Process any leftover line without trailing newline
```

---

## 1. POST /api/analyze

### Purpose
Analyze a public GitHub repository and return a complete `ProjectProfile` with SSE progress updates.

### Request

```http
POST /api/analyze
Content-Type: application/json
```

```json
{
  "repositoryUrl": "https://github.com/gin-gonic/gin"
}
```

### Input Validation

- `repositoryUrl` must be present and a string
- URL must be a valid GitHub repository URL (format: `https://github.com/owner/repo[.git]`)
- Invalid URL → `400 Bad Request` with JSON error body

### SSE Stream Events

```
{ "type": "progress", "step": "Fetching repository metadata..." }
{ "type": "progress", "step": "Scanning file tree..." }
{ "type": "progress", "step": "Analyzing technical facts..." }
{ "type": "progress", "step": "Generating project understanding..." }
{ "type": "progress", "step": "Complete" }
{ "type": "result", "data": { ...ProjectProfile } }
```

### Progress Steps

| Step | Description |
|------|-------------|
| `"Fetching repository metadata..."` | Fetching repo metadata + file tree from GitHub API |
| `"Scanning file tree..."` | Identifying important files (README, manifest, Docker, entry point) |
| `"Analyzing technical facts..."` | Running Light Analyzer (manifest + Docker parsing) |
| `"Generating project understanding..."` | Calling Groq AI for project understanding |
| `"Complete"` | Analysis finished, result is about to be sent |

### Final Result Event

```json
{
  "type": "result",
  "data": {
    "repository": {
      "name": "gin",
      "owner": "gin-gonic",
      "url": "https://github.com/gin-gonic/gin",
      "defaultBranch": "master"
    },
    "technicalFacts": {
      "language": "Go",
      "framework": "Gin",
      "deployment": "None"
    },
    "understanding": {
      "purpose": "Gin is a web framework for Go.",
      "mainModules": [
        { "name": "Routing", "description": "HTTP routing engine." }
      ],
      "architectureSummary": "Layered HTTP framework.",
      "keyFeatures": ["Fast", "Middleware", "JSON validation"],
      "techStackDetails": "Go with Gin for HTTP routing.",
      "dataFlow": "Request -> Router -> Handler -> Response."
    }
  }
}
```

### Error Events

#### Rate Limit (429 from Groq)

```json
{
  "type": "error",
  "error": "Rate limit hit. Try again in 1 minute.",
  "retryAfterSeconds": 60
}
```

- `retryAfterSeconds` is extracted from the API's `Retry-After` header or Groq-specific `x-ratelimit-reset-*` headers
- Defaults to 30 seconds if headers are missing

#### GitHub Error (404, 403, network)

```json
{
  "type": "error",
  "error": "Repository not found."
}
```

#### Timeout

If analysis takes longer than 60 seconds:

```json
{
  "type": "error",
  "error": "Analysis timed out after 60 seconds. The repository may be too large or the AI service is slow. Try again later."
}
```

### Backend Flow

```
Validate URL
      │
      ▼
Check disk cache (.cache/analysis/)
      │
      ├── HIT ──► Return cached ProjectProfile
      │
      └── MISS
            │
            ▼
   GitHub API (parallel: repo metadata + HEAD tree)
            │
            ▼
   Identify important files (README, manifest, Docker, entry point)
            │
            ▼
   Fetch all important files in parallel
            │
            ▼
   Light Analyzer (manifest parser + Docker parser)
            │
            ▼
   Generate Understanding (Groq AI, JSON response)
            │
            ▼
   Build Profile (pure function combines all)
            │
            ▼
   Cache to disk (setCachedAnalysis)
            │
            ▼
   Stream result to client
```

---

## 2. POST /api/explain

### Purpose

Generate an explanation for one audience using an existing `ProjectProfile`.

Uses lazy generation (only the requested audience is generated) with in-memory caching for instant audience switching.

### Supported Audiences

- CEO
- PM
- Developer
- QA
- Customer

### Request

```http
POST /api/explain
Content-Type: application/json
```

```json
{
  "projectProfile": { "...": "..." },
  "audience": "Developer"
}
```

### Input Validation

- `projectProfile` must be present and contain a `repository` object and an `understanding` object
- `audience` must be one of the supported values
- Missing/invalid → `400 Bad Request` with JSON error body

### Response Modes

#### Cached Response (JSON, not streaming)

If the explanation for this `{ repository, audience }` pair is cached in-memory (30 min TTL):

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "explanation": "SystemLens analysed the repository...",
  "diagram": "graph TD\nA[Client] --> B[API]",
  "cached": true
}
```

#### Streaming Response (SSE)

When not cached, the endpoint streams the response:

```
{ "type": "chunk", "content": "SystemLens analysed the repository and generated..." }
{ "type": "chunk", "content": " a developer-focused explanation of the codebase." }
{ "type": "diagram", "diagram": "graph TD\nA[Client] --> B[API]" }
{ "type": "done" }
```

### SSE Event Types (Explain)

| Event Type | Fields | Description |
|------------|--------|-------------|
| `chunk` | `content: string` | Progressive text content chunks as the AI streams |
| `diagram` | `diagram: string` | Mermaid diagram (sanitized, validated, with fallback) |
| `done` | — | Stream complete |
| `error` | `error: string`, `retryAfterSeconds?: number` | Error (rate limit or AI failure) |

### Diagram Generation

- AI outputs content text, then a `\n---DIAGRAM---\n` delimiter, then the Mermaid diagram
- Diagram is sanitized via `sanitizeMermaid()` (fixes arrow types, special characters, fences)
- Diagram is validated via `isValidMermaid()`
- If invalid, a deterministic fallback diagram is generated from `mainModules` via `buildFallbackDiagram()`

### Error Events

#### Rate Limit (429 from Groq)

```json
{
  "type": "error",
  "error": "Rate limit hit. Try again in 1 minute.",
  "retryAfterSeconds": 60
}
```

#### AI Failure (all retries exhausted)

```json
{
  "type": "error",
  "error": "Unable to generate explanation."
}
```

### Backend Flow

```
Validate input
      │
      ▼
Prune expired caches
      │
      ▼
Check in-memory explanation cache
      │
      ├── HIT ──► Return JSON { explanation, diagram, cached: true }
      │
      └── MISS
            │
            ▼
   streamExplanation (Groq, streaming + delimiter)
            │
            ├── onContent(chunk) ──► Emit { "type": "chunk", "content" }
            │
            ▼
   Sanitize + validate Mermaid diagram
            │
            ├── Valid ──► Use AI diagram
            └── Invalid ──► Use buildFallbackDiagram()
            │
            ▼
   Cache explanation (cacheExplanation)
            │
            ▼
   Emit { "type": "diagram", ... }
   Emit { "type": "done" }
```

---

## 3. POST /api/chat

### Purpose

Answer project-related and code-related questions with streaming text.

### Request

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "projectProfile": {
    "repository": { "owner": "...", "name": "...", "defaultBranch": "..." },
    "understanding": { "..." }
  },
  "audience": "Developer",
  "history": [
    { "role": "user", "content": "What does this project do?" },
    { "role": "assistant", "content": "..." }
  ],
  "question": "Explain the authentication middleware."
}
```

### Field Details

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectProfile` | object | Yes | Must contain `repository` and `understanding` |
| `audience` | string | No | One of CEO/PM/Developer/QA/Customer. Defaults to `"Developer"` if invalid |
| `history` | `ChatMessage[]` | No | Conversation history. Defaults to `[]` |
| `question` | string | Yes | Must be non-empty after trimming |

### Input Validation

- `projectProfile` with `repository` and `understanding` required → else `400`
- `question` required and non-empty → else `400`
- Malformed JSON body → `400` with `"Invalid request body."`

### SSE Stream Events

```
{ "type": "status", "step": "Analyzing question..." }
{ "type": "chunk", "content": "The authentication middleware..." }
{ "type": "chunk", "content": " validates incoming JWT tokens." }
{ "type": "truncated" }
{ "type": "done" }
```

### SSE Event Types (Chat)

| Event Type | Fields | Description |
|------------|--------|-------------|
| `status` | `step: string` | Status label during pre-answer phase |
| `chunk` | `content: string` | Streaming answer text |
| `truncated` | — | Response hit the token limit; answer was cut off |
| `done` | — | Stream complete |
| `error` | `error: string`, `retryAfterSeconds?: number` | Error |

### Backend Flow

#### Profile-answerable question (optimized path)

If `isProfileQuestion()` matches (question keywords: "what is this project", "architecture", "overview", "tech stack", etc.):

```
Question
    │
    ▼
isProfileQuestion() = true
    │
    ▼
Skip chooseFiles AI round-trip
    │
    ▼
Stream answer using Project Profile + Question + Code Context (empty)
```

#### Code question (full path)

If `isProfileQuestion()` does not match:

```
Question
    │
    ▼
Fetch file tree (cached per owner/repo:branch)
    │
    ▼
chooseFiles AI call (needsFiles + filePaths)
    │
    ├── needsFiles = false ──► Answer without code context
    │
    └── needsFiles = true
            │
            ▼
        Fetch selected files in parallel (cached per owner/repo:path:branch)
            │
            ▼
        streamAnswer with codeContext
```

### Performance Optimizations

- **Profile-question heuristic**: ~1-2s saved per chat message by skipping `chooseFiles` AI call
- **File tree cache**: `fileTreeCache` — 30 min TTL per `{ owner/repo:branch }`
- **File content cache**: `fileContentCache` — 30 min TTL per `{ owner/repo:path:branch }`
- **File selection cache**: `chooseFilesCache` — 30 min TTL per `{ owner/repo:question }`
- **History cap**: Only last 10 messages passed to AI (prevents context overflow)
- **max_tokens**: 32768 for answer generation
- **Pre-answer timeout**: 30s hard timeout on tree fetch + file selection + file fetch only; streaming answer is never cut off

### Error Events

#### Rate Limit (429 from Groq)

```json
{
  "type": "error",
  "error": "Rate limit hit. Try again in 1 minute.",
  "retryAfterSeconds": 60
}
```

#### GitHub API Failure

```json
{
  "type": "error",
  "error": "Unable to retrieve repository information."
}
```

#### Pre-answer timeout (30s exceeded)

```json
{
  "type": "error",
  "error": "Request timed out while preparing the response. Please try again."
}
```

### Truncation Handling

When the AI response hits the token limit (`finish_reason: "length"`):

```json
{ "type": "truncated" }
```

The frontend displays a notice: "Response was cut off because it reached the length limit. Consider asking a more specific or shorter question."

---

## API Principles

- **All endpoints use POST** because they trigger analysis or AI generation (all carry request bodies).
- **All requests and responses use JSON** (for request bodies and cached responses).
- **All streaming responses use SSE** — newline-delimited JSON objects sent as text.
- **The frontend communicates only with the Next.js backend** via the three API endpoints.
- **The backend is the only component that communicates with GitHub and Groq.**
- **API keys remain server-side** and are never exposed to the client.
- **Rate-limit errors include `retryAfterSeconds`** so clients can show countdown timers.
- **No database** — chat history lives in browser memory, explanations cached in-memory/server, analysis cached to disk.