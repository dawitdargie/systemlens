# Sequence Diagrams

This document describes the runtime interactions between SystemLens components.

## Covered Workflows

1. Repository Analysis
2. Audience Explanation
3. Project Chat

### Repository Analysis

Triggered by:

POST /api/analyze

Purpose:

- Retrieve repository information
- Extract technical facts
- Generate project understanding
- Build the Project Profile

---

### Audience Explanation

Triggered by:

POST /api/explain

Purpose:

Generate an explanation tailored to:

- CEO
- PM
- Developer
- QA
- Customer

using the existing Project Profile.

---

### Project Chat

Triggered by:

POST /api/chat

Supports:

- General project questions
- Code-related questions

For code questions, SystemLens retrieves relevant source files before requesting a final explanation from Gemini.