/// <reference path="../src/types/express.d.ts" />

import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { getJwtSecret } from "../src/config/jwt";
import { authenticate, authorize } from "../src/middleware/auth.middleware";
import { UserModel } from "../src/models/user.model";

test("POST /auth/register validates and safely registers a member", async () => {
  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The test server did not start on a TCP port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const originalCreate = UserModel.create;
  const postRegistration = (body: unknown) =>
    fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    const missingFields = await postRegistration({});
    assert.equal(missingFields.status, 400);
    assert.equal((await missingFields.json()).errors.length, 3);

    const invalidFields = await postRegistration({
      name: " ",
      email: "not-an-email",
      password: "short",
    });
    assert.equal(invalidFields.status, 400);
    assert.equal((await invalidFields.json()).errors.length, 3);

    const malformedJson = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformedJson.status, 400);

    let createdInput: Record<string, unknown> | undefined;
    Object.assign(UserModel, {
      create: async (input: Record<string, unknown>) => {
        createdInput = input;
        return {
          id: "user-id",
          ...input,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      },
    });

    const password = "correct horse battery";
    const successfulRegistration = await postRegistration({
      name: " Ada ",
      email: " ADA@example.com ",
      password,
      role: "admin",
    });
    assert.equal(successfulRegistration.status, 201);

    const responseUser = (await successfulRegistration.json()).user;
    assert.equal(responseUser.role, "member");
    assert.equal(responseUser.email, "ada@example.com");
    assert.equal("passwordHash" in responseUser, false);
    assert.equal(createdInput?.name, "Ada");
    assert.equal(createdInput?.role, "member");
    assert.notEqual(createdInput?.passwordHash, password);
    assert.equal(await bcrypt.compare(password, String(createdInput?.passwordHash)), true);

    Object.assign(UserModel, {
      create: async () => {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      },
    });
    const duplicateEmail = await postRegistration({
      name: "Ada",
      email: "ada@example.com",
      password,
    });
    assert.equal(duplicateEmail.status, 409);

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
  } finally {
    Object.assign(UserModel, { create: originalCreate });
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("login, bearer authentication, authorization, and /auth/me", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindOne = UserModel.findOne;
  const originalFindById = UserModel.findById;
  const testSecret = "test-jwt-secret";
  process.env.JWT_SECRET = testSecret;

  const adminApp = express();
  adminApp.get("/admin", authenticate, authorize("admin"), (req, res) => {
    res.status(200).json({ auth: req.auth });
  });

  const authServer = app.listen(0);
  const adminServer = adminApp.listen(0);

  try {
    await Promise.all([once(authServer, "listening"), once(adminServer, "listening")]);
    const authAddress = authServer.address();
    const adminAddress = adminServer.address();
    if (
      !authAddress ||
      typeof authAddress === "string" ||
      !adminAddress ||
      typeof adminAddress === "string"
    ) {
      throw new Error("The test servers did not start on TCP ports");
    }

    const authUrl = `http://127.0.0.1:${authAddress.port}`;
    const adminUrl = `http://127.0.0.1:${adminAddress.port}`;
    const user = {
      id: "member-id",
      name: "Ada",
      email: "ada@example.com",
      passwordHash: await bcrypt.hash("correct password", 4),
      role: "member" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    let selectedFields: string | undefined;
    let lookedUpEmail: unknown;
    let loginUser: typeof user | null = user;
    Object.assign(UserModel, {
      findOne: (filter: { email: string }) => {
        lookedUpEmail = filter.email;
        return {
          select: async (fields: string) => {
            selectedFields = fields;
            return loginUser;
          },
        };
      },
      findById: async (id: string) => (id === user.id ? user : null),
    });

    const postLogin = (body: unknown) =>
      fetch(`${authUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const invalidLogin = await postLogin({ email: "bad", password: "" });
    assert.equal(invalidLogin.status, 400);

    const login = await postLogin({
      email: " ADA@example.com ",
      password: "correct password",
    });
    assert.equal(login.status, 200);
    assert.equal(lookedUpEmail, "ada@example.com");
    assert.equal(selectedFields, "+passwordHash");
    const loginBody = await login.json();
    assert.equal(loginBody.user.id, user.id);
    assert.equal("passwordHash" in loginBody.user, false);

    const payload = jwt.verify(loginBody.token, testSecret) as jwt.JwtPayload;
    assert.equal(payload.sub, user.id);
    assert.equal(payload.role, "member");
    assert.ok(payload.exp !== undefined && payload.iat !== undefined);
    assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);

    const failedPassword = await postLogin({
      email: "ada@example.com",
      password: "incorrect password",
    });
    loginUser = null;
    const unknownEmail = await postLogin({
      email: "unknown@example.com",
      password: "correct password",
    });
    assert.equal(failedPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal((await failedPassword.json()).message, "Invalid email or password");
    assert.equal((await unknownEmail.json()).message, "Invalid email or password");
    loginUser = user;

    const currentUser = await fetch(`${authUrl}/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(currentUser.status, 200);
    const currentUserBody = await currentUser.json();
    assert.equal(currentUserBody.user.id, user.id);
    assert.equal("passwordHash" in currentUserBody.user, false);

    const noToken = await fetch(`${authUrl}/auth/me`);
    const invalidToken = await fetch(`${authUrl}/auth/me`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    const expiredToken = jwt.sign(
      { role: "member" },
      testSecret,
      { subject: user.id, expiresIn: "-1s" },
    );
    const expired = await fetch(`${authUrl}/auth/me`, {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(noToken.status, 401);
    assert.equal(invalidToken.status, 401);
    assert.equal(expired.status, 401);

    const memberForbidden = await fetch(`${adminUrl}/admin`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    const adminToken = jwt.sign(
      { role: "admin" },
      testSecret,
      { subject: "admin-id", expiresIn: "7d" },
    );
    const adminAllowed = await fetch(`${adminUrl}/admin`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(memberForbidden.status, 403);
    assert.equal(adminAllowed.status, 200);
    assert.deepEqual((await adminAllowed.json()).auth, {
      userId: "admin-id",
      role: "admin",
    });

    const deletedUser = await fetch(`${authUrl}/auth/me`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deletedUser.status, 401);

    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET is not configured/);
  } finally {
    Object.assign(UserModel, {
      findOne: originalFindOne,
      findById: originalFindById,
    });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    await Promise.all(
      [authServer, adminServer].map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  }
});
