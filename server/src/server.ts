import "dotenv/config";
import app from "./app";
import { connectToDatabase } from "./config/db";
import { getJwtSecret } from "./config/jwt";

const port = Number.parseInt(process.env.PORT ?? "5000", 10);

async function startServer(): Promise<void> {
  getJwtSecret();
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});