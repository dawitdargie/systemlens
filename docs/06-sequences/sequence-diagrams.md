# Sequence Diagrams

This document describes the runtime interactions between SystemLens components.

## Covered Workflows

1. Repository Analysis
2. Audience Explanation
3. Project Chat
4. Rate-Limit Error Handling
5. Cache Hit Optimization

---

## 1. Repository Analysis

**Triggered by:** `POST /api/analyze`

**Purpose:**
- Retrieve repository information
- Extract technical facts
- Generate project understanding
- Build the Project Profile
- Stream progress + result to the client

### Sequence

```
Browser          Backend          GitHub API        Light Analyzer     Groq API         Profile Builder
   │               │                  │                │                 │                │
   │ POST /api/analyze                │                │                 │                │
   │──────────────►│                  │                │                 │                │
   │               │ getCachedAnalysis│                │                 │                │
   │               │───no hit──►      │                │                 │                │
   │               │                  │                │                 │                │
   │               │ SSE: progress    │                │                 │                │
   │               │ "Fetching..."    │                │                 │                │
   │               │                  │ GET /repos     │                │                 │
   │               │                  │───async────►   │                 │                 │
   │               │                  │ GET /trees     │                 │                 │
   │               │                  │───async────►   │                 │                 │
   │               │                  │                │                 │                 │
   │               │ parseGitHubUrl() │                │                 │                 │
   │               │ identifyImportantFiles()         │                │                 │
   │               │                  │ GET /contents  │                 │                 │
   │               │                  │───parallel──►  │                 │                 │
   │               │                  │                │                 │                 │
   │               │ SSE: progress    │                │                 │                 │
   │               │ "Analyzing..."   │                │                 │                 │
   │               │                  │                │ parseManifest() │                 │
   │               │                  │                │ parseDocker()   │                 │
   │               │                  │                │───parallel──►    │                 │
   │               │ analyzeTechnicalFacts()          │                 │                 │
   │               │                  │                │                 │                 │
   │               │ SSE: progress    │                │                 │                 │
   │               │ "Generating..."  │                │                 │                 │
   │               │                  │                │                 │ POST /chat     │
   │               │                  │                │                 │────async──►     │
   │               │                  │                │                 │                 │
   │               │                  │                │                 │    AI Response   │
   │               │                  │                │                 │◄───async────     │
   │               │ generateUnderstanding()           │                 │                 │
   │               │                  │                │                 │                 │
   │               │ buildProfile()                          │                 │                 │
   │               │◄──────────────────│                │                 │                 │
   │               │                  │                │                 │                 │
   │               │ setCachedAnalysis()                │                 │                 │
   │               │                  │                │                 │                 │
   │ SSE: { type: "result", data }    │                │                 │                 │
   │◄──────────────│                  │                │                 │                 │
   │               │                  │                │                 │                 │
```

### Optimization: Parallel Fetching
- Repository metadata and HEAD file tree are fetched **simultaneously** via `Promise.all`
- All important files (README, manifest, Docker, entry point) are fetched **in parallel** after tree analysis
- Manifest and Docker parsing happen **in parallel** inside `analyzeTechnicalFacts()`

---

## 2. Audience Explanation

**Triggered by:** `POST /api/explain`

**Purpose:** Generate an explanation tailored to:
- CEO
- PM
- Developer
- QA
- Customer

Using the existing Project Profile.

### Sequence

```
Browser         Backend          Explanation Cache      Groq API
   │              │                   │                   │
   │ POST /api/explain                │                   │
   │──────────────►│                   │                   │
   │              │ getCachedExplanation()               │
   │              │                   │                   │
   │              │─── HIT ──►        │                   │
   │              │                   │                   │
   │ SSE: JSON {explanation, diagram, cached: true}       │
   │◄──────────────│                   │                   │
   │              │                   │                   │
   │              │─── MISS ─►       │                   │
   │              │                   │                   │
   │              │ SSE: {type: "chunk", content: ...}     │
   │◄──────────────│                   │                   │
   │              │ streamExplanation()                   │
   │              │                   │                   │
   │              │                   │ POST /chat (stream)     │
   │              │                   │────async──►            │
   │              │                   │                       │
   │              │                   │    AI stream           │
   │              │                   │◄───async────            │
   │              │ sanitizeMermaid() isValidMermaid()        │
   │              │                   │                       │
   │              │─── Valid diagram ──► use AI diagram        │
   │              │─── Invalid ──► buildFallbackDiagram()      │
   │              │                   │                       │
   │              │ cacheExplanation()                        │
   │              │                   │                       │
   │ SSE: { type: "diagram", diagram: "..." }                  │
   │◄──────────────│                   │                       │
   │ SSE: { type: "done" }              │                       │
   │◄──────────────│                   │                       │
```

### Key Design Points
- **Lazy generation**: Only the requested audience is generated (not all 5 in parallel)
- **Delimiter-based streaming**: Content + `---DIAGRAM---` delimiter + Mermaid diagram
- **Retry with repair prompt**: Second attempt uses a stricter prompt emphasizing Mermaid syntax constraints
- **Fallback diagram**: Deterministic diagram built from `mainModules` if AI output is invalid

---

## 3. Project Chat

**Triggered by:** `POST /api/chat`

**Purpose:** Answer project-related and code-related questions.

### Sequence

```
Browser         Backend          Chat Caches      Groq API       GitHub API
   │              │                   │              │               │
   │ POST /api/chat                  │              │               │
   │──────────────►│                   │              │               │
   │              │ validate input                    │               │
   │              │ setPreAnswerTimeout(30s)         │               │
   │              │                   │              │               │
   │              │ SSE: {type: "status", step: "Analyzing question..."}│
   │◄──────────────│                   │              │               │
   │              │                   │              │               │
   │              │ buildTreeCacheKey()               │               │
   │              │ fileTreeCache.get()               │               │
   │              │                   │              │               │
   │              │── MISS ──► fetchRepositoryTree()  │               │
   │              │                   │              │ GET /trees   │
   │              │                   │               │────►         │
   │              │                   │               │◄────         │
   │              │ fileTreeCache.set()               │               │
   │              │                   │              │               │
   │              │ isProfileQuestion()?              │               │
   │              │                   │              │               │
   │              ├─── YES ──► Skip chooseFiles      │               │
   │              │                   │              │               │
   │              └─── NO ───► chooseFilesCache.get()│               │
   │              │                   │              │               │
   │              │── MISS ──► chooseFiles()        │               │
   │              │                   │              │ POST /chat   │
   │              │                   │               │────►         │
   │              │                   │               │◄────         │
   │              │ chooseFilesCache.set()          │               │
   │              │                   │              │               │
   │              │ needsFiles?                     │               │
   │              │                   │              │               │
   │              ├─── false ──► streamAnswer()      │               │
   │              │                   │              │ POST /chat   │
   │              │                   │               │────►         │
   │              │                   │               │◄────         │
   │              │                   │              │               │
   │              └─── true ───► fetch selected files│               │
   │              │                   │              │ GET /contents│
   │              │                   │               │────►         │
   │              │                   │               │◄────         │
   │              │                   │              │               │
   │              │ clearPreAnswerTimeout()           │               │
   │              │                   │              │               │
   │              │ streamAnswer() with codeContext   │               │
   │              │                   │              │ POST /chat   │
   │              │                   │               │────►         │
   │              │ SSE: {type: "chunk", content: ...}│               │
   │◄──────────────│                   │              │◄────         │
   │              │                   │              │               │
   │              │ SSE: {type: "done"}               │               │
   │◄──────────────│                   │              │               │
```

### Profile-Question Optimization

The `isProfileQuestion()` heuristic detects questions that can be answered from the project profile alone:
- Keywords: "what is this project", "what does this project do", "what is the purpose", "architecture", "overview", "summary", "tech stack", "technologies", "key features", "main modules", "data flow", "how does it work", "what is it", "high level", "audience", "deployment"

When matched, the `chooseFiles` AI round-trip is skipped, saving ~1-2s of latency.

### Performance Optimizations
- File tree fetched once per repo, cached for 30 min
- File contents cached per file path
- File selection results cached per question
- History capped to last 10 messages
- max_tokens: 32768
- 30s timeout only guards pre-answer phase (tree + selection + fetch)

---

## 4. Rate-Limit Error Handling

### Sequence (Analyze, Explain, or Chat)

```
Groq API        Backend (route)        Frontend
   │                 │                   │
   │ HTTP 429        │                   │
   │◄───error──       │                   │
   │                 │                   │
   │                 │ isRateLimitError()│                   │
   │                 │                   │                   │
   │                 │ getRetryAfterSeconds()              │
   │                 │   (from headers: retry-after,        │
   │                 │    x-ratelimit-reset-tokens,         │
   │                 │    x-ratelimit-reset-requests)       │
   │                 │    defaults to 30s                   │
   │                 │                   │                   │
   │                 │ SSE: { type: "error",                   │
   │                 │   error: "...", retryAfterSeconds: N } │
   │                 │──────────────────►│                   │
   │                 │                   │ Show error +      │
   │                 │                   │ countdown timer   │
   │                 │                   │ Disable retry     │
   │                 │                   │ button until 0    │
```

---

## 5. Cache Hit Optimization

### Disk Cache (Analysis)

```
Browser         Backend          Disk Cache
   │              │                   │
   │ POST /api/analyze                │
   │──────────────►│                   │
   │              │ getCachedAnalysis()│
   │              │                   │
   │              │── HIT ──► return cached profile
   │              │                   │
   │ SSE: {type: "progress", step: "Complete"}    │
   │◄──────────────│                   │
   │ SSE: {type: "result", data}      │
   │◄──────────────│                   │
```

### In-Memory Cache (Explanation + Chat)

```
Browser         Backend          In-Memory Cache
   │              │                   │
   │ POST /api/explain                │
   │──────────────►│                   │
   │              │ getCachedExplanation()│ (or fileTreeCache, etc.)
   │              │                   │
   │              │── HIT ──► return JSON immediately
   │              │                   │
   │ SSE: JSON {explanation, diagram, cached: true}
   │◄──────────────│                   │
```

### Cache TTLs

| Cache | Location | TTL | Key |
|-------|----------|-----|-----|
| Analysis | `.cache/analysis/` (disk) | 24h | SHA-256 of repo URL |
| Explanations | In-memory (server) | 30min | `${owner}/${name}:${audience}` |
| File Tree | In-memory (server) | 30min | `${owner}/${repo}:${branch}` |
| File Content | In-memory (server) | 30min | `${owner}/${repo}:${path}:${branch}` |
| File Selection | In-memory (server) | 30min | `${owner}/${repo}:${question}` |

> **Note**: In-memory caches are per-serverless-function-instance. Cold starts on Vercel clear them. Only disk cache persists across invocations (but is limited by Vercel's ephemeral filesystem).