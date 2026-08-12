# User States and Flow

## Application States

## 1. Landing

User has opened SystemLens for the first time.
- Hero section with tagline, hero image, and feature cards
- Repository URL input bar (always visible)
- Theme toggle (light/dark mode) in the navigation bar
- Theme preference detected from `localStorage` or system setting

## 2. Submitting Repository

User has entered a GitHub repository URL and clicked **Analyze**.
- URL is validated
- `POST /api/analyze` request is sent
- Input bar disabled with spinner ("Analyzing...")
- Progress indicator appears below the input

## 3. Analyzing

System is fetching and processing repository information via SSE stream.

**Progress steps streamed in real-time:**
1. `"Fetching repository metadata..."` — GitHub API call for repo info + HEAD file tree (parallel)
2. `"Scanning file tree..."` — Identify important files
3. `"Analyzing technical facts..."` — Light Analyzer parses manifests + Docker files
4. `"Generating project understanding..."` — Groq AI generates project understanding
5. `"Complete"` — Result is about to be sent

**Error handling during analysis:**
- Rate limit (429 from Groq): Error banner shows with countdown timer + retry button
- GitHub error (404, 403, network): Error banner shows with retry button
- Timeout (60s): Generic timeout error message

## 4. Profile Ready

System has generated the project profile.
- Analysis complete banner appears
- Repository header (owner/name, GitHub link, default branch badge)
- Technical Facts cards (Language, Framework, Deployment)
- Project Understanding sections:
  - Purpose (SectionCard with cyan accent)
  - Key Features (icon list)
  - Main Modules (grid of cards with name + description)
  - Architecture Summary
  - Tech Stack Details
  - Data Flow
- "Explore This Project" CTA bar with two buttons:
  - "Tailored Explanations" (scrolls to audience picker)
  - "Ask Questions" (scrolls to chat)

## 5. Selecting Audience

User is choosing an explanation perspective.

**Audience Picker:**
- 5 buttons: CEO, PM, Developer, QA, Customer
- Each audience has a color-coded dot and accent glow
- Active audience is highlighted with border + glow
- `onSelect` triggers `handleExplain()` which starts SSE streaming for `/api/explain`

## 6. Explaining

System is generating (or retrieving cached) the explanation.

**Cached path:**
- Single JSON response with `cached: true`
- Explanation renders immediately with key takeaways + paragraphs + diagram

**Streaming path (not cached):**
- SSE stream begins
- `{ "type": "chunk", "content": "..." }` events update the explanation content progressively
- `{ "type": "diagram", "diagram": "..." }` event renders the Mermaid diagram
- `{ "type": "done" }` marks completion
- Loading skeleton shown until first chunk arrives

**Explanation view features:**
- Audience badge with color-coded dot
- Key Takeaways callout (first sentence of each paragraph, max 4)
- Animated paragraph cards (slide-in with staggered delay)
- Mermaid diagram with zoom controls, fullscreen toggle, and retry button
- Error state: explanation view shows error message + retry button with countdown

## 7. Exploring

User reads explanations and asks questions.

**Chat interface:**
- Suggested questions appear when chat is empty:
  - "What does this project do?"
  - "How is the code organized?"
  - "What are the main components?"
  - "How does data flow through the system?"
- User can type custom questions (multi-line textarea, shift+Enter for new line, Enter to send)
- Messages render with role-based alignment (user right, assistant left)
- Assistant messages use `renderCodeBlocks()` to wrap fenced code in styled `<pre>` boxes
- Streaming: messages update progressively via `requestAnimationFrame` batching
- Status indicators: "Analyzing question...", "Fetching relevant code..."
- Truncation notice: if response hits token limit, shows amber banner with guidance
- Error handling: error banner with retry button (countdown for rate limits)
- Rate-limit: retry button disabled during countdown, shows "Retry in {time}"

---

## User Journey Diagram

```
┌─────────────┐
│ Landing     │
│ (Hero +     │
│  Input Bar)  │
└──────┬──────┘
       │ User enters URL
       │ Clicks "Analyze"
       ▼
┌──────────────┐
│ Analyzing    │ ◄── SSE: progress events
│ (Progress    │     (5 steps streamed)
│  Spinner)    │
└──────┬──────┘
       │
       ├── Error ──► Error banner + retry (with countdown)
       │
       ▼
┌──────────────┐
│ Profile Ready│
│ (Tech Facts  │
│  + Profile)  │
└──────┬──────┘
       │
       ├── Click "Tailored Explanations"
       ▼
┌──────────────┐
│ Selecting    │
│ Audience     │
└──────┬──────┘
       │ Select audience
       ▼
┌──────────────┐
│ Explaining   │ ◄── SSE: chunk + diagram + done
│ (Streaming   │     or cached JSON response
│  Explanation)│
└──────┬──────┘
       │
       ├── Error ──► Error + retry (with countdown)
       │
       ▼
┌──────────────┐
│ Exploring    │ ◄── SSE: status + chunk + truncated + done
│ (Chat)        │     Profile-question optimization
└──────────────┘     File selection + code fetch (if needed)
```
