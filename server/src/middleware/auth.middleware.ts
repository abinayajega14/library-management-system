import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt";
import type { UserRole } from "../models/user.model";

function isUserRole(role: unknown): role is UserRole {
  return role === "member" || role === "admin";
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const secret = getJwtSecret();

  try {
  const decoded = jwt.verify(match[1], secret, { algorithms: ["HS256"] });
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !decoded.sub ||
      typeof decoded.exp !== "number" ||
      !isUserRole(decoded.role)
    ) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    req.auth = { userId: decoded.sub, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
