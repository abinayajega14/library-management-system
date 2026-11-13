/// <reference path="../src/types/express.d.ts" />

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { getJwtSecret } from "../src/config/jwt";
import { authenticate, authorize } from "../src/middleware/auth.middleware";
import { UserModel } from "../src/models/user.model";

test("POST /api/auth/register validates and safely registers a member", async () => {
  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The test server did not start on a TCP port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const originalCreate = UserModel.create;
  const postRegistration = (body: unknown) =>
    fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const assertRegistrationValidationError = async (
    body: unknown,
    fields: string[],
  ): Promise<void> => {
    const response = await postRegistration(body);
    assert.equal(response.status, 400);
    const errorBody = await response.json();
    assert.equal(typeof errorBody.message, "string");
    assert.deepEqual(Object.keys(errorBody.errors).sort(), fields.sort());
    for (const field of fields) {
      assert.equal(typeof errorBody.errors[field], "string");
    }
  };

  try {
    await assertRegistrationValidationError({}, ["name", "email", "password"]);
    await assertRegistrationValidationError(
      { email: "ada@example.com", password: "long enough" },
      ["name"],
    );
    await assertRegistrationValidationError(
      { name: "Ada", password: "long enough" },
      ["email"],
    );
    await assertRegistrationValidationError(
      { name: "Ada", email: "ada@example.com" },
      ["password"],
    );
    await assertRegistrationValidationError(
      { name: "Ada", email: "not-an-email", password: "long enough" },
      ["email"],
    );
    await assertRegistrationValidationError(
      { name: "Ada", email: "ada@example.com", password: "short" },
      ["password"],
    );

    const malformedJson = await fetch(`${baseUrl}/api/auth/register`, {
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

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    Object.assign(UserModel, { create: originalCreate });
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("login, bearer authentication, authorization, and /api/auth/me", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindOne = UserModel.findOne;
  const originalFindById = UserModel.findById;
  const testSecret = "test-jwt-secret";
  process.env.JWT_SECRET = testSecret;

  const adminApp = express();
  adminApp.get("/api/admin", authenticate, authorize("admin"), (req, res) => {
    res.status(200).json({ auth: req.auth });
  });
  adminApp.get("/api/member", authenticate, authorize("member"), (req, res) => {
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
      fetch(`${authUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const invalidLogin = await postLogin({ email: "bad", password: "" });
    assert.equal(invalidLogin.status, 400);
    const invalidLoginBody = await invalidLogin.json();
    assert.deepEqual(Object.keys(invalidLoginBody.errors).sort(), ["email", "password"]);
    assert.equal(typeof invalidLoginBody.errors.email, "string");
    assert.equal(typeof invalidLoginBody.errors.password, "string");

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

    const currentUser = await fetch(`${authUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(currentUser.status, 200);
    const currentUserBody = await currentUser.json();
    assert.equal(currentUserBody.user.id, user.id);
    assert.equal("passwordHash" in currentUserBody.user, false);

    const noToken = await fetch(`${authUrl}/api/auth/me`);
    const invalidToken = await fetch(`${authUrl}/api/auth/me`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    const expiredToken = jwt.sign(
      { role: "member" },
      testSecret,
      { subject: user.id, expiresIn: "-1s" },
    );
    const expired = await fetch(`${authUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(noToken.status, 401);
    assert.equal(invalidToken.status, 401);
    assert.equal(expired.status, 401);

    const memberForbidden = await fetch(`${adminUrl}/api/admin`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    const memberAllowed = await fetch(`${adminUrl}/api/member`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    const adminToken = jwt.sign(
      { role: "admin" },
      testSecret,
      { subject: "admin-id", expiresIn: "7d" },
    );
    const adminAllowed = await fetch(`${adminUrl}/api/admin`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const adminForbidden = await fetch(`${adminUrl}/api/member`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(memberForbidden.status, 403);
    assert.equal(memberAllowed.status, 200);
    assert.equal(adminAllowed.status, 200);
    assert.equal(adminForbidden.status, 403);
    assert.deepEqual((await memberAllowed.json()).auth, {
      userId: user.id,
      role: "member",
    });
    assert.deepEqual((await adminAllowed.json()).auth, {
      userId: "admin-id",
      role: "admin",
    });

    const deletedUser = await fetch(`${authUrl}/api/auth/me`, {
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

test("PATCH /api/users/me updates allowed profile fields only", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindByIdAndUpdate = UserModel.findByIdAndUpdate;
  const testSecret = "test-jwt-secret";
  process.env.JWT_SECRET = testSecret;

  const user = {
    id: "member-id",
    name: "Ada",
    email: "ada@example.com",
    role: "member" as const,
    phone: "555-0100",
    address: "Old address",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  let updateId: unknown;
  let updateData: Record<string, unknown> | undefined;
  let updateOptions: Record<string, unknown> | undefined;
  Object.assign(UserModel, {
    findByIdAndUpdate: async (
      id: unknown,
      update: { $set: Record<string, unknown> },
      options: Record<string, unknown>,
    ) => {
      updateId = id;
      updateData = update.$set;
      updateOptions = options;
      return { ...user, ...update.$set };
    },
  });

  const server = app.listen(0);

  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("The test server did not start on a TCP port");
    }

    const token = jwt.sign({ role: "member" }, testSecret, {
      subject: user.id,
      expiresIn: "7d",
    });
    const patchProfile = (body: unknown) =>
      fetch(`http://127.0.0.1:${address.port}/api/users/me`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

    const invalidName = await patchProfile({ name: "   " });
    assert.equal(invalidName.status, 400);
    assert.equal(typeof (await invalidName.json()).errors.name, "string");

    const response = await patchProfile({
      name: "  Ada Lovelace  ",
      phone: " 555-0110 ",
      address: " New address ",
      email: "attacker@example.com",
      role: "admin",
      passwordHash: "exposed",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(updateData, {
      name: "Ada Lovelace",
      phone: "555-0110",
      address: "New address",
    });
    assert.equal(updateId, user.id);
    assert.deepEqual(updateOptions, { new: true, runValidators: true });
    assert.equal(body.user.name, "Ada Lovelace");
    assert.equal(body.user.email, user.email);
    assert.equal(body.user.role, "member");
    assert.equal(body.user.phone, "555-0110");
    assert.equal(body.user.address, "New address");
    assert.equal("passwordHash" in body.user, false);
  } finally {
    Object.assign(UserModel, { findByIdAndUpdate: originalFindByIdAndUpdate });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("forgot and reset password use a hashed, expiring, single-use token", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalClientUrl = process.env.CLIENT_URL;
  const originalFindOneAndUpdate = UserModel.findOneAndUpdate;
  const originalLog = console.log;
  process.env.NODE_ENV = "test";
  process.env.CLIENT_URL = "http://localhost:5173";

  let storedTokenHash: string | undefined;
  let storedTokenExpires: Date | undefined;
  let storedPasswordHash: string | undefined;
  const user = { id: "member-id" };
  const loggedMessages: string[] = [];
  let passwordUpdateCount = 0;
  Object.assign(console, {
    log: (message: string) => loggedMessages.push(message),
  });
  Object.assign(UserModel, {
    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      update: {
        $set?: Record<string, unknown>;
        $unset?: Record<string, unknown>;
      },
    ) => {
      if ("email" in filter) {
        if (filter.email !== "ada@example.com") {
          return null;
        }
        storedTokenHash = update.$set?.resetTokenHash as string;
        storedTokenExpires = update.$set?.resetTokenExpires as Date;
        return user;
      }

      const expirationFilter = filter.resetTokenExpires as { $gt: Date } | undefined;
      if (
        filter.resetTokenHash !== storedTokenHash ||
        !storedTokenExpires ||
        !expirationFilter ||
        storedTokenExpires <= expirationFilter.$gt
      ) {
        return null;
      }

      if (update.$set?.passwordHash) {
        storedPasswordHash = update.$set.passwordHash as string;
        passwordUpdateCount += 1;
        storedTokenHash = undefined;
        storedTokenExpires = undefined;
      }
      return user;
    },
  });

  const server = app.listen(0);

  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("The test server did not start on a TCP port");
    }

    const baseUrl = `http://127.0.0.1:${address.port}/api/auth`;
    const postJson = (path: string, body: unknown) =>
      fetch(`${baseUrl}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const forgot = await postJson("forgot-password", { email: " ADA@example.com " });
    assert.equal(forgot.status, 200);
    const forgotBody = await forgot.json();
    assert.equal(
      forgotBody.message,
      "If an account exists, a reset link has been generated.",
    );
    assert.equal(typeof forgotBody.resetToken, "string");
    const resetToken = forgotBody.resetToken as string;
    assert.notEqual(storedTokenHash, resetToken);
    assert.equal(
      storedTokenHash,
      createHash("sha256").update(resetToken).digest("hex"),
    );
    assert.ok(storedTokenExpires);
    assert.ok(storedTokenExpires.getTime() > Date.now() + 14 * 60 * 1000);
    assert.ok(storedTokenExpires.getTime() <= Date.now() + 15 * 60 * 1000);
    assert.ok(
      loggedMessages.some((message) =>
        message.includes(`http://localhost:5173/reset-password?token=${resetToken}`),
      ),
    );

    const unknownEmail = await postJson("forgot-password", {
      email: "unknown@example.com",
    });
    assert.equal(unknownEmail.status, 200);
    assert.deepEqual(await unknownEmail.json(), {
      message: forgotBody.message,
    });

    const shortPassword = await postJson("reset-password", {
      token: resetToken,
      password: "short",
    });
    assert.equal(shortPassword.status, 400);
    assert.equal(typeof (await shortPassword.json()).errors.password, "string");
    assert.equal(passwordUpdateCount, 0);

    const reset = await postJson("reset-password", {
      token: resetToken,
      password: "new secure password",
    });
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).message, "Password has been reset");
    assert.ok(storedPasswordHash);
    assert.equal(
      await bcrypt.compare("new secure password", storedPasswordHash),
      true,
    );
    assert.equal(storedTokenHash, undefined);
    assert.equal(storedTokenExpires, undefined);

    const reusedToken = await postJson("reset-password", {
      token: resetToken,
      password: "another secure password",
    });
    assert.equal(reusedToken.status, 400);

    const invalidToken = await postJson("reset-password", {
      token: "not-a-valid-token",
      password: "new secure password",
    });
    assert.equal(invalidToken.status, 400);

    const expiredToken = "expired-reset-token";
    storedTokenHash = createHash("sha256").update(expiredToken).digest("hex");
    storedTokenExpires = new Date(Date.now() - 1000);
    const expired = await postJson("reset-password", {
      token: expiredToken,
      password: "new secure password",
    });
    assert.equal(expired.status, 400);
    assert.equal(passwordUpdateCount, 1);
  } finally {
    Object.assign(UserModel, { findOneAndUpdate: originalFindOneAndUpdate });
    Object.assign(console, { log: originalLog });
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
