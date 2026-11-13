import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/db";
import { BookModel, type Book } from "../models/book.model";
import { LoanModel } from "../models/loan.model";
import { UserModel } from "../models/user.model";

const books: Array<Omit<Book, "availableCopies"> & { availableCopies: number }> = [
  {
    title: "The Quiet Observatory",
    author: "Mira Ellison",
    genre: "Fiction",
    isbn: "9780134685991",
    description: "A small-town astronomer uncovers a mystery in the night sky.",
    totalCopies: 5,
    availableCopies: 5,
  },
  {
    title: "Letters from the Glass Coast",
    author: "Jonah Vale",
    genre: "Fiction",
    isbn: "9780134685992",
    totalCopies: 4,
    availableCopies: 4,
  },
  {
    title: "A Map of Old Rivers",
    author: "Leena Hart",
    genre: "History",
    isbn: "9780134685993",
    totalCopies: 3,
    availableCopies: 0,
  },
  {
    title: "The Clockwork Orchard",
    author: "Tomas Wren",
    genre: "Fantasy",
    isbn: "9780134685994",
    totalCopies: 1,
    availableCopies: 1,
  },
  {
    title: "Signals from Europa",
    author: "Nadia Sol",
    genre: "Science",
    isbn: "9780134685995",
    totalCopies: 6,
    availableCopies: 2,
  },
  {
    title: "Practical Paper Circuits",
    author: "Ravi Sen",
    genre: "Technology",
    isbn: "9780134685996",
    totalCopies: 3,
    availableCopies: 1,
  },
  {
    title: "The Museum of Small Hours",
    author: "Elise Rowan",
    genre: "Fiction",
    isbn: "9780134685997",
    totalCopies: 4,
    availableCopies: 4,
  },
  {
    title: "A Field Guide to Quiet Birds",
    author: "Milo Fern",
    genre: "Science",
    isbn: "9780134685998",
    totalCopies: 5,
    availableCopies: 5,
  },
  {
    title: "The Lantern Cartographer",
    author: "Sera North",
    genre: "Fantasy",
    isbn: "9780134685999",
    totalCopies: 2,
    availableCopies: 2,
  },
  {
    title: "Harbors of the Inland Sea",
    author: "Leena Hart",
    genre: "History",
    isbn: "9780134686000",
    totalCopies: 4,
    availableCopies: 4,
  },
  {
    title: "Building Useful Machines",
    author: "Owen Pike",
    genre: "Technology",
    isbn: "9780134686001",
    totalCopies: 3,
    availableCopies: 3,
  },
  {
    title: "The Winter Seed Library",
    author: "Mira Ellison",
    genre: "Fiction",
    isbn: "9780134686002",
    totalCopies: 5,
    availableCopies: 5,
  },
];

export async function ensureSeedData(): Promise<void> {
  const [adminPasswordHash, memberPasswordHash] = await Promise.all([
    bcrypt.hash("Admin@123", 12),
    bcrypt.hash("Member@123", 12),
  ]);

  await Promise.all([
    UserModel.updateOne(
      { email: "admin@library.test" },
      {
        $setOnInsert: {
          name: "Library Admin",
          email: "admin@library.test",
          passwordHash: adminPasswordHash,
          role: "admin",
        },
      },
      { upsert: true },
    ),
    UserModel.updateOne(
      { email: "member@library.test" },
      {
        $setOnInsert: {
          name: "Demo Member",
          email: "member@library.test",
          passwordHash: memberPasswordHash,
          role: "member",
        },
      },
      { upsert: true },
    ),
    ...books.map((book) =>
      BookModel.updateOne(
        { isbn: book.isbn },
        { $setOnInsert: book },
        { upsert: true },
      ),
    ),
  ]);

  const member = await UserModel.findOne({ email: "member@library.test" });
  const overdueBook = await BookModel.findOne({ isbn: "9780134685991" });

  if (!member || !overdueBook) {
    throw new Error("Unable to find seeded member or book for the overdue loan");
  }

  const existingDemoLoan = await LoanModel.exists({
    user: member._id,
    book: overdueBook._id,
  });

  if (!existingDemoLoan) {
    const dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const borrowedAt = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    const bookWithOneFewerCopy = await BookModel.findOneAndUpdate(
      { _id: overdueBook._id, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { returnDocument: "after" },
    );

    if (!bookWithOneFewerCopy) {
      throw new Error("Unable to reserve a copy for the overdue demo loan");
    }

    await LoanModel.create({
      user: member._id,
      book: overdueBook._id,
      borrowedAt,
      dueDate,
      returnedAt: null,
      status: "borrowed",
    });
  }

  console.log("Demo users, books, and overdue loan ensured without overwriting existing data.");
}

async function seed(): Promise<void> {
  await connectToDatabase();

  try {
    await ensureSeedData();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seed().catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  });
}
