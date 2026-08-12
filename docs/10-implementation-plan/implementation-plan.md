# Implementation Plan

SystemLens was built in vertical slices. Each phase produces working, deployable output.

---

## Phase Status

| Phase | Status | Key Deliverables Implemented |
|-------|--------|------------------------------|
| Phase 1 — Project Foundation | ✅ Complete | Next.js app, TypeScript, Tailwind CSS, folder structure, env handling, landing page |
| Phase 2 — Repository Analysis Foundation | ✅ Complete | GitHub URL parsing, repo metadata fetch, file tree fetch, file content fetch, important file identification |
| Phase 3 — Light Analyzer | ✅ Complete | Manifest parser (Go, JS/TS, Python), Docker parser, parallel analysis orchestration |
| Phase 4 — Project Profile Generation | ✅ Complete | Groq AI integration, project understanding (6 fields), profile builder |
| Phase 5 — Audience Explanation | ✅ Complete | Lazy SSE streaming, Mermaid diagram generation/sanitization/validation/fallback, in-memory caching |
| Phase 6 — Project Chat | ✅ Complete | Streaming chat, code-aware file selection, profile-question optimization, truncation detection, chat caching |
| Phase 7 — Frontend Experience | ✅ Complete | Hero section, feature cards, project profile display, audience picker, explanation view, chat interface, theme toggle, progress streaming, error handling with countdowns |
| Phase 8 — Reliability and Polish | ✅ Complete + In Progress | Rate-limit handling, error states, loading states, Mermaid zoom/fullscreen, animation, responsive design |
| Post-MVP | 🔄 In Progress | Disk-based analysis caching, profile-question optimization, truncation detection |

---

## Phase 1 — Project Foundation  ✅ Complete

### Goal
Create the application skeleton.

### Tasks Completed:
- [x] Create Next.js application (App Router)
- [x] Configure TypeScript
- [x] Configure Tailwind CSS
- [x] Create initial folder structure (`app/`, `components/`, `lib/`, `types/`, `public/`, `docs/`)
- [x] Add environment variable handling (`lib/env.ts`)
- [x] Add basic landing page
- [x] Add favicon (external URL in `layout.tsx`)

### Result:
User can open the SystemLens website with a hero section, feature cards, and repository URL input.

---

## Phase 2 — Repository Analysis Foundation  ✅ Complete

### Goal
Allow SystemLens to receive and read GitHub repositories.

### Implemented:

#### GitHub Service (`lib/github/`)

**Features:**
- [x] Parse GitHub URL (`lib/github/parse-url.ts`) — accepts `https://github.com/owner/repo` and `.git` suffixes
- [x] Get repository information (`lib/github/fetch-repository.ts`) — `GET /repos/{owner}/{repo}`
- [x] Get file tree (`lib/github/fetch-tree.ts`) — `GET /trees/{branch}?recursive=1`
- [x] Fetch specific files (`lib/github/fetch-file.ts`) — `GET /contents/{path}?ref={branch}`, base64 decoded

**Important file identification (`lib/github/identify-important-files.ts`):**
- README: `README.md` (case-insensitive)
- Manifest: `go.mod`, `package.json`, `requirements.txt`, `Cargo.toml`, `composer.json`, `Gemfile`, `build.gradle`, `pom.xml`
- Docker: `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`
- Entry point: `main.go`, `index.js`, `app.js`, `main.ts`, `index.ts`, `main.py`, `app.py`, `server.js`, `server.ts`, `cli.js`, etc.

**Supported file fetching:**
- README.md
- go.mod, package.json, requirements.txt, Cargo.toml, etc.
- Dockerfile, docker-compose.yml
- Entry point files (main.go, index.js, app.ts, etc.)

### Result:
User submits a GitHub repository URL. SystemLens fetches repository metadata, file tree, and important file contents from the GitHub API. All GitHub API calls use `GITHUB_TOKEN` when available.

---

## Phase 3 — Light Analyzer  ✅ Complete

### Goal
Extract deterministic technical facts.

### Implemented:

#### Manifest Parser (`lib/analyzer/manifest-parser.ts`)

**Detects:**
- [x] Language (Go, JavaScript, TypeScript, Python)
- [x] Framework

**Examples:**
| File | Language | Framework |
|------|----------|-----------|
| `go.mod` | Go | Gin, Echo, Fiber, Chi, Gorilla Mux |
| `package.json` | JavaScript / TypeScript | Next.js, React, Express, Vue, Angular, Svelte, Fastify |
| `requirements.txt` | Python | Django, Flask, FastAPI, Tornado |

#### Docker Parser (`lib/analyzer/docker-parser.ts`)

**Detects:**
- [x] Docker usage (Dockerfile with `FROM` instruction)
- [x] Docker Compose usage (`services:` key)

#### Analysis Orchestration (`lib/analyzer/analyze.ts`)

- [x] Fetches manifest + Docker files in parallel
- [x] Returns combined `TechnicalFacts { language, framework, deployment }`

### Result:
```json
{
  "language": "Go",
  "framework": "Gin",
  "deployment": "Docker"
}
```

---

## Phase 4 — Project Profile Generation  ✅ Complete

### Goal
Create the core domain object.

### Implemented:

#### AI Client (`lib/ai/ai-client.ts`)
- [x] OpenAI-compatible SDK client (defaults to Groq)
- [x] Configurable via `AI_API_KEY`/`GROQ_API_KEY`, `AI_BASE_URL`, `AI_MODEL`

#### Generate Understanding (`lib/ai/generate-understanding.ts`)
- [x] Groq API call with JSON response format
- [x] Input: repository info + technical facts + README + entry point
- [x] Output: `ProjectUnderstanding` with 6 fields:
  - `purpose` (2-3 sentences)
  - `mainModules` (3-5 modules with name + description)
  - `architectureSummary` (3-5 sentences)
  - `keyFeatures` (3-6 features)
  - `techStackDetails` (1-2 sentences)
  - `dataFlow` (2-4 sentences)
- [x] 2 retry attempts (non-rate-limit failures only)
- [x] 50s AbortController timeout
- [x] Rate-limit errors propagate immediately (no retry on 429)
- [x] Markdown code fence stripping for AI responses

#### Profile Builder (`lib/profile/build-profile.ts`)
- [x] Pure function combining Repository + TechnicalFacts + ProjectUnderstanding
- [x] Returns complete `ProjectProfile`

#### Disk Cache (`lib/cache/analysis-cache.ts`)
- [x] 24h TTL, SHA-256 key, env-gated (`CACHE_ANALYSIS`)

### Result:
Repository analysis works end-to-end. Results are cached to disk for instant re-analysis.

---

## Phase 5 — Audience Explanation  ✅ Complete

### Goal
Allow users to understand the project from different perspectives.

### Implemented:

#### Audience Selector
- [x] 5 audiences: CEO, PM, Developer, QA, Customer
- [x] Color-coded accents per audience (purple, blue, cyan, yellow, green)

#### Explanation Generation (`lib/ai/generate-explanation.ts`)
- [x] Two variants: `generateExplanation()` (JSON) and `streamExplanation()` (SSE streaming)
- [x] Input: ProjectProfile + audience
- [x] Output: `Explanation { audience, content, diagram }`
- [x] **Lazy generation**: only requested audience is generated (not all 5 in parallel)
- [x] **Repair prompt**: 2nd retry uses stricter prompt for Mermaid syntax
- [x] **Delimiter-based streaming**: content + `\n---DIAGRAM---\n` + Mermaid diagram
- [x] **Mermaid sanitization**: `sanitizeMermaid()` fixes common AI mistakes
- [x] **Mermaid validation**: `isValidMermaid()` lightweight validation
- [x] **Fallback diagram**: `buildFallbackDiagram()` generates deterministic diagram from mainModules

#### In-Memory Cache (`lib/ai/explanation-cache.ts`)
- [x] 30 min TTL, keyed by `${owner}/${name}:${audience}`
- [x] Cached explanations returned as single JSON response (not streaming)

#### Frontend (`components/explanation/index.tsx`)
- [x] Streaming content display (progressive rendering)
- [x] Loading skeleton
- [x] Key Takeaways extraction (first sentence of each paragraph)
- [x] Animated paragraph cards
- [x] MermaidDiagram with zoom + fullscreen
- [x] Rate-limit error handling with countdown + retry

### Result:
User can switch between 5 audiences. First generation streams; cached results return instantly as JSON.

---

## Phase 6 — Project Chat  ✅ Complete

### Goal
Allow users to ask questions about the analyzed repository.

### Implemented:

#### Chat Context
- [x] Frontend stores chat messages in React state (per session, no persistence)
- [x] No database, no authentication
- [x] Conversation history sent to backend, capped to last 10 messages

#### General Questions
- [x] Profile-question heuristic (`isProfileQuestion()`) skips `chooseFiles` AI call
- [x] Uses ProjectProfile + question for AI answer
- [x] Streaming response via SSE `chunk` events
- [x] `max_tokens: 32768`

#### Code Questions
Flow:
```
Question
    ↓
isProfileQuestion()?
    ├── YES → Skip chooseFiles, stream answer
    └── NO  → chooseFiles AI call
                 ↓
              GitHub API (fetch files, cached)
                 ↓
              Groq AI answer with code context
```

#### Performance Optimizations
- [x] `isProfileQuestion()` heuristic saves ~1-2s per chat message
- [x] File tree cache (30 min TTL, per repo/branch)
- [x] File content cache (30 min TTL, per file path)
- [x] File selection cache (30 min TTL, per question)
- [x] 30s hard timeout on pre-answer phase only (streaming answer unbounded)
- [x] Truncation detection (`finish_reason: "length"` → `truncated` SSE event)

#### Chat Cache (`lib/ai/chat-cache.ts`)
- [x] `TimedCache<T>` class
- [x] Three caches: fileTree, fileContent, chooseFiles

#### Frontend (`components/chat/index.tsx`)
- [x] Streaming message display with `requestAnimationFrame` batching
- [x] Suggested questions (empty state)
- [x] Code block rendering (`renderCodeBlocks()`) with streaming-safe unclosed fence handling
- [x] Multi-line textarea (Enter to send, Shift+Enter for newline)
- [x] Auto-scroll to bottom
- [x] Truncation notice (amber banner)
- [x] Rate-limit error handling with countdown + retry
- [x] Status indicators during pre-answer phase

### Result:
User can ask general questions (fast, no file fetch) or code questions (fetches relevant source files) and get streaming answers.

---

## Phase 7 — Frontend Experience  ✅ Complete

### Goal
Connect all backend capabilities into the user journey.

### Implemented:

#### Components
- [x] `app/page.tsx` — Main page orchestrating analysis, explanation, and chat
- [x] `components/audience-picker/index.tsx` — Color-coded audience selector
- [x] `components/explanation/index.tsx` — Streaming explanation view with diagram
- [x] `components/chat/index.tsx` — Chat interface with streaming + code blocks
- [x] `components/mermaid-diagram/index.tsx` — Lazy-loaded Mermaid rendering with zoom/focus
- [x] `components/repository-input/index.ts` — **Stub** (empty)
- [x] `components/project-profile/index.ts` — **Stub** (empty)
- [x] `components/ui/index.ts` — **Stub** (empty)

#### Pages/Components
```
Landing Page  ──► Analysis Progress (SSE) ──► Profile Display
                                          ├──► Audience Selection
                                          ├──► Explanation View
                                          └──► Chat Interface
```

#### Features Added
- [x] Loading states (analysis spinner, explanation skeleton, chat status)
- [x] Error states (banner with retry + countdown for rate limits)
- [x] Mermaid rendering (lazy-loaded, zoom 0.5x–3x, fullscreen with Escape to exit)
- [x] Responsive design (glass-morphism UI, mobile-friendly grid)
- [x] Theme toggle (light/dark mode with system preference detection + localStorage)
- [x] Hero image (external URL from `i.ibb.co`)
- [x] "What You Get" feature cards
- [x] "Explore This Project" CTA with scroll-to-section
- [x] Analysis complete banner
- [x] Technical facts display (color-coded dots per category)
- [x] Project understanding sections (Purpose, Key Features, Main Modules, Architecture, Tech Stack, Data Flow)
- [x] Key Takeaways callout in explanation view

### Result:
Complete user journey from landing page to analysis to explanation to chat.

---

## Phase 8 — Reliability and Polish  ✅ Complete + 🔄 In Progress

### Goal
Make the MVP stable.

### Error Handling:
- [x] Invalid GitHub URLs (400 Bad Request with JSON error)
- [x] Private repositories (GitHub 404 → "Repository not found")
- [x] Missing files (graceful defaults — "Unknown" / "None")
- [x] Unsupported languages (parser returns "Unknown" framework)
- [x] Gemini/Groq failures (retry with repair prompt, fallback diagram, best-effort content)
- [x] GitHub API failures (GitHubError with status codes, network errors with timeouts)
- [x] Rate-limit handling (RateLimitError with retryAfterSeconds, countdown timers, disabled retry)
- [x] Analysis timeout (60s hard timeout → error message)
- [x] Chat pre-answer timeout (30s → error message)
- [x] Token truncation (detect `finish_reason: "length"` → truncate notice)

### Improved:
- [x] Error messages (typed errors: GitHubError, AIError, RateLimitError)
- [x] Loading experience (progress steps streamed via SSE)
- [x] UI consistency (glass-morphism design system, color-coded accents)

### Completed (from TODO.md):
- [x] Milestone 1: Light-theme profile text visibility
- [x] Milestone 3: Favicon (external URL in layout.tsx)
- [x] Milestone 4: Compact "Explore This Project" at top

### In Progress (from TODO.md):
- [x] Milestone 2: Rate-limit handling (create rate-limit.ts, catch 429 in all AI functions, emit retryAfterSeconds in routes, show countdown in frontend)
- [x] Milestone 5: Complete chat responses (max_tokens raised to 32768, renderCodeBlocks for unclosed fences)
- [ ] TODO.md verification items: `tsc --noEmit`, `next build`, manual flow checks

---

## Final MVP Capability

After completing all phases:
A user can:

1. Open SystemLens
2. Paste a GitHub repository URL
3. SystemLens analyzes the repository (with real-time progress)
4. Generates a Project Profile (tech stack, purpose, architecture, key features, data flow)
5. User chooses from: CEO, PM, Developer, QA, Customer
6. SystemLens explains the project (streamed text + Mermaid diagram)
7. User views Mermaid diagrams (with zoom + fullscreen)
8. User asks questions about the project (streaming answers, code-aware when needed)

### Additional Capabilities Beyond Original MVP
- Rate-limit aware with countdown timers and retry
- Disk-based analysis caching (re-analyze same repo instantly)
- In-memory explanation caching (instant audience switching)
- Profile-question optimization (skip file fetch for general questions)
- Truncation detection and user guidance
- Light/dark theme toggle

---

## Implementation Order Diagram

```
Project Setup          (Phase 1) ✅
      │
      ▼
GitHub Integration     (Phase 2) ✅
      │
      ▼
Light Analyzer         (Phase 3) ✅
      │
      ▼
Groq Integration      (Phase 4) ✅
      │
      ▼
Project Profile        (Phase 4) ✅
      │
      ▼
Audience Explanation   (Phase 5) ✅
      │
      ▼
Chat                  (Phase 6) ✅
      │
      ▼
UI Polish + Reliability + Caching + Rate Limiting  (Phases 7-8 + Post-MVP) ✅