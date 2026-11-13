# Library Management System — Implementation Plan

> **Stack:** MERN (MongoDB Atlas, Express, React, Node) · TypeScript · single repo with `server/` and `client/`
> **Deadline:** 13 Nov 2026 EOD
> **Philosophy:** simplest design that satisfies every requirement. No over-engineering.

---

## 0. How to use this file with Copilot

Paste this into Copilot Chat once at the start of a session:

```
Read IMPLEMENTATION_PLAN.md fully. Follow its conventions, data models and API contract exactly.
I will tell you which phase to implement. Implement ONLY that phase, step by step, and stop when
its "Done when" checklist is satisfied. Do not add features that are not in the plan.
If something already exists in the repo, review and extend it instead of rewriting it.
Keep code simple and readable. Add short comments only where the logic is non-obvious.
```

Then, per phase: *"Implement Phase N from IMPLEMENTATION_PLAN.md."* Each phase has a ready-made prompt you can use instead.

**Rules for every phase**
1. After each phase: run it, run its tests, `git commit -m "phase N: ..."`.
2. Log every Copilot prompt you used in `docs/ai-prompts.md`, and review each output in `docs/ai-review.md` (template in Phase 11). Do this *as you go*, not at the end.
3. Read and understand every generated line before committing. You will be asked to explain it.

---

## 1. Project at a glance

### Roles
| Role | How created | Can do |
|---|---|---|
| `member` | Public registration (always) | Browse, borrow, return, own history, own dashboard, own profile |
| `admin` | Seed script only | Add/edit books, admin dashboard. **Cannot borrow** (see assumptions) |

### Data models (3 collections)

**User**
| Field | Rules |
|---|---|
| name | required, trimmed |
| email | required, unique, lowercase, valid format |
| passwordHash | required (bcryptjs). Never returned in responses |
| role | `member` \| `admin`, default `member` |
| phone, address | optional (profile) |
| resetTokenHash, resetTokenExpires | optional (password reset) |
| timestamps | createdAt, updatedAt |

**Book**
| Field | Rules |
|---|---|
| title, author | required, trimmed |
| genre | required, trimmed |
| isbn | required, **unique**, trimmed (strip spaces/hyphens before saving; must be 10 or 13 digits) |
| description | optional |
| coverImage | optional URL string (frontend shows default image when empty/broken) |
| totalCopies | integer, **min 0** |
| availableCopies | integer, min 0, **must be ≤ totalCopies** (schema validator) |

**Loan**
| Field | Rules |
|---|---|
| user | ref User, required |
| book | ref Book, required |
| borrowedAt | Date, default now |
| dueDate | Date, `borrowedAt + 14 days`, set on creation |
| returnedAt | Date, null until returned |
| status | stored as `borrowed` \| `returned` only |

**Overdue is computed, not stored** (no cron job needed):
`isOverdue = status === 'borrowed' && dueDate < now`. API responses expose a derived `displayStatus` of `Borrowed | Returned | Overdue`.

**Indexes on Loan**
- Unique partial index `{ user: 1, book: 1 }` with `partialFilterExpression: { status: 'borrowed' }` → the database itself blocks duplicate active borrows (covers refresh, double-click, multi-tab).
- Normal index `{ user: 1, status: 1 }` for fast lookups.

### API contract (all under `/api`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Register (role forced to `member`) |
| POST | `/auth/login` | public | Returns `{ token, user }` |
| GET | `/auth/me` | auth | Current user |
| POST | `/auth/forgot-password` | public | Generate reset token |
| POST | `/auth/reset-password` | public | Set new password with token |
| PATCH | `/users/me` | auth | Update name, phone, address |
| GET | `/books` | auth | List; query: `q`, `genre`, `page`, `limit` |
| GET | `/books/genres` | auth | Distinct genre list for filter dropdown |
| GET | `/books/:id` | auth | Book details |
| POST | `/books` | admin | Create book |
| PUT | `/books/:id` | admin | Update book |
| POST | `/loans` | member | Borrow `{ bookId }` |
| POST | `/loans/:id/return` | member | Return a loan |
| GET | `/loans/me/current` | member | Active loans (borrowed + overdue) |
| GET | `/loans/me/history` | member | All own loans, newest first |
| GET | `/dashboard/member` | member | Current loans, due dates, overdue |
| GET | `/dashboard/admin` | admin | Counts + low-availability books |

> If your existing auth routes are mounted without `/api`, mount everything under `/api` and update the existing tests' URLs in one pass. It makes the Vite dev proxy a one-liner.

### Error format (every error)
```json
{ "message": "Human readable message", "errors": { "email": "Invalid email" } }
```
`errors` is only present for validation failures. Status codes: **400** validation · **401** not logged in · **403** wrong role · **404** not found · **409** conflict (no copies, limit reached, duplicate borrow, already returned, duplicate ISBN/email).

### Folder structure
```
library-app/
├─ package.json            # root: "dev" runs server + client together (concurrently)
├─ README.md
├─ .gitignore
├─ docs/                   # all submission documents
├─ server/
│  ├─ .env.example
│  └─ src/
│     ├─ app.ts            # express app (no listen) — used by tests
│     ├─ server.ts         # connects DB + listen
│     ├─ config/           # env, db
│     ├─ models/           # User.ts Book.ts Loan.ts
│     ├─ routes/           # auth, users, books, loans, dashboard
│     ├─ middleware/       # authenticate, authorize, errorHandler, validate
│     ├─ schemas/          # Zod schemas
│     ├─ utils/            # AppError, loanStatus helper
│     ├─ scripts/seed.ts
│     └─ tests/
└─ client/
   └─ src/
      ├─ api/              # axios instance + small API functions
      ├─ context/          # AuthContext
      ├─ components/       # Navbar, BookCard, BookCover, ProtectedRoute, Alert, LoanTable
      └─ pages/            # Login, Register, ForgotPassword, ResetPassword, Catalog,
                           # BookDetails, MyBooks, History, Profile, MemberDashboard,
                           # AdminDashboard, BookForm
```

---

## 2. Assumptions for the "ambiguous requirements" (decide once, document in Phase 11)

| # | Question | Decision (simple) | Why |
|---|---|---|---|
| A1 | Borrow without completing profile? | **Yes.** Only name, email, password are required to register. Phone/address are optional. | Profile completion adds gating logic with no requirement behind it. |
| A2 | Membership expiry date? | **Not implemented.** Listed as a known limitation / future work. | Not in business rules. Adds checks everywhere. |
| A3 | Can an admin borrow? | **No.** Borrow/return endpoints are member-only; admins are staff accounts created by the seed script. | Keeps roles clean and BR-05/BR-06 simple. |
| A4 | Password reset without an email service? | Token is generated, stored **hashed** with a 15-minute expiry, and returned in the API response (and logged) in dev. The UI shows a reset link. | No SMTP needed; flow is still realistic. Document that production would email the link. |
| A5 | Does a member with overdue books keep borrowing? | **Yes**, still bound by the 3-book limit (overdue books count toward the 3). | No rule says otherwise. |
| A6 | "Low availability" threshold? | `availableCopies <= 2` (one constant, easy to change). | Spec doesn't define it. |
| A7 | Available copies on book creation? | Equals `totalCopies` (admin cannot set it independently). | Prevents inconsistent data. |
| A8 | Editing total copies? | `newTotal` must be ≥ copies currently on loan; `availableCopies = newTotal − onLoan`. | Satisfies the "reduce below borrowed count" edge case. |
| A9 | Book deletion? | Not implemented (not required). | Avoids orphaned loans. |

---

## 3. Time plan (be realistic — you have about two working days)

| Day | Phases | Target |
|---|---|---|
| **12 Nov** | 0 → 6 | Backend complete and tested |
| **13 Nov** | 7 → 11 | Frontend, manual edge-case testing, docs, submit |
| Only if time remains | 12 | Bonus |

**If you fall behind, cut in this order:** Phase 12 → pagination → forgot/reset-password UI (keep the API) → admin book-edit page polish. Never cut: the borrow/return rules, tests, or the docs. The docs are half the grade.

---

# PHASES

---

## Phase 0 — Repo setup & conventions (≈30 min)

**Goal:** one clean Git repo with `server/` and `client/`, running together with a single command.

**Steps**
1. Make sure the repo root contains `server/`, `client/`, `docs/`. If the backend currently lives at the root, move it into `server/` (`git mv`) and fix paths.
2. Root `package.json`: add `concurrently` and scripts: `"dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""`, `"seed": "npm run seed --prefix server"`, `"test": "npm test --prefix server"`.
3. `.gitignore` at root: `node_modules`, `.env`, `dist`, `coverage`.
4. `server/.env.example` with placeholders: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `PORT=5000`, `CLIENT_URL=http://localhost:5173`. **Never commit the real `.env`** (Atlas credentials).
5. Create `docs/` with empty files: `requirements-analysis.md`, `business-rules-validations.md`, `assumptions.md`, `ai-prompts.md`, `ai-review.md`, `test-cases.md`, `known-issues.md`.
6. Mount all routes under `/api` and make sure `app.ts` (the Express app) is separate from `server.ts` (the `listen` call) so tests can import the app.

**Why:** a separate `app.ts` lets Supertest call the app without opening a port. `.env.example` lets the reviewer run your project.

**Done when:** `npm run dev` at the root starts both apps (client can be the Vite default for now); `git status` shows no secrets.

---

## Phase 1 — Auth core (✅ mostly done — verify and finish) (≈30 min)

**What should already exist:** User model, `POST /auth/register` (role always `member`), `POST /auth/login` → `{ token, user }`, JWT in `sub`, `authenticate` + `authorize(...roles)` middleware, `GET /auth/me` (401 if user no longer exists), and tests.

**Steps**
1. **Fix the red-line error in `auth.routes.test.ts` first** (read the TypeScript message; usually a missing type import or wrong `app` import).
2. Verify validations: unique email (409), password ≥ 8 chars, required fields (name/email/password), invalid email format → 400 with `errors` per field.
3. Verify the password hash is never in any response.
4. Confirm `authorize('admin')` and `authorize('member')` both work (you need both later).

**Why:** every later endpoint depends on these two middlewares. Broken auth = broken everything.

**Done when:** auth tests pass; all four user validations from the spec are covered by tests.

**Interview talking point:** why JWT `sub` holds the user id, why role is forced to `member` on public registration (privilege-escalation protection).

---

## Phase 2 — Profile & password reset (≈45 min)

**Goal:** finish the remaining User Management features.

**Steps**
1. `PATCH /users/me` (auth): Zod schema allows only `name` (non-empty), `phone` (optional), `address` (optional). Ignore/reject any other field (especially `role`, `email`, `passwordHash`). Return the updated user.
2. `POST /auth/forgot-password` `{ email }`:
   - Always respond 200 with a generic message (don't reveal whether the email exists).
   - If the user exists: create a random token (`crypto.randomBytes(32).toString('hex')`), store its **SHA-256 hash** and an expiry (now + 15 min) on the user.
   - In non-production only, include `resetToken` in the response and `console.log` the reset link `CLIENT_URL/reset-password?token=...`.
3. `POST /auth/reset-password` `{ token, password }`:
   - Hash the incoming token, find user with matching hash and `resetTokenExpires > now`.
   - Validate password ≥ 8 chars, store new bcrypt hash, clear the token fields.
   - Invalid/expired token → 400.

**Why:** storing only the *hash* of the token means a database leak can't be used to reset passwords. Single-use because the fields are cleared.

**Done when:** tests: update profile OK; cannot change role via profile; reset flow works end-to-end; expired/invalid/reused token rejected; short password rejected.

**Copilot prompt**
```
Implement Phase 2 of IMPLEMENTATION_PLAN.md: PATCH /api/users/me, POST /api/auth/forgot-password
and POST /api/auth/reset-password in the existing Express + TypeScript + Mongoose + Zod setup.
Hash the reset token with SHA-256, 15 minute expiry, single use. Add Supertest tests.
```

---

## Phase 3 — Books backend (≈1 h 15 min)

**Goal:** catalog, search, filter, details, admin create/update, seed data.

**Steps**
1. **Book model** with schema validators:
   - `totalCopies`: integer, `min: 0`.
   - `availableCopies`: integer, `min: 0`, custom validator `availableCopies <= totalCopies`.
   - `isbn`: `unique: true`. Normalise (strip `-` and spaces) in the Zod schema before saving; accept 10 or 13 digits.
   - Make sure the unique index is created (Mongoose builds it on startup; in tests call `await Book.init()`).
2. `GET /books`:
   - `q` → case-insensitive match on **title OR author** using `$regex` (**escape special regex characters** in `q`).
   - `genre` → exact match (case-insensitive).
   - Simple pagination: `page` (default 1), `limit` (default 12, max 50). Return `{ items, total, page, pages }`.
3. `GET /books/genres` → `Book.distinct('genre')`, sorted.
4. `GET /books/:id` → 404 if not found; invalid ObjectId → 404/400 (don't crash).
5. `POST /books` (admin): create with `availableCopies = totalCopies`. Duplicate ISBN → 409 (catch Mongo error code `11000`).
6. `PUT /books/:id` (admin): allow title, author, genre, isbn, description, coverImage, totalCopies.
   - `onLoan = book.totalCopies − book.availableCopies`.
   - If `newTotal < onLoan` → **409** "Total copies cannot be less than the N copies currently borrowed".
   - Else set `totalCopies = newTotal`, `availableCopies = newTotal − onLoan`.
   - Never accept `availableCopies` from the client.
7. **Seed script** `server/src/scripts/seed.ts` (idempotent: clear then insert):
   - 1 admin (`admin@library.test` / `Admin@123`), 1 demo member (`member@library.test` / `Member@123`).
   - ~12 books across 4–5 genres. Include: **one with no cover image**, **one with 0 available copies**, **one with exactly 1 copy** (for the concurrency demo), and a couple with low availability.
   - Use stable placeholder cover URLs or leave most empty. Don't hotlink anything fragile.
   - *(Add one overdue loan for the demo member after Phase 4: a loan with `dueDate` 3 days ago, and decrement that book's `availableCopies`.)*

**Why:** `availableCopies` is derived state controlled only by the borrow/return logic, so the client must never set it. Escaping the regex prevents a search for `(` from crashing the API.

**Done when:** tests: search by title, by author, genre filter, combined; details; member gets 403 on create/update; duplicate ISBN → 409; negative total → 400; reduce total below on-loan count → 409 (this one you can only fully test after Phase 4, add it then).

**Copilot prompt**
```
Implement Phase 3 of IMPLEMENTATION_PLAN.md: Book model with validators, GET /books (q, genre,
pagination), GET /books/genres, GET /books/:id, admin-only POST and PUT with the total-copies rule,
and the seed script. Use Zod for validation and the existing AppError/errorHandler.
```

---

## Phase 4 — Borrowing backend (core of the assessment) (≈2 h)

**Goal:** borrow and return that stay correct under refresh, double-click, multiple tabs, and simultaneous requests.

### 4.1 Helper
`utils/loanStatus.ts`:
```ts
export function getDisplayStatus(loan) {
  if (loan.status === 'returned') return 'Returned';
  return loan.dueDate < new Date() ? 'Overdue' : 'Borrowed';
}
```
Use it in every response that returns loans (add `displayStatus`).

### 4.2 `POST /loans` — borrow (member only) `{ bookId }`
Order matters. Follow exactly:

1. Validate `bookId` is a valid ObjectId; book must exist (404).
2. **Friendly pre-check (not safety-critical):** active loans for this user (`status: 'borrowed'`) count ≥ 3 → 409 "Borrowing limit of 3 books reached".
3. **Create the Loan** (`dueDate = now + 14 days`).
   - If MongoDB throws duplicate key `11000` (partial unique index) → 409 "You have already borrowed this book".
4. **Re-count** active loans for the user. If count > 3 → delete the loan just created, return 409 (limit reached). *(Catches two tabs borrowing two different books at the same instant.)*
5. **Atomically take a copy:**
   ```ts
   const updated = await Book.findOneAndUpdate(
     { _id: bookId, availableCopies: { $gt: 0 } },
     { $inc: { availableCopies: -1 } },
     { new: true }
   );
   ```
   If `updated` is `null` → delete the loan just created, return 409 "No copies available".
6. Return 201 with the loan (populated with book title/author).

### 4.3 `POST /loans/:id/return` — return (member only)
1. **Atomically flip the loan:**
   ```ts
   const loan = await Loan.findOneAndUpdate(
     { _id: id, user: req.user.id, status: 'borrowed' },
     { status: 'returned', returnedAt: new Date() },
     { new: true }
   );
   ```
2. If `null` → 409 "Loan not found or already returned" (also covers someone else's loan — don't reveal which).
3. Then `Book.updateOne({ _id: loan.book }, { $inc: { availableCopies: 1 } })`.
4. Return the updated loan.

### 4.4 Read endpoints (always filtered by `req.user.id` → BR-05)
- `GET /loans/me/current` → loans with `status: 'borrowed'` (includes overdue), populated book, sorted by `dueDate` ascending, each with `displayStatus`.
- `GET /loans/me/history` → all own loans, newest first, populated book, with `displayStatus`.
- No endpoint accepts a `userId` parameter. That is how BR-05 is enforced.

### Why this design is simple *and* safe
| Problem | How it's handled |
|---|---|
| Two members take the last copy | `findOneAndUpdate` with `availableCopies > 0` is a single atomic MongoDB operation. Only one gets a document back. |
| Refresh / double-click / two tabs borrow the same book | Partial unique index: DB rejects the second active loan. |
| Return twice | Atomic filter `status: 'borrowed'` — the second call matches nothing. |
| 4th book via two tabs | Re-count after insert; rollback if over 3 (fails safe: never over the limit). |
| Over-return | Copies only increase after a *successful* status flip, so counts can't drift upward. |

**Known trade-off (document in `known-issues.md`):** there are no multi-document transactions, so a server crash between steps 3 and 5 could leave an orphan loan. MongoDB transactions (Atlas supports them) would be the production fix. Mention this in the interview — it shows you understand the limit.

**Done when:** tests (see Phase 6) for: borrow success reduces available by 1; return restores by 1; no copies → 409; 4th book → 409; duplicate → 409; return twice → 409; return someone else's loan → 409; admin trying to borrow → 403.

**Copilot prompt**
```
Implement Phase 4 of IMPLEMENTATION_PLAN.md exactly as specified: POST /api/loans, POST
/api/loans/:id/return, GET /api/loans/me/current, GET /api/loans/me/history. Use the Loan model with a
partial unique index on {user, book} where status is 'borrowed'. Use atomic findOneAndUpdate for the
book copy decrement and for marking a loan returned. Follow the step order in the plan. No transactions.
```

---

## Phase 5 — Dashboards backend (≈30 min)

**`GET /dashboard/member`** (member): returns
```json
{ "currentLoans": [ { "id", "book": {"title","author"}, "dueDate", "displayStatus" } ],
  "overdueLoans": [ ...same shape, only overdue ],
  "counts": { "current": 2, "overdue": 1 } }
```
Reuse the same query as `/loans/me/current`; derive `overdueLoans` by filtering with the helper.

**`GET /dashboard/admin`** (admin): returns
```json
{ "totalMembers": n,        // User.countDocuments({ role: 'member' })
  "totalBooks": n,          // Book.countDocuments()
  "activeBorrowings": n,    // Loan.countDocuments({ status: 'borrowed' })
  "overdueBorrowings": n,   // Loan.countDocuments({ status: 'borrowed', dueDate: { $lt: now } })
  "lowAvailabilityBooks": [ { "id","title","availableCopies","totalCopies" } ] } // availableCopies <= 2, sorted asc
```

**Why:** because overdue is computed from `dueDate`, counting it is a single query. No background jobs.

**Done when:** tests: member sees only own loans; admin counts match seeded data; member gets 403 on the admin dashboard and vice versa.

---

## Phase 6 — Backend test suite (≈1 h 30 min)

**Setup:** use a **separate** test database (a different DB name on Atlas, e.g. `library_test`, or `mongodb-memory-server`). **Never run tests against your real data.** Clear collections `beforeEach`. Call `await Model.init()` (or `syncIndexes()`) for Book and Loan before tests so the unique indexes exist — **without this the duplicate-borrow test can pass/fail incorrectly**.

Write small helpers: `createUser(role)`, `loginAs(user)`, `createBook({ totalCopies })`.

**Automated test list (maps 1:1 to the assessment's required cases)**

| Type | Test |
|---|---|
| Functional | Register · Login · Search by title/author · Filter by genre · Borrow · Return · Borrowing history · Profile update · Password reset |
| Negative | Invalid login · Empty mandatory fields · Invalid email · Password < 8 chars · Duplicate email · Borrow unavailable book · Exceed 3-book limit · Return already-returned · Member creating a book (403) · Duplicate ISBN · Negative total copies |
| Edge | **Concurrent last copy:** book with 1 copy, 2 different members, `Promise.all([borrowA, borrowB])` → exactly one 201 and one 409; `availableCopies === 0` · **Duplicate borrow:** same member, same book, `Promise.all` of 2 requests → one 201, one 409, only 1 loan · **Admin reduces total below borrowed** → 409 · **Overdue:** set a loan's `dueDate` to the past, check `displayStatus === 'Overdue'` and the dashboard counts it |

*Refresh and multi-tab are browser behaviours; the Promise.all tests prove the backend side, and you verify the UI side manually in Phase 10.*

**Done when:** `npm test` is green and the test names are readable (you'll copy them into `docs/test-cases.md`).

---

## Phase 7 — Frontend scaffold & auth pages (≈1 h 30 min)

**Stack:** Vite + React + TypeScript, Tailwind CSS, `react-router-dom`, `axios`. State = React `useState` / `useEffect` + one `AuthContext`. No Redux, no React Query.

**Steps**
1. Create `client/` with Vite (React + TS), add Tailwind, `react-router-dom`, `axios`.
2. `vite.config.ts` dev proxy: `/api` → `http://localhost:5000` (avoids CORS in dev).
3. `api/client.ts`: axios instance (`baseURL: '/api'`); request interceptor adds `Authorization: Bearer <token>` from `localStorage`; response interceptor: on `401` clear token and redirect to `/login`.
4. `context/AuthContext.tsx`: `{ user, login, register, logout, loading }`. On app start, if a token exists, call `/auth/me` to restore the session (this is what makes **browser refresh** keep you logged in).
5. `ProtectedRoute({ role? })`: redirect to `/login` if no user; show "Not authorised" if role doesn't match.
6. Small shared components: `Navbar` (links change by role; admin sees no "My Books"), `Alert` (error/success box), a simple `Spinner`.
7. Pages: **Register**, **Login**, **ForgotPassword** (shows the dev reset link returned by the API), **ResetPassword** (reads `?token=`), **Profile** (edit name/phone/address).
8. **Client-side validation mirrors the server** (required, email format, password ≥ 8) for fast feedback. The server remains the source of truth: always display `error.response.data.message` and per-field `errors`.

**Why:** restoring the session via `/auth/me` and a single axios interceptor keeps auth logic in two places instead of scattered across pages.

**Done when:** you can register, log in, refresh the page and stay logged in, log out, edit your profile, and complete a password reset through the UI.

**Copilot prompt**
```
Implement Phase 7 of IMPLEMENTATION_PLAN.md in /client: Vite React TypeScript with Tailwind, axios
instance with auth interceptor, AuthContext that restores the session from /auth/me, ProtectedRoute with
optional role, and the Register, Login, ForgotPassword, ResetPassword and Profile pages.
Keep components small and simple. No extra state libraries.
```

---

## Phase 8 — Frontend: catalog, details, borrow (≈1 h 30 min)

**Steps**
1. `BookCover` component: shows `coverImage`; if empty **or** the image fails to load (`onError`), shows `/default-cover.svg` (put a simple SVG in `client/public/`). This satisfies the "default image" requirement for both missing and broken URLs.
2. **Catalog page** (`/`): search input (title/author), genre dropdown (from `/books/genres`), grid of `BookCard`s (cover, title, author, genre, "Available: x / y"), pagination (Prev/Next).
   - Debounce the search ~300 ms or search on submit (simpler).
   - Show "Out of stock" badge when `availableCopies === 0`.
   - Empty state: "No books found".
3. **Book details page** (`/books/:id`): all book info + description.
   - **Borrow button** (members only):
     - Disabled with text "Unavailable" when `availableCopies === 0`.
     - Disabled with a spinner **while the request is in flight** (prevents double-click double-borrow).
     - On success: show success alert with the due date, then **re-fetch the book** so the count updates.
     - On error (409, etc.): show the server's message and re-fetch the book (someone else may have taken the last copy).
   - Admin sees an **Edit** button instead of Borrow.

**Why:** disabling the button during the request plus the server-side unique index means a double click, refresh or second tab can never create a second loan. The UI is a courtesy; the database is the guarantee.

**Done when:** you can search, filter, open a book, borrow it, see the available count drop, and get a clear error on every failed case.

---

## Phase 9 — Frontend: my books, history, dashboards, admin forms (≈2 h)

**Steps**
1. **LoanTable** component (reused): book title/author, borrowed date, due date, returned date, status badge (`Borrowed` blue, `Returned` grey, `Overdue` red).
2. **My Books** (`/my-books`): `/loans/me/current` with a **Return** button per row (disable while in flight; refetch after; show server error on failure).
3. **History** (`/history`): `/loans/me/history`, same table, no actions.
4. **Member dashboard** (`/dashboard`, default home for members): current books, due dates, overdue section highlighted in red, with counts.
5. **Admin dashboard** (`/admin`): 5 stat cards (Total Members, Total Books, Active Borrowings, Overdue Borrowings, Low-availability count) + a list of low-availability books, + "Add Book" button.
6. **BookForm** (`/admin/books/new` and `/admin/books/:id/edit`): fields for all book info; `availableCopies` is **display-only** on edit. Show server validation errors per field (duplicate ISBN, copies below on-loan count, negative copies).
7. Redirect after login by role: member → `/dashboard`, admin → `/admin`.
8. Wire the Navbar: Catalog · Dashboard · My Books · History · Profile (member) / Catalog · Admin · Add Book (admin).

**Done when:** all member and admin features from the spec are reachable from the UI, and every failed server rule shows a readable message.

**Copilot prompt**
```
Implement Phase 9 of IMPLEMENTATION_PLAN.md in /client: LoanTable, MyBooks, History, MemberDashboard,
AdminDashboard and BookForm (create/edit) pages using the existing api client and AuthContext, with
role-protected routes. Status badges: Borrowed, Returned, Overdue. Disable action buttons while requests run.
```

---

## Phase 10 — Manual end-to-end testing (≈1 h)

Run the full app against seeded data and record the result of each case in `docs/test-cases.md` (ID, steps, expected, actual, pass/fail).

**Edge cases to test by hand (UI)**
| Case | How | Expected |
|---|---|---|
| Browser refresh while borrowing | Click Borrow, refresh immediately, check My Books | Only **one** loan, available count dropped by 1 |
| Double-click Borrow | Click twice fast | One loan; button disabled during request |
| Multiple tabs, same book | Open the book in two tabs, borrow in both | Second tab shows "already borrowed" error |
| Multiple tabs, last copy | Two different members in two browsers, borrow the 1-copy book | One succeeds, other sees "No copies available" |
| Return in one tab, return again in another | Return in tab A, then tab B | Second shows error; copies increased only once |
| 4th book | Borrow 3, try a 4th | Error, count unchanged |
| Admin lowers total below on-loan | Edit a borrowed book's total copies | Rejected with message |
| Overdue | Seeded overdue loan (or set `dueDate` in Atlas) | Red Overdue badge in dashboard and counted in admin dashboard |
| Direct URL as member to `/admin` | Type URL | Not authorised |
| No cover image / broken URL | View seeded book | Default image shown |

Fix any bug found, add a regression test for it, commit.

---

## Phase 11 — Documentation & submission (≈1 h 15 min)

Create the files below in `docs/` (plus the README). Fill them from what you already logged. Keep them short and factual.

| File | Content |
|---|---|
| `README.md` (root) | What it is · stack · prerequisites · setup (clone, `npm install` in root/server/client, copy `.env.example`, Atlas URI, `npm run seed`, `npm run dev`) · demo accounts · how to run tests · folder structure · link to docs |
| `docs/requirements-analysis.md` | Each requirement area (User, Book, Borrowing, Dashboard) → how it is implemented (endpoint/page) |
| `docs/business-rules-validations.md` | Table of BR-01…BR-06 → where enforced (file/function) + all validations (email unique, password ≥ 8, mandatory fields, email format, ISBN unique, copies rules, default cover, zero-availability, borrowing rules) |
| `docs/assumptions.md` | Section 2 of this plan (A1–A9) + the three ambiguous questions answered explicitly |
| `docs/ai-prompts.md` | Every Copilot prompt used, in order, with the phase/file it was for |
| `docs/ai-review.md` | For **each** AI output: *What AI generated · What was correct · What was incorrect · What I changed · Why* |
| `docs/test-cases.md` | Functional, negative and edge-case tables (from Phases 6 and 10) with results |
| `docs/known-issues.md` | No transactions (possible orphan loan on crash) · no membership expiry · reset token shown in API response in dev (no email) · no loan renewals · no fines · simple pagination · token in localStorage · whatever else you found |

**`ai-review.md` template**
```
### Output N — <what you asked for>
- **Prompt:** (link to entry in ai-prompts.md)
- **What AI generated:**
- **What was correct:**
- **What was incorrect / risky:**
- **Modifications made:**
- **Why the changes were necessary:**
```
Good real examples to capture (they usually happen): regex search without escaping; borrow logic using read-then-write instead of atomic `findOneAndUpdate`; missing unique-index sync in tests; allowing `role` or `availableCopies` through request bodies; returning `passwordHash`; no 409 for duplicate key errors.

**Final checklist before you submit**
- [ ] Fresh clone → follow README → app runs
- [ ] `.env` not committed; `.env.example` present
- [ ] `npm test` green
- [ ] All 10 deliverables present
- [ ] Demo credentials in README work after `npm run seed`
- [ ] Repo pushed (public or access granted as requested)

---

## Phase 12 — Optional bonus (only if everything above is done)

Pick **one**, cheapest first:
1. **Overdue fine:** `fine = daysOverdue × 1` computed on read (no storage); show in My Books and history. ≈20 min.
2. **Recently viewed books:** keep the last 5 viewed book ids in `localStorage`; show on the catalog page. ≈25 min.
3. Ratings/reviews, waitlist, AI recommendations: skip unless you have spare hours.

---

## Quick reference — business rules → where enforced

| Rule | Enforced in |
|---|---|
| BR-01 only available books | Phase 4: atomic decrement with `availableCopies > 0` |
| BR-02 copies change on borrow/return | Phase 4: `$inc -1` on borrow, `$inc +1` after successful return |
| BR-03 max 3 books | Phase 4: pre-check + post-insert re-count |
| BR-04 14 days then Overdue | Phase 4: `dueDate` at creation; overdue derived at read time |
| BR-05 own history only | Phase 4: every loan query filters by `req.user.id`; no `userId` parameter anywhere |
| BR-06 only admins add/edit books | Phase 3: `authorize('admin')` on POST/PUT |
