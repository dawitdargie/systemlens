# Component Responsibilities
## 1. API Routes

Receives requests from the frontend.

Examples:

- POST /api/analyze
- POST /api/explain
- POST /api/chat

### Responsibilities:

- Validate input
- Call application services
- Return responses

No business logic.

## 2. Analysis Service

The orchestrator for repository analysis.

### Responsibilities:

- Coordinate analysis workflow
- Call GitHub Service
- Call Light Analyzer
- Call AI Service
- Build the final Project Profile

Think of it as:

"Run the complete analysis pipeline."

## 3. GitHub Service

Responsible only for GitHub communication.

### Responsibilities:

- Fetch repository metadata
- Fetch README
- Fetch file tree
- Fetch specific files

Nothing else.

## 4. Light Analyzer

Performs deterministic analysis.

Examples:

- Detect language
- Detect framework
- Detect dependencies
- Detect Docker usage

No AI.

Only parsing.

## 5. AI Service

Responsible for every Gemini interaction.

### Responsibilities:

#### Generate project understanding

Input:

- README
- Entry point
- Technical facts

Output:

- Purpose
- Main modules
- Architecture summary

#### Generate audience explanations

Input:

- Project Profile
- Audience

Output:

- CEO explanation
- PM explanation
- Developer explanation
- QA explanation
- Customer explanation

#### Answer questions

Input:

- Project Profile
- User question

If needed:

- Select relevant file paths
- Explain retrieved code

## 6. Profile Builder

This component assembles the final Project Profile.

Inputs:

- Repository information
- Technical facts
- AI-generated understanding

Output:

- Project Profile

This keeps ownership of the Project Profile inside SystemLens, not Gemini.