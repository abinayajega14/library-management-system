# Requirements Analysis

| Requirement area | Implementation |
|---|---|
| User | Registration and login are `POST /api/auth/register` and `POST /api/auth/login`; `GET /api/auth/me` restores the session. Profile edits use `PATCH /api/users/me`. Password reset uses `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`. The React screens are Login, Register, Forgot Password, Reset Password, and Profile. Public registration always creates a member; admin accounts are seeded. |
| Book | Authenticated catalog browsing uses `GET /api/books` with `q`, `genre`, `page`, and `limit`; genres use `GET /api/books/genres`, and details use `GET /api/books/:id`. Admins create and edit books with `POST /api/books` and `PUT /api/books/:id`. The client screens are Catalog, Book Details, and the admin Book Form. |
| Borrowing | Members borrow with `POST /api/loans` and return with `POST /api/loans/:id/return`. `GET /api/loans/me/current` and `/api/loans/me/history` are scoped to the signed-in member. The Book Details, My Books, and History screens provide the member workflows. Loans are due 14 days after borrowing; overdue status is derived at read time. |
| Dashboard | `GET /api/dashboard/member` supplies a member's current and overdue loans and counts; `GET /api/dashboard/admin` supplies library counts and low-availability books. The client has separate Member Dashboard and Admin Dashboard screens with role guards. |

All API paths are mounted below `/api`. Authentication uses bearer JWTs; errors use a human-readable `message` and include an `errors` object for validation failures.
