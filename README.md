# Library Management System

A full-stack library app for managing members, books, borrowing, returns, and
overdue loans. The API is built with Express, TypeScript, and MongoDB/Mongoose;
the client uses React, TypeScript, Vite, and Tailwind CSS.

## Features

- Member registration, login, profile updates, and password reset
- Searchable, filterable, paginated book catalog with book details
- Member borrowing, returns, personal loan history, and dashboards
- Admin book management and library dashboard
- Server-side validation and role-based API access

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- A MongoDB Atlas database and network access to its cluster

## Setup

```sh
git clone https://github.com/abinayajega14/library-management-system.git
cd library-management-system
npm install
npm install --prefix server
npm install --prefix client
```

Copy the server environment template:

```powershell
Copy-Item server\.env.example server\.env
```

On macOS or Linux, use `cp server/.env.example server/.env`. Edit
`server/.env` and set `MONGODB_URI` to your Atlas connection string and
`JWT_SECRET` to a long, random value. Keep `server/.env` private; it is ignored
by Git. `PORT` defaults to `5000`, and the client dev server uses port `5173`.

Seed demo users, books, and one overdue loan:

```sh
npm run seed
```

**Use a disposable development database for seeding.** The seed script deletes
the existing loans, users, and books in the configured database before adding
the demo data.

Start the API and client together:

```sh
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the server on
port `5000`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Member | `member@library.test` | `Member@123` |
| Admin | `admin@library.test` | `Admin@123` |

These are local assessment/demo credentials created by the seed script. Do not
reuse them for a deployed environment.

## Tests and checks

```sh
npm test
npm run typecheck --prefix server
npm run build --prefix client
npm run lint --prefix client
```

The backend tests use `mongodb-memory-server` and do not require the Atlas
database configured in `server/.env`. The first test run may download a MongoDB
test binary.

## Project structure

```text
client/
  public/                  # static assets, including the default book cover
  src/
    api/ components/ context/ pages/ types/ utils/
server/
  src/
    config/ middleware/ models/ routes/ scripts/ types/ utils/
  test/
docs/
```

## Documentation

- [Requirements analysis](docs/requirements-analysis.md)
- [Business rules and validations](docs/business-rules-validations.md)
- [Assumptions](docs/assumptions.md)
- [Copilot prompts](docs/ai-prompts.md)
- [AI output review](docs/ai-review.md)
- [Test cases and results](docs/test-cases.md)
- [Known issues](docs/known-issues.md)
