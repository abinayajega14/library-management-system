import mongoose from "mongoose";
import { UserModel } from "../models/user.model";

const membershipTermInMilliseconds = 365 * 24 * 60 * 60 * 1000;

export async function connectToDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(uri);
  await backfillMembershipExpiries();
}

export async function backfillMembershipExpiries(): Promise<void> {
  await UserModel.updateMany(
    { membershipExpiresAt: null },
    [
      {
        $set: {
          membershipExpiresAt: {
            $add: [
              { $ifNull: ["$createdAt", "$$NOW"] },
              membershipTermInMilliseconds,
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}
