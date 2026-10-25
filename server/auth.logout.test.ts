import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { LEGAL_VERSION } from "@shared/legal";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(
  userOverrides: Partial<AuthenticatedUser> = {}
): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it.each([
    {
      emailVerified: false,
      legalConsentAt: new Date(),
      legalConsentVersion: LEGAL_VERSION,
    },
    {
      emailVerified: true,
      legalConsentAt: null,
      legalConsentVersion: null,
    },
  ])("denies private workspace access without verified email and current consent", async overrides => {
    const { ctx } = createAuthContext({
      username: "studywithnitheesh",
      passwordHash: "scrypt-hash",
      loginMethod: "password",
      email: "sample@example.com",
      ...overrides,
    });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.tasks.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.account.me()).resolves.toBeNull();
  });
});
