import { Octokit } from "@octokit/rest";
import { config } from "../config/env.js";

// Keep global Octokit for now (can be per-repo later)
const octokit = new Octokit({ auth: config.github.token });

// Helper to get Octokit instance (future: per-repo tokens)
function getOctokit(repoOwner?: string, repoName?: string): Octokit {
  // For now, use global token
  // TODO: Implement per-repo token management
  return octokit;
}

// ---------------------------------------------------------------------------
// Tool 1: triggerBuildAndScan
// ---------------------------------------------------------------------------

export interface TriggerBuildAndScanParams {
  imageName: string;
  ref?: string; // branch or tag to build from; defaults to default branch
  extraInputs?: Record<string, string>;
  
  // Required repository context
  repoOwner: string;
  repoName: string;
}

export interface TriggerBuildAndScanResult {
  workflowRunUrl: string;
  dispatched: boolean;
}

/**
 * Triggers a GitHub Actions workflow that builds a container image and runs
 * a vulnerability scan against it.
 *
 * Expects a workflow file `build-and-scan.yml` in the repo that accepts
 * an `image_name` input.
 */
export async function triggerBuildAndScan(
  params: TriggerBuildAndScanParams
): Promise<TriggerBuildAndScanResult> {
  const { repoOwner, repoName } = params;
  const octokit = getOctokit(repoOwner, repoName);

  const { data: repoData } = await octokit.repos.get({ 
    owner: repoOwner, 
    repo: repoName 
  });
  const ref = params.ref ?? repoData.default_branch;

  await octokit.actions.createWorkflowDispatch({
    owner: repoOwner,
    repo: repoName,
    workflow_id: "build-and-scan.yml",
    ref,
    inputs: {
      image_name: params.imageName,
      ...params.extraInputs,
    },
  });

  return {
    workflowRunUrl: `https://github.com/${repoOwner}/${repoName}/actions`,
    dispatched: true,
  };
}

// ---------------------------------------------------------------------------
// Tool 2: createPullRequest
// ---------------------------------------------------------------------------

export interface CreatePullRequestParams {
  cveId: string;
  branchName: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
  
  // Required repository context
  repoOwner: string;
  repoName: string;
}

export interface CreatePullRequestResult {
  prUrl: string;
  prNumber: number;
}

/**
 * Creates a Pull Request with the vulnerability fix.
 * - Creates a new branch from the default branch
 * - Commits the provided file changes
 * - Opens a PR for review
 */
export async function createPullRequest(
  params: CreatePullRequestParams
): Promise<CreatePullRequestResult> {
  const { repoOwner, repoName } = params;
  const octokit = getOctokit(repoOwner, repoName);

  // 1. Get default branch + latest SHA
  const { data: repoData } = await octokit.repos.get({ 
    owner: repoOwner, 
    repo: repoName 
  });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  // 2. Create branch
  await octokit.git.createRef({
    owner: repoOwner,
    repo: repoName,
    ref: `refs/heads/${params.branchName}`,
    sha: baseSha,
  });

  // 3. Get base tree
  const { data: commitData } = await octokit.git.getCommit({
    owner: repoOwner,
    repo: repoName,
    commit_sha: baseSha,
  });

  // 4. Create blobs for each file
  const treeItems = await Promise.all(
    params.files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner: repoOwner,
        repo: repoName,
        content: Buffer.from(file.content).toString("base64"),
        encoding: "base64",
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  // 5. Create tree
  const { data: newTree } = await octokit.git.createTree({
    owner: repoOwner,
    repo: repoName,
    base_tree: commitData.tree.sha,
    tree: treeItems,
  });

  // 6. Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner: repoOwner,
    repo: repoName,
    message: `fix: remediate ${params.cveId}\n\n${params.body}`,
    tree: newTree.sha,
    parents: [baseSha],
  });

  // 7. Update branch ref
  await octokit.git.updateRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${params.branchName}`,
    sha: newCommit.sha,
  });

  // 8. Open PR
  const { data: pr } = await octokit.pulls.create({
    owner: repoOwner,
    repo: repoName,
    title: params.title,
    body: params.body,
    head: params.branchName,
    base: defaultBranch,
  });

  return { prUrl: pr.html_url, prNumber: pr.number };
}

// ---------------------------------------------------------------------------
// Tool 3: readIssues
// ---------------------------------------------------------------------------

export interface ReadIssuesParams {
  labels?: string[];     // e.g. ["vulnerability", "security"]
  searchTerm?: string;   // free-text filter (matched against title + body)
  state?: "open" | "closed" | "all";
  maxResults?: number;
  
  // Optional repository context (defaults to config values)
  repoOwner?: string;
  repoName?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reads issues from the GitHub repo, optionally filtered by labels and/or
 * a search term. Useful for the agent to discover existing vulnerability
 * reports or related discussions.
 */
export async function readIssues(
  params: ReadIssuesParams = {}
): Promise<GitHubIssue[]> {
  const owner = params.repoOwner ?? config.github.defaultOwner;
  const repo = params.repoName ?? config.github.defaultRepo;
  const maxResults = params.maxResults ?? 25;

  // If a search term is provided, use the search API for full-text matching
  if (params.searchTerm) {
    const labelFilter = params.labels?.length
      ? params.labels.map((l) => `label:"${l}"`).join(" ")
      : "";
    const stateFilter = params.state && params.state !== "all"
      ? `state:${params.state}`
      : "";
    const q = [
      params.searchTerm,
      `repo:${owner}/${repo}`,
      "is:issue",
      stateFilter,
      labelFilter,
    ]
      .filter(Boolean)
      .join(" ");

    const { data } = await octokit.search.issuesAndPullRequests({
      q,
      per_page: maxResults,
      sort: "updated",
      order: "desc",
    });

    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      body: item.body ?? "",
      state: item.state,
      labels: item.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? ""
      ),
      url: item.html_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }

  // Otherwise use the standard list endpoint with label filtering
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: params.state ?? "open",
    labels: params.labels?.join(","),
    per_page: maxResults,
    sort: "updated",
    direction: "desc",
  });

  return data
    .filter((item) => !item.pull_request) // exclude PRs
    .map((item) => ({
      number: item.number,
      title: item.title,
      body: item.body ?? "",
      state: item.state ?? "open",
      labels: item.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? ""
      ),
      url: item.html_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
}

// ---------------------------------------------------------------------------
// Tool 4: createApprovalTagWorkflow
// ---------------------------------------------------------------------------

export interface CreateApprovalTagWorkflowParams {
  tagName: string;
  cveId: string;
  message: string;
  imageName?: string;
  
  // Required repository context
  repoOwner: string;
  repoName: string;
}

export interface CreateApprovalTagWorkflowResult {
  tagName: string;
  tagUrl: string;
  workflowRunUrl: string;
  requiresApproval: true;
}

/**
 * Custom API tool that:
 *   1. Creates an annotated Git tag on the default branch
 *   2. Dispatches the `rebuild-image.yml` workflow with that tag
 *   3. The workflow uses a GitHub Environment with required reviewers,
 *      so a human must approve before the image is actually built.
 *
 * Returns the tag URL and workflow URL so the user can go approve it.
 */
export async function createApprovalTagWorkflow(
  params: CreateApprovalTagWorkflowParams
): Promise<CreateApprovalTagWorkflowResult> {
  const { repoOwner, repoName } = params;
  const octokit = getOctokit(repoOwner, repoName);

  // 1. Get default branch HEAD
  const { data: repoData } = await octokit.repos.get({ 
    owner: repoOwner, 
    repo: repoName 
  });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${defaultBranch}`,
  });

  // 2. Create annotated tag
  const { data: tagObj } = await octokit.git.createTag({
    owner: repoOwner,
    repo: repoName,
    tag: params.tagName,
    message: `${params.message}\n\nRemediation for ${params.cveId}`,
    object: refData.object.sha,
    type: "commit",
  });

  // 3. Create tag reference
  await octokit.git.createRef({
    owner: repoOwner,
    repo: repoName,
    ref: `refs/tags/${params.tagName}`,
    sha: tagObj.sha,
  });

  // 4. Dispatch the rebuild workflow (requires env approval to proceed)
  try {
    await octokit.actions.createWorkflowDispatch({
      owner: repoOwner,
      repo: repoName,
      workflow_id: "rebuild-image.yml",
      ref: defaultBranch,
      inputs: {
        tag: params.tagName,
        cve_id: params.cveId,
        vuln_id: params.vulnId,
        callback_url: params.callbackUrl,
        ...(params.imageName ? { image_name: params.imageName } : {}),
      },
    });
  } catch (err) {
    console.warn(
      "[createApprovalTagWorkflow] Workflow dispatch failed (may not exist yet):",
      err
    );
  }

  const tagUrl = `https://github.com/${repoOwner}/${repoName}/releases/tag/${params.tagName}`;
  const workflowRunUrl = `https://github.com/${repoOwner}/${repoName}/actions`;

  return {
    tagName: params.tagName,
    tagUrl,
    workflowRunUrl,
    requiresApproval: true,
  };
}
