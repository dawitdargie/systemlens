# Top-Level Structure

```
systemlens/
│
├── app/
├── components/
├── lib/
├── public/
├── docs/
├── types/
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
└── README.md
```

## Project Structure Diagram

```
systemlens
│
├── app
├── components
├── lib
├── types
├── public
└── docs
```

## app/

Contains the Next.js application (App Router).

```
app
│
├── api
├── globals.css
├── layout.tsx
└── page.tsx
```

### Responsibilities

- Pages (`page.tsx`)
- API Routes (`api/`)
- Root layout (`layout.tsx`)
- Global styles (`globals.css`)

## app/api

Exactly the three routes:

```
app/api
│
├── analyze/
│   └── route.ts
├── explain/
│   └── route.ts
└── chat/
    └── route.ts
```

### Notes

- All routes use **SSE streaming** (`ReadableStream` + `TextEncoder`)
- `analyze/route.ts` — 60s hard timeout on entire analysis
- `explain/route.ts` — Checks in-memory explanation cache first; returns cached JSON or streams new generation
- `chat/route.ts` — 30s pre-answer timeout (tree fetch + file selection + file fetch only); streaming answer is unbounded

## components/

Reusable UI components.

```
components
│
├── repository-input/   (stub — empty, not implemented)
├── audience-picker/    (AudiencePicker — color-coded audience selector)
├── project-profile/    (stub — empty, not implemented)
├── explanation/        (ExplanationView — streaming explanation display)
├── mermaid-diagram/    (MermaidDiagram — lazy-loaded mermaid rendering)
├── chat/               (Chat — streaming chat interface)
└── ui/                 (stub — empty, not implemented)
```

### Responsibilities

- Display
- User interaction
- SSE stream consumption
- Theme management (light/dark toggle in `page.tsx`)

Components **never** call GitHub or Groq directly. They only communicate through `/api/analyze`, `/api/explain`, and `/api/chat`.

## lib/

This is the heart of the backend. It maps to the component diagram.

```
lib
│
├── github/
├── analyzer/
├── ai/
├── profile/
├── cache/
├── services/
└── env.ts
```

## lib/github/

Implements the GitHub Service + analysis orchestration.

```
github
│
├── parse-url.ts            Parse GitHub URLs into { owner, repo }
├── fetch-repository.ts     Fetch repo metadata (GET /repos)
├── fetch-tree.ts           Fetch recursive file tree (GET /trees)
├── fetch-file.ts           Fetch file contents (GET /contents)
├── identify-important-files.ts  Scan tree for README, manifest, Docker, entry point
├── errors.ts               GitHubError class + GitHubErrors factory
├── analyze-repository.ts   Full analysis orchestration (URL → Profile)
└── index.ts                Barrel exports
```

### Responsibilities

- GitHub API communication (metadata, tree, files)
- URL parsing
- Important file identification
- Full analysis orchestration (delegates to analyzer, AI, profile, cache)
- Progress callbacks
- Disk caching integration

## lib/analyzer/

Implements the Light Analyzer (deterministic, no AI).

```
analyzer
│
├── manifest-parser.ts   Detect language + framework (go.mod, package.json, requirements.txt)
├── docker-parser.ts     Detect Docker usage (Dockerfile, docker-compose.yml)
├── analyze.ts           Parallel orchestration of both parsers → TechnicalFacts
└── index.ts             Barrel exports
```

### Responsibilities

- Parse `go.mod` → Go + framework (Gin, Echo, Fiber, Chi, Gorilla Mux)
- Parse `package.json` → JS/TS + framework (Next.js, React, Express, Vue, Angular, Svelte, Fastify)
- Parse `requirements.txt` → Python + framework (Django, Flask, FastAPI, Tornado)
- Parse `Dockerfile` → Docker detection (requires `FROM` instruction)
- Parse `docker-compose.yml/yaml` → Docker detection (requires `services:` key)
- Return combined `TechnicalFacts` object

## lib/ai/

Implements the AI Service (every Groq interaction).

```
ai
│
├── ai-client.ts           OpenAI-compatible client (defaults to Groq)
├── generate-understanding.ts  Project understanding (JSON, 2 retries, rate-limit aware)
├── generate-explanation.ts   Audience explanation (streaming + JSON, 2 retries)
├── answer-chat.ts          Chat answers (streaming, 32768 max_tokens, truncation detection)
├── choose-files.ts         AI file selection for code questions (graceful fallback)
├── rate-limit.ts           RateLimitError, isRateLimitError(), getRetryAfterSeconds()
├── errors.ts               AIError class + AIErrors factory
├── mermaid-utils.ts        Sanitize, validate, generate fallback Mermaid diagrams
├── explanation-cache.ts    In-memory explanation cache (30 min TTL)
├── chat-cache.ts           In-memory caches: fileTree, fileContent, chooseFiles (30 min TTL)
├── index.ts                Barrel exports
├── generate-understanding.test.ts
├── generate-explanation.test.ts
├── answer-chat.test.ts
└── choose-files.test.ts
```

### Responsibilities

- All Groq API communication via OpenAI SDK
- Prompt orchestration for understanding, explanation, chat, file selection
- Rate-limit error detection and propagation
- Mermaid diagram sanitization, validation, and fallback generation
- In-memory caching for explanations and chat data
- Retry logic with repair prompts (explanation only)

### Configuration

- `AI_API_KEY` or `GROQ_API_KEY` — API key
- `AI_BASE_URL` — Custom endpoint (default: Groq)
- `AI_MODEL` — Model name (default: `llama-3.3-70b-versatile`)

## lib/profile/

Implements the Profile Builder.

```
profile
│
├── build-profile.ts   Pure function: buildProfile(repo, facts, understanding) → ProjectProfile
└── index.ts           Barrel exports
```

### Responsibilities

- Combine Repository + TechnicalFacts + ProjectUnderstanding into a ProjectProfile
- Pure function — no side effects

## lib/cache/

Disk-based caching for analysis results.

```
cache
│
└── analysis-cache.ts  Disk cache for ProjectProfile (24h TTL, env-gated)
```

### Responsibilities

- `getCachedAnalysis(url)` — Read from `.cache/analysis/`
- `setCachedAnalysis(url, profile)` — Write to disk
- `clearAnalysisCache()` — Remove all cached entries
- Key: SHA-256 hash of repository URL
- Controlled by `CACHE_ANALYSIS` env var (default: enabled)

## lib/services/

**This is an empty stub.**

```
services
│
└── index.ts   (export {}; — empty, not implemented)
```

The original architecture planned an "Analysis Service" here. In the actual implementation, all orchestration logic lives in `lib/github/analyze-repository.ts`.

## lib/env.ts

Environment variable validation utility.

```ts
export function getEnvVar(name: string): string  // throws if missing
```

## types/

Shared domain models. Six models.

```
types
│
├── repository.ts             Repository { name, owner, url, defaultBranch }
├── technical-facts.ts        TechnicalFacts { language, framework, deployment }
├── project-understanding.ts  ProjectUnderstanding { purpose, mainModules, architectureSummary, keyFeatures, techStackDetails, dataFlow } + ModuleInfo { name, description }
├── project-profile.ts        ProjectProfile { repository, technicalFacts, understanding }
├── explanation.ts            Explanation { audience, content, diagram } + Audience type
├── chat-message.ts           ChatMessage { role, content } + MessageRole type
└── index.ts                  Barrel re-exports
```

## public/

Static assets.

```
public
│
├── logo.svg
├── next.svg
└── vercel.svg
```

> **Note**: No `favicon.ico` file. Favicon is set to an external URL in `app/layout.tsx` (`https://i.ibb.co/HTQ0Cc8s/System-Lens-Fav.png`).

## docs/

Architecture documentation (12 sections).

```
docs
│
├── 01-requirements/
├── 02-design/
├── 03-system-design/
├── 04-architecture/
├── 05-backend-design/
├── 06-sequences/
├── 07-api-design/
├── 08-data-model/
├── 09-project-structure/
├── 10-implementation-plan/
├── 11-deployment-design/
└── 12-testing-strategy/
```

## Dependency Rules

```
app/api/*
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

### Rules:

- API Routes may call `analyzeRepository` and `lib/ai/*` functions.
- `analyzeRepository` may call GitHub, Analyzer, AI, Profile Builder, and Cache.
- GitHub, Analyzer, AI, Profile, and Cache may use shared Types.
- Components never call GitHub or Groq directly.
- The frontend communicates only through `/api/analyze`, `/api/explain`, and `/api/chat`.