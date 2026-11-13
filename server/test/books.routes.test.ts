import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { BookModel, type Book } from "../src/models/book.model";

const testSecret = "test-jwt-secret";
const bookId = "64b000000000000000000001";

function createBook(overrides: Partial<Book> = {}) {
  return new BookModel({
    _id: bookId,
    title: "The Quiet Observatory",
    author: "Mira Ellison",
    genre: "Fiction",
    isbn: "9780134685991",
    totalCopies: 5,
    availableCopies: 3,
    ...overrides,
  });
}

function tokenFor(role: "member" | "admin"): string {
  return jwt.sign({ role }, testSecret, {
    subject: `${role}-id`,
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

test("Book schema declares a unique ISBN index and validates copy counts", async () => {
  const hasUniqueIsbnIndex = BookModel.schema.indexes().some(
    ([fields, options]) => fields.isbn === 1 && options.unique === true,
  );
  assert.equal(hasUniqueIsbnIndex, true);

  const invalidBook = createBook({ totalCopies: 2, availableCopies: 3 });
  await assert.rejects(invalidBook.validate());
});

test("book catalog search, genre filtering, pagination, and genre list", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFind = BookModel.find;
  const originalCountDocuments = BookModel.countDocuments;
  const originalDistinct = BookModel.distinct;
  process.env.JWT_SECRET = testSecret;

  const listBooks = [createBook()];
  let capturedFilter: Record<string, unknown> = {};
  let capturedSkip = -1;
  let capturedLimit = -1;
  let count = 13;
  type MockBookQuery = {
    sort: (_sort: { title: number }) => MockBookQuery;
    skip: (value: number) => MockBookQuery;
    limit: (value: number) => MockBookQuery;
    exec: () => Promise<ReturnType<typeof createBook>[]>;
  };
  let query: MockBookQuery;
  query = {
    sort: (_sort) => query,
    skip: (value: number) => {
      capturedSkip = value;
      return query;
    },
    limit: (value: number) => {
      capturedLimit = value;
      return query;
    },
    exec: async () => listBooks,
  };
  Object.assign(BookModel, {
    find: (filter: Record<string, unknown>) => {
      capturedFilter = filter;
      return query;
    },
    countDocuments: async () => count,
    distinct: async () => ["Science", "Fiction"],
  });

  try {
    await withServer(async (baseUrl) => {
      const requestBooks = (params: Record<string, string>) =>
        fetch(`${baseUrl}/api/books?${new URLSearchParams(params)}`, {
          headers: { authorization: `Bearer ${tokenFor("member")}` },
        });

      const titleSearch = await requestBooks({ q: "Observatory" });
      assert.equal(titleSearch.status, 200);
      let response = await titleSearch.json();
      assert.equal(response.items[0].id, bookId);
      assert.equal(response.total, 13);
      assert.equal(response.page, 1);
      assert.equal(response.pages, 2);
      assert.ok(Array.isArray(capturedFilter.$or));
      const titleOrAuthor = capturedFilter.$or as Array<Record<string, RegExp>>;
      assert.equal(titleOrAuthor[0].title.source, "Observatory");
      assert.equal(titleOrAuthor[0].title.flags, "i");
      assert.equal(titleOrAuthor[1].author.source, "Observatory");

      const authorSearch = await requestBooks({ q: "Mira Ellison" });
      assert.equal(authorSearch.status, 200);
      const authorFilter = capturedFilter.$or as Array<Record<string, RegExp>>;
      assert.equal(authorFilter[1].author.source, "Mira Ellison");

      const genreSearch = await requestBooks({ genre: "science" });
      assert.equal(genreSearch.status, 200);
      assert.ok(capturedFilter.genre instanceof RegExp);
      assert.equal(capturedFilter.genre.source, "^science$");
      assert.equal(capturedFilter.genre.flags, "i");

      const combinedSearch = await requestBooks({
        q: "glass",
        genre: "Fiction",
        page: "2",
        limit: "5",
      });
      assert.equal(combinedSearch.status, 200);
      assert.ok(capturedFilter.$or);
      assert.ok(capturedFilter.genre instanceof RegExp);
      assert.equal(capturedSkip, 5);
      assert.equal(capturedLimit, 5);
      response = await combinedSearch.json();
      assert.equal(response.page, 2);
      assert.equal(response.pages, 3);

      const escapedSearch = await requestBooks({ q: "(" });
      assert.equal(escapedSearch.status, 200);
      const escapedFilter = capturedFilter.$or as Array<Record<string, RegExp>>;
      assert.equal(escapedFilter[0].title.source, "\\(");

      count = 0;
      const invalidPage = await requestBooks({ page: "0" });
      assert.equal(invalidPage.status, 400);

      const genres = await fetch(`${baseUrl}/api/books/genres`, {
        headers: { authorization: `Bearer ${tokenFor("member")}` },
      });
      assert.equal(genres.status, 200);
      assert.deepEqual((await genres.json()).genres, ["Fiction", "Science"]);
    });
  } finally {
    Object.assign(BookModel, {
      find: originalFind,
      countDocuments: originalCountDocuments,
      distinct: originalDistinct,
    });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test("book details and admin-only create/update with ISBN and copy validation", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = BookModel.findById;
  const originalCreate = BookModel.create;
  const originalFindByIdAndUpdate = BookModel.findByIdAndUpdate;
  process.env.JWT_SECRET = testSecret;

  let currentBook = createBook();
  let lastCreatedInput: Record<string, unknown> | undefined;
  let lastUpdate: Record<string, unknown> | undefined;
  let createCount = 0;
  Object.assign(BookModel, {
    findById: async (id: string) => (id === bookId ? currentBook : null),
    create: async (input: Record<string, unknown>) => {
      createCount += 1;
      lastCreatedInput = input;
      if (input.isbn === "0000000000") {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      }
      return new BookModel({ _id: bookId, ...input });
    },
    findByIdAndUpdate: async (
      _id: string,
      update: { $set: Record<string, unknown> },
    ) => {
      lastUpdate = update.$set;
      currentBook = createBook({
        ...currentBook.toObject(),
        ...update.$set,
      });
      return currentBook;
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const getBook = (id: string) =>
        fetch(`${baseUrl}/api/books/${id}`, {
          headers: { authorization: `Bearer ${tokenFor("member")}` },
        });

      const details = await getBook(bookId);
      assert.equal(details.status, 200);
      assert.equal((await details.json()).book.id, bookId);
      assert.equal((await getBook("not-an-object-id")).status, 404);
      assert.equal((await getBook("64b000000000000000000002")).status, 404);

      const memberHeaders = {
        authorization: `Bearer ${tokenFor("member")}`,
        "content-type": "application/json",
      };
      const memberCreate = await fetch(`${baseUrl}/api/books`, {
        method: "POST",
        headers: memberHeaders,
        body: JSON.stringify({
          title: "New Book",
          author: "A. Writer",
          genre: "Fiction",
          isbn: "1234567890",
          totalCopies: 2,
        }),
      });
      assert.equal(memberCreate.status, 403);
      const memberUpdate = await fetch(`${baseUrl}/api/books/${bookId}`, {
        method: "PUT",
        headers: memberHeaders,
        body: JSON.stringify({ title: "Changed title" }),
      });
      assert.equal(memberUpdate.status, 403);
      assert.equal(createCount, 0);

      const adminHeaders = {
        authorization: `Bearer ${tokenFor("admin")}`,
        "content-type": "application/json",
      };
      const adminCreate = await fetch(`${baseUrl}/api/books`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          title: " New Book ",
          author: " A. Writer ",
          genre: " Fiction ",
          isbn: "123-45 67890",
          totalCopies: 4,
          availableCopies: 0,
        }),
      });
      assert.equal(adminCreate.status, 201);
      assert.equal(lastCreatedInput?.isbn, "1234567890");
      assert.equal(lastCreatedInput?.availableCopies, 4);
      assert.equal((await adminCreate.json()).book.availableCopies, 4);

      const negativeTotal = await fetch(`${baseUrl}/api/books`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          title: "Invalid Book",
          author: "A. Writer",
          genre: "Fiction",
          isbn: "1234567891",
          totalCopies: -1,
        }),
      });
      assert.equal(negativeTotal.status, 400);
      assert.equal(typeof (await negativeTotal.json()).errors.totalCopies, "string");

      const duplicateIsbn = await fetch(`${baseUrl}/api/books`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          title: "Duplicate Book",
          author: "A. Writer",
          genre: "Fiction",
          isbn: "0000000000",
          totalCopies: 1,
        }),
      });
      assert.equal(duplicateIsbn.status, 409);

      const adminUpdate = await fetch(`${baseUrl}/api/books/${bookId}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ totalCopies: 7, availableCopies: 0 }),
      });
      assert.equal(adminUpdate.status, 200);
      assert.equal(lastUpdate?.totalCopies, 7);
      assert.equal(lastUpdate?.availableCopies, 5);
      assert.equal((await adminUpdate.json()).book.availableCopies, 5);

      const reduceBelowOnLoan = await fetch(`${baseUrl}/api/books/${bookId}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ totalCopies: 1 }),
      });
      assert.equal(reduceBelowOnLoan.status, 409);
      assert.equal(
        (await reduceBelowOnLoan.json()).message,
        "Total copies cannot be less than the 2 copies currently borrowed",
      );
    });
  } finally {
    Object.assign(BookModel, {
      findById: originalFindById,
      create: originalCreate,
      findByIdAndUpdate: originalFindByIdAndUpdate,
    });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});
