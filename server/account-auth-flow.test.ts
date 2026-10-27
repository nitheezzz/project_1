import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as accountSecurity from "./account-security";
import { LEGAL_VERSION } from "../shared/legal";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  db: {
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    getAccountChallengeByUsername: vi.fn(),
    getAccountChallengeById: vi.fn(),
    saveAccountChallenge: vi.fn(),
    isAccountChallengeContinuationValid: vi.fn(),
    claimAccountCompletionAttempt: vi.fn(),
    completeAccountChallengeVerification: vi.fn(),
    completeAccountChallengeSignup: vi.fn(),
    completeAccountChallengePasswordReset: vi.fn(),
  },
  email: {
    assertEmailDeliveryConfigured: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
}));

vi.mock("./db", () => mocks.db);
vi.mock("./email", () => mocks.email);

import { appRouter } from "./routers";

describe("email-first account flows", () => {
  let storedChallenge: Record<string, any>;
  let deliveredCode = "";

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "unit-test-resend-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "verified@example.test");
    vi.stubEnv("MANUS_JWT_SECRET", "unit-test-signing-key-never-deployed");
    vi.stubEnv("MANUS_PROJECT_ID", "project-test");
    deliveredCode = "";
    storedChallenge = {};
    mocks.db.getUserByUsername.mockResolvedValue(undefined);
    mocks.db.getUserByEmail.mockResolvedValue(undefined);
    mocks.db.getAccountChallengeByUsername.mockResolvedValue(undefined);
    mocks.db.getAccountChallengeById.mockImplementation(async () => storedChallenge);
    mocks.db.isAccountChallengeContinuationValid.mockResolvedValue(true);
    mocks.db.claimAccountCompletionAttempt.mockResolvedValue(true);
    mocks.db.saveAccountChallenge.mockImplementation(async (values: Record<string, any>) => {
      storedChallenge = { ...values, createdAt: new Date() };
      return storedChallenge;
    });
    mocks.db.completeAccountChallengeVerification.mockResolvedValue(true);
    mocks.db.completeAccountChallengeSignup.mockResolvedValue({
      id: 1,
      openId: "local_test-user",
      username: "student_1",
      name: "student_1",
      email: "student@example.test",
      emailVerified: true,
      passwordHash: "scrypt-test-hash",
      loginMethod: "password",
      legalConsentAt: new Date(),
      legalConsentVersion: "2026-01",
      authVersion: 0,
    });
    mocks.db.completeAccountChallengePasswordReset.mockResolvedValue(true);
    mocks.email.assertEmailDeliveryConfigured.mockImplementation(() => undefined);
    mocks.email.sendVerificationEmail.mockImplementation(
      async (_to: string, code: string) => {
        deliveredCode = code;
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function createContext() {
    const cookies: unknown[][] = [];
    const ctx: TrpcContext = {
      user: null,
      req: {
        ip: `signup-test-${randomUUID()}`,
        socket: { remoteAddress: "127.0.0.1" },
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        cookie: (...args: unknown[]) => cookies.push(args),
      } as unknown as TrpcContext["res"],
    };
    return { ctx, cookies };
  }

  it("does not create an account or accept a password until email OTP verification", async () => {
    const { ctx, cookies } = createContext();
    const caller = appRouter.createCaller(ctx);
    const request = await caller.account.requestSignupCode({
      username: "Student_1",
      email: "Student@Example.test",
      legalConsent: true,
    });

    expect(mocks.db.saveAccountChallenge).toHaveBeenCalledOnce();
    expect(mocks.db.saveAccountChallenge.mock.calls[0]?.[0]).not.toHaveProperty(
      "password"
    );
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledWith(
      "student@example.test",
      expect.stringMatching(/^\d{6}$/),
      "verification"
    );
    expect(mocks.db.completeAccountChallengeSignup).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);

    const verification = await caller.account.verifySignupCode({
      challengeId: request.challengeId,
      code: deliveredCode,
    });
    expect(verification.registrationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(mocks.db.completeAccountChallengeSignup).not.toHaveBeenCalled();
    expect(cookies).toHaveLength(0);

    await caller.account.completeSignup({
      challengeId: request.challengeId,
      registrationToken: verification.registrationToken,
      password: "a-long-study-password-12",
      confirmPassword: "a-long-study-password-12",
    });
    expect(mocks.db.completeAccountChallengeSignup).toHaveBeenCalledOnce();
    expect(cookies).toHaveLength(1);
  });

  it("requires an email address in the username/password sign-in request", async () => {
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.account.login({
        username: "student_1",
        password: "a-long-study-password-12",
      } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.db.getUserByUsername).not.toHaveBeenCalled();
  });

  it("rejects an invalid signup continuation before running password hashing", async () => {
    storedChallenge = {
      id: randomUUID(),
      purpose: "signup",
      legalConsentVersion: LEGAL_VERSION,
    };
    mocks.db.isAccountChallengeContinuationValid.mockResolvedValue(false);
    const hashPassword = vi.spyOn(accountSecurity, "hashPassword");
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.account.completeSignup({
        challengeId: storedChallenge.id,
        registrationToken: "x".repeat(43),
        password: "a-long-study-password-12",
        confirmPassword: "a-long-study-password-12",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(mocks.db.completeAccountChallengeSignup).not.toHaveBeenCalled();
    hashPassword.mockRestore();
  });

  it("rejects an invalid reset continuation before running password hashing", async () => {
    mocks.db.isAccountChallengeContinuationValid.mockResolvedValue(false);
    const hashPassword = vi.spyOn(accountSecurity, "hashPassword");
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.account.completePasswordReset({
        challengeId: randomUUID(),
        resetToken: "x".repeat(43),
        newPassword: "a-new-study-password-15",
        confirmPassword: "a-new-study-password-15",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(mocks.db.completeAccountChallengePasswordReset).not.toHaveBeenCalled();
    hashPassword.mockRestore();
  });

  it("blocks completion attempts over the shared IP limit before password hashing", async () => {
    mocks.db.claimAccountCompletionAttempt.mockResolvedValue(false);
    const hashPassword = vi.spyOn(accountSecurity, "hashPassword");
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.account.completePasswordReset({
        challengeId: randomUUID(),
        resetToken: "x".repeat(43),
        newPassword: "a-new-study-password-15",
        confirmPassword: "a-new-study-password-15",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.db.isAccountChallengeContinuationValid).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    hashPassword.mockRestore();
  });

  it("sends recovery only to the verified email and does not sign in after reset", async () => {
    const account = {
      id: 7,
      username: "student_1",
      email: "student@example.test",
      emailVerified: true,
      passwordHash: "scrypt-test-hash",
      loginMethod: "password",
    };
    mocks.db.getUserByUsername.mockResolvedValue(account);
    const { ctx, cookies } = createContext();
    const caller = appRouter.createCaller(ctx);

    const requested = await caller.account.requestPasswordReset({
      username: "student_1",
      email: "student@example.test",
    });
    expect(requested.message).toContain("If those details match an account");
    expect(mocks.email.sendVerificationEmail).toHaveBeenCalledWith(
      "student@example.test",
      expect.stringMatching(/^\d{6}$/),
      "password_reset"
    );

    const verified = await caller.account.verifyPasswordResetCode({
      challengeId: requested.challengeId,
      code: deliveredCode,
    });
    await caller.account.completePasswordReset({
      challengeId: requested.challengeId,
      resetToken: verified.resetToken,
      newPassword: "a-new-study-password-15",
      confirmPassword: "a-new-study-password-15",
    });
    expect(mocks.db.completeAccountChallengePasswordReset).toHaveBeenCalledOnce();
    expect(cookies).toHaveLength(0);
  });

  it("returns the same recovery message and sends no code for mismatched account details", async () => {
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.account.requestPasswordReset({
      username: "not_a_user",
      email: "unknown@example.test",
    });
    expect(result.message).toBe(
      "If those details match an account, a recovery code will be sent to its verified email."
    );
    expect(mocks.email.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
