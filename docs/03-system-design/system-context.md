# System Context Diagram

## Purpose

The System Context Diagram defines SystemLens boundaries and shows external systems interacting with it.

## External Actors

### User

Users interact with SystemLens to:
- Submit GitHub repositories
- Select explanation audiences
- Explore project understanding
- Ask questions
- Toggle light/dark theme

Supported audiences:
- CEO
- PM
- Developer
- QA
- Customer

### GitHub API

External service that provides repository information:
- Repository metadata (name, owner, description, default branch)
- File tree (recursive listing of all files)
- File contents (README, manifests, entry points, source files)

Used for:
- Fetching repository metadata
- Fetching repository file tree
- Fetching specific file contents

No authentication required, but `GITHUB_TOKEN` is recommended to avoid rate limits (60 req/hour unauthenticated vs 5,000 req/hour authenticated).

### Groq API

External AI service (OpenAI-compatible SDK) that provides AI capabilities:
- Project understanding (purpose, architecture, modules, key features, tech stack, data flow)
- Audience-based explanations (content + Mermaid diagram)
- Code explanations
- Project chat responses
- File selection for code-aware questions

Groq is used instead of Gemini because it provides significantly faster inference while maintaining 70B parameter quality. The provider is configurable via `AI_BASE_URL` and `AI_MODEL` environment variables.

## System Boundary

SystemLens is responsible for:

- Repository analysis workflow (URL parsing → GitHub → Light Analyzer → AI → Profile Builder)
- Project profile generation (combining technical facts + AI understanding)
- Explanation generation (audience-tailored text + Mermaid diagrams)
- Mermaid diagram generation, sanitization, validation, and fallback
- Visualization generation and client-side rendering (with zoom + fullscreen)
- Question handling with code-aware retrieval (choose files → fetch → explain)
- Rate-limit error detection and countdown handling
- Caching (disk-based analysis cache + in-memory explanation/chat caches)
- Frontend UI state management (theme, streaming, progress, errors)

## Key Design Decisions

1. **Backend-only external access**: The frontend never communicates directly with GitHub or Groq. All external API calls go through Next.js API Routes.
2. **SSE streaming**: All three API endpoints use Server-Sent Events for real-time progress and streaming responses (not traditional JSON request/response).
3. **Lazy explanation generation**: Only the requested audience's explanation is generated (not all 5 in parallel), with results cached for instant switching.
4. **Profile-question optimization**: General questions answerable from the project profile skip the AI file-selection round-trip entirely.
5. **Disk + memory caching**: Analysis results are cached to disk (24h TTL) and explanations/file data are cached in-memory (30 min TTL).