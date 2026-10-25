import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const MAX_LOGIN_FAILURES_PER_ACCOUNT_IP = 8;
const MAX_LOGIN_FAILURES_PER_IP = 40;
const MAX_REGISTRATIONS_PER_IP = 20;
const DUMMY_HASH = `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${"0".repeat(32)}:${"0".repeat(128)}`;

type RateBucket = { count: number; resetsAt: number };
const rateBuckets = new Map<string, RateBucket>();

function pruneRateBuckets(now: number) {
  if (rateBuckets.size < 10_000) return;
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetsAt <= now) rateBuckets.delete(key);
  }
}

function assertUnderLimit(
  key: string,
  limit: number,
  windowMs: number,
  message: string
) {
  const now = Date.now();
  pruneRateBuckets(now);
  const bucket = rateBuckets.get(key);
  if (bucket && bucket.resetsAt > now && bucket.count >= limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
  }
}

function incrementBucket(key: string, windowMs: number) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetsAt <= now) {
    rateBuckets.set(key, { count: 1, resetsAt: now + windowMs });
  } else {
    current.count += 1;
  }
}

function identityKey(ip: string, username: string) {
  return `login:${ip}:${normalizeUsername(username)}`;
}

export function assertLoginAllowed(ip: string, username: string) {
  assertUnderLimit(
    identityKey(ip, username),
    MAX_LOGIN_FAILURES_PER_ACCOUNT_IP,
    LOGIN_WINDOW_MS,
    "Too many failed attempts for this username. Please try again in 15 minutes."
  );
  assertUnderLimit(
    `login-ip:${ip}`,
    MAX_LOGIN_FAILURES_PER_IP,
    LOGIN_WINDOW_MS,
    "Too many failed sign-in attempts. Please try again in 15 minutes."
  );
}

export function recordLoginFailure(ip: string, username: string) {
  incrementBucket(identityKey(ip, username), LOGIN_WINDOW_MS);
  incrementBucket(`login-ip:${ip}`, LOGIN_WINDOW_MS);
}

export function clearLoginFailures(ip: string, username: string) {
  rateBuckets.delete(identityKey(ip, username));
}

export function assertRegistrationAllowed(ip: string) {
  assertUnderLimit(
    `register-ip:${ip}`,
    MAX_REGISTRATIONS_PER_IP,
    REGISTER_WINDOW_MS,
    "Too many account creation attempts. Please try again later."
  );
}

export function recordRegistrationAttempt(ip: string) {
  incrementBucket(`register-ip:${ip}`, REGISTER_WINDOW_MS);
}

function deriveKey(
  password: string,
  salt: string,
  N: number,
  r: number,
  p: number
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer))
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [algorithm, nText, rText, pText, salt, expectedHex] =
    encoded.split(":");
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !expectedHex ||
    !Number.isSafeInteger(N) ||
    N !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(expectedHex)
  ) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await deriveKey(password, salt, N, r, p);
  return timingSafeEqual(actual, expected);
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function registerPasswordUser(username: string, password: string) {
  const normalized = normalizeUsername(username);
  const existing = await db.getUserByUsername(normalized);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That username is already taken.",
    });
  }
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.createPasswordUser({
      openId: `local_${randomUUID()}`,
      username: normalized,
      passwordHash,
    });
    if (!user) throw new Error("New account could not be loaded");
    return user;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That username is already taken.",
      });
    }
    throw error;
  }
}

export async function authenticatePasswordUser(
  username: string,
  password: string
) {
  const normalized = normalizeUsername(username);
  const user = await db.getUserByUsername(normalized);
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH
  );
  if (!user || !valid || user.loginMethod !== "password") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid username or password.",
    });
  }
  return user;
}
