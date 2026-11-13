import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { BookModel } from "../src/models/book.model";
import { LoanModel } from "../src/models/loan.model";
import { UserModel } from "../src/models/user.model";

const testSecret = "test-jwt-secret";
const memberId = "64a000000000000000000001";
const otherMemberId = "64a000000000000000000002";

type TestLoan = {
  id: string;
  user: string;
  book: { title: string; author: string };
  borrowedAt: Date;
  dueDate: Date;
  returnedAt: Date | null;
  status: "borrowed" | "returned";
};

function tokenFor(role: "member" | "admin", userId = memberId): string {
  return jwt.sign({ role }, testSecret, {
    subject: userId,
    expiresIn: "7d",
  });
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);

  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("The test server did not start on a TCP port");
    }

    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("member dashboard includes only the member's current and overdue loans", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFind = LoanModel.find;
  process.env.JWT_SECRET = testSecret;

  const now = Date.now();
  const loans: TestLoan[] = [
    {
      id: "64c000000000000000000001",
      user: memberId,
      book: { title: "Current Book", author: "A. Writer" },
      borrowedAt: new Date(now - 24 * 60 * 60 * 1000),
      dueDate: new Date(now + 7 * 24 * 60 * 60 * 1000),
      returnedAt: null,
      status: "borrowed",
    },
    {
      id: "64c000000000000000000002",
      user: memberId,
      book: { title: "Overdue Book", author: "B. Writer" },
      borrowedAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now - 6 * 24 * 60 * 60 * 1000),
      returnedAt: null,
      status: "borrowed",
    },
    {
      id: "64c000000000000000000003",
      user: otherMemberId,
      book: { title: "Another Member's Book", author: "C. Writer" },
      borrowedAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
      returnedAt: null,
      status: "borrowed",
    },
  ];
  let capturedFilter: Record<string, unknown> = {};
  let capturedSort: Record<string, 1 | -1> = {};
  type MockLoanQuery = {
    populate: (path: string, select: string) => MockLoanQuery;
    sort: (sort: Record<string, 1 | -1>) => MockLoanQuery;
    exec: () => Promise<TestLoan[]>;
  };
  Object.assign(LoanModel, {
    find: (filter: Record<string, unknown>) => {
      capturedFilter = filter;
      let query: MockLoanQuery;
      query = {
        populate: () => query,
        sort: (sort) => {
          capturedSort = sort;
          return query;
        },
        exec: async () => {
          const matchingLoans = loans.filter(
            (loan) =>
              loan.user === String(filter.user) &&
              loan.status === filter.status,
          );
          matchingLoans.sort(
            (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
          );
          return matchingLoans;
        },
      };
      return query;
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/dashboard/member`, {
        headers: { authorization: `Bearer ${tokenFor("member")}` },
      });
      assert.equal(response.status, 200);
      const body = await response.json();

      assert.deepEqual(capturedFilter, {
        user: memberId,
        status: "borrowed",
      });
      assert.deepEqual(capturedSort, { dueDate: 1 });
      assert.equal(body.currentLoans.length, 2);
      assert.equal(body.currentLoans[0].book.title, "Overdue Book");
      assert.equal(body.currentLoans[0].displayStatus, "Overdue");
      assert.equal(body.currentLoans[1].book.title, "Current Book");
      assert.equal(body.overdueLoans.length, 1);
      assert.equal(body.overdueLoans[0].id, "64c000000000000000000002");
      assert.deepEqual(body.counts, { current: 2, overdue: 1 });
    });
  } finally {
    Object.assign(LoanModel, { find: originalFind });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test("admin dashboard counts match seeded data and role access is restricted", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originals = {
    userCountDocuments: UserModel.countDocuments,
    bookCountDocuments: BookModel.countDocuments,
    bookFind: BookModel.find,
    loanCountDocuments: LoanModel.countDocuments,
  };
  process.env.JWT_SECRET = testSecret;

  const countFilters: Array<Record<string, unknown> | undefined> = [];
  const lowAvailabilityBooks = [
    {
      id: "64b000000000000000000003",
      title: "Unavailable Book",
      availableCopies: 0,
      totalCopies: 3,
    },
    {
      id: "64b000000000000000000004",
      title: "The Clockwork Orchard",
      availableCopies: 1,
      totalCopies: 1,
    },
    {
      id: "64b000000000000000000005",
      title: "Practical Paper Circuits",
      availableCopies: 1,
      totalCopies: 3,
    },
    {
      id: "64b000000000000000000006",
      title: "Signals from Europa",
      availableCopies: 2,
      totalCopies: 6,
    },
    {
      id: "64b000000000000000000007",
      title: "The Lantern Cartographer",
      availableCopies: 2,
      totalCopies: 2,
    },
  ];
  type MockBookQuery = {
    sort: (sort: Record<string, 1 | -1>) => MockBookQuery;
    exec: () => Promise<typeof lowAvailabilityBooks>;
  };
  let capturedBookSort: Record<string, 1 | -1> = {};
  Object.assign(UserModel, {
    countDocuments: async (filter?: Record<string, unknown>) => {
      countFilters.push(filter);
      return 1;
    },
  });
  Object.assign(BookModel, {
    countDocuments: async () => 12,
    find: (filter: Record<string, unknown>) => {
      assert.deepEqual(filter, { availableCopies: { $lte: 2 } });
      let query: MockBookQuery;
      query = {
        sort: (sort) => {
          capturedBookSort = sort;
          return query;
        },
        exec: async () => lowAvailabilityBooks,
      };
      return query;
    },
  });
  Object.assign(LoanModel, {
    countDocuments: async (filter: Record<string, unknown>) => {
      countFilters.push(filter);
      return 1;
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const adminDashboard = await fetch(`${baseUrl}/api/dashboard/admin`, {
        headers: { authorization: `Bearer ${tokenFor("admin")}` },
      });
      assert.equal(adminDashboard.status, 200);
      assert.deepEqual(await adminDashboard.json(), {
        totalMembers: 1,
        totalBooks: 12,
        activeBorrowings: 1,
        overdueBorrowings: 1,
        lowAvailabilityBooks,
      });
      assert.deepEqual(capturedBookSort, { availableCopies: 1 });
      assert.deepEqual(countFilters[0], { role: "member" });
      assert.deepEqual(countFilters[1], { status: "borrowed" });
      assert.deepEqual(
        Object.keys(countFilters[2] ?? {}).sort(),
        ["dueDate", "status"],
      );
      assert.ok(countFilters[2]?.dueDate);

      const memberOnAdminDashboard = await fetch(`${baseUrl}/api/dashboard/admin`, {
        headers: { authorization: `Bearer ${tokenFor("member")}` },
      });
      const adminOnMemberDashboard = await fetch(`${baseUrl}/api/dashboard/member`, {
        headers: { authorization: `Bearer ${tokenFor("admin")}` },
      });
      assert.equal(memberOnAdminDashboard.status, 403);
      assert.equal(adminOnMemberDashboard.status, 403);
    });
  } finally {
    Object.assign(UserModel, { countDocuments: originals.userCountDocuments });
    Object.assign(BookModel, {
      countDocuments: originals.bookCountDocuments,
      find: originals.bookFind,
    });
    Object.assign(LoanModel, { countDocuments: originals.loanCountDocuments });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});
