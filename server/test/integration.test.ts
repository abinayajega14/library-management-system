import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app";
import { backfillMembershipExpiries } from "../src/config/db";
import { BookModel } from "../src/models/book.model";
import { LoanModel } from "../src/models/loan.model";
import { UserModel, type UserRole } from "../src/models/user.model";
import { ensureSeedData } from "../src/scripts/seed";

const testSecret = "integration-test-jwt-secret";
const testPassword = "TestPassword@123";
const testName = "Library Member";
const originalJwtSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

let mongoServer: MongoMemoryServer | undefined;
let httpServer: Server | undefined;
let baseUrl = "";
let userSequence = 0;
let isbnSequence = 0;

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function createUser(role: UserRole = "member") {
  userSequence += 1;
  return UserModel.create({
    name: testName,
    email: `${role}-${userSequence}@library.test`,
    passwordHash: await bcrypt.hash(testPassword, 4),
    role,
    phone: "555-0100",
    address: "1 Library Lane",
  });
}

async function loginAs(user: { email: string }) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email: user.email, password: testPassword },
  });
  assert.equal(response.status, 200);
  return (await response.json()).token as string;
}

async function createBook(options: {
  totalCopies: number;
  availableCopies?: number;
  title?: string;
  author?: string;
  genre?: string;
  isbn?: string;
}) {
  isbnSequence += 1;
  return BookModel.create({
    title: options.title ?? `Test Book ${isbnSequence}`,
    author: options.author ?? "Test Author",
    genre: options.genre ?? "Fiction",
    isbn: options.isbn ?? String(isbnSequence).padStart(10, "0"),
    totalCopies: options.totalCopies,
    availableCopies: options.availableCopies ?? options.totalCopies,
  });
}

before(async () => {
  process.env.JWT_SECRET = testSecret;
  process.env.NODE_ENV = "test";
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: "library_test" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "library_test" });
  await Promise.all([UserModel.init(), BookModel.init(), LoanModel.init()]);

  httpServer = app.listen(0);
  await once(httpServer, "listening");
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("The integration test server did not start on a TCP port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await Promise.all([
    LoanModel.deleteMany({}),
    BookModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  await Promise.all([UserModel.init(), BookModel.init(), LoanModel.init()]);
});

after(async () => {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("registration validates required fields, email, password, and duplicate accounts", async () => {
  const missingFields = await request("/api/auth/register", {
    method: "POST",
    body: {},
  });
  assert.equal(missingFields.status, 400);
  assert.deepEqual(
    Object.keys((await missingFields.json()).errors).sort(),
    ["email", "name", "password"],
  );

  const invalidEmail = await request("/api/auth/register", {
    method: "POST",
    body: { name: testName, email: "not-an-email", password: testPassword },
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(typeof (await invalidEmail.json()).errors.email, "string");

  const shortPassword = await request("/api/auth/register", {
    method: "POST",
    body: { name: testName, email: "short@library.test", password: "short" },
  });
  assert.equal(shortPassword.status, 400);
  assert.equal(typeof (await shortPassword.json()).errors.password, "string");

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: testName,
      email: "member@library.test",
      password: testPassword,
      role: "admin",
    },
  });
  assert.equal(registration.status, 201);
  const registeredUser = (await registration.json()).user;
  assert.equal(registeredUser.role, "member");
  assert.equal("passwordHash" in registeredUser, false);
  const membershipExpiresAt = new Date(registeredUser.membershipExpiresAt).getTime();
  assert.ok(membershipExpiresAt > Date.now() + 364 * 24 * 60 * 60 * 1000);
  assert.ok(membershipExpiresAt <= Date.now() + 366 * 24 * 60 * 60 * 1000);

  const duplicateRegistration = await request("/api/auth/register", {
    method: "POST",
    body: { name: testName, email: "member@library.test", password: testPassword },
  });
  assert.equal(duplicateRegistration.status, 409);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "member@library.test", password: testPassword },
  });
  assert.equal(login.status, 200);
  assert.equal(typeof (await login.json()).token, "string");

  const invalidLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "member@library.test", password: "wrong password" },
  });
  assert.equal(invalidLogin.status, 401);
});

test("legacy users are assigned an expiry based on their account creation date", async () => {
  const member = await createUser();
  await UserModel.updateOne(
    { _id: member.id },
    { $unset: { membershipExpiresAt: 1 } },
  );

  await backfillMembershipExpiries();

  const migratedMember = await UserModel.findById(member.id);
  assert.ok(migratedMember?.membershipExpiresAt);
  assert.equal(
    migratedMember.membershipExpiresAt.getTime(),
    member.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000,
  );
});

test("catalog supports title and author search, genre filters, and combined queries", async () => {
  const firstBook = await createBook({
    totalCopies: 4,
    title: "The Quiet Observatory",
    author: "Mira Ellison",
    genre: "Science",
  });
  await createBook({
    totalCopies: 3,
    title: "Garden Notes",
    author: "Mira Ellison",
    genre: "Fiction",
  });
  await createBook({
    totalCopies: 2,
    title: "The Stone Archive",
    author: "Jonah Vale",
    genre: "History",
  });
  const member = await createUser();
  const token = await loginAs(member);

  const titleSearch = await request("/api/books?q=Observatory", { token });
  assert.equal(titleSearch.status, 200);
  assert.deepEqual(
    (await titleSearch.json()).items.map((book: { id: string }) => book.id),
    [firstBook.id],
  );

  const authorSearch = await request("/api/books?q=Mira%20Ellison", { token });
  assert.equal(authorSearch.status, 200);
  assert.equal((await authorSearch.json()).total, 2);

  const genreFilter = await request("/api/books?genre=science", { token });
  assert.equal(genreFilter.status, 200);
  assert.equal((await genreFilter.json()).items[0].genre, "Science");

  const combined = await request("/api/books?q=Mira&genre=Fiction", { token });
  assert.equal(combined.status, 200);
  assert.equal((await combined.json()).total, 1);
});

test("member cannot create books; duplicate ISBN and negative copies are rejected", async () => {
  const member = await createUser();
  const memberToken = await loginAs(member);
  const memberCreate = await request("/api/books", {
    method: "POST",
    token: memberToken,
    body: {
      title: "Restricted Book",
      author: "Test Author",
      genre: "Fiction",
      isbn: "1111111111",
      totalCopies: 1,
    },
  });
  assert.equal(memberCreate.status, 403);

  const admin = await createUser("admin");
  const adminToken = await loginAs(admin);
  const bookBody = {
    title: "Unique Book",
    author: "Test Author",
    genre: "Fiction",
    isbn: "1111111111",
    totalCopies: 2,
  };
  assert.equal(
    (
      await request("/api/books", {
        method: "POST",
        token: adminToken,
        body: bookBody,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/api/books", {
        method: "POST",
        token: adminToken,
        body: bookBody,
      })
    ).status,
    409,
  );

  const negativeCopies = await request("/api/books", {
    method: "POST",
    token: adminToken,
    body: { ...bookBody, isbn: "2222222222", totalCopies: -1 },
  });
  assert.equal(negativeCopies.status, 400);
});

test("borrowing, returning, and history update copy counts correctly", async () => {
  const member = await createUser();
  const token = await loginAs(member);
  const book = await createBook({ totalCopies: 2 });
  const borrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(borrow.status, 201);
  const borrowed = (await borrow.json()).loan;
  assert.equal(borrowed.displayStatus, "Borrowed");
  assert.equal(borrowed.fine, 0);
  assert.equal((await BookModel.findById(book.id))?.availableCopies, 1);

  const current = await request("/api/loans/me/current", { token });
  assert.equal(current.status, 200);
  assert.equal((await current.json()).loans.length, 1);

  const returned = await request(`/api/loans/${borrowed.id}/return`, {
    method: "POST",
    token,
  });
  assert.equal(returned.status, 200);
  assert.equal((await returned.json()).loan.displayStatus, "Returned");
  assert.equal((await BookModel.findById(book.id))?.availableCopies, 2);

  const returnAgain = await request(`/api/loans/${borrowed.id}/return`, {
    method: "POST",
    token,
  });
  assert.equal(returnAgain.status, 409);

  const history = await request("/api/loans/me/history", { token });
  assert.equal(history.status, 200);
  const historyLoans = (await history.json()).loans;
  assert.equal(historyLoans.length, 1);
  assert.equal(historyLoans[0].id, borrowed.id);
  assert.equal(historyLoans[0].displayStatus, "Returned");
});

test("borrowing requires a complete profile and an active membership", async () => {
  const member = await createUser();
  const token = await loginAs(member);
  const book = await createBook({ totalCopies: 1 });

  await UserModel.updateOne({ _id: member.id }, { $unset: { phone: 1 } });
  const incompleteProfileBorrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(incompleteProfileBorrow.status, 403);
  assert.match((await incompleteProfileBorrow.json()).message, /complete your profile/i);
  assert.equal(await LoanModel.countDocuments({ user: member.id }), 0);

  await UserModel.updateOne(
    { _id: member.id },
    { $set: { phone: "555-0100", membershipExpiresAt: new Date(Date.now() - 1) } },
  );
  const expiredMembershipBorrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(expiredMembershipBorrow.status, 403);
  assert.match((await expiredMembershipBorrow.json()).message, /membership has expired/i);
  assert.equal(await LoanModel.countDocuments({ user: member.id }), 0);

  await UserModel.updateOne(
    { _id: member.id },
    { $set: { membershipExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
  );
  const activeMembershipBorrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(activeMembershipBorrow.status, 201);
});

test("admins can borrow, return, and view their own loans as members", async () => {
  const admin = await createUser("admin");
  const token = await loginAs(admin);
  const book = await createBook({ totalCopies: 1 });

  const borrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(borrow.status, 201);
  const loanId = (await borrow.json()).loan.id as string;

  const currentLoans = await request("/api/loans/me/current", { token });
  assert.equal(currentLoans.status, 200);
  assert.equal((await currentLoans.json()).loans[0].id, loanId);

  const returned = await request(`/api/loans/${loanId}/return`, {
    method: "POST",
    token,
  });
  assert.equal(returned.status, 200);
  assert.equal((await returned.json()).loan.status, "returned");

  const history = await request("/api/loans/me/history", { token });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).loans[0].id, loanId);
});

test("overdue fines are calculated on current loans and fixed in history after return", async () => {
  const member = await createUser();
  const token = await loginAs(member);
  const book = await createBook({ totalCopies: 1 });
  const borrow = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: book.id },
  });
  assert.equal(borrow.status, 201);
  const loanId = (await borrow.json()).loan.id as string;
  const dueDate = new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000);
  await LoanModel.updateOne({ _id: loanId }, { $set: { dueDate } });

  const current = await request("/api/loans/me/current", { token });
  assert.equal(current.status, 200);
  assert.equal((await current.json()).loans[0].fine, 2);

  const returned = await request(`/api/loans/${loanId}/return`, {
    method: "POST",
    token,
  });
  assert.equal(returned.status, 200);
  assert.equal((await returned.json()).loan.fine, 2);

  const history = await request("/api/loans/me/history", { token });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).loans[0].fine, 2);
});

test("unavailable books and borrowing more than three active books are rejected", async () => {
  const member = await createUser();
  const token = await loginAs(member);
  const unavailableBook = await createBook({ totalCopies: 0 });
  const unavailable = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: unavailableBook.id },
  });
  assert.equal(unavailable.status, 409);
  assert.equal(await LoanModel.countDocuments({ user: member.id }), 0);

  const books = await Promise.all([
    createBook({ totalCopies: 1 }),
    createBook({ totalCopies: 1 }),
    createBook({ totalCopies: 1 }),
    createBook({ totalCopies: 1 }),
  ]);
  for (const book of books.slice(0, 3)) {
    const borrow = await request("/api/loans", {
      method: "POST",
      token,
      body: { bookId: book.id },
    });
    assert.equal(borrow.status, 201);
  }
  const fourthBook = await request("/api/loans", {
    method: "POST",
    token,
    body: { bookId: books[3].id },
  });
  assert.equal(fourthBook.status, 409);
  assert.equal(await LoanModel.countDocuments({ user: member.id, status: "borrowed" }), 3);
});

test("profile updates ignore privileged fields and password reset works end-to-end", async () => {
  const member = await createUser();
  const token = await loginAs(member);

  const profileUpdate = await request("/api/users/me", {
    method: "PATCH",
    token,
    body: {
      name: "Updated Member",
      phone: "555-0101",
      address: "New Address",
      email: "changed@library.test",
      role: "admin",
    },
  });
  assert.equal(profileUpdate.status, 200);
  const profile = (await profileUpdate.json()).user;
  assert.equal(profile.name, "Updated Member");
  assert.equal(profile.email, member.email);
  assert.equal(profile.role, "member");

  const forgot = await request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: member.email },
  });
  assert.equal(forgot.status, 200);
  const resetToken = (await forgot.json()).resetToken as string;
  assert.equal(typeof resetToken, "string");
  const storedUser = await UserModel.findById(member.id).select("+resetTokenHash");
  assert.ok(storedUser?.resetTokenHash);
  assert.notEqual(storedUser?.resetTokenHash, resetToken);

  const reset = await request("/api/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: "UpdatedPassword@123" },
  });
  assert.equal(reset.status, 200);
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: member.email, password: "UpdatedPassword@123" },
      })
    ).status,
    200,
  );

  const invalidReset = await request("/api/auth/reset-password", {
    method: "POST",
    body: { token: "invalid-token", password: "UpdatedPassword@123" },
  });
  assert.equal(invalidReset.status, 400);
});

test("book and member changes persist after reconnecting to MongoDB", async () => {
  const admin = await createUser("admin");
  const adminToken = await loginAs(admin);
  const createBook = await request("/api/books", {
    method: "POST",
    token: adminToken,
    body: {
      title: "Persistent Book",
      author: "Test Author",
      genre: "Fiction",
      isbn: "1234567890",
      totalCopies: 2,
    },
  });
  assert.equal(createBook.status, 201);
  const createdBook = (await createBook.json()).book;

  const bookUpdate = await request(`/api/books/${createdBook.id}`, {
    method: "PUT",
    token: adminToken,
    body: {
      title: "Updated Persistent Book",
      coverImage: "https://example.com/cover.jpg",
    },
  });
  assert.equal(bookUpdate.status, 200);

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Persistent Member",
      email: "persistent-member@library.test",
      password: testPassword,
    },
  });
  assert.equal(registration.status, 201);
  const registeredMember = (await registration.json()).user;

  const forgot = await request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: registeredMember.email },
  });
  assert.equal(forgot.status, 200);
  const resetToken = (await forgot.json()).resetToken as string;
  const reset = await request("/api/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: "PersistentPassword@123" },
  });
  assert.equal(reset.status, 200);

  await mongoose.disconnect();
  assert.ok(mongoServer);
  await mongoose.connect(mongoServer.getUri(), { dbName: "library_test" });

  const persistedBook = await BookModel.findById(createdBook.id);
  assert.equal(persistedBook?.title, "Updated Persistent Book");
  assert.equal(persistedBook?.coverImage, "https://example.com/cover.jpg");

  const persistedMember = await UserModel.findOne({
    email: registeredMember.email,
  });
  assert.ok(persistedMember);
  assert.equal(persistedMember.name, "Persistent Member");
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: {
          email: registeredMember.email,
          password: "PersistentPassword@123",
        },
      })
    ).status,
    200,
  );
});

test("demo seeding preserves existing data and is safe to rerun", async () => {
  const passwordHash = await bcrypt.hash(testPassword, 4);
  const member = await UserModel.create({
    name: "Existing Demo Member",
    email: "member@library.test",
    passwordHash,
    role: "member",
  });
  const book = await BookModel.create({
    title: "Existing Demo Book",
    author: "Existing Author",
    genre: "Reference",
    isbn: "9780134685991",
    coverImage: "https://example.com/existing-cover.jpg",
    totalCopies: 3,
    availableCopies: 3,
  });
  const registeredMember = await UserModel.create({
    name: "Registered Member",
    email: "registered-member@library.test",
    passwordHash,
    role: "member",
  });
  const registeredBook = await BookModel.create({
    title: "Registered Book",
    author: "Registered Author",
    genre: "History",
    isbn: "1234567890",
    coverImage: "https://example.com/registered-cover.jpg",
    totalCopies: 2,
    availableCopies: 2,
  });

  await ensureSeedData();
  await ensureSeedData();

  const persistedMember = await UserModel.findById(member.id);
  assert.equal(persistedMember?.name, "Existing Demo Member");
  assert.ok(await UserModel.findById(registeredMember.id));

  const persistedBook = await BookModel.findById(book.id);
  assert.equal(persistedBook?.title, "Existing Demo Book");
  assert.equal(persistedBook?.coverImage, "https://example.com/existing-cover.jpg");
  assert.equal(persistedBook?.availableCopies, 2);
  assert.ok(await BookModel.findById(registeredBook.id));
  assert.equal(
    await LoanModel.countDocuments({ user: member.id, book: book.id }),
    1,
  );
});

test("two members competing for the last copy yield one success", async () => {
  const [firstMember, secondMember] = await Promise.all([
    createUser(),
    createUser(),
  ]);
  const [firstToken, secondToken] = await Promise.all([
    loginAs(firstMember),
    loginAs(secondMember),
  ]);
  const book = await createBook({ totalCopies: 1 });

  const responses = await Promise.all([
    request("/api/loans", {
      method: "POST",
      token: firstToken,
      body: { bookId: book.id },
    }),
    request("/api/loans", {
      method: "POST",
      token: secondToken,
      body: { bookId: book.id },
    }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal((await BookModel.findById(book.id))?.availableCopies, 0);
  assert.equal(await LoanModel.countDocuments({ book: book.id, status: "borrowed" }), 1);
});

test("simultaneous duplicate borrows create one active loan", async () => {
  const member = await createUser();
  const token = await loginAs(member);
  const book = await createBook({ totalCopies: 2 });

  const responses = await Promise.all([
    request("/api/loans", {
      method: "POST",
      token,
      body: { bookId: book.id },
    }),
    request("/api/loans", {
      method: "POST",
      token,
      body: { bookId: book.id },
    }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(
    await LoanModel.countDocuments({
      user: member.id,
      book: book.id,
      status: "borrowed",
    }),
    1,
  );
  assert.equal((await BookModel.findById(book.id))?.availableCopies, 1);
});

test("admin cannot reduce total copies below the number currently borrowed", async () => {
  const admin = await createUser("admin");
  const adminToken = await loginAs(admin);
  const member = await createUser();
  const memberToken = await loginAs(member);
  const book = await createBook({ totalCopies: 3 });
  const borrow = await request("/api/loans", {
    method: "POST",
    token: memberToken,
    body: { bookId: book.id },
  });
  assert.equal(borrow.status, 201);

  const update = await request(`/api/books/${book.id}`, {
    method: "PUT",
    token: adminToken,
    body: { totalCopies: 0 },
  });
  assert.equal(update.status, 409);
  assert.equal(
    (await update.json()).message,
    "Total copies cannot be less than the 1 copies currently borrowed",
  );
});

test("overdue loans appear on member and admin dashboards", async () => {
  const admin = await createUser("admin");
  const adminToken = await loginAs(admin);
  const member = await createUser();
  const memberToken = await loginAs(member);
  const book = await createBook({ totalCopies: 1 });
  const borrow = await request("/api/loans", {
    method: "POST",
    token: memberToken,
    body: { bookId: book.id },
  });
  assert.equal(borrow.status, 201);
  const borrowedLoanId = (await borrow.json()).loan.id as string;
  await LoanModel.updateOne(
    { _id: borrowedLoanId },
    { $set: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  );

  const currentLoans = await request("/api/loans/me/current", { token: memberToken });
  assert.equal((await currentLoans.json()).loans[0].displayStatus, "Overdue");

  const memberDashboard = await request("/api/dashboard/member", {
    token: memberToken,
  });
  assert.deepEqual((await memberDashboard.json()).counts, { current: 1, overdue: 1 });

  const adminDashboard = await request("/api/dashboard/admin", {
    token: adminToken,
  });
  const adminBody = await adminDashboard.json();
  assert.equal(adminBody.totalMembers, 1);
  assert.equal(adminBody.totalBooks, 1);
  assert.equal(adminBody.activeBorrowings, 1);
  assert.equal(adminBody.overdueBorrowings, 1);
  assert.equal(adminBody.lowAvailabilityBooks[0].availableCopies, 0);
});
