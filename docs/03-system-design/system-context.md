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

Supported audiences:
- CEO
- PM
- Developer
- QA
- Customer

### GitHub API

Provides repository information:
- Repository metadata
- File structure
- Important source files

### Gemini API

Provides AI capabilities:
- Project understanding
- Audience-based explanations
- Code explanations
- Project chat responses

## System Boundary

SystemLens is responsible for:
- Repository analysis workflow
- Project profile generation
- Explanation generation
- Visualization generation
- Question handling