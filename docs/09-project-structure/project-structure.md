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
└── README.md
```

## Project Structure Diagram

```
systemlens
│
├── app
│
├── components
│
├── lib
│
├── types
│
├── public
│
└── docs
```

## app/

Contains the Next.js application.

```
app
│
├── api
│
├── page.tsx
│
├── layout.tsx
│
└── globals.css
```

### Responsibilities

* Pages
* API Routes
* Layout

Nothing else.

## app/api

Exactly the three routes we designed.

```
app/api
│
├── analyze/
│   └── route.ts
│
├── explain/
│   └── route.ts
│
└── chat/
    └── route.ts
```

Matches Stage 8 exactly.

## components/

Reusable UI.

```
components
│
├── repository-input
├── audience-picker
├── project-profile
├── explanation
├── mermaid-diagram
├── chat
└── ui
```

### Responsibilities

* Display
* User interaction

No business logic.

## lib/

This is the heart of the backend.  
It maps almost one-to-one with the Stage 6 Component Diagram.

```
lib
│
├── github
│
├── analyzer
│
├── ai
│
├── profile
│
└── services
```

## github/

Implements the GitHub Service.

```
github
│
├── fetch-repository.ts
├── fetch-tree.ts
├── fetch-file.ts
└── index.ts
```

### Responsibilities

* GitHub API communication only

## analyzer/

Implements the Light Analyzer.

```
analyzer
│
├── manifest-parser.ts
├── docker-parser.ts
└── index.ts
```

### Responsibilities

* Parse go.mod
* Parse package.json
* Parse Dockerfile
* Return Technical Facts

No AI.

## ai/

Implements the AI Service.

```
ai
│
├── generate-understanding.ts
├── generate-explanation.ts
├── answer-chat.ts
├── choose-files.ts
└── index.ts
```

### Responsibilities

* Gemini communication
* Prompt orchestration

No GitHub logic.

## profile/

Implements the Profile Builder.

```
profile
│
├── build-profile.ts
└── index.ts
```

### Responsibilities

Combine:

* Repository
* Technical Facts
* Project Understanding

Return

* Project Profile

Exactly as designed in Stage 6.

## services/

Implements the Analysis Service.

```
services
│
└── analyze-repository.ts
```

### Responsibilities

Orchestrate the complete analysis pipeline.  
It calls:

* GitHub
* Analyzer
* AI
* Profile Builder

Exactly matching Stage 6.

## types/

Shared domain models.

```
types
│
├── repository.ts
├── technical-facts.ts
├── project-understanding.ts
├── project-profile.ts
├── explanation.ts
└── chat-message.ts
```

These correspond directly to the six domain models from Stage 9.

## public/

Static assets.

```
public
│
├── logo.svg
└── favicon.ico
```

## docs/

Architecture documentation.

```
docs
│
├── 01-requirements
├── 02-user-flow
├── 03-system-context
├── 04-architecture
├── 05-backend-design
├── 06-sequences
├── 07-api-design
├── 08-data-model
└── 09-project-structure
```

## Dependency Rules

```
API Routes
      │
      ▼
Services
      │
      ▼
GitHub
Analyzer
AI
Profile
      │
      ▼
Types
```

### Rules:

* API Routes may call Services.
* Services may call GitHub, Analyzer, AI, and Profile.
* GitHub, Analyzer, AI, and Profile may use shared Types.
* Components never call GitHub or Gemini directly.
* The frontend communicates only through /api/analyze, /api/explain, and /api/chat.