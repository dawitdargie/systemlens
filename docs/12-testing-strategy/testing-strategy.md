# Testing Strategy

SystemLens uses a **layered testing strategy** with **Vitest** as the sole test runner.

```
Unit Tests
    │
    ▼
Integration Tests
    │
    ▼
API Contract Tests
```

Each layer verifies a different responsibility. No Postman or Playwright is currently configured — all tests run through Vitest.

---

## Tooling

| Purpose | Tool |
| :--- | :--- |
| Unit Testing | Vitest |
| Integration Testing | Vitest |
| API Testing | Vitest (mocked) |
| Code Quality | ESLint |
| Type Checking | TypeScript (`tsc --noEmit`) |
| Build Verification | `next build` |

---

## 1. Unit Testing

### Goal
Test individual pieces of logic independently.

**Focus:**
- Manifest parser (language + framework detection)
- Docker parser (Docker usage detection)
- Technical facts analysis (parallel orchestration)
- Profile builder (pure function)
- URL parser (GitHub URL validation)
- Important file identification (tree scanning)

### Existing Test Files

| Test File | Module Under Test | Tests |
|-----------|-------------------|-------|
| `lib/analyzer/manifest-parser.test.ts` | `lib/analyzer/manifest-parser.ts` | parseGoMod, parsePackageJson, parseRequirementsTxt, parseManifest |
| `lib/analyzer/docker-parser.test.ts` | `lib/analyzer/docker-parser.ts` | parseDockerfile, parseDockerCompose, parseDocker |
| `lib/analyzer/analyze.test.ts` | `lib/analyzer/analyze.ts` | analyzeTechnicalFacts (parallel manifest + Docker fetch) |
| `lib/github/parse-url.test.ts` | `lib/github/parse-url.ts` | parseGitHubUrl (valid URLs, `.git` suffix, invalid URLs) |
| `lib/github/identify-important-files.test.ts` | `lib/github/identify-important-files.ts` | identifyImportantFiles (README, manifest, Docker, entry point detection) |
| `lib/profile/build-profile.test.ts` | `lib/profile/build-profile.ts` | buildProfile (combines repo + facts + understanding) |
| `lib/github/analyze-repository.test.ts` | `lib/github/analyze-repository.ts` | analyzeRepository (full pipeline with mocked dependencies, caching, parallel fetch, error propagation) |
| `lib/ai/generate-understanding.test.ts` | `lib/ai/generate-understanding.ts` | generateUnderstanding (AI response parsing, JSON validation, retries, rate-limit propagation) |
| `lib/ai/generate-explanation.test.ts` | `lib/ai/generate-explanation.ts` | generateExplanation + streamExplanation (content/diagram parsing, sanitization, fallback, retries) |
| `lib/ai/answer-chat.test.ts` | `lib/ai/answer-chat.ts` | streamAnswer + answerQuestion + buildMessages + capHistory (history capping, system prompt, truncation, rate-limit) |
| `lib/ai/choose-files.test.ts` | `lib/ai/choose-files.ts` | chooseFiles (file selection logic, JSON parsing, graceful fallback on errors, rate-limit propagation) |

### Components to Test

#### Manifest Parser
**Input:**
- `go.mod`
- `package.json`
- `requirements.txt`

**Expected output:**
- Language
- Framework

**Example:**
`go.mod`

**Output:**
- **Language:** Go
- **Framework:** Gin

#### Docker Parser
**Input:**
- `Dockerfile`
- `docker-compose.yml`

**Expected:**
- Deployment ("Docker" or "None")

#### Technical Facts Analyzer (`analyze.ts`)
**Input:**
- ImportantFiles (manifest path + content, docker path + content)

**Expected:**
- `TechnicalFacts { language, framework, deployment }`

**Tests should verify:**
- Parallel fetching of manifest + Docker files
- Graceful defaults when files are missing ("Unknown" / "None")
- Error handling when file fetch fails

#### Profile Builder
**Input:**
- Repository
- Technical Facts
- Project Understanding

**Expected:**
- Project Profile

#### URL Parser
**Input:**
- GitHub repository URLs (various formats)

**Expected:**
- `{ owner, repo }` or throws error for invalid URLs

#### Important File Identification
**Input:**
- File tree (`TreeItem[]`)

**Expected:**
- `{ readme, manifest, docker, entryPoint }` (paths or null)

---

## 2. Integration Testing

### Goal
Verify that internal components communicate correctly.

### Analysis Pipeline Test

**Test:**
```
GitHub Service (fetchRepository, fetchRepositoryTree, fetchFileContent)
        │
        ▼
Light Analyzer (analyzeTechnicalFacts → manifest parser + docker parser)
        │
        ▼
AI Service (generateUnderstanding)
        │
        ▼
Profile Builder (buildProfile)
```

**Mocked dependencies:**
- GitHub API calls (fetchRepository, fetchRepositoryTree, fetchFileContent)
- AI calls (generateUnderstanding)
- Disk cache (getCachedAnalysis returns null)

**Expected:**
```
Repository URL
    │
    ▼
Project Profile
```

**Test file:** `lib/github/analyze-repository.test.ts`

**Cases covered:**
- Valid URL → complete ProjectProfile
- Invalid URL → throws "Invalid GitHub repository URL."
- Repository not found → propagates GitHubError
- AI failure → throws with descriptive error
- Important files fetched in parallel (README + entry point verified)

---

## 3. API Testing

### Goal
Verify API contracts match the actual implementation.

**Note:** All API tests are done with Vitest using mocked external dependencies (no live HTTP calls).

#### `POST /api/analyze`

**Test input:**
```json
{
  "repositoryUrl": "https://github.com/example/project"
}
```

**Expected SSE events:**
```
{ "type": "progress", "step": "Fetching repository metadata..." }
{ "type": "progress", "step": "Complete" }
{ "type": "result", "data": { ...ProjectProfile } }
```

**Error cases:**
- Missing `repositoryUrl` → 400 JSON error
- Invalid URL → 400 JSON error
- GitHub 404 → SSE error event
- Rate limit (429 from Groq) → SSE error event with `retryAfterSeconds`
- Timeout (60s) → SSE error event

#### `POST /api/explain`

**Test input:**
```json
{
  "projectProfile": { "...": "..." },
  "audience": "Developer"
}
```

**Expected (cached):**
```json
{
  "explanation": "...",
  "diagram": "...",
  "cached": true
}
```

**Expected (streaming):**
```
{ "type": "chunk", "content": "..." }
{ "type": "diagram", "diagram": "..." }
{ "type": "done" }
```

**Error cases:**
- Missing projectProfile → 400
- Invalid audience → 400
- Rate limit → SSE error with `retryAfterSeconds`

#### `POST /api/chat`

**Test input:**
```json
{
  "projectProfile": { "...": "..." },
  "audience": "Developer",
  "history": [],
  "question": "Explain authentication"
}
```

**Expected SSE events:**
```
{ "type": "status", "step": "Analyzing question..." }
{ "type": "chunk", "content": "..." }
{ "type": "done" }
```

**Error cases:**
- Missing projectProfile → 400
- Missing question → 400
- Invalid JSON body → 400
- Rate limit → SSE error with `retryAfterSeconds`
- Timeout (30s pre-answer) → SSE error

---

## 4. Error Testing

SystemLens must handle failures gracefully.

### Invalid GitHub URL
**Example:**
`github.com/wrong/url`

**Expected:**
`Invalid GitHub repository URL.`

### Invalid URL Format (missing owner/repo)
**Example:**
`https://github.com/only-owner`

**Expected:**
`Invalid GitHub repository URL.`

### Repository Not Found
**Example:**
`https://github.com/nonexistent/nonexistent`

**Expected:**
`Repository not found.`

### Missing Files
**Example:**
Repository has no:
- README
- Manifest
- Dockerfile
- Entry point

**Expected:**
- `language`: "Unknown"
- `framework`: "Unknown"
- `deployment`: "None"
- Analysis proceeds with limited information
- AI understanding generated from whatever data is available

### Unsupported Repository
**Example:**
Unknown language (no recognized manifest file)

**Expected:**
- Technical facts: "Unknown", "Unknown", "None"
- Analysis continues with README-only context
- AI understanding based on README + repository metadata

### Groq/Gemini Failure
**Expected:**
```
Rate limit:
  { "type": "error", "error": "...", "retryAfterSeconds": 60 }

AI failure:
  Error with retry, fallback diagram, or best-effort content
```

### GitHub API Failure
**Expected:**
```
{ "type": "error", "error": "Unable to retrieve repository information." }
```

### Analysis Timeout
**Expected (60s exceeded):**
```
{ "type": "error", "error": "Analysis timed out after 60 seconds..." }
```

### Chat Pre-Answer Timeout
**Expected (30s exceeded during tree fetch or file selection):**
```
{ "type": "error", "error": "Request timed out while preparing the response." }
```

### Token Truncation
**Expected (response hits max_tokens):**
```
{ "type": "truncated" }
```

---

## Performance Testing

### Goal
Ensure the MVP feels responsive.

### Measure:

#### Repository Analysis
**Target:**
Few seconds for normal repositories (GitHub API + Groq inference)
- File tree fetch: parallelizable with metadata
- Important files fetched in parallel
- Disk cache: instant for re-analysis (24h TTL)

#### API Response (SSE)
**Monitor:**
- `/api/analyze` — progress events every 1-2s
- `/api/explain` — streaming chunks as AI generates text
- `/api/chat` — status events during pre-answer, then streaming

#### Large Repository Handling
**Verify:**
- Large file trees (recursive=1 may be truncated by GitHub API)
- Missing important files (graceful defaults)
- Excessive file size (README truncated to 1500 chars, entry point to 800 chars)

---

## Security Testing

### Verify:

#### API Keys
**Check:**
- Groq API Key (`GROQ_API_KEY` or `AI_API_KEY`)
- GitHub Token (`GITHUB_TOKEN`)

**Never appear in:**
- ❌ Browser
- ❌ Client code
- ❌ Responses
- ❌ Error messages (stripped to generic messages)

#### User Input
**Validate:**
- GitHub URL format (must be `github.com/owner/repo`)
- Request body (JSON parsing with error handling)
- Audience values (must be one of: CEO, PM, Developer, QA, Customer)
- Question content (must be non-empty after trimming)
- Project Profile structure (must contain `repository` and `understanding`)

#### Cache Safety
**Verify:**
- Disk cache does not store API keys or tokens
- In-memory caches only store AI responses and file contents (no secrets)

---

## Test Execution

```bash
# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest

# Run specific test file
npx vitest run lib/ai/choose-files.test.ts

# Type checking
npx tsc --noEmit

# Lint
npx eslint .

# Build (also verifies compilation)
npm run build
```

---

## MVP Testing Status

| Test Layer | Status |
|-----------|--------|
| Unit Tests (manifest, docker, URL parser, file identification, profile builder) | ✅ Implemented |
| Unit Tests (AI functions: generate-understanding, generate-explanation, answer-chat, choose-files) | ✅ Implemented |
| Integration Tests (analyze-repository with mocked dependencies) | ✅ Implemented |
| API Contract Tests (SSE event format verification) | ⚠️ Partial (covered by integration tests with mocks) |
| Error Testing (URL validation, GitHub errors, rate-limit, timeout, truncation) | ✅ Covered in unit + integration tests |
| E2E Testing (full user journey) | ❌ Not implemented |
| Performance Testing (benchmarks) | ❌ Not implemented |
| Security Testing (API key exposure) | ✅ Code review verified |