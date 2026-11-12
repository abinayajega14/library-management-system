import express, { NextFunction, Request, Response } from "express";
import authRouter from "./routes/auth.routes";
import healthRouter from "./routes/health.routes";

const app = express();

app.use(express.json());
app.use("/health", healthRouter);
app.use("/auth", authRouter);

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