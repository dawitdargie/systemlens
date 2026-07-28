# API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /api/analyze | Analyze a GitHub repository and build a Project Profile |
| POST | /api/explain | Generate an audience-specific explanation |
| POST | /api/chat | Answer project and code questions |

## 1. POST /api/analyze

### Purpose
Analyze a public GitHub repository and return a reusable Project Profile.

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

### Backend Flow

```text
Validate URL
      │
      ▼
GitHub Service
      │
      ▼
Light Analyzer
      │
      ▼
AI Service
      │
      ▼
Profile Builder
      │
      ▼
Project Profile
```

### Success Response (200)

```json
{
  "projectProfile": {
    "repository": {
      "name": "gin",
      "owner": "gin-gonic",
      "url": "https://github.com/gin-gonic/gin"
    },
    "technicalFacts": {
      "language": "Go",
      "framework": "Gin",
      "deployment": "Docker"
    },
    "understanding": {
      "purpose": "HTTP web framework",
      "mainModules": [
        "Routing",
        "Middleware",
        "Rendering"
      ],
      "architectureSummary": "Layered HTTP framework."
    }
  }
}
```

The structure is intentionally simplified for the MVP. Additional fields can be added later without changing the API design.

### Error Responses

#### Invalid Repository URL

`400 Bad Request`

```json
{
  "error": "Invalid GitHub repository URL."
}
```

#### Repository Not Found

`404 Not Found`

```json
{
  "error": "Repository not found."
}
```

#### Analysis Failed

`500 Internal Server Error`

```json
{
  "error": "Unable to analyze repository."
}
```

---

## 2. POST /api/explain

### Purpose
Generate an explanation for one audience using the existing Project Profile.

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

### Backend Flow

```text
Project Profile
      +
Audience
      │
      ▼
AI Service
      │
      ▼
Explanation
+
Mermaid Diagram
```

### Success Response (200)

```json
{
  "explanation": "SystemLens analysed the repository and generated a developer-focused explanation...",
  "diagram": "graph TD\nFrontend-->Backend"
}
```

The diagram field contains Mermaid syntax that the frontend renders using Mermaid.js.

### Error Responses

#### Invalid Audience

`400 Bad Request`

```json
{
  "error": "Unsupported audience."
}
```

#### AI Failure

`500 Internal Server Error`

```json
{
  "error": "Unable to generate explanation."
}
```

---

## 3. POST /api/chat

### Purpose
Answer project-related and code-related questions.

### Request

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "projectProfile": { "...": "..." },
  "audience": "Developer",
  "history": [
    {
      "role": "user",
      "content": "What does this project do?"
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ],
  "question": "Explain the authentication middleware."
}
```

### Backend Flow

General Question
```text
General Question
Project Profile
      +
Question
      │
      ▼
AI Service
      │
      ▼
Answer
```


Code Question
```text
Project Profile
+
Repository Tree
+
Question
      │
      ▼
Gemini selects relevant files
      │
      ▼
GitHub Service
(fetch files)
      │
      ▼
AI Service
(explain code)
      │
      ▼
Answer
```

This is the simplified MVP approach we agreed on. No cloning, embeddings, or vector database.

### Success Response (200)

```json
{
  "answer": "The authentication middleware validates incoming JWT tokens before allowing access to protected routes."
}
```

### Error Responses

#### Invalid Request

`400 Bad Request`

```json
{
  "error": "Invalid request."
}
```

#### AI Failure

`500 Internal Server Error`

```json
{
  "error": "Unable to answer question."
}
```

---

## API Principles

- All endpoints use POST because they trigger analysis or AI generation.
- All requests and responses use JSON.
- The frontend communicates only with the Next.js backend.
- The backend is the only component that communicates with GitHub and Gemini.
- API keys remain server-side and are never exposed to the client.

Frontend communicates only with the backend.

The backend communicates with:
• GitHub API
• Gemini API

No direct client access to external services.