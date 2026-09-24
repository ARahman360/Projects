# Halali development workflow

These instructions apply to coding tasks in the Halali project. The user has
authorized automatic commits and pushes after successfully completed changes,
subject to the branch approval and verification rules below. Do not ask the user
to repeat this authorization for each task.

## Repository and scope

- Halali is a subdirectory of the existing `C:/Users/arahm/WORKSPACE/Projects`
  Git repository. Do not initialize another repository or change its remotes,
  GitHub connection, or upstream configuration.
- Before each task, inspect the repository root, current branch, upstream,
  staged changes, working changes, and unpushed commits. Preserve other work.
- The user explicitly approved automatic pushes to both `github1/main` and
  `github2/main` on 2026-09-24. While on `main`, push each verified task commit
  to both destinations without asking again. Keep the existing upstream
  (`github2/main`) and remote connections unchanged.
- Stay on the current development branch. Do not switch or create branches
  without user direction. If the branch is detached or its push destination is
  missing or ambiguous, resolve that with the user before pushing.
- The user's approval includes the previously disclosed outgoing commit
  `8d48ee1` (`Checkpoint HomeFoods marketplace improvements`). This does not
  authorize staging any unrelated working changes.

## Complete and verify each requested change

1. Implement the requested change and run relevant tests and available lint,
   syntax, type, or build checks. For interface changes, also check the affected
   behavior in the browser when available. Check for errors and fix any caused
   by the task.
2. This project currently has no package manifest or automated test suite.
   Use `node --check app.js` and `node --check learn.js` when relevant, check
   embedded scripts when changed, and perform targeted browser checks for
   changed behavior. Report missing checks honestly; syntax checks are not a
   substitute for behavior tests. Use any test tooling added in future tasks.
3. Review the Git diff, including new files, for correctness, task scope, and
   sensitive content. Never commit credentials, API keys, tokens, private keys,
   `.env` or `.env.*` files, or unrelated changes. Do not print secret values.
4. Stage only the task's files or hunks using explicit paths. Never use blanket
   staging such as `git add .` or `git add -A`. Do not include sibling projects,
   pre-existing deletions, or another task's staged changes. If changes cannot
   be safely separated, stop and report the conflict instead of altering them.
5. Review the staged diff and run `git diff --cached --check`. If tests or
   required checks fail, fix the task's failures and rerun the relevant checks.
   Never push while tests fail. If verification is blocked, report the blocker
   and do not claim successful verification or push an unverified change.
6. Commit the verified task changes with a clear, descriptive message. Do not
   create an empty commit. Do not amend other people's commits.
7. Automatically push verified task commits without asking for repeated
   permission. On `main`, fetch `main` from both `github1` and `github2`, inspect
   outgoing commits, and confirm that each remote branch is an ancestor of the
   commit being pushed. Push the same verified commit with explicit refspecs
   to `github1` and `github2`, each targeting `refs/heads/main`. On another
   development branch, use that branch's existing upstream instead; never
   send another branch's work to `main` automatically. Obtain approval before
   including unrelated pre-existing outgoing commits beyond those approved
   above. If one destination fails, report each destination separately and
   preserve any successful push; do not roll back shared history.
8. Use only a normal fast-forward push. Never force-push (including
   `--force-with-lease`), rewrite shared history, reset away work, or overwrite
   other people's changes. If the remote has diverged or rejects the push,
   preserve the local commit and report the blocker.

## End-of-task report

After every task, report:

- The completed change and tests/checks run, with pass, fail, or not-run status.
- The commit hash, or why no commit was created.
- The push destination and success/failure status, or why the push was withheld.

Read-only tasks do not require a commit or push; report them as not applicable.
