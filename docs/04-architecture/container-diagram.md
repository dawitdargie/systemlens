# Container Responsibilities
## 1. Browser (Frontend)

### Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- Mermaid.js

### Responsibilities

- Submit repository URL
- Display progress
- Display project profile
- Display Mermaid diagrams
- Audience selection
- Chat interface

The frontend never talks directly to GitHub or Gemini.

Everything goes through the backend.

## 2. Next.js Backend

This is the heart of SystemLens.

### Responsibilities:

#### Repository Fetching

Uses GitHub API to retrieve:

- README
- File tree
- Manifest files
- Docker configuration
- Entry point
- Selected source files

#### Light Analyzer

Extracts deterministic facts.

Examples:

`go.mod`  
↓  
Language = Go  
Framework = Gin  

`package.json`  
↓  
Framework = Next.js  

`Dockerfile`  
↓  
Containerized  

No AI.

Only parsing.

#### Project Profile Generation

Combines:

- README
- Analyzer output
- Entry point

Sends them to Gemini.

Receives:

- Purpose
- Main components
- Architecture description
- Modules

Stores the resulting Project Profile in memory for the current analysis request.

#### AI Orchestration

Generates:

- CEO explanation
- PM explanation
- Developer explanation
- QA explanation
- Customer explanation

Always uses:

Project Profile  
+  
Audience  

#### Chat Orchestration

For every user question:

**General questions**  
Project Profile  
+  
Question  
↓  
Gemini  

**Code questions**  
Question  
        │  
        ▼  
Gemini chooses relevant files  
        │  
        ▼  
GitHub API  
(fetch selected files)  
        │  
        ▼  
Gemini answers using:  
- Project Profile  
- Retrieved code  
- Question  

This keeps the MVP simple while supporting code-aware answers.

## External Systems
### GitHub API

#### Responsibilities

- Repository metadata
- Repository tree
- File contents

### Gemini API

#### Responsibilities

- Project understanding
- Audience explanations
- Code explanations
- Chat responses

Gemini never accesses GitHub directly.