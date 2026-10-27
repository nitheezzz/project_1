import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertEmailOtpSendAllowed,
  assertLoginAllowed,
  assertRegistrationAllowed,
  createEmailVerificationCode,
  createAccountChallengeCodeHash,
  createAccountContinuationToken,
  hashEmailVerificationCode,
  hashAccountContinuationToken,
  matchesAccountChallengeCode,
  matchesEmailVerificationCode,
  normalizeEmail,
  hashPassword,
  normalizeUsername,
  recordEmailOtpSend,
  recordLoginFailure,
  recordRegistrationAttempt,
  verifyPassword,
} from "./account-security";

describe("studywithfun account credentials", () => {
  it("creates six-digit verification codes and compares their keyed hashes", () => {
    const code = createEmailVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
    const email = normalizeEmail(" Student@Example.COM ");
    expect(email).toBe("student@example.com");
    const digest = hashEmailVerificationCode(
      "StudyWithNitheesh",
      email,
      code,
      "unit-test-secret"
    );
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(
      matchesEmailVerificationCode(
        "studywithnitheesh",
        email,
        code,
        digest,
        "unit-test-secret"
      )
    ).toBe(true);
    expect(
      matchesEmailVerificationCode(
        "studywithnitheesh",
        email,
        "000000",
        digest,
        "unit-test-secret"
      )
    ).toBe(false);
    expect(
      matchesEmailVerificationCode(
        "another-user",
        email,
        code,
        digest,
        "unit-test-secret"
      )
    ).toBe(false);
  });

  it("limits repeated OTP email sends per address", () => {
    const email = `student-${randomUUID()}@example.test`;
    const ip = `otp-${randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assertEmailOtpSendAllowed(ip, email);
      recordEmailOtpSend(ip, email);
    }
    expect(() => assertEmailOtpSendAllowed(ip, email)).toThrow(
      /Too many verification emails/
    );
  });

  it("binds staged signup and recovery codes to their purpose and challenge", () => {
    const code = createEmailVerificationCode();
    const challengeId = randomUUID();
    const email = "student@example.test";
    const username = "student_1";
    const hash = createAccountChallengeCodeHash(
      "signup",
      challengeId,
      username,
      email,
      code,
      "unit-test-secret"
    );
    expect(
      matchesAccountChallengeCode(
        "signup",
        challengeId,
        username,
        email,
        code,
        hash,
        "unit-test-secret"
      )
    ).toBe(true);
    expect(
      matchesAccountChallengeCode(
        "password_reset",
        challengeId,
        username,
        email,
        code,
        hash,
        "unit-test-secret"
      )
    ).toBe(false);
    expect(
      matchesAccountChallengeCode(
        "signup",
        randomUUID(),
        username,
        email,
        code,
        hash,
        "unit-test-secret"
      )
    ).toBe(false);
  });

  it("hashes one-use continuation tokens without persisting the token itself", () => {
    const token = createAccountContinuationToken();
    const challengeId = randomUUID();
    const digest = hashAccountContinuationToken(
      "password_reset",
      challengeId,
      token,
      "unit-test-secret"
    );
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(
      hashAccountContinuationToken(
        "password_reset",
        randomUUID(),
        token,
        "unit-test-secret"
      )
    ).not.toBe(digest);
  });

  it("stores a salted scrypt hash and verifies only the matching password", async () => {
    const password = "a-long-study-password-12";
    const encoded = await hashPassword(password);
    expect(encoded).not.toContain(password);
    expect(encoded).toMatch(/^scrypt:16384:8:1:[a-f0-9]{32}:[a-f0-9]{128}$/);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", encoded)).resolves.toBe(
      false
    );
    await expect(verifyPassword(password, null)).resolves.toBe(false);
  });

  it("normalizes usernames for case-insensitive uniqueness", () => {
    expect(normalizeUsername("  StudyWithNitheesh  ")).toBe(
      "studywithnitheesh"
    );
  });

  it("temporarily throttles repeated failed sign-in attempts", () => {
    const ip = `test-${randomUUID()}`;
    for (let attempt = 0; attempt < 8; attempt += 1)
      recordLoginFailure(ip, "student_1");
    expect(() => assertLoginAllowed(ip, "Student_1")).toThrow(
      /Too many failed attempts/
    );
  });

  it("limits account creation attempts without touching the database", () => {
    const ip = `test-${randomUUID()}`;
    for (let attempt = 0; attempt < 20; attempt += 1)
      recordRegistrationAttempt(ip);
    expect(() => assertRegistrationAllowed(ip)).toThrow(
      /Too many account creation attempts/
    );
  });
});
