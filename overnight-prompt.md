You are starting milestone M0 of BajaOvrLay. Read CLAUDE.md in this repo first and follow it throughout. I will be away for several hours; work unattended, do not wait for answers. Where a decision is genuinely mine, pick the conservative option and record it under "Decisions taken" in the PR description.

Work through three tasks in this order, each on its own branch off main, each with its own PR. The briefs are in their Plane work items (project BAJAOVRLAY). Do not stack branches: finish and push one before starting the next.

1. BAJAOVRLAY-7 (its Plane work item) — repo scaffold, CLAUDE.md already present, CI gates. This is the ONLY task you may squash-merge yourself, and only after GitHub Actions is green on the PR. Delete the branch after merging and pull main.

2. BAJAOVRLAY-10 (its Plane work item) — the race-clock OGraf graphic. Branch off the updated main. Open the PR with a full description and leave it open for my review. Do not merge.

3. BAJAOVRLAY-8 (its Plane work item) — server core. Branch off main (not off the race-clock branch). Open the PR and leave it open. Do not merge.

For every task: write the tests first in the style of docs/testing-style.md (created in task 1); run pnpm lint, typecheck, test and build locally before pushing; make sure CI passes on the PR; keep commits small with messages that say why.

If a task cannot be completed, leave the PR as a draft with a clear "Blocked: ..." section at the top of the description and move on to the next task.

When all three are done, write an M0 overnight report summarising what was built, what is waiting for review, decisions taken, and anything you would change in the briefs, and commit it on main directly (documentation only).
