import { NextRequest } from "next/server";
import { chooseFiles, streamAnswer } from "@/lib/ai";
import type { CodeFile } from "@/lib/ai";
import { fetchRepositoryTree, fetchFileContent } from "@/lib/github";
import { GitHubError } from "@/lib/github";
import type { TreeItem } from "@/lib/github";
import {
  fileTreeCache,
  fileContentCache,
  chooseFilesCache,
  buildTreeCacheKey,
  buildFileCacheKey,
  buildChooseFilesCacheKey,
  pruneChatCaches,
} from "@/lib/ai/chat-cache";
import type { ProjectProfile, Audience, ChatMessage } from "@/types";
import { RateLimitError } from "@/lib/ai";

const VALID_AUDIENCES: Audience[] = [
  "CEO",
  "PM",
  "Developer",
  "QA",
  "Customer",
];

const HARD_TIMEOUT_MS = 30_000;

/**
 * Heuristic: detect questions that can be answered from the project profile
 * alone (purpose, architecture, features, tech stack) without needing to
 * fetch source files. This skips the expensive chooseFiles AI round-trip.
 */
function isProfileQuestion(question: string): boolean {
  const q = question.toLowerCase().trim();
  const profileKeywords = [
    "what is this project",
    "what does this project do",
    "what is the purpose",
    "what is the architecture",
    "architecture",
    "overview",
    "summary",
    "tech stack",
    "technologies",
    "what technologies",
    "what framework",
    "what language",
    "key features",
    "features",
    "main modules",
    "modules",
    "components",
    "data flow",
    "how does it work",
    "what is it",
    "high level",
    "audience",
    "who is this for",
    "deployment",
    "how is it deployed",
  ];
  return profileKeywords.some((kw) => q.includes(kw));
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { projectProfile, audience, history, question } = body as {
    projectProfile?: ProjectProfile;
    audience?: string;
    history?: ChatMessage[];
    question?: string;
  };

  // Validate required fields
  if (
    !projectProfile ||
    !projectProfile.repository ||
    !projectProfile.understanding ||
    !question ||
    typeof question !== "string" ||
    !question.trim()
  ) {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate audience (default to Developer)
  const resolvedAudience: Audience =
    audience && VALID_AUDIENCES.includes(audience as Audience)
      ? (audience as Audience)
      : "Developer";

  // Validate history (default to empty array)
  const resolvedHistory: ChatMessage[] = Array.isArray(history) ? history : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const { repository } = projectProfile;
        const { owner, name: repo, defaultBranch: branch } = repository;

        // Prune expired cache entries opportunistically before each request.
        pruneChatCaches();

        // Hard timeout that ONLY guards the pre-answer phase (tree + file
        // selection + file fetch). It is cleared before streaming begins so a
        // long answer is never cut off mid-stream.
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const setPreAnswerTimeout = () => {
          timeout = setTimeout(() => {
            throw new Error(
              "Request timed out while preparing the response. Please try again."
            );
          }, HARD_TIMEOUT_MS);
        };
        const clearPreAnswerTimeout = () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
          }
        };

        // Step 1: Fetch file tree (cached per owner/repo:branch)
        send({ type: "status", step: "Analyzing question..." });

        const treeKey = buildTreeCacheKey(owner, repo, branch);
        let fileTree: TreeItem[] = fileTreeCache.get(treeKey) ?? [];

        if (fileTree.length === 0) {
          setPreAnswerTimeout();
          try {
            fileTree = await fetchRepositoryTree(owner, repo, branch);
            fileTreeCache.set(treeKey, fileTree);
          } catch (error) {
            // If tree fetch fails, continue without code context
            console.error(
              "[chat] File tree fetch failed, continuing without code:",
              error instanceof Error ? error.message : error
            );
          } finally {
            clearPreAnswerTimeout();
          }
        }

        // Step 2: Determine if code files are needed.
        // Profile-answerable questions skip the chooseFiles AI round-trip,
        // saving ~1-2s of latency per chat message.
        const chooseKey = buildChooseFilesCacheKey(owner, repo, question);
        let chooseResult = chooseFilesCache.get(chooseKey);

        if (!chooseResult) {
          if (isProfileQuestion(question)) {
            chooseResult = { needsFiles: false, filePaths: [] };
            chooseFilesCache.set(chooseKey, chooseResult);
          } else {
            setPreAnswerTimeout();
            try {
              chooseResult = await chooseFiles({
                question,
                projectProfile,
                fileTree,
              });
              chooseFilesCache.set(chooseKey, chooseResult);
            } finally {
              clearPreAnswerTimeout();
            }
          }
        }

        // Step 3: If files are needed, fetch them in parallel (cached per file)
        let codeContext: CodeFile[] = [];

        if (chooseResult.needsFiles && chooseResult.filePaths.length > 0) {
          send({ type: "status", step: "Fetching relevant code..." });

          setPreAnswerTimeout();
          try {
            const fetchPromises = chooseResult.filePaths.map(async (path) => {
              const fileKey = buildFileCacheKey(owner, repo, path, branch);
              const cached = fileContentCache.get(fileKey);
              if (cached !== null) {
                return { path, content: cached } as CodeFile;
              }
              try {
                const content = await fetchFileContent(
                  owner,
                  repo,
                  path,
                  branch
                );
                fileContentCache.set(fileKey, content);
                return { path, content } as CodeFile;
              } catch (error) {
                // Silently skip files that fail to fetch
                console.error(
                  `[chat] Failed to fetch ${path}:`,
                  error instanceof Error ? error.message : error
                );
                return null;
              }
            });

            const results = await Promise.allSettled(fetchPromises);
            codeContext = results
              .filter(
                (r): r is PromiseFulfilledResult<CodeFile> =>
                  r.status === "fulfilled" && r.value !== null
              )
              .map((r) => r.value);
          } finally {
            clearPreAnswerTimeout();
          }
        }

        // Step 4: Stream the answer (no timeout here - stream to completion)
        await streamAnswer(
          {
            question,
            projectProfile,
            audience: resolvedAudience,
            history: resolvedHistory,
            codeContext: codeContext.length > 0 ? codeContext : undefined,
          },
          (chunk) => {
            send({ type: "chunk", content: chunk });
          },
          () => {
            // The model hit its token limit; send a notice so the client can
            // show a visible "response was cut off" indicator.
            send({ type: "truncated" });
          }
        );

        clearPreAnswerTimeout();
        send({ type: "done" });
      } catch (error) {
        console.error("[chat] Route error:", error);

        if (error instanceof RateLimitError) {
          send({ type: "error", error: error.message, retryAfterSeconds: error.retryAfterSeconds });
        } else {
          const message =
            error instanceof GitHubError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Unable to answer question.";
          send({ type: "error", error: message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}