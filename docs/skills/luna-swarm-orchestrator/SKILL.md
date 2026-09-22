---
name: luna-swarm-orchestrator
description: "Orchestrate small coding agents such as Luna for a large implementation or audit: split ownership, pair Luna Coders with Luna Destroyers, demand production evidence, and integrate follow-up waves. Use when the user explicitly asks for a swarm, Luna agents, parallel subagents, or delegation to cheaper models."
---

# Luna Swarm Orchestrator

Use small agents as bounded executors and adversarial reviewers. The orchestrator
owns architecture, integration, acceptance, and the final truth about readiness.

## Start from evidence

Inspect the branch, working tree, local instructions, tests, runtime entry points,
and recent handoffs. Record the base SHA and protected paths. Separate known facts
from hypotheses; do not build a wave on an assumed foundation.

Keep handoffs operationally complete. Shorten repetition and prose, but retain
the base SHA, owned files, production entry points, writer ownership, commands,
evidence, not-run checks, and known risks. A compact handoff that loses one of
these fields is worse than a longer one.

## Assign distinct roles

**Luna Coder** owns one small vertical slice. It implements observable behavior,
adds meaningful tests, checks the real entry point, and returns one clean commit.

**Luna Destroyer** receives the Coder's commit after it exists. It tries to falsify
the claimed status through negative cases, real production dependencies,
persistence, browser behavior, and integration seams. It starts read-only. It may
fix only localized defects in explicitly allowed files and must use a separate
commit.

Do not send Coder and Destroyer to edit the same live files concurrently. Do not
send several Coders to the same seam. The sequence is Coder → Destroyer →
orchestrator integration. Independent slices may run in parallel.

## Shape the wave

Choose disjoint tasks with one concrete outcome, explicit non-goals, a small
allowed-file set, named forbidden paths, production entry points, authoritative
writers, evidence requirements, and a commit/report deliverable. Give shared
integration files to one owner. Keep an orchestrator slot free when useful.

Read [references/prompt-contracts.md](references/prompt-contracts.md) for Coder,
Destroyer, and corrective-wave prompt templates.

## Demand production evidence

Require exactly one status:

- **foundation**: API/model exists but the real app does not load or call it;
- **connected**: production code loads it and a real user path reaches it;
- **verified**: connected plus real dependencies, persistence, and the relevant
  browser/network scenario;
- **blocked**: a named dependency prevents proof.

A mock cannot replace the contract under review. Regex and `innerHTML` do not
prove a browser path. One client does not prove synchronization. Every agent must
list mocks, justify external substitutes, and name checks as `not-run` when
omitted.

## Integrate skeptically

For every Coder/Destroyer pair:

1. inspect both diffs and file ownership;
2. read tests before reports;
3. trace UI → intent → sanitizer → authoritative writer → persistence/projection;
4. identify the single owner of version, undo, journal, and storage;
5. run targeted tests on the candidate commits;
6. integrate only passing blocks and resolve conflicts deliberately;
7. run combined tests on the integrated tree;
8. use a real browser for UI and two clients for synchronization;
9. commit each substantial accepted block before the next risky merge.

The Codex orchestrator remains the final integrator and readiness authority. A
Coder or Destroyer report can recommend acceptance, but cannot promote a block
to verified without the orchestrator tracing the production path and checking
the evidence against the acceptance gate.

Read [references/acceptance-gate.md](references/acceptance-gate.md) for the full
checklist and known false positives.

## Grow the next wave

Turn findings into smaller corrective tasks with an exact failed contract and
required evidence. Prefer this rhythm:

1. parallel Coders on disjoint slices;
2. Destroyers against completed commits;
3. orchestrator audit and integration;
4. combined production tests;
5. localized corrective wave;
6. browser/network acceptance;
7. handoff with SHAs, statuses, remaining seams, and commands.

Stop spawning when integration debt exceeds parallel benefit. Finish the seam
locally or serialize dependent work.
