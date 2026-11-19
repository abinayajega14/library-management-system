import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { BookModel } from "../src/models/book.model";
import { LoanModel } from "../src/models/loan.model";
import { UserModel } from "../src/models/user.model";
import { WaitlistModel } from "../src/models/waitlist.model";
import { getDisplayStatus, getFineAmount } from "../src/utils/loanStatus";

const testSecret = "test-jwt-secret";
const memberId = "64a000000000000000000001";
const otherMemberId = "64a000000000000000000002";
const adminId = "64a000000000000000000003";
const bookId = "64b000000000000000000001";
const noCopiesBookId = "64b000000000000000000002";
const fourthBookId = "64b000000000000000000003";
const adminBookId = "64b000000000000000000004";

type TestBook = {
  id: string;
  title: string;
  author: string;
  availableCopies: number;
};

type TestLoan = {
  id: string;
  _id: string;
  user: string;
  bookId: string;
  book: string | { title: string; author: string };
  borrowedAt: Date;
  dueDate: Date;
  returnedAt: Date | null;
  status: "borrowed" | "returned";
  populate: (path: string, select: string) => Promise<TestLoan>;
};

function tokenFor(role: "member" | "admin", userId = memberId): string {
  return jwt.sign({ role }, testSecret, {
    subject: userId,
    expiresIn: "7d",
  });
}

test("Loan schema indexes and computed display status", () => {
  const indexes = LoanModel.schema.indexes();
  const activeBorrowIndex = indexes.some(
    ([fields, options]) =>
      fields.user === 1 &&
      fields.book === 1 &&
      options.unique === true &&
      options.partialFilterExpression?.status === "borrowed",
  );
  const userStatusIndex = indexes.some(
    ([fields]) => fields.user === 1 && fields.status === 1,
  );
  assert.equal(activeBorrowIndex, true);
  assert.equal(userStatusIndex, true);

  assert.equal(
    getDisplayStatus({ status: "returned", dueDate: new Date(0) }),
    "Returned",
  );
  assert.equal(
    getDisplayStatus({ status: "borrowed", dueDate: new Date(Date.now() - 1000) }),
    "Overdue",
  );
  assert.equal(
    getDisplayStatus({ status: "borrowed", dueDate: new Date(Date.now() + 60_000) }),
    "Borrowed",
  );
});

test("overdue fine counts started days and uses returnedAt for returned loans", () => {
  const dueDate = new Date("2026-01-01T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  assert.equal(
    getFineAmount(
      { status: "borrowed", dueDate, returnedAt: null },
      new Date(dueDate.getTime() - 1),
    ),
    0,
  );
  assert.equal(
    getFineAmount(
      { status: "borrowed", dueDate, returnedAt: null },
      new Date(dueDate.getTime() + 1),
    ),
    1,
  );
  assert.equal(
    getFineAmount(
      {
        status: "returned",
        dueDate,
        returnedAt: new Date(dueDate.getTime() + day + 1),
      },
      new Date(dueDate.getTime() + day * 10),
    ),
    2,
  );
  assert.equal(
    getFineAmount({
      status: "returned",
      dueDate,
      returnedAt: new Date(dueDate.getTime() - 1),
    }),
    0,
  );
});

test("loan routes enforce borrowing rules, return copies, and scope reads to the member", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originals = {
    userFindById: UserModel.findById,
    bookFindById: BookModel.findById,
    bookFindOneAndUpdate: BookModel.findOneAndUpdate,
    bookUpdateOne: BookModel.updateOne,
    loanCountDocuments: LoanModel.countDocuments,
    loanCreate: LoanModel.create,
    loanDeleteOne: LoanModel.deleteOne,
    loanFindOneAndUpdate: LoanModel.findOneAndUpdate,
    loanFind: LoanModel.find,
    waitlistFindOne: WaitlistModel.findOne,
  };
  process.env.JWT_SECRET = testSecret;

  const books = new Map<string, TestBook>([
    [bookId, { id: bookId, title: "Last Copy", author: "A. Writer", availableCopies: 1 }],
    [
      noCopiesBookId,
      { id: noCopiesBookId, title: "Out of Stock", author: "B. Writer", availableCopies: 0 },
    ],
    [
      fourthBookId,
      { id: fourthBookId, title: "Another Book", author: "C. Writer", availableCopies: 1 },
    ],
    [
      adminBookId,
      { id: adminBookId, title: "Admin Book", author: "D. Writer", availableCopies: 1 },
    ],
  ]);
  let loans: TestLoan[] = [];
  let nextLoanId = 10;
  let capturedLoanFilter: Record<string, unknown> = {};
  let capturedLoanSort: Record<string, 1 | -1> = {};
  let createdLoanCount = 0;
  let deletedLoanCount = 0;
  type MockLoanQuery = {
    populate: (path: string, select: string) => MockLoanQuery;
    sort: (sort: Record<string, 1 | -1>) => MockLoanQuery;
    exec: () => Promise<TestLoan[]>;
  };

  const makeLoan = (input: {
    user: string;
    book: string;
    status?: "borrowed" | "returned";
    borrowedAt?: Date;
    dueDate?: Date;
    returnedAt?: Date | null;
  }): TestLoan => {
    const id = nextLoanId.toString(16).padStart(24, "0");
    nextLoanId += 1;
    const loan: TestLoan = {
      id,
      _id: id,
      user: input.user,
      bookId: input.book,
      book: input.book,
      borrowedAt: input.borrowedAt ?? new Date(),
      dueDate: input.dueDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      returnedAt: input.returnedAt ?? null,
      status: input.status ?? "borrowed",
      populate: async () => {
        const book = books.get(loan.bookId);
        if (!book) {
          throw new Error("Missing test book for populated loan");
        }
        loan.book = { title: book.title, author: book.author };
        return loan;
      },
    };
    return loan;
  };

  Object.assign(BookModel, {
    findById: async (id: string) => books.get(String(id)) ?? null,
    findOneAndUpdate: async (
      filter: { _id: unknown; availableCopies: { $gt: number } },
      update: { $inc: { availableCopies: number } },
    ) => {
      const book = books.get(String(filter._id));
      if (!book || book.availableCopies <= filter.availableCopies.$gt) {
        return null;
      }
      book.availableCopies += update.$inc.availableCopies;
      return book;
    },
    updateOne: async (
      filter: { _id: unknown },
      update: { $inc: { availableCopies: number } },
    ) => {
      const book = books.get(String(filter._id));
      if (book) {
        book.availableCopies += update.$inc.availableCopies;
      }
      return { matchedCount: book ? 1 : 0 };
    },
  });

  Object.assign(UserModel, {
    findById: async () => ({
      name: "Library User",
      phone: "555-0100",
      address: "1 Library Lane",
      membershipExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }),
  });

  Object.assign(LoanModel, {
    countDocuments: async (filter: { user: unknown; status: string }) =>
      loans.filter(
        (loan) =>
          loan.user === String(filter.user) && loan.status === filter.status,
      ).length,
    create: async (input: {
      user: unknown;
      book: unknown;
      borrowedAt: Date;
      dueDate: Date;
      returnedAt: Date | null;
      status: "borrowed" | "returned";
    }) => {
      const user = String(input.user);
      const book = String(input.book);
      if (
        loans.some(
          (loan) =>
            loan.user === user && loan.bookId === book && loan.status === "borrowed",
        )
      ) {
        throw Object.assign(new Error("duplicate active loan"), { code: 11000 });
      }
      createdLoanCount += 1;
      const loan = makeLoan({
        user,
        book,
        status: input.status,
        borrowedAt: input.borrowedAt,
        dueDate: input.dueDate,
        returnedAt: input.returnedAt,
      });
      loans.push(loan);
      return loan;
    },
    deleteOne: async (filter: { _id: unknown }) => {
      const before = loans.length;
      loans = loans.filter((loan) => loan.id !== String(filter._id));
      if (loans.length < before) {
        deletedLoanCount += 1;
      }
      return { deletedCount: before - loans.length };
    },
    findOneAndUpdate: async (
      filter: { _id: unknown; user: unknown; status: "borrowed" },
      update: { $set: { status: "returned"; returnedAt: Date } },
    ) => {
      const loan = loans.find(
        (item) =>
          item.id === String(filter._id) &&
          item.user === String(filter.user) &&
          item.status === filter.status,
      );
      if (!loan) {
        return null;
      }
      loan.status = update.$set.status;
      loan.returnedAt = update.$set.returnedAt;
      return loan;
    },
    find: (filter: Record<string, unknown>) => {
      capturedLoanFilter = filter;
      let query: MockLoanQuery;
      query = {
        populate: () => query,
        sort: (sort: Record<string, 1 | -1>) => {
          capturedLoanSort = sort;
          return query;
        },
        exec: async () => {
          const matches = loans.filter(
            (loan) =>
              loan.user === String(filter.user) &&
              (filter.status === undefined || loan.status === filter.status),
          );
          for (const loan of matches) {
            const book = books.get(loan.bookId);
            if (book) {
              loan.book = { title: book.title, author: book.author };
            }
          }
          return matches;
        },
      };
      return query;
    },
  });

  let waitlistQuery: {
    sort: () => typeof waitlistQuery;
    exec: () => Promise<null>;
  };
  waitlistQuery = {
    sort: () => waitlistQuery,
    exec: async () => null,
  };
  Object.assign(WaitlistModel, {
    findOne: () => waitlistQuery,
  });

  try {
    const server = app.listen(0);
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("The test server did not start on a TCP port");
      }
      const baseUrl = `http://127.0.0.1:${address.port}/api/loans`;
      const postBorrow = (token: string, body: unknown) =>
        fetch(baseUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });

      const adminBorrow = await postBorrow(tokenFor("admin", adminId), {
        bookId: adminBookId,
      });
      assert.equal(adminBorrow.status, 201);
      assert.equal(books.get(adminBookId)?.availableCopies, 0);

      const invalidBookId = await postBorrow(tokenFor("member"), { bookId: "bad-id" });
      assert.equal(invalidBookId.status, 400);

      const successfulBorrow = await postBorrow(tokenFor("member"), { bookId });
      assert.equal(successfulBorrow.status, 201);
      const successfulBorrowBody = await successfulBorrow.json();
      const borrowedLoanId = successfulBorrowBody.loan.id as string;
      assert.equal(books.get(bookId)?.availableCopies, 0);
      assert.equal(successfulBorrowBody.loan.book.title, "Last Copy");
      assert.equal(successfulBorrowBody.loan.displayStatus, "Borrowed");
      assert.equal(
        new Date(successfulBorrowBody.loan.dueDate).getTime() -
          new Date(successfulBorrowBody.loan.borrowedAt).getTime(),
        14 * 24 * 60 * 60 * 1000,
      );

      const duplicateBorrow = await postBorrow(tokenFor("member"), { bookId });
      assert.equal(duplicateBorrow.status, 409);
      assert.equal(
        loans.filter((loan) => loan.user === memberId && loan.status === "borrowed").length,
        1,
      );

      const noCopiesBorrow = await postBorrow(tokenFor("member"), {
        bookId: noCopiesBookId,
      });
      assert.equal(noCopiesBorrow.status, 409);
      assert.equal((await noCopiesBorrow.json()).message, "No copies available");
      assert.equal(
        loans.some(
          (loan) =>
            loan.bookId === noCopiesBookId &&
            loan.user === memberId &&
            loan.status === "borrowed",
        ),
        false,
      );
      assert.equal(deletedLoanCount, 1);

      loans = [
        makeLoan({ user: memberId, book: bookId }),
        makeLoan({ user: memberId, book: noCopiesBookId }),
        makeLoan({ user: memberId, book: fourthBookId }),
      ];
      const createdBeforeLimit = createdLoanCount;
      const fourthBorrow = await postBorrow(tokenFor("member"), {
        bookId: fourthBookId,
      });
      assert.equal(fourthBorrow.status, 409);
      assert.equal((await fourthBorrow.json()).message, "Borrowing limit of 3 books reached");
      assert.equal(createdLoanCount, createdBeforeLimit);

      loans = [loans[0]];
      loans[0].id = borrowedLoanId;
      loans[0]._id = borrowedLoanId;
      loans[0].bookId = bookId;
      loans[0].book = bookId;
      loans[0].status = "borrowed";
      loans[0].returnedAt = null;
      const returnedBook = books.get(bookId);
      assert.ok(returnedBook);
      returnedBook.availableCopies = 0;

      const returnUrl = `${baseUrl}/${borrowedLoanId}/return`;
      const returnLoan = () =>
        fetch(returnUrl, {
          method: "POST",
          headers: { authorization: `Bearer ${tokenFor("member")}` },
        });
      const returned = await returnLoan();
      assert.equal(returned.status, 200);
      const returnedBody = await returned.json();
      assert.equal(returnedBody.loan.status, "returned");
      assert.equal(returnedBody.loan.displayStatus, "Returned");
      assert.equal(books.get(bookId)?.availableCopies, 1);

      const returnedAgain = await returnLoan();
      assert.equal(returnedAgain.status, 409);
      assert.equal(books.get(bookId)?.availableCopies, 1);

      const someoneElsesLoan = makeLoan({
        user: otherMemberId,
        book: bookId,
      });
      loans.push(someoneElsesLoan);
      const otherMemberLoanReturn = await fetch(
        `${baseUrl}/${someoneElsesLoan.id}/return`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${tokenFor("member")}` },
        },
      );
      assert.equal(otherMemberLoanReturn.status, 409);
      assert.equal(someoneElsesLoan.status, "borrowed");
      assert.equal(books.get(bookId)?.availableCopies, 1);

      const overdueLoan = makeLoan({
        user: memberId,
        book: bookId,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        borrowedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      });
      loans = [loans[0], overdueLoan, someoneElsesLoan];

      const currentLoans = await fetch(`${baseUrl}/me/current`, {
        headers: { authorization: `Bearer ${tokenFor("member")}` },
      });
      assert.equal(currentLoans.status, 200);
      const currentBody = await currentLoans.json();
      assert.deepEqual(capturedLoanFilter, { user: memberId, status: "borrowed" });
      assert.deepEqual(capturedLoanSort, { dueDate: 1 });
      assert.equal(currentBody.loans.length, 1);
      assert.equal(currentBody.loans[0].id, overdueLoan.id);
      assert.equal(currentBody.loans[0].displayStatus, "Overdue");

      const history = await fetch(`${baseUrl}/me/history`, {
        headers: { authorization: `Bearer ${tokenFor("member")}` },
      });
      assert.equal(history.status, 200);
      const historyBody = await history.json();
      assert.deepEqual(capturedLoanFilter, { user: memberId });
      assert.deepEqual(capturedLoanSort, { borrowedAt: -1 });
      assert.equal(historyBody.loans.length, 2);
      assert.equal(
        historyBody.loans.every((loan: { id: string }) => loan.id !== someoneElsesLoan.id),
        true,
      );
      assert.equal(
        historyBody.loans.some(
          (loan: { id: string; displayStatus: string }) =>
            loan.id === overdueLoan.id && loan.displayStatus === "Overdue",
        ),
        true,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    Object.assign(UserModel, { findById: originals.userFindById });
    Object.assign(BookModel, {
      findById: originals.bookFindById,
      findOneAndUpdate: originals.bookFindOneAndUpdate,
      updateOne: originals.bookUpdateOne,
    });
    Object.assign(LoanModel, {
      countDocuments: originals.loanCountDocuments,
      create: originals.loanCreate,
      deleteOne: originals.loanDeleteOne,
      findOneAndUpdate: originals.loanFindOneAndUpdate,
      find: originals.loanFind,
      findOne: originals.waitlistFindOne,
    });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});
