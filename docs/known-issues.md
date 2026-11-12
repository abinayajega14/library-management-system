# Known Issues and Limitations

- Borrowing and returning update loan and book documents in separate operations, not a MongoDB transaction. A crash between writes can leave a loan/copy count inconsistent.
- Membership expiry is not modeled or enforced.
- Password reset has no email delivery. In development, the reset token is returned by the API and written to the server log; production needs an email provider.
- Loan renewal and fines are not implemented.
- Catalog pagination is simple page/limit offset pagination; there is no advanced sorting or cursor pagination.
- JWTs are stored in browser `localStorage`, so an XSS issue could expose a session token.
- `npm run seed` clears the configured database's loans, users, and books before inserting demo data. Run it only against a disposable development database.
- `JWT_EXPIRES_IN` appears in the environment example, but login currently hardcodes a seven-day token lifetime.
- The client has no automated component/E2E test runner; its Phase 10 browser checks are recorded manually in `docs/test-cases.md`.
- Mongoose emits deprecation warnings for the `new` option in `findOneAndUpdate`; the routes should eventually use `returnDocument`.
- Book deletion is intentionally not implemented.