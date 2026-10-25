import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { LEGAL_VERSION } from "@shared/legal";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storageGetSignedUrl, storagePut } from "./storage";
import { randomUUID } from "node:crypto";
import { decodeNotePdfUpload, MAX_NOTE_PDF_BYTES } from "./pdf-attachments";
import {
  assertLoginAllowed,
  assertEmailOtpSendAllowed,
  assertRegistrationAllowed,
  authenticatePasswordUser,
  clearLoginFailures,
  createEmailVerificationCode,
  EMAIL_OTP_SEND_WINDOW_MS,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  hashEmailVerificationCode,
  MAX_EMAIL_OTP_SENDS_PER_ACCOUNT,
  matchesEmailVerificationCode,
  MAX_EMAIL_OTP_ATTEMPTS,
  normalizeEmail,
  normalizeUsername,
  recordLoginFailure,
  recordEmailOtpSend,
  recordRegistrationAttempt,
  registerPasswordUser,
  hashPassword,
  verifyPassword,
} from "./account-security";
import * as db from "./db";
import {
  assertEmailDeliveryConfigured,
  sendVerificationEmail,
} from "./email";
import type { EmailVerificationPurpose, User } from "../drizzle/schema";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const noteCategory = z.enum(["study", "planning", "reflection"]);
const taskStatus = z.enum(["todo", "in_progress", "done"]);
const priority = z.enum(["low", "normal", "high"]);
const usernameInput = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters for your username.")
  .max(24, "Usernames can be up to 24 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores.");
const passwordInput = z
  .string()
  .min(10, "Use a password with at least 10 characters.")
  .max(128, "Passwords can be up to 128 characters.");
const emailInput = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320)
  .transform(normalizeEmail);
const verificationCodeInput = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");
const nullableShortText = (length: number) =>
  z.string().trim().max(length).nullable().optional();
const pdfUploadInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentBase64: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_NOTE_PDF_BYTES * 4) / 3) + 8),
});

async function storeStudyMaterialPdf(
  userId: number,
  input: z.infer<typeof pdfUploadInput>
) {
  const { data, fileName } = decodeNotePdfUpload(input);
  const stored = await storagePut(
    `studywithfun/users/${userId}/study-materials/${randomUUID()}.pdf`,
    data,
    "application/pdf"
  );
  return { fileName, fileSize: data.length, storageKey: stored.key };
}

const localUserProcedure = publicProcedure.use(({ ctx, next }) => {
  if (
    !ctx.user?.username ||
    !ctx.user.passwordHash ||
    ctx.user.loginMethod !== "password" ||
    !ctx.user.emailVerified ||
    !ctx.user.email ||
    !ctx.user.legalConsentAt ||
    ctx.user.legalConsentVersion !== LEGAL_VERSION
  ) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please sign in to your studywithfun account.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

async function startAccountSession(
  ctx: {
    req: Parameters<typeof getSessionCookieOptions>[0];
    res: { cookie: (name: string, value: string, options: object) => void };
  },
  user: { openId: string; name: string | null; username: string | null }
) {
  const token = await sdk.createSessionToken(user.openId, {
    name: user.username || user.name || "studywithfun user",
    expiresInMs: ONE_YEAR_MS,
  });
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: ONE_YEAR_MS,
  });
}

function publicAccount(ctx: { user: User | null }) {
  const user = ctx.user;
  if (
    !user?.username ||
    !user.passwordHash ||
    user.loginMethod !== "password" ||
    !user.emailVerified ||
    !user.email ||
    !user.legalConsentAt ||
    user.legalConsentVersion !== LEGAL_VERSION
  )
    return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    emailVerified: true,
    bio: user.bio,
    profileColor: user.profileColor,
  };
}

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;

function clientIp(ctx: { req: { ip?: string; socket: { remoteAddress?: string } } }) {
  return ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@", 2);
  const visible = local.slice(0, 1);
  return `${visible}${"•".repeat(Math.min(6, Math.max(2, local.length - 1)))}@${domain}`;
}

async function assertEmailAvailable(email: string, exceptUserId?: number) {
  const owner = await db.getUserByEmail(email);
  if (owner && owner.id !== exceptUserId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That email is already linked to another account.",
    });
  }
}

async function issueEmailChallenge(
  ip: string,
  user: User,
  email: string,
  purpose: EmailVerificationPurpose
) {
  assertEmailDeliveryConfigured();
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const currentTarget =
    user.verificationPurpose === "email_change"
      ? user.pendingEmail
      : user.email;
  const hasLiveSameCode =
    Boolean(user.verificationCode) &&
    Boolean(user.verificationExpiresAt) &&
    user.verificationExpiresAt!.getTime() > now &&
    normalizeEmail(currentTarget ?? "") === normalizedEmail;
  if (
    hasLiveSameCode &&
    user.verificationSentAt &&
    now - user.verificationSentAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS
  ) {
    if (user.verificationAttempts >= MAX_EMAIL_OTP_ATTEMPTS) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many incorrect codes. Wait before requesting a new one.",
      });
    }
    return maskEmail(normalizedEmail);
  }

  assertEmailOtpSendAllowed(ip, normalizedEmail);
  const maySend = await db.claimEmailVerificationSend(
    user.id,
    new Date(now),
    MAX_EMAIL_OTP_SENDS_PER_ACCOUNT,
    EMAIL_OTP_SEND_WINDOW_MS
  );
  if (!maySend) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many verification emails were requested for this account. Try again later.",
    });
  }
  const code = createEmailVerificationCode();
  const changes = {
    ...(purpose === "email_change"
      ? { pendingEmail: normalizedEmail }
      : { email: normalizedEmail, pendingEmail: null, emailVerified: false }),
    verificationCode: hashEmailVerificationCode(
      user.username ?? "",
      normalizedEmail,
      code
    ),
    verificationPurpose: purpose,
    verificationExpiresAt: new Date(now + EMAIL_OTP_TTL_MS),
    verificationSentAt: new Date(now),
    verificationAttempts: 0,
  };
  await db.updateUserEmailChallenge(user.id, changes);
  recordEmailOtpSend(ip, normalizedEmail);
  try {
    await sendVerificationEmail(normalizedEmail, code);
  } catch (error) {
    await db.clearUserEmailChallenge(user.id, changes.verificationCode);
    throw error;
  }
  return maskEmail(normalizedEmail);
}

async function verifyStoredEmailCode(
  user: User,
  email: string,
  code: string,
  purpose: EmailVerificationPurpose
) {
  if (
    user.emailVerified && purpose !== "email_change" ||
    user.verificationPurpose !== purpose ||
    !user.verificationCode ||
    !user.verificationExpiresAt
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That verification code is invalid or has expired.",
    });
  }
  if (user.verificationExpiresAt.getTime() <= Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That code has expired. Request a new verification email.",
    });
  }
  if (user.verificationAttempts >= MAX_EMAIL_OTP_ATTEMPTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many incorrect codes. Request a new verification email.",
    });
  }
  if (!user.verificationCode) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That verification code is invalid or has expired.",
    });
  }
  if (
    !matchesEmailVerificationCode(
      user.username ?? "",
      email,
      code,
      user.verificationCode
    )
  ) {
    const counted = await db.incrementEmailVerificationAttempts(
      user.id,
      purpose,
      user.verificationCode,
      MAX_EMAIL_OTP_ATTEMPTS
    );
    if (!counted) {
      const latest = await db.getUserByUsername(user.username ?? "");
      if (latest && latest.verificationAttempts >= MAX_EMAIL_OTP_ATTEMPTS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many incorrect codes. Request a new verification email.",
        });
      }
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That verification code is not correct.",
    });
  }
  const consumed = await db.completeUserEmailVerification(
    user.id,
    normalizeEmail(email),
    purpose,
    user.verificationCode,
    MAX_EMAIL_OTP_ATTEMPTS
  );
  if (!consumed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That verification code is invalid, expired, or already used.",
    });
  }
}

function clearAccountCookie(ctx: {
  req: Parameters<typeof getSessionCookieOptions>[0];
  res: { clearCookie: (name: string, options: object) => void };
}) {
  ctx.res.clearCookie(COOKIE_NAME, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: -1,
  });
  return { success: true } as const;
}

export const appRouter = router({
  system: systemRouter,
  account: router({
    register: publicProcedure
      .input(
        z.object({
          username: usernameInput,
          password: passwordInput,
          email: emailInput,
          legalConsent: z.literal(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ip = clientIp(ctx);
        assertRegistrationAllowed(ip);
        assertEmailDeliveryConfigured();
        recordRegistrationAttempt(ip);
        const user = await registerPasswordUser(
          input.username,
          input.password,
          input.email,
          LEGAL_VERSION
        );
        const email = await issueEmailChallenge(
          ip,
          user,
          input.email,
          "registration"
        );
        return { needsVerification: true as const, email };
      }),
    login: publicProcedure
      .input(
        z.object({
          username: usernameInput,
          password: passwordInput,
          email: emailInput.optional(),
          acceptLegalConsent: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ip = clientIp(ctx);
        assertLoginAllowed(ip, input.username);
        let user: User;
        try {
          user = await authenticatePasswordUser(input.username, input.password);
        } catch (error) {
          if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
            recordLoginFailure(ip, input.username);
          }
          throw error;
        }
        clearLoginFailures(ip, input.username);
        if (
          !user.legalConsentAt ||
          user.legalConsentVersion !== LEGAL_VERSION
        ) {
          if (!input.acceptLegalConsent) {
            return { needsConsent: true as const };
          }
          await db.updateUserLegalConsent(user.id, LEGAL_VERSION);
          const consentedUser = await db.getUserByUsername(user.username ?? "");
          if (!consentedUser) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "The accepted account could not be loaded.",
            });
          }
          user = consentedUser;
        }
        if (!user.emailVerified) {
          const email = normalizeEmail(
            input.email ?? user.pendingEmail ?? user.email ?? ""
          );
          if (!email) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Enter an email address to verify this account.",
            });
          }
          assertEmailDeliveryConfigured();
          await assertEmailAvailable(email, user.id);
          const maskedEmail = await issueEmailChallenge(
            ip,
            user,
            email,
            "existing_account"
          );
          return { needsVerification: true as const, email: maskedEmail };
        }
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        await startAccountSession(ctx, user);
        return { needsVerification: false as const };
      }),
    verifyEmail: publicProcedure
      .input(
        z.object({ username: usernameInput, code: verificationCodeInput })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByUsername(
          normalizeUsername(input.username)
        );
        if (
          !user?.username ||
          user.emailVerified ||
          !user.email ||
          !user.verificationPurpose ||
          user.verificationPurpose === "email_change" ||
          !user.legalConsentAt ||
          user.legalConsentVersion !== LEGAL_VERSION
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That verification code is invalid or has expired.",
          });
        }
        const email = normalizeEmail(user.email);
        await verifyStoredEmailCode(
          user,
          email,
          input.code,
          user.verificationPurpose
        );
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const verifiedUser = await db.getUserByUsername(user.username);
        if (!verifiedUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The verified account could not be loaded.",
          });
        }
        await startAccountSession(ctx, verifiedUser);
        return { success: true } as const;
      }),
    requestEmailChange: localUserProcedure
      .input(
        z.object({ currentPassword: passwordInput, email: emailInput })
      )
      .mutation(async ({ ctx, input }) => {
        const ip = clientIp(ctx);
        const username = ctx.user.username ?? "unknown";
        assertLoginAllowed(ip, username);
        if (!(await verifyPassword(input.currentPassword, ctx.user.passwordHash))) {
          recordLoginFailure(ip, username);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Your current password isn’t correct.",
          });
        }
        clearLoginFailures(ip, username);
        if (input.email === ctx.user.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That email is already verified on your account.",
          });
        }
        assertEmailDeliveryConfigured();
        await assertEmailAvailable(input.email, ctx.user.id);
        const email = await issueEmailChallenge(
          ip,
          ctx.user,
          input.email,
          "email_change"
        );
        return { success: true, email } as const;
      }),
    verifyEmailChange: localUserProcedure
      .input(z.object({ code: verificationCodeInput }))
      .mutation(async ({ ctx, input }) => {
        const email = ctx.user.pendingEmail;
        if (!email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "There is no pending email change to verify.",
          });
        }
        await verifyStoredEmailCode(
          ctx.user,
          email,
          input.code,
          "email_change"
        );
        return { success: true } as const;
      }),
    updateProfile: localUserProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(50),
          bio: z.string().trim().max(180).nullable(),
          profileColor: z.enum(["sage", "ocean", "violet", "amber"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true } as const;
      }),
    changePassword: localUserProcedure
      .input(
        z.object({
          currentPassword: passwordInput,
          newPassword: passwordInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        const username = ctx.user.username ?? "unknown";
        assertLoginAllowed(ip, username);
        if (
          !(await verifyPassword(input.currentPassword, ctx.user.passwordHash))
        ) {
          recordLoginFailure(ip, username);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Your current password isn’t correct.",
          });
        }
        clearLoginFailures(ip, username);
        if (input.currentPassword === input.newPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Choose a new password that differs from your current one.",
          });
        }
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateUserPassword(ctx.user.id, passwordHash);
        return { success: true } as const;
      }),
    me: publicProcedure.query(({ ctx }) => publicAccount(ctx)),
    logout: publicProcedure.mutation(({ ctx }) => clearAccountCookie(ctx)),
  }),
  // Keep the starter's auth endpoints available for compatibility; only studywithfun
  // username/password accounts are returned as authenticated app users.
  auth: router({
    me: publicProcedure.query(({ ctx }) => publicAccount(ctx)),
    logout: publicProcedure.mutation(({ ctx }) => clearAccountCookie(ctx)),
  }),
  notes: router({
    list: localUserProcedure
      .input(
        z.object({
          date: z.string().regex(dayPattern).optional(),
          search: z.string().trim().max(100).optional(),
        })
      )
      .query(({ ctx, input }) => db.listNotes(ctx.user.id, input)),
    create: localUserProcedure
      .input(
        z.object({
          date: z.string().regex(dayPattern),
          title: z.string().trim().min(1).max(240),
          body: z.string().max(12000).nullable().optional(),
          category: noteCategory,
        })
      )
      .mutation(({ ctx, input }) => db.createNote(ctx.user.id, input)),
    update: localUserProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          date: z.string().regex(dayPattern).optional(),
          title: z.string().trim().min(1).max(240).optional(),
          body: z.string().max(12000).nullable().optional(),
          category: noteCategory.optional(),
        })
      )
      .mutation(({ ctx, input: { id, ...values } }) =>
        db.updateNote(ctx.user.id, id, values)
      ),
    delete: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deleteNote(ctx.user.id, input.id)),
  }),
  studyMaterials: router({
    list: localUserProcedure.query(({ ctx }) =>
      db.listStudyMaterials(ctx.user.id)
    ),
    upload: localUserProcedure
      .input(
        z.object({
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().max(12000).nullable().optional(),
          fileName: pdfUploadInput.shape.fileName,
          contentBase64: pdfUploadInput.shape.contentBase64,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const uploaded = await storeStudyMaterialPdf(ctx.user.id, {
          fileName: input.fileName,
          contentBase64: input.contentBase64,
        });
        return db.createStudyMaterial(ctx.user.id, {
          title: input.title,
          description: input.description || null,
          ...uploaded,
        });
      }),
    downloadUrl: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const material = await db.getStudyMaterial(ctx.user.id, input.id);
        if (!material?.storageKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Study material not found.",
          });
        }
        return { url: await storageGetSignedUrl(material.storageKey) };
      }),
    remove: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        db.removeStudyMaterial(ctx.user.id, input.id)
      ),
  }),
  friends: router({
    search: localUserProcedure
      .input(
        z.object({
          query: z
            .string()
            .trim()
            .min(2)
            .max(24)
            .regex(/^[a-zA-Z0-9_]+$/),
        })
      )
      .query(({ ctx, input }) =>
        db.searchFriendAccounts(ctx.user.id, input.query)
      ),
    list: localUserProcedure.query(({ ctx }) =>
      db.listFriendships(ctx.user.id)
    ),
    requests: localUserProcedure.query(({ ctx }) =>
      db.listFriendRequests(ctx.user.id)
    ),
    sendRequest: localUserProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You can’t add yourself.",
          });
        }
        if (!(await db.getFriendAccountById(input.userId))) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That account is unavailable.",
          });
        }
        if (await db.areFriends(ctx.user.id, input.userId)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You’re already friends.",
          });
        }
        const requests = await db.listFriendRequests(ctx.user.id);
        if (requests.incoming.some(item => item.user.id === input.userId)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "They’ve already sent you a request. Accept it from your inbox.",
          });
        }
        return db.createOrRefreshFriendRequest(ctx.user.id, input.userId);
      }),
    respond: localUserProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          accept: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.respondToFriendRequest(
          ctx.user.id,
          input.requestId,
          input.accept
        );
        if (!result.success)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Friend request not found.",
          });
        return result;
      }),
    remove: localUserProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await db.areFriends(ctx.user.id, input.userId))) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Friend not found.",
          });
        }
        return db.removeFriendship(ctx.user.id, input.userId);
      }),
    messages: router({
      list: localUserProcedure
        .input(z.object({ friendId: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
          if (!(await db.areFriends(ctx.user.id, input.friendId))) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only friends can open this conversation.",
            });
          }
          return db.listDirectMessages(ctx.user.id, input.friendId);
        }),
      send: localUserProcedure
        .input(
          z.object({
            friendId: z.number().int().positive(),
            body: z.string().trim().min(1).max(3000),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!(await db.areFriends(ctx.user.id, input.friendId))) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only message an accepted friend.",
            });
          }
          return db.createDirectMessage(
            ctx.user.id,
            input.friendId,
            input.body
          );
        }),
    }),
  }),
  tasks: router({
    reminders: localUserProcedure.query(({ ctx }) =>
      db.listTaskReminders(ctx.user.id)
    ),
    list: localUserProcedure
      .input(
        z.object({
          date: z.string().regex(dayPattern).optional(),
          status: taskStatus.optional(),
          assignee: z.string().trim().max(160).optional(),
          search: z.string().trim().max(100).optional(),
        })
      )
      .query(({ ctx, input }) => db.listTasks(ctx.user.id, input)),
    create: localUserProcedure
      .input(
        z.object({
          title: z.string().trim().min(1).max(240),
          details: z.string().max(12000).nullable().optional(),
          dueDate: z.string().regex(dayPattern),
          dueTime: z.string().regex(timePattern).default("17:00"),
          assignee: nullableShortText(160),
          studyContext: nullableShortText(180),
          status: taskStatus.default("todo"),
          priority: priority.default("normal"),
        })
      )
      .mutation(({ ctx, input }) => db.createTask(ctx.user.id, input)),
    update: localUserProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(1).max(240).optional(),
          details: z.string().max(12000).nullable().optional(),
          dueDate: z.string().regex(dayPattern).optional(),
          dueTime: z.string().regex(timePattern).optional(),
          assignee: nullableShortText(160),
          studyContext: nullableShortText(180),
          status: taskStatus.optional(),
          priority: priority.optional(),
        })
      )
      .mutation(({ ctx, input: { id, ...values } }) =>
        db.updateTask(ctx.user.id, id, values)
      ),
    delete: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deleteTask(ctx.user.id, input.id)),
  }),
});

export type AppRouter = typeof appRouter;
