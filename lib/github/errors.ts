export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export const GitHubErrors = {
  INVALID_URL: () => new GitHubError("Invalid GitHub repository URL."),
  NOT_FOUND: () => new GitHubError("Repository not found."),
  RATE_LIMITED: () =>
    new GitHubError(
      "GitHub API rate limit exceeded. Add a GITHUB_TOKEN to your .env file to increase your limit. Get one at https://github.com/settings/tokens"
    ),
  NETWORK: () => new GitHubError("Unable to reach GitHub API."),
  UNEXPECTED: (status: number) =>
    new GitHubError(`GitHub API responded with status ${status}.`, status),
} as const;