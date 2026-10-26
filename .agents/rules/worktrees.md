# Parallel Work: Git Worktrees

Several agent threads may work on this repository at the same time. Never implement or fix an issue directly in the main checkout (`b2car-app`, usually on `dev`): file changes, test runs, and git commands there affect every other thread.

Before modifying files for an issue (IMPLEMENT or FIX, or any multi-file code change):

1. Create a dedicated worktree and branch from `dev`, or reuse the issue's worktree if it already exists:

   ```sh
   git worktree add ../worktrees/b2car-app/<ISSUE_ID> -b agent/<ISSUE_ID>-<short-slug> dev
   ```

2. Edit, test, lint, and typecheck only inside that worktree.
3. Git-ignored files are not present in a new worktree: copy `.env` from the main checkout and run `npm install` before validating.
4. Plans and work artifacts stay in the main checkout's `.codex-work/<ISSUE_ID>/` (git-ignored and shared between threads). Read and write them there using the main checkout's absolute path.

PLAN may run in the main checkout because it only writes to `.codex-work/`. REVIEW must read the code and diff from the issue's worktree.

Outside your own worktree, do not run `git add .`, `git commit -a`, `git stash`, `git checkout -- <path>`, `git reset`, `git clean`, or switch branches: these capture or discard another thread's work. Inside your worktree, stage only the files you changed.
