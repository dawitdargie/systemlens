# Components Deployment

## Frontend

**Runs on:**
* Vercel

**Responsibilities:**
* Render UI
* Collect repository URL
* Display progress
* Display explanations
* Render Mermaid diagrams
* Maintain chat history in browser memory

---

## Backend

**Runs inside:**
* Next.js API Routes (Vercel Functions)

**Responsibilities:**
* Receive API requests
* Call GitHub API
* Run Light Analyzer
* Call Gemini
* Build Project Profile
* Return responses

**Endpoints:**
* `POST /api/analyze`
* `POST /api/explain`
* `POST /api/chat`

---

## External Services

### GitHub API
External service.

**Used for:**
* Repository information
* File tree
* File contents

**Flow:**
```
Backend
   │
   ▼
GitHub API
   │
   ▼
Repository Data
```

### Gemini API
External AI service.

**Used for:**
* Project Understanding
* Audience Explanation
* Chat Answers

**Flow:**
```
Backend
   │
   ▼
Gemini API
   │
   ▼
AI Response
```

---

## Environment Variables
Secrets stay only on the backend.

**Example:**
* `GITHUB_TOKEN`
* `GEMINI_API_KEY`

**Flow:**
```
Browser
   │
   │ No access
   ▼

Vercel Environment Variables
   │
   ▼

Backend API Routes
```

---

## Deployment Rules

Frontend never talks directly to:
* ❌ GitHub API
* ❌ Gemini API

**Only:**
```
Browser
    │
    ▼
SystemLens Backend
```

Backend never exposes:
* API keys
* GitHub token
* Internal prompts

---

## MVP Deployment Stack

| Part | Technology | Hosting |
| :--- | :--- | :--- |
| **Frontend** | Next.js | Vercel Free Tier |
| **Backend** | Next.js API Routes | Vercel Free Tier |
| **Repository Access** | GitHub API | — |
| **AI** | Gemini API | — |
| **Diagram Rendering** | Mermaid.js | — |
| **Database** | None | — |