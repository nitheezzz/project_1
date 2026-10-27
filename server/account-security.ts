import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
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
export const EMAIL_OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const MAX_EMAIL_OTP_SENDS_PER_ACCOUNT = 5;
const MAX_EMAIL_OTP_SENDS_PER_IP = 20;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_EMAIL_OTP_ATTEMPTS = 5;
export const MAX_ACCOUNT_COMPLETION_ATTEMPTS_PER_IP = 40;
export const ACCOUNT_COMPLETION_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
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

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createEmailVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashEmailVerificationCode(
  username: string,
  email: string,
  code: string,
  secret = ENV.cookieSecret
) {
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email verification is not available right now.",
    });
  }
  return createHmac("sha256", secret)
    .update(`${normalizeUsername(username)}\0${normalizeEmail(email)}\0${code}`)
    .digest("hex");
}

export function matchesEmailVerificationCode(
  username: string,
  email: string,
  code: string,
  storedHash: string | null,
  secret = ENV.cookieSecret
) {
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(
    hashEmailVerificationCode(username, email, code, secret),
    "hex"
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type AccountChallengePurpose = "signup" | "password_reset";

export function createAccountChallengeCodeHash(
  purpose: AccountChallengePurpose,
  challengeId: string,
  username: string,
  email: string,
  code: string,
  secret = ENV.cookieSecret
) {
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email verification is not available right now.",
    });
  }
  return createHmac("sha256", secret)
    .update(
      `account-challenge\0${purpose}\0${challengeId}\0${normalizeUsername(username)}\0${normalizeEmail(email)}\0${code}`
    )
    .digest("hex");
}

export function matchesAccountChallengeCode(
  purpose: AccountChallengePurpose,
  challengeId: string,
  username: string,
  email: string,
  code: string,
  storedHash: string | null,
  secret = ENV.cookieSecret
) {
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(
    createAccountChallengeCodeHash(
      purpose,
      challengeId,
      username,
      email,
      code,
      secret
    ),
    "hex"
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAccountContinuationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccountContinuationToken(
  purpose: AccountChallengePurpose,
  challengeId: string,
  token: string,
  secret = ENV.cookieSecret
) {
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Account security is not available right now.",
    });
  }
  return createHmac("sha256", secret)
    .update(`account-continuation\0${purpose}\0${challengeId}\0${token}`)
    .digest("hex");
}

export function hashAccountCompletionIp(ip: string, secret = ENV.cookieSecret) {
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Account security is not available right now.",
    });
  }
  return createHmac("sha256", secret)
    .update(`account-completion-ip\0${ip}`)
    .digest("hex");
}

export function assertEmailOtpSendAllowed(ip: string, email: string) {
  assertUnderLimit(
    `email-otp-address:${normalizeEmail(email)}`,
    MAX_EMAIL_OTP_SENDS_PER_ACCOUNT,
    EMAIL_OTP_SEND_WINDOW_MS,
    "Too many verification emails were requested. Try again later."
  );
  assertUnderLimit(
    `email-otp-ip:${ip}`,
    MAX_EMAIL_OTP_SENDS_PER_IP,
    EMAIL_OTP_SEND_WINDOW_MS,
    "Too many verification emails were requested from this connection. Try again later."
  );
}

export function recordEmailOtpSend(ip: string, email: string) {
  incrementBucket(
    `email-otp-address:${normalizeEmail(email)}`,
    EMAIL_OTP_SEND_WINDOW_MS
  );
  incrementBucket(`email-otp-ip:${ip}`, EMAIL_OTP_SEND_WINDOW_MS);
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
      message: "Invalid username, email, or password.",
    });
  }
  return user;
}
