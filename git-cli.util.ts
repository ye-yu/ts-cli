import { executeCli, spawnCliProcess } from "./spawn.util.ts";

export type GitStatusResult = {
  currentBranch: string;
  trackingBranch: string | null;
  isWorkingDirectoryClean: boolean;
  rebaseOngoing: boolean;
  changes: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };
}

const gitBranchRegex = /On branch ([^\r\n]+)|currently rebasing branch '([^']+)'/m
const gitTrackingBranchRegex = /Your branch .*? '([^']+)'/m
const gitStatusChangesRegex = /Changes (not staged for commit)|(to be committed)|Unmerged paths:|both added:/gm
const gitRebaseRegex = /interactive rebase in progress|currently rebasing branch '/m

export function extractGitStatus(commandOutput: string): GitStatusResult {
  const branchMatch = commandOutput.match(gitBranchRegex);
  if (!branchMatch) {
    throw new Error("Failed to parse git status output.", { cause: commandOutput });
  }

  return {
    currentBranch: branchMatch[1] ?? branchMatch[2],
    trackingBranch: commandOutput.match(gitTrackingBranchRegex)?.[1] ?? null,
    isWorkingDirectoryClean: !commandOutput.match(gitStatusChangesRegex),
    rebaseOngoing: gitRebaseRegex.test(commandOutput),
    // not yet implemented
    changes: {
      staged: [],
      unstaged: [],
      untracked: [],
    }
  }
}

export const GIT = {
  status(repoDir: string): GitStatusResult {
    const { stdout, stderr } = executeCli("git", ["status"], { cwd: repoDir });
    if (stderr) {
      console.error(`Error executing git status in ${repoDir}:`, stderr);
      throw new Error(stderr);
    }
    return extractGitStatus(stdout);
  },
  add: {
    files(files: string[], repoDir: string) {
      executeCli("git", ["add", ...files], { cwd: repoDir });
    }
  },
  commit: {
    message(message: string, repoDir: string) {
      executeCli("git", ["commit", "-S", "-m", `"${message}"`], { cwd: repoDir });
    }
  },
  pull: {
    current(repoDir: string) {
      executeCli("git", ["pull"], { cwd: repoDir });
    },
    rebase(repoDir: string) {
      executeCli("git", ["pull", "--rebase"], { cwd: repoDir });
    }
  },
  push: {
    toRemote(remote: string, branch: string, repoDir: string, force = false) {
      const args = ["push", remote, branch];
      if (force) {
        args.push("--force");
      }
      executeCli("git", args, { cwd: repoDir });
    },
    toRemoteWithUpstream(remote: string, branch: string, repoDir: string) {
      executeCli("git", ["push", "--set-upstream", remote, branch], { cwd: repoDir });
    },
  },
  showRef: {
    branchExists(branchName: string, repoDir: string): boolean {
      const command = `show-ref --quiet refs/heads/${branchName}`;
      const { code } = executeCli("git", command.split(" "), { cwd: repoDir });
      return code === 0;
    }
  },
  branch: {
    exists(branchName: string, repoDir: string): boolean {
      return GIT.showRef.branchExists(branchName, repoDir);
    },
    setUpstream(remote: string, branchName: string, repoDir: string) {
      executeCli("git", ["branch", "--set-upstream-to", `${remote}/${branchName}`, branchName], { cwd: repoDir });
    }
  },
  switch: {
    async newBranch(branchName: string, repoDir: string) {
      await spawnCliProcess("git", ["switch", "-c", branchName], { cwd: repoDir });
    },
    async existingBranch(branchName: string, repoDir: string) {
      await spawnCliProcess("git", ["switch", branchName], { cwd: repoDir });
    }
  },
  fetch: {
    all(repoDir: string, depth?: number) {
      const args = ["fetch"];
      if (depth !== undefined) {
        args.push(`--depth=${depth}`);
        args.push('--all')
      }
      executeCli("git", args, { cwd: repoDir });
    },
    branch(remote: string, branchName: string, repoDir: string): boolean {
      const sourceRef = `refs/heads/${branchName}`;
      const remoteBranch = executeCli("git", ["ls-remote", "--exit-code", "--heads", remote, sourceRef], { cwd: repoDir, silent: true });
      if (remoteBranch.code === 2) {
        return false;
      }
      if (remoteBranch.code !== 0) {
        throw new Error(`Failed to check remote branch ${branchName}.`, { cause: remoteBranch.stderr });
      }
      const remoteRef = `refs/remotes/${remote}/${branchName}`;
      const { code } = executeCli("git", ["fetch", remote, `${sourceRef}:${remoteRef}`], { cwd: repoDir });
      return code === 0;
    }
  },
  remote: {
    configureFetchBranch(remote: string, branchName: string, repoDir: string) {
      const refspec = `+refs/heads/${branchName}:refs/remotes/${remote}/${branchName}`;
      const { stdout } = executeCli("git", ["config", "--get-all", `remote.${remote}.fetch`], { cwd: repoDir, silent: true });
      if (!stdout.split(/\r?\n/).includes(refspec)) {
        executeCli("git", ["config", "--add", `remote.${remote}.fetch`, refspec], { cwd: repoDir });
      }
    }
  },
  reset: {
    hardTo(ref: string, repoDir: string) {
      executeCli("git", ["reset", "--hard", ref], { cwd: repoDir });
    }
  },
  rebase: {
    abort(repoDir: string) {
      executeCli("git", ["rebase", "--abort"], { cwd: repoDir });
    }
  },

  // aliases
  repo: {
    buildFileCache(repoDir: string) {
      const { stdout: filterAStdout, stderr: filterAStderr } = executeCli("git", ["diff", "--cached", "--name-only", "--diff-filter=A"], { cwd: repoDir });
      if (filterAStderr) {
        console.error(`Error executing git diff --cached --name-only --diff-filter=A in ${repoDir}:`, filterAStderr);
        throw new Error(filterAStderr);
      }
      const { stdout: filterMStdout, stderr: filterMStderr } = executeCli("git", ["diff", "--cached", "--name-only", "--diff-filter=M"], { cwd: repoDir });
      if (filterMStderr) {
        console.error(`Error executing git diff --cached --name-only --diff-filter=M in ${repoDir}:`, filterMStderr);
        throw new Error(filterMStderr);
      }
      return {
        added: filterAStdout.split("\n").filter(Boolean),
        modified: filterMStdout.split("\n").filter(Boolean),
      };
    }
  }
}