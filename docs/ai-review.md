# AI Output Review

This is a retrospective record reconstructed from the project conversation and
the current source tree. No manual user-authored code changes were recorded in
the available history. "Modifications made" notes later validation fixes or
documentation clarifications.

### Output 01 - Initial repository review

- **Prompt:** [Prompt 01](ai-prompts.md#prompt-01-initial-repository-review)
- **What AI generated:** A five-line project summary, existing-phase inventory, plan-conflict notes, and proposed first steps; no code.
- **What was correct:** Identified the MERN/TypeScript stack, `/api` contract, member/admin roles, and the phase-by-phase constraint.
- **What was incorrect / risky:** The phase inventory was an inspection snapshot, not proof that every listed phase met its tests.
- **Modifications made:** None; the request was explicitly read-only.
- **Why the changes were necessary:** No changes were allowed for the initial review.

### Output 02 - Phase 2 auth and profile APIs

- **Prompt:** [Prompt 02](ai-prompts.md#prompt-02-phase-2)
- **What AI generated:** Profile update and password reset routes, user fields, and route tests.
- **What was correct:** Reset tokens are hashed, expire, and are single-use; profile and auth responses exclude password/reset secrets.
- **What was incorrect / risky:** Tests were skipped at the user's direction, so the phase had no test evidence at completion. A reset-test mock later needed correction when the full suite was run.
- **Modifications made:** The later validation pass corrected the test mock; Phase 11 documents the development-only reset token behavior.
- **Why the changes were necessary:** Keep test expectations aligned with the actual reset-token flow and make the non-production token exposure clear.

### Output 03 - Phase 3 book catalog backend

- **Prompt:** [Prompt 04](ai-prompts.md#prompt-04-phase-3)
- **What AI generated:** Book model, catalog/admin routes, seed script, and book tests.
- **What was correct:** ISBN normalization/uniqueness, copy-count validation, and admin-only create/update match the plan.
- **What was incorrect / risky:** The phase summary described the seed script as idempotent. It actually deletes existing loans, users, and books before reseeding; the command is destructive. Tests/type-check were also not run at that phase.
- **Modifications made:** No application-code change in Phase 11; the README and known-issues document now warn that seeding clears those collections.
- **Why the changes were necessary:** Prevent an operator from running the seed command against a database containing data they intend to keep.

### Output 04 - Phase 4 borrowing and returning

- **Prompt:** [Prompt 05](ai-prompts.md#prompt-05-phase-4)
- **What AI generated:** Loan model/indexes, borrow/return/current/history routes, derived status helper, and loan tests.
- **What was correct:** The partial unique active-loan index, member-scoped queries, 14-day due dates, and computed overdue status follow the plan.
- **What was incorrect / risky:** The first test run exposed an unrelated password-reset mock failure; borrow/return writes are also not transactional and can leave counts inconsistent after a crash.
- **Modifications made:** The test mock/type issues were corrected during later validation. The non-transaction limitation is recorded in known issues.
- **Why the changes were necessary:** Restore a reliable test suite and accurately disclose the multi-document write limitation.

### Output 05 - Phase 5 dashboards

- **Prompt:** [Prompt 06](ai-prompts.md#prompt-06-phase-5)
- **What AI generated:** Member/admin dashboard endpoints, shared current-loan query, and dashboard tests.
- **What was correct:** Member queries are scoped to the signed-in member; admin counts and the `availableCopies <= 2` threshold match the plan.
- **What was incorrect / risky:** The test command was unavailable/denied at the time, so the phase's initial completion report could not confirm the new tests.
- **Modifications made:** The suite was run and corrected in Phase 6; the final backend suite passes.
- **Why the changes were necessary:** Ensure dashboard assertions match the real query results before relying on them.

### Output 06 - Phase 6 integration suite

- **Prompt:** [Prompt 07](ai-prompts.md#prompt-07-phase-6)
- **What AI generated:** In-memory MongoDB integration coverage, test script/dependency updates, and test-case results.
- **What was correct:** Tests use an ephemeral database, initialize indexes, clear data between cases, and exercise last-copy and duplicate-borrow concurrency.
- **What was incorrect / risky:** Initial validation surfaced a dashboard assertion-order issue and Mongoose typing problems.
- **Modifications made:** Those test/type issues were fixed; the final result was 21 passing tests and a passing server type-check.
- **Why the changes were necessary:** Make the full suite reliable and preserve the model's copy-count validation under the installed Mongoose version.

### Output 07 - Phase 7 auth client scaffold

- **Prompt:** [Prompt 08](ai-prompts.md#prompt-08-phase-7)
- **What AI generated:** React/Vite setup, auth context/pages, protected routes, navigation, and Axios API handling.
- **What was correct:** The client uses the planned API prefix and role guards; build/lint and backend tests passed.
- **What was incorrect / risky:** Browser tokens are stored in `localStorage`; the client does not have an automated component/E2E test runner.
- **Modifications made:** No later application-code change was needed for Phase 11; the storage/test limitations are documented.
- **Why the changes were necessary:** Make operational/security limits visible without expanding scope into a new auth or test framework.

### Output 08 - Phase 8 catalog and borrow UI

- **Prompt:** [Prompt 09](ai-prompts.md#prompt-09-phase-8)
- **What AI generated:** Catalog search/filter/pagination, book details, borrow/refetch behavior, and fallback covers.
- **What was correct:** Client build/lint, backend tests, and a mocked browser flow passed; broken cover URLs use the default asset.
- **What was incorrect / risky:** The browser flow at that point was mocked rather than a full seeded end-to-end run.
- **Modifications made:** Phase 10 later exercised the real UI and isolated seeded database; no product-code fix was required.
- **Why the changes were necessary:** Validate server/client integration under actual seeded data rather than relying only on mocks.

### Output 09 - Phase 9 loans, dashboards, and admin UI

- **Prompt:** [Prompt 10](ai-prompts.md#prompt-10-phase-9)
- **What AI generated:** Member loan/history/dashboard pages, admin dashboard, and admin book create/edit form.
- **What was correct:** Build/lint and backend tests passed; mocked browser flows covered role-based navigation and error states.
- **What was incorrect / risky:** As with Phase 8, those browser checks were not yet the manual seeded-data edge-case pass required by Phase 10.
- **Modifications made:** Phase 10 completed those manual checks and recorded them; no application-code changes were needed.
- **Why the changes were necessary:** Close the gap between component/mock flows and the required end-to-end scenarios.

### Output 10 - Phase 10 manual end-to-end checks

- **Prompt:** [Prompt 11](ai-prompts.md#prompt-11-phase-10)
- **What AI generated:** An isolated in-memory test environment and the Phase 10 test-case record.
- **What was correct:** All ten UI cases passed; the seed ran only against the isolated database, and the full backend suite passed 21/21.
- **What was incorrect / risky:** The temporary test helper and local services had to be cleaned up; they were not product features.
- **Modifications made:** The helper and temporary services were removed/stopped; only `docs/test-cases.md` was committed for Phase 10.
- **Why the changes were necessary:** Avoid leaving temporary infrastructure or unintentionally committing earlier-phase work.

### Output 11 - Phase 11 submission documentation

- **Prompt:** [Prompt 12](ai-prompts.md#prompt-12-phase-11-documentation-and-submission)
- **What AI generated:** Root setup guide and the requested requirements, business-rule, assumption, prompt/review, test, and known-issue documents.
- **What was correct:** The docs are checked against the current routes, models, scripts, environment example, and test output; `server/.env` is ignored and not tracked.
- **What was incorrect / risky:** Prompt/review notes are backfilled rather than contemporaneous; changes not present in the conversation history cannot be independently attributed.
- **Modifications made:** Phase 6 tests were reorganized into functional, negative, and edge-case result tables; the Phase 3 seed behavior is explicitly described as destructive.
- **Why the changes were necessary:** Match the Phase 11 deliverables to the actual repository behavior and preserve an honest review trail.

### Output 12 - Phase 12 overdue fine

- **Prompt:** [Prompt 13](ai-prompts.md#prompt-13-phase-12-overdue-fine)
- **What AI generated:** A read-time overdue fine in loan responses and a fine column on My Books and loan history.
- **What was correct:** Fine values are derived from loan dates, are not stored, and use `returnedAt` to keep late-return amounts fixed.
- **What was incorrect / risky:** The plan does not specify a currency or whether partial days count as a full day.
- **Modifications made:** Counted each started 24-hour period as one unit and added unit/integration coverage for before-due, just-overdue, late-return, current-loan, and history cases.
- **Why the changes were necessary:** Make the plan's simple `daysOverdue × 1` formula deterministic while keeping fines read-only and scoped to the requested member pages.