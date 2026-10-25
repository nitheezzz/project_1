import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertLoginAllowed,
  assertRegistrationAllowed,
  hashPassword,
  normalizeUsername,
  recordLoginFailure,
  recordRegistrationAttempt,
  verifyPassword,
} from "./account-security";

describe("Daynote account credentials", () => {
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
    expect(normalizeUsername("  StudyWithSam  ")).toBe("studywithsam");
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
