# Copilot Prompts Used

Prompts are listed in chronological order. Phase/file scopes identify the
repository area each request targeted.

## Prompt 01: Initial repository review

**Phase/files:** Initial read-only review of `IMPLEMENTATION_PLAN.md`, repository
structure, package manifests, models, routes, middleware, and tests.

```text
I'm building a Library Management System for a job assessment. I've attached IMPLEMENTATION_PLAN.md,
which is the source of truth for this project.

Please do the following and DO NOT write or change any code yet:

1. Read IMPLEMENTATION_PLAN.md fully.
2. Inspect the current repo (folder structure, package.json files, existing models, routes,
   middleware and tests).
3. Reply with:
   a. A 5-line summary of what you understood about the project, stack and rules.
   b. What already exists in the repo and which plan phases it covers (Phase 0 and Phase 1 should
      be mostly done).
   c. Anything in the repo that conflicts with the plan (folder layout, route prefix, error format,
      naming), and what you propose to change.
   d. Your proposed first steps for Phase 0 and Phase 1.

Working rules for this whole project:
- Follow the plan's data models, API contract, error format and folder structure exactly.
- Implement ONE phase at a time, only when I name it. Stop when that phase's "Done when" list is met.
- Do not add features, libraries or abstractions that are not in the plan. Keep the code simple.
- If code already exists, review and extend it; don't rewrite it.
- For every phase, also write the tests listed in the plan.
- Never put secrets in code; use .env and keep .env.example updated.
- After finishing a phase, give me a short summary of what you changed and why, so I can
  record it in docs/ai-review.md.
```

## Shared phase-task body: Phases 2-10

Prompts 02 and 04-11 used this same instruction body after the phase-specific
opening sentence:

```text
- Follow every step in that phase exactly, in the order given.
- Add the tests listed for that phase.
- Don't touch code outside this phase unless it's required, and tell me if you do.
- When finished, run the tests, then summarise: files created/changed, what each does,
  and anything you were unsure about.
```

### Prompt 02: Phase 2

**Opening:** `Implement Phase 2 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Auth/profile routes and user model, auth tests. The shared
phase-task body above followed the opening.

### Prompt 03: Phase 2 test instruction

**Files/area:** Phase 2 validation instruction for the preceding auth/profile
changes.

```text
Skip running tests
```

### Prompt 04: Phase 3

**Opening:** `Implement Phase 3 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Book model/routes, seed script, package scripts, book tests.
The shared phase-task body above followed the opening.

### Prompt 05: Phase 4

**Opening:** `Implement Phase 4 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Loan model/routes/status helper, loan tests, related book test
and known-issues note. The shared phase-task body above followed the opening.

### Prompt 06: Phase 5

**Opening:** `Implement Phase 5 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Dashboard routes/query helper/tests and route/test-script wiring.
The shared phase-task body above followed the opening.

### Prompt 07: Phase 6

**Opening:** `Implement Phase 6 of IMPLEMENTATION_PLAN.md.`

**Files/area:** In-memory integration tests, test dependencies/scripts,
test-case record, validation fixes. The shared phase-task body above followed
the opening.

### Prompt 08: Phase 7

**Opening:** `Implement Phase 7 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Client scaffold, routing, auth context/pages, shared UI, and API
client. The shared phase-task body above followed the opening.

### Prompt 09: Phase 8

**Opening:** `Implement Phase 8  of IMPLEMENTATION_PLAN.md.`

**Files/area:** Catalog, book details, book cards/covers, fallback asset. The
shared phase-task body above followed the opening.

### Prompt 10: Phase 9

**Opening:** `Implement Phase 9 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Member loan/history/dashboard UI and admin dashboard/book form.
The shared phase-task body above followed the opening.

### Prompt 11: Phase 10

**Opening:** `Implement Phase 10 of IMPLEMENTATION_PLAN.md.`

**Files/area:** Manual E2E checklist and `docs/test-cases.md`. The shared
phase-task body above followed the opening.

## Prompt 12: Phase 11 documentation and submission

**Files/area:** Root `README.md` and the requested submission documents in
`docs/`.

```text
Implement Phase 11 of IMPLEMENTATION_PLAN.md.

- Follow every step in that phase exactly, in the order given.
- Add the tests listed for that phase.
- Don't touch code outside this phase unless it's required, and tell me if you do.
- When finished, run the tests, then summarise: files created/changed, what each does,
  and anything you were unsure about.
```