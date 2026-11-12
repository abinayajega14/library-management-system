## Plan assumptions (Section 2)

| ID | Question | Decision | Rationale |
|---|---|---|---|
| A1 | Can a member borrow without completing a profile? | Yes. Registration requires name, email, and password; phone and address are optional. | No profile-completion gate is required. |
| A2 | Is membership expiry implemented? | No; it is a known limitation. | Membership expiry is not part of the business rules. |
| A3 | Can an admin borrow? | No. Borrow/return routes are member-only; admin accounts come from the seed script. | Keeps member loan ownership separate from staff permissions. |
| A4 | How does password reset work without email delivery? | A random reset token is stored as a hash with a 15-minute expiry. In development the token/link is returned and logged; production email delivery is future work. | No SMTP service is configured. |
| A5 | Can a member with overdue books continue borrowing? | Yes, while below the three-active-loan limit. Overdue loans count toward that limit. | No additional borrowing ban is specified. |
| A6 | What counts as low availability? | `availableCopies <= 2`. | The threshold is defined once in the dashboard query. |
| A7 | What is available inventory on book creation? | `availableCopies` starts equal to `totalCopies`; clients cannot set it independently. | Avoids inconsistent initial counts. |
| A8 | Can total copies be reduced below the number on loan? | No. The new total must be at least the number on loan; available becomes `newTotal - onLoan`. | Preserves current loans and non-negative availability. |
| A9 | Can books be deleted? | No delete operation is implemented. | Avoids orphaned loan records. |

## Three explicit decisions

1. **Can admins borrow?** No; loan routes require the member role (A3).
2. **Can members with overdue books borrow?** Yes, up to three active loans total, counting overdue loans (A5).
3. **How can a user reset a password without an email service?** The hashed, 15-minute token is exposed only in development and logged for the local reset flow; a production deployment would send the link by email (A4).