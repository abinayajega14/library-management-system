## Business rules

| Rule | Enforcement |
|---|---|
| BR-01 - Only borrow an available book | `server/src/routes/loans.routes.ts`, `POST /`: the copy decrement matches a book with `availableCopies > 0`; if no copy can be reserved, the loan is removed and the API returns `409 No copies available`. |
| BR-02 - Keep book copy counts in step with loans | `server/src/routes/loans.routes.ts`, `POST /` decrements `availableCopies` on successful reservation; `POST /:id/return` increments it only after the loan changes from borrowed to returned. These are separate database operations, not a transaction. |
| BR-03 - A member may have at most three active loans | `server/src/routes/loans.routes.ts`, `POST /` checks active loans before and after insertion; a post-insert excess is deleted and rejected. The `borrowed` status includes overdue loans. |
| BR-04 - A loan is due after 14 days; overdue is derived | `server/src/routes/loans.routes.ts` sets `dueDate` from `borrowedAt + 14 days`; `server/src/utils/loanStatus.ts` derives `Overdue` from `status === "borrowed"` and a past due date. No overdue status is stored. |
| BR-05 - Members can access only their own loans | `server/src/routes/loans.routes.ts` and `server/src/utils/loanQueries.ts` filter by `req.auth.userId` for current loans, history, and returns. There is no caller-supplied user ID in these routes. |
| BR-06 - Only admins can add or edit books | `server/src/routes/books.routes.ts` protects `POST /` and `PUT /:id` with `authenticate` and `authorize("admin")`. |

## Validations and defaults

| Data or action | Validation / behavior | Location |
|---|---|---|
| User registration | Name, email, and password are required; email is trimmed, lowercased, and format-checked; password is at least 8 characters. Passwords are bcrypt-hashed, the email has a unique index, and duplicate registration returns `409`. Registration fixes role to `member`. | `server/src/routes/auth.routes.ts`, `server/src/models/user.model.ts` |
| User response/profile | `passwordHash` and reset-token fields are excluded from normal reads/responses. Profile updates accept only name, phone, and address; name is required and phone/address are optional. | `server/src/models/user.model.ts`, `server/src/routes/users.routes.ts` |
| Book fields and ISBN | Title, author, genre, and ISBN are required. ISBN spaces and hyphens are removed before checking for 10 or 13 digits; the ISBN index is unique and duplicate ISBN returns `409`. A supplied cover URL must be valid. | `server/src/routes/books.routes.ts`, `server/src/models/book.model.ts` |
| Copy counts | `totalCopies` and `availableCopies` must be non-negative integers, and available cannot exceed total. Creation sets available equal to total; editing total preserves on-loan copies and rejects a total below that number. Zero copies are valid inventory but cannot be borrowed. | `server/src/models/book.model.ts`, `server/src/routes/books.routes.ts` |
| Borrow request | `bookId` must be a valid ID for an existing book. Borrowing requires the member role, an available copy, fewer than three active loans, and no existing active loan for the same book. A partial unique loan index prevents duplicate active loans. | `server/src/routes/loans.routes.ts`, `server/src/models/loan.model.ts` |
| Return request | Only the borrowing member can return a loan, and only while its status is `borrowed`; repeated or missing returns return a conflict response. | `server/src/routes/loans.routes.ts` |
| Missing/broken cover | `coverImage` is optional. The client switches to `/default-cover.svg` when the URL is absent or the image fails to load. | `client/src/components/BookCover.tsx`, `client/public/default-cover.svg` |