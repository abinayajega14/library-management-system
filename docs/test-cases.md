# Test Cases

Validation command: `npm test`

Latest result: **23 passed, 0 failed**. The integration suite runs against an
ephemeral `mongodb-memory-server` database named `library_test`.

## Functional tests

| Test | Result |
|---|---|
| `POST /api/auth/register validates and safely registers a member` | Pass |
| `login, bearer authentication, authorization, and /api/auth/me` | Pass |
| `PATCH /api/users/me updates allowed profile fields only` | Pass |
| `forgot and reset password use a hashed, expiring, single-use token` | Pass |
| `profile updates ignore privileged fields and password reset works end-to-end` | Pass |
| `book catalog search, genre filtering, pagination, and genre list` | Pass |
| `book details and admin-only create/update with ISBN and copy validation` | Pass |
| `catalog supports title and author search, genre filters, and combined queries` | Pass |
| `loan routes enforce borrowing rules, return copies, and scope reads to the member` | Pass |
| `borrowing, returning, and history update copy counts correctly` | Pass |
| `member dashboard includes only the member's current and overdue loans` | Pass |
| `admin dashboard counts match seeded data and role access is restricted` | Pass |

## Negative tests

| Test | Result |
|---|---|
| `registration validates required fields, email, password, and duplicate accounts` | Pass |
| `Book schema declares a unique ISBN index and validates copy counts` | Pass |
| `member cannot create books; duplicate ISBN and negative copies are rejected` | Pass |
| `unavailable books and borrowing more than three active books are rejected` | Pass |
| `admin cannot reduce total copies below the number currently borrowed` | Pass |

## Edge-case and concurrency tests

| Test | Result |
|---|---|
| `Loan schema indexes and computed display status` | Pass |
| `overdue fine counts started days and uses returnedAt for returned loans` | Pass |
| `two members competing for the last copy yield one success` | Pass |
| `simultaneous duplicate borrows create one active loan` | Pass |
| `overdue loans appear on member and admin dashboards` | Pass |
| `overdue fines are calculated on current loans and fixed in history after return` | Pass |

## Phase 10 — Manual end-to-end edge cases

Run against the seeded data in an isolated in-memory MongoDB instance, with two
additional test members and dedicated last-copy and broken-cover books.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| P10-01 | As member2, borrow *Letters from the Glass Coast* and refresh immediately. | One active loan; available copies decrease by one. | After refresh, details showed 3 / 4 and My Books showed one loan for the title. | Pass |
| P10-02 | As member2, rapidly click Borrow twice for *The Museum of Small Hours*. | Button disables during the request; only one loan is created. | The button was disabled at the second click; one borrow request, one loan, and 3 / 4 copies available. | Pass |
| P10-03 | In two tabs as member2, load *Building Useful Machines* in both; borrow in each. | First borrow succeeds; second reports already borrowed. | Both initially showed 3 / 3. First succeeded; second showed “You have already borrowed this book”; only one matching loan appeared and availability was 2 / 3. | Pass |
| P10-04 | As member2 and member3 in separate tabs, concurrently borrow the 1-copy *Last Copy E2E*. | One succeeds; the other sees “No copies available”. | One borrow succeeded, the other showed “No copies available”, and the book ended at 0 / 1. | Pass |
| P10-05 | Load member2’s *Letters from the Glass Coast* loan in two tabs; return in tab A, then use the stale Return button in tab B. | Second return errors; available copies increase only once. | Tab A returned it; tab B showed “Loan not found or already returned”. Availability was 4 / 4 both after the first return and after the second attempt. | Pass |
| P10-06 | As member2, borrow a third book, then try to borrow a fourth. | Fourth borrow is rejected; active-loan count stays at three. | Third borrow succeeded. The fourth showed “Borrowing limit of 3 books reached”; My Books still had three active loans and no fourth-book loan. | Pass |
| P10-07 | As admin, edit *The Museum of Small Hours* (one copy on loan) and set total copies to 0. | Update is rejected because total copies cannot be below copies on loan. | Form showed “Total copies cannot be less than the 1 copies currently borrowed”; persisted book remained at 3 / 4. | Pass |
| P10-08 | View the seeded overdue loan as member, then inspect the admin dashboard. | Member sees a red Overdue indicator; admin overdue count includes the loan. | Member dashboard showed 1 overdue loan and a red badge (`bg-red-100 text-red-800`); admin dashboard showed Overdue Borrowings: 1. | Pass |
| P10-09 | As a member, navigate directly to `/admin`. | Member is not authorized. | `/admin` displayed “Not authorised” and did not show the admin dashboard. | Pass |
| P10-10 | Open *Broken Cover E2E* with its unavailable cover URL. | Default cover image is shown. | The broken request failed and the rendered image switched to `/default-cover.svg`; the fallback image loaded. | Pass |
