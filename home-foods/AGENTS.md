<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Persistent completion workflow for Home Foods

These instructions apply to future coding tasks in this project. The user has
authorized automatic task-scoped commits and normal pushes after successful
verification, using the approved destinations below. Do not ask the
user to repeat this authorization on each task.

### Approved push destinations

- The user explicitly approved automatic commits and pushes to **both
  `github1/main` and `github2/main`** after every completed, verified change.
  No repeated approval is required for `main` or either of these destinations.
- When working on local `main`, publish the same reviewed commit to both remotes
  as part of the same task completion. Check both destinations before pushing.
  Cross-remote pushes are not atomic: report each result separately and, if one
  fails, preserve the successful push and retry only the failed destination when
  safe. Never force-push to make the remotes match.
- For other development branches, use the current branch's existing configured
  upstream. If the branch has no upstream, HEAD is detached, or the target is
  ambiguous, ask for the destination rather than inventing one.
- Keep the existing GitHub connections: `github1` is `ARahman360/Projects` and
  `github2` is `abdurrahmanXY/Projects`. Local `main` tracks `github2/main`.
  Inspect the actual branch/upstream at the start of each task. Do not silently
  publish a different development branch to `main`; honor later user instructions.

### Complete, verify, review, commit and push

1. Inspect repository status, current branch, upstream and existing changes before
   editing. This project's Git root is the parent `Projects` directory; changes
   in sibling projects are outside the task unless explicitly requested.
2. Complete the requested work. Run relevant tests and project checks, inspect
   their results and fix errors introduced by the task. Use suitable validation
   for documentation-only changes. If a required check fails or cannot run, do
   not push; report the failure or blocker honestly.
3. Review the complete task diff and check for accidental edits, sensitive data
   and generated artifacts. Never commit credentials, API keys, tokens, private
   keys, `.env` files or `.env.*` files, including environment example files.
   Never copy secret values into commands, logs, reports or commit messages.
4. Stage only explicit paths and, when needed, individual hunks belonging to the
   current task. Do not use blanket staging such as `git add .` or `git add -A`.
   Preserve unrelated changes, including earlier uncommitted work in this project.
   Review the staged diff and staged file list before committing. Do not include
   unrelated files already staged by the user.
5. Create a commit with a clear message describing the requested change. Do not
   create an empty commit when there are no changes. Do not amend existing commits
   unless the user explicitly requests it.
6. Before pushing, fetch each approved destination and inspect its full outgoing
   commit range. A push sends all unpushed ancestors: do not push unrelated,
   unreviewed or secret-containing commits. If the remote has diverged or the
   outgoing range includes unrelated work, stop and report the blocker rather
   than rewriting history or publishing it accidentally.
7. After successful verification and review, automatically push the task commit
   to both `github1/main` and `github2/main` when on local `main`, using explicit
   destinations (`git push github1 HEAD:refs/heads/main` and
   `git push github2 HEAD:refs/heads/main`). For other development branches, use
   the approved existing upstream with an explicit remote/branch destination.
   Never force-push (including force-with-lease), reset away others' work, delete
   remote branches, bypass failing checks or overwrite other people's changes.
   A rejected push must be reported; do not force it through.
8. Do not create a repository, replace remotes, change the GitHub connection,
   switch branches or create a new branch just to satisfy this workflow without
   the user's authorization.
9. At the end of every task, report the checks run and their results, the commit
   hash (or why no commit was created), and the push destination/status (or why
   the push was blocked). Never claim a commit or push succeeded without checking
   the Git command result.
