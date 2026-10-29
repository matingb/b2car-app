# Parallel Work & Git Worktrees

Use the current checkout and branch by default. A dedicated worktree and branch are optional isolation tools; use them when parallel contributors need separate files, the user requests isolation, or a task has a concrete conflict or cleanup risk that benefits from a separate checkout.

Before editing, inspect the current branch and `git status`, then preserve existing local changes. Do not switch branches, stash, reset, clean, or restore paths when that could capture or discard another contributor's work.

When isolation is useful, create a worktree from the requested base branch or reuse the worktree for that task. Install dependencies and provide required local configuration before validating there. Stage only files changed for the task.

Plans and review artifacts may stay in `.codex-work/<ISSUE_ID>/` when the task uses an issue ID. PLAN can use the current checkout when it only writes planning artifacts; REVIEW should inspect the source branch or worktree named by the user.
