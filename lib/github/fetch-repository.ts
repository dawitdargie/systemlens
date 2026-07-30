import { Repository } from "@/types";
import { GitHubError, GitHubErrors } from "./errors";

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  default_branch: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

/**
 * Fetches repository metadata from the GitHub API.
 *
 * @param owner - Repository owner (user or organization)
 * @param repo - Repository name
 * @returns Repository metadata matching our domain model
 * @throws GitHubError on API errors
 */
export async function fetchRepository(
  owner: string,
  repo: string
): Promise<Repository> {
  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers }
    );
  } catch {
    throw GitHubErrors.NETWORK();
  }

  if (response.status === 404) {
    throw GitHubErrors.NOT_FOUND();
  }

  if (response.status === 403) {
    throw GitHubErrors.RATE_LIMITED();
  }

  if (!response.ok) {
    throw GitHubErrors.UNEXPECTED(response.status);
  }

  let data: GitHubRepoResponse;
  try {
    data = await response.json();
  } catch {
    throw GitHubErrors.NETWORK();
  }

  return {
    name: data.name,
    owner: data.owner.login,
    url: data.html_url,
    defaultBranch: data.default_branch,
  };
}