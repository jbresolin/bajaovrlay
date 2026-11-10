# Docs

The design authority for BajaOvrLay is **`00-concept.md`** ("00 — Concept & Architecture").
That file is authoritative between milestones: as-built changes are written into it in the PR
that makes them. The Plane page of the same name (project BAJAOVRLAY, workspace `personal`)
is the human-readable mirror, which João updates from that file at each milestone close.
Inside it, the decision records at the end (§18, §19) win over the earlier sections.

Task briefs are not kept here: each lives only in its Plane work item (BAJAOVRLAY-n). This
folder holds conventions, decisions, ADRs and cross-repo contracts only.

- `00-concept.md` — what the system is, its architecture, state model, rules and milestones.
- `testing-style.md` — the canonical example test every test file copies (created in BAJAOVRLAY-7).
- `buttons.md` — driving the show from Companion, a Stream Deck or an Ulanzi D200 over HTTP: open mode or tokens, buttons, button colours, the D200's per-button status URLs and a `curl` line per shortcut, and an HTTP trigger with a body (BAJAOVRLAY-28, BAJAOVRLAY-56, BAJAOVRLAY-48).
- `triggers.md` — for the operator, in pt-BR: triggers that run a macro on an OBS scene, an HTTP call, an inbox event or a schedule time, with the data each carries (BAJAOVRLAY-48).
- `youtube.md` — João's runbook, in pt-BR: a Google Cloud project, the YouTube Data API v3 key in the env, a "Chat do YouTube (Super Chats)" source with the live's address, and what the daily quota means for a day of racing (BAJAOVRLAY-35).
