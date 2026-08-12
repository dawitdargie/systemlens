# SystemLens

> **Understand any GitHub repository instantly.** Paste a URL. Get a complete project profile, audience-tailored explanations, an architecture diagram, and AI-powered answers to your questions — grounded in the actual source code.

## Features

- **Instant Repository Analysis** — Fetches and parses public GitHub repos to extract technical facts (language, framework, deployment), README content, and key source files.
- **AI-Powered Project Understanding** — Generates a structured project profile with purpose, architecture summary, key modules, tech stack details, and data flow.
- **Audience-Specific Explanations** — Tailored walkthroughs for **CEOs**, **PMs**, **Developers**, **QA Engineers**, and **Customers**, each with a Mermaid architecture diagram.
- **Ask the Codebase** — Chat with a repository to get answers grounded in actual source code. The AI identifies relevant files and fetches them for code-aware answers.
- **SSE Streaming** — Progress updates during analysis and streaming text during explanations and chat responses for a responsive experience.
- **Rate-Limit Aware** — Automatic detection of 429 errors with countdown timers and retry buttons.
- **Smart Caching** — Disk-based analysis cache (24h TTL), in-memory explanation cache (30 min TTL), and chat caches for file trees and contents.
- **Light/Dark Mode** — Toggle between themes with system preference detection.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Runtime | Node.js / Vercel Serverless Functions |
| Frontend | React, Tailwind CSS, Mermaid.js |
| GitHub API | REST API v3 |
| AI | Groq (OpenAI-compatible SDK, `llama-3.3-70b-versatile`) |
| Styling | Tailwind CSS with CSS variables for theming |
| Testing | Vitest |
| Deployment | Vercel (commit-and-push deployment) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/dawitdargie/systemlens.git
cd systemlens

# Install dependencies
npm install

# Create a .env.local file with your API keys
cp .env.example .env.local
# Then edit .env.local to add your keys (see Environment Variables below)
```

### Environment Variables

All environment variables are optional at development time but required for full functionality. Create a `.env.local` file:

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token (unauthenticated requests are heavily rate-limited) | Recommended |
| `GROQ_API_KEY` | Groq API key for AI inference | Required for AI features |
| `AI_API_KEY` | Alias for `GROQ_API_KEY` (`AI_API_KEY` takes priority) | Alternative |
| `AI_BASE_URL` | Override the API base URL (defaults to Groq) | Optional |
| `AI_MODEL` | Override the model name (defaults to `llama-3.3-70b-versatile`) | Optional |
| `CACHE_ANALYSIS` | Set to `false` to disable disk-based analysis caching | Optional |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

```bash
npm test
# or watch mode
npx vitest
```

### Build

```bash
npm run build
```

## Usage

1. Open [http://localhost:3000](http://localhost:3000)
2. Paste a **public GitHub repository URL** (e.g., `https://github.com/gin-gonic/gin`)
3. Click **Analyze** — watch real-time progress as the system fetches repo metadata, scans the file tree, extracts technical facts, and generates the project understanding
4. Browse the **Project Profile** (tech stack, purpose, architecture, key features, data flow)
5. Click **Tailored Explanations** and select an audience (CEO, PM, Developer, QA, Customer) to get an AI-generated explanation with a Mermaid architecture diagram
6. Use **Ask Questions** to chat with the repository — code-related questions will fetch relevant source files for accurate answers

## API Endpoints

All endpoints use **POST** with **JSON request bodies** and return **SSE (Server-Sent Events) streams** for real-time progress and streaming responses.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/analyze` | Analyze a GitHub repository and build a Project Profile |
| `POST /api/explain` | Generate (or retrieve cached) audience-specific explanation with Mermaid diagram |
| `POST /api/chat` | Answer project/code questions with streaming text |

See [docs/07-api-design/api-spec.md](docs/07-api-design/api-spec.md) for full API documentation.

## Architecture

```
Browser (Next.js Frontend)
    │
    ▼
Next.js API Routes (Backend)
    │
    ├──► GitHub API       (repo metadata, file tree, file contents)
    ├──► Groq API          (AI inference: understanding, explanations, chat)
    ├──► Disk Cache        (analysis-cache, 24h TTL)
    └──► In-Memory Caches  (explanations, file tree, file content, 30min TTL)
```

See [docs/04-architecture/](docs/04-architecture/) for the full architecture documentation.

## Deployment

SystemLens is deployed on **Vercel**. Once connected to a GitHub repository, every commit to the main branch triggers an automatic rebuild and deployment — simply commit and push to update the live site.

### Deploy to Vercel

1. Push your code to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Add the following environment variables in the Vercel dashboard:
   - `GITHUB_TOKEN`
   - `GROQ_API_KEY`
5. Deploy!

After initial setup, **every subsequent `git push` automatically deploys** a new version.

## Documentation

Full architecture and design documentation is in the [`docs/`](docs/) directory:

| # | Doc | Topic |
|---|-----|-------|
| 01 | Requirements | Functional & non-functional requirements, user stories |
| 02 | User Flow | Application states and user journey |
| 03 | System Context | External actors and system boundaries |
| 04 | Container Diagram | High-level architecture containers |
| 05 | Component Diagram | Internal components and responsibilities |
| 06 | Sequence Diagrams | Runtime interaction flows |
| 07 | API Spec | REST endpoint contracts and SSE event formats |
| 08 | Data Model | Domain model definitions and relationships |
| 09 | Project Structure | Codebase folder structure and ownership rules |
| 10 | Implementation Plan | Phased development strategy |
| 11 | Deployment Design | Hosting, environment variables, deployment rules |
| 12 | Testing Strategy | Testing layers and tooling |

## License

Open source.