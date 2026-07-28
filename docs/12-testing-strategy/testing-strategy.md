# Testing Approach

SystemLens will use a layered testing strategy.

```
Unit Tests
     │
     ▼
Integration Tests
     │
     ▼
API Tests
     │
     ▼
End-to-End Tests
```

Each layer verifies a different responsibility.

## 1. Unit Testing

### Goal
Test individual pieces of logic independently.

**Focus:**
- Light Analyzer
- Parsers
- Profile Builder
- Utility functions

### Components to Test

#### Manifest Parser
**Input:**
- `go.mod`
- `package.json`
- `requirements.txt`

**Expected output:**
- Language
- Framework
- Dependencies

**Example:**
`go.mod`

**Output:**
- **Language:** Go
- **Framework:** Gin

#### Docker Parser
**Input:**
- `Dockerfile`
- `docker-compose.yml`

**Expected:**
- Deployment
- Services
- Ports

#### Profile Builder
**Input:**
- Repository
- +
- Technical Facts
- +
- Project Understanding

**Expected:**
- Project Profile

---

## 2. Integration Testing

### Goal
Verify that internal components communicate correctly.

### Analysis Pipeline Test

**Test:**
```
GitHub Service
        │
        ▼
Light Analyzer
        │
        ▼
Gemini Service
        │
        ▼
Profile Builder
```

**Expected:**
```
Repository URL

        ↓

Project Profile
```

---

## 3. API Testing

### Goal
Verify API contracts from Stage 8.

#### `POST /api/analyze`

**Test input:**
```json
{
  "repositoryUrl": "https://github.com/example/project"
}
```

**Expected:**
```json
{
  "projectProfile": {}
}
```

#### `POST /api/explain`

**Test input:**
```json
{
  "projectProfile": {},
  "audience": "Developer"
}
```

**Expected:**
```json
{
  "explanation": "",
  "diagram": ""
}
```

#### `POST /api/chat`

**Test input:**
```json
{
  "projectProfile": {},
  "audience": "Developer",
  "chatHistory": [],
  "question": "Explain authentication"
}
```

**Expected:**
```json
{
  "answer": ""
}
```

---

## 4. End-to-End Testing

### Goal
Test the complete user journey.  
The same flow from Stage 2.

### User Journey Test

```
Open SystemLens
        │
        ▼
Paste GitHub URL
        │
        ▼
Click Analyze
        │
        ▼
View Progress
        │
        ▼
Choose Audience
        │
        ▼
View Explanation
        │
        ▼
View Mermaid Diagram
        │
        ▼
Ask Question
        │
        ▼
Receive Answer
```

Success means the complete experience works.

---

## Error Testing

SystemLens must handle failures gracefully.

### Invalid GitHub URL
**Example:**
`github.com/wrong/url`

**Expected:**
`Invalid repository URL`

### Missing Files
**Example:**  
Repository has no:
- README
- Manifest
- Dockerfile

**Expected:**
`Analyze available information only`

### Unsupported Repository
**Example:**  
Unknown language.

**Expected:**
`Limited analysis available`

### Gemini Failure
**Expected:**
```
AI service unavailable.
Please try again later.
```

### GitHub API Failure
**Expected:**
`Unable to retrieve repository information.`

---

## Performance Testing

### Goal
Ensure the MVP feels responsive.

### Measure:

#### Repository Analysis
**Target:**
Few seconds for normal repositories

#### API Response
**Monitor:**
- `/api/analyze`
- `/api/explain`
- `/api/chat`

#### Large Repository Handling
**Verify:**
- Large file trees
- Missing important files
- Excessive file size

---

## Security Testing

### Verify:

#### API Keys
**Check:**
- Gemini API Key
- GitHub Token

**Never appear in:**
- Browser
- Client code
- Responses

#### User Input
**Validate:**
- GitHub URL format
- Request body
- Audience values

---

## MVP Testing Tools

| Purpose | Tool |
| :--- | :--- |
| Unit Testing | Vitest |
| API Testing | Postman / Bruno |
| E2E Testing | Playwright |
| Code Quality | ESLint |
| Type Checking | TypeScript |