import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storageGetSignedUrl, storagePut } from "./storage";
import { randomUUID } from "node:crypto";
import { decodeNotePdfUpload, MAX_NOTE_PDF_BYTES } from "./pdf-attachments";
import {
  assertLoginAllowed,
  assertRegistrationAllowed,
  authenticatePasswordUser,
  clearLoginFailures,
  recordLoginFailure,
  recordRegistrationAttempt,
  registerPasswordUser,
} from "./account-security";
import * as db from "./db";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
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
const nullableShortText = (length: number) =>
  z.string().trim().max(length).nullable().optional();
const pdfUploadInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentBase64: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_NOTE_PDF_BYTES * 4) / 3) + 8),
});

async function storeNotePdf(
  userId: number,
  input: z.infer<typeof pdfUploadInput>
) {
  const { data, fileName } = decodeNotePdfUpload(input);
  const stored = await storagePut(
    `studywithfun/users/${userId}/notes/${randomUUID()}.pdf`,
    data,
    "application/pdf"
  );
  return {
    pdfStorageKey: stored.key,
    pdfFileName: fileName,
    pdfFileSize: data.length,
  };
}

const localUserProcedure = publicProcedure.use(({ ctx, next }) => {
  if (
    !ctx.user?.username ||
    !ctx.user.passwordHash ||
    ctx.user.loginMethod !== "password"
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

function publicAccount(ctx: { user: import("../drizzle/schema").User | null }) {
  const user = ctx.user;
  if (!user?.username || !user.passwordHash || user.loginMethod !== "password")
    return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
  };
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
      .input(z.object({ username: usernameInput, password: passwordInput }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        assertRegistrationAllowed(ip);
        recordRegistrationAttempt(ip);
        const user = await registerPasswordUser(input.username, input.password);
        await startAccountSession(ctx, user);
        return { success: true } as const;
      }),
    login: publicProcedure
      .input(z.object({ username: usernameInput, password: passwordInput }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        assertLoginAllowed(ip, input.username);
        let user;
        try {
          user = await authenticatePasswordUser(input.username, input.password);
        } catch (error) {
          if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
            recordLoginFailure(ip, input.username);
          }
          throw error;
        }
        clearLoginFailures(ip, input.username);
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        await startAccountSession(ctx, user);
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
          pdf: pdfUploadInput.optional(),
        })
      )
      .mutation(async ({ ctx, input: { pdf, ...values } }) => {
        const attachment = pdf ? await storeNotePdf(ctx.user.id, pdf) : {};
        return db.createNote(ctx.user.id, { ...values, ...attachment });
      }),
    update: localUserProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          date: z.string().regex(dayPattern).optional(),
          title: z.string().trim().min(1).max(240).optional(),
          body: z.string().max(12000).nullable().optional(),
          category: noteCategory.optional(),
          pdf: pdfUploadInput.optional(),
        })
      )
      .mutation(async ({ ctx, input: { id, pdf, ...values } }) => {
        const attachment = pdf ? await storeNotePdf(ctx.user.id, pdf) : {};
        return db.updateNote(ctx.user.id, id, { ...values, ...attachment });
      }),
    delete: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deleteNote(ctx.user.id, input.id)),
    pdfDownloadUrl: localUserProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await db.getNoteAttachment(ctx.user.id, input.id);
        if (!attachment?.pdfStorageKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "PDF attachment not found.",
          });
        }
        return { url: await storageGetSignedUrl(attachment.pdfStorageKey) };
      }),
  }),
  tasks: router({
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
  preferences: router({
    spotifyLink: localUserProcedure.query(({ ctx }) =>
      db.getSpotifyLink(ctx.user.id)
    ),
    saveSpotifyLink: localUserProcedure
      .input(z.object({ spotifyLink: z.string().trim().max(2048).nullable() }))
      .mutation(({ ctx, input }) =>
        db.saveSpotifyLink(ctx.user.id, input.spotifyLink)
      ),
  }),
});

export type AppRouter = typeof appRouter;
