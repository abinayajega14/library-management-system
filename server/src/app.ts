import express, { NextFunction, Request, Response } from "express";
import bookEngagementRouter from "./routes/book-engagement.routes";
import authRouter from "./routes/auth.routes";
import booksRouter from "./routes/books.routes";
import dashboardRouter from "./routes/dashboard.routes";
import healthRouter from "./routes/health.routes";
import loansRouter from "./routes/loans.routes";
import recommendationsRouter from "./routes/recommendations.routes";
import usersRouter from "./routes/users.routes";

const app = express();

app.use(express.json());
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/books", bookEngagementRouter);
app.use("/api/books", booksRouter);
app.use("/api/loans", loansRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/recommendations", recommendationsRouter);

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }

  console.error("Unhandled request error:", error);
  res.status(500).json({ message: "Internal server error" });
});

export default app;