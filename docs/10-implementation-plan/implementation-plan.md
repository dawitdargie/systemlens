# Development Strategy

SystemLens will be built in vertical slices.
Each milestone should produce something working.

## Phase 1 — Project Foundation

### Goal
Create the application skeleton.

### Tasks:
- Create Next.js application
- Configure TypeScript
- Configure Tailwind CSS
- Create initial folder structure
- Add environment variable handling
- Add basic landing page

### Result:
User can open SystemLens website.

## Phase 2 — Repository Analysis Foundation

### Goal
Allow SystemLens to receive and read GitHub repositories.

### Implement:

#### GitHub Service

##### Features:
- Parse GitHub URL
- Get repository information
- Get file tree
- Fetch specific files

##### Supported files:
README.md
go.mod
package.json
requirements.txt
Dockerfile
docker-compose.yml
entry files

### Result:
User submits repository URL.
SystemLens can retrieve repository data.

## Phase 3 — Light Analyzer

### Goal
Extract deterministic technical facts.

### Implement:

#### Manifest Parser

##### Detect:
- Language
- Framework
- Dependencies

##### Examples:
go.mod
Go
Gin

package.json
JavaScript
Next.js

#### Docker Parser

##### Detect:
- Docker usage
- Services
- Ports

### Result:
```json
{
  "language": "Go",
  "framework": "Gin",
  "deployment": "Docker"
}
```

## Phase 4 — Project Profile Generation

### Goal
Create the core domain object.

### Implement:

#### AI Service
Gemini generates:
- Purpose
- Main modules
- Architecture summary

##### Input:
Repository information
+
Technical Facts
+
README
+
Entry point

#### Profile Builder
Combines:
Repository
+
Technical Facts
+
Project Understanding

Creates:
Project Profile

### Result:
Repository analysis works end-to-end.

## Phase 5 — Audience Explanation

### Goal
Allow users to understand the project from different perspectives.

### Implement:

#### Audience Selector

##### Supported:
CEO
PM
Developer
QA
Customer

#### Explanation Generation

##### Input:
Project Profile
+
Audience

##### Output:
Explanation
+
Mermaid Diagram

### Result:
User can explore the same project differently depending on their role.

## Phase 6 — Project Chat

### Goal
Allow users to ask questions about the analyzed repository.

### Implement:

#### Chat Context
Frontend stores:
Chat Messages

No database.
No authentication.

#### General Questions
Uses:
Project Profile
+
Question

#### Code Questions
Flow:
```
Question
      ↓
Gemini selects files
      ↓
GitHub Service fetches files
      ↓
Gemini explains code
```

### Result:
User can explore specific parts of the project.

## Phase 7 — Frontend Experience

### Goal
Connect all backend capabilities into the user journey.

### Implement:

#### Pages/components:
```
Landing Page
      ↓
Analysis Progress
      ↓
Audience Selection
      ↓
Explanation View
      ↓
Chat Interface
```

#### Add:
- Loading states
- Error states
- Mermaid rendering
- Responsive design

## Phase 8 — Reliability and Polish

### Goal
Make the MVP stable.

### Handle:
- Invalid GitHub URLs
- Private repositories
- Missing files
- Unsupported languages
- Gemini failures
- GitHub API failures

### Improve:
- Error messages
- Loading experience
- UI consistency

## Final MVP Capability

After completing all phases:
A user can:

1. Open SystemLens
2. Paste a GitHub repository URL
3. SystemLens analyzes the repository
4. Generates a Project Profile
5. User chooses:
   CEO
   PM
   Developer
   QA
   Customer
6. SystemLens explains the project
7. User views Mermaid diagrams
8. User asks questions about the project

## Implementation Order Diagram

```
Project Setup
      │
      ▼
GitHub Integration
      │
      ▼
Light Analyzer
      │
      ▼
Gemini Integration
      │
      ▼
Project Profile
      │
      ▼
Audience Explanation
      │
      ▼
Chat
      │
      ▼
UI Polish + Reliability
```