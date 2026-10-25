import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertNote,
  InsertStudyMaterial,
  InsertTask,
  InsertUser,
  EmailVerificationPurpose,
  directMessages,
  friendRequests,
  friendships,
  notes,
  studyMaterials,
  tasks,
  User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily create the managed Drizzle connection so local tools can run without a DB. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = requireDb(await getDb());
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  for (const field of textFields) {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
  const db = requireDb(await getDb());
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserByUsername(
  username: string
): Promise<User | undefined> {
  const db = requireDb(await getDb());
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = requireDb(await getDb());
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.pendingEmail, email)))
    .limit(1);
  return result[0];
}

export async function updateUserEmailChallenge(
  userId: number,
  values: {
    email?: string | null;
    pendingEmail?: string | null;
    emailVerified?: boolean;
    verificationCode?: string | null;
    verificationPurpose?: EmailVerificationPurpose | null;
    verificationExpiresAt?: Date | null;
    verificationSentAt?: Date | null;
    verificationAttempts?: number;
    verificationSendWindowAt?: Date | null;
    verificationSendCount?: number;
  }
) {
  const db = requireDb(await getDb());
  await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function incrementEmailVerificationAttempts(
  userId: number,
  purpose: EmailVerificationPurpose,
  challengeHash: string,
  maxAttempts: number
) {
  const db = requireDb(await getDb());
  const result = await db
    .update(users)
    .set({
      verificationAttempts: sql`${users.verificationAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.verificationPurpose, purpose),
        eq(users.verificationCode, challengeHash),
        gt(users.verificationExpiresAt, new Date()),
        lt(users.verificationAttempts, maxAttempts)
      )
    );
  return Number(result[0].affectedRows) === 1;
}

export async function clearUserEmailChallenge(
  userId: number,
  challengeHash?: string
) {
  const db = requireDb(await getDb());
  await db
    .update(users)
    .set({
      pendingEmail: null,
      verificationCode: null,
      verificationPurpose: null,
      verificationExpiresAt: null,
      verificationSentAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(
      challengeHash
        ? and(eq(users.id, userId), eq(users.verificationCode, challengeHash))
        : eq(users.id, userId)
    );
}

export async function completeUserEmailVerification(
  userId: number,
  email: string,
  purpose: EmailVerificationPurpose,
  challengeHash: string,
  maxAttempts: number
) {
  const db = requireDb(await getDb());
  const targetMatches =
    purpose === "email_change"
      ? eq(users.pendingEmail, email)
      : and(eq(users.email, email), eq(users.emailVerified, false));
  const result = await db
    .update(users)
    .set({
      email,
      emailVerified: true,
      pendingEmail: null,
      verificationCode: null,
      verificationPurpose: null,
      verificationExpiresAt: null,
      verificationSentAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.verificationPurpose, purpose),
        eq(users.verificationCode, challengeHash),
        gt(users.verificationExpiresAt, new Date()),
        lt(users.verificationAttempts, maxAttempts),
        targetMatches
      )
    );
  return Number(result[0].affectedRows) === 1;
}

export async function claimEmailVerificationSend(
  userId: number,
  now: Date,
  maxSends: number,
  windowMs: number
) {
  const db = requireDb(await getDb());
  const windowStart = new Date(now.getTime() - windowMs);
  const resetWindow =
    isNull(users.verificationSendWindowAt) ||
    lte(users.verificationSendWindowAt, windowStart);
  const result = await db
    .update(users)
    .set({
      verificationSendCount: sql`CASE WHEN ${users.verificationSendWindowAt} IS NULL OR ${users.verificationSendWindowAt} <= ${windowStart} THEN 1 ELSE ${users.verificationSendCount} + 1 END`,
      verificationSendWindowAt: sql`CASE WHEN ${users.verificationSendWindowAt} IS NULL OR ${users.verificationSendWindowAt} <= ${windowStart} THEN ${now} ELSE ${users.verificationSendWindowAt} END`,
      updatedAt: now,
    })
    .where(
      and(
        eq(users.id, userId),
        or(resetWindow, lt(users.verificationSendCount, maxSends))
      )
    );
  return Number(result[0].affectedRows) === 1;
}

export async function updateUserLegalConsent(
  userId: number,
  legalConsentVersion: string
) {
  const db = requireDb(await getDb());
  await db
    .update(users)
    .set({
      legalConsentAt: new Date(),
      legalConsentVersion,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: number,
  values: { name: string; bio: string | null; profileColor: string }
) {
  const db = requireDb(await getDb());
  await db.update(users).set(values).where(eq(users.id, userId));
  return { success: true } as const;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = requireDb(await getDb());
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return { success: true } as const;
}

export async function createPasswordUser(values: {
  openId: string;
  username: string;
  passwordHash: string;
  email: string;
  legalConsentVersion: string;
}) {
  const db = requireDb(await getDb());
  await db.insert(users).values({
    openId: values.openId,
    username: values.username,
    passwordHash: values.passwordHash,
    email: values.email,
    emailVerified: false,
    legalConsentAt: new Date(),
    legalConsentVersion: values.legalConsentVersion,
    name: values.username,
    loginMethod: "password",
    role: "user",
    lastSignedIn: new Date(),
  });
  return getUserByOpenId(values.openId);
}

export async function listNotes(
  userId: number,
  input: { date?: string; search?: string }
) {
  const db = requireDb(await getDb());
  const filters = [eq(notes.userId, userId)];
  if (input.date) filters.push(eq(notes.date, input.date));
  if (input.search?.trim()) {
    const query = `%${input.search.trim()}%`;
    filters.push(or(like(notes.title, query), like(notes.body, query))!);
  }
  return db
    .select()
    .from(notes)
    .where(and(...filters))
    .orderBy(desc(notes.updatedAt))
    .limit(100);
}

export async function createNote(
  userId: number,
  values: Omit<InsertNote, "id" | "userId" | "createdAt" | "updatedAt">
) {
  const db = requireDb(await getDb());
  await db.insert(notes).values({ ...values, userId });
  return { success: true } as const;
}

export async function listStudyMaterials(userId: number) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(studyMaterials)
    .where(
      and(eq(studyMaterials.userId, userId), isNull(studyMaterials.deletedAt))
    )
    .orderBy(desc(studyMaterials.createdAt))
    .limit(200);
}

export async function createStudyMaterial(
  userId: number,
  values: Pick<
    InsertStudyMaterial,
    "title" | "description" | "fileName" | "storageKey" | "fileSize"
  >
) {
  const db = requireDb(await getDb());
  await db.insert(studyMaterials).values({ ...values, userId });
  return { success: true } as const;
}

export async function getStudyMaterial(userId: number, id: number) {
  const db = requireDb(await getDb());
  const [material] = await db
    .select({
      storageKey: studyMaterials.storageKey,
      fileName: studyMaterials.fileName,
    })
    .from(studyMaterials)
    .where(
      and(
        eq(studyMaterials.id, id),
        eq(studyMaterials.userId, userId),
        isNull(studyMaterials.deletedAt)
      )
    )
    .limit(1);
  return material ?? null;
}

export async function removeStudyMaterial(userId: number, id: number) {
  const db = requireDb(await getDb());
  await db
    .update(studyMaterials)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(studyMaterials.id, id),
        eq(studyMaterials.userId, userId),
        isNull(studyMaterials.deletedAt)
      )
    );
  return { success: true } as const;
}

export async function updateNote(
  userId: number,
  id: number,
  values: Partial<Omit<InsertNote, "id" | "userId" | "createdAt" | "updatedAt">>
) {
  const db = requireDb(await getDb());
  await db
    .update(notes)
    .set(values)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return { success: true } as const;
}

export async function deleteNote(userId: number, id: number) {
  const db = requireDb(await getDb());
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return { success: true } as const;
}

export async function listTasks(
  userId: number,
  input: {
    date?: string;
    status?: "todo" | "in_progress" | "done";
    assignee?: string;
    search?: string;
  }
) {
  const db = requireDb(await getDb());
  const filters = [eq(tasks.userId, userId)];
  if (input.date) filters.push(eq(tasks.dueDate, input.date));
  if (input.status) filters.push(eq(tasks.status, input.status));
  if (input.assignee) filters.push(eq(tasks.assignee, input.assignee));
  if (input.search?.trim()) {
    const query = `%${input.search.trim()}%`;
    filters.push(
      or(
        like(tasks.title, query),
        like(tasks.details, query),
        like(tasks.assignee, query),
        like(tasks.studyContext, query)
      )!
    );
  }
  return db
    .select()
    .from(tasks)
    .where(and(...filters))
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt))
    .limit(100);
}

export async function listTaskReminders(userId: number) {
  const db = requireDb(await getDb());
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      dueTime: tasks.dueTime,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), ne(tasks.status, "done")))
    .orderBy(asc(tasks.dueDate), asc(tasks.dueTime), asc(tasks.id))
    .limit(5000);
}

export async function createTask(
  userId: number,
  values: Omit<InsertTask, "id" | "userId" | "createdAt" | "updatedAt">
) {
  const db = requireDb(await getDb());
  await db.insert(tasks).values({ ...values, userId });
  return { success: true } as const;
}

export async function updateTask(
  userId: number,
  id: number,
  values: Partial<Omit<InsertTask, "id" | "userId" | "createdAt" | "updatedAt">>
) {
  const db = requireDb(await getDb());
  await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return { success: true } as const;
}

export async function deleteTask(userId: number, id: number) {
  const db = requireDb(await getDb());
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return { success: true } as const;
}

export async function searchFriendAccounts(userId: number, query: string) {
  const db = requireDb(await getDb());
  const escaped = query
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, "\\$&");
  const term = `%${escaped}%`;
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      profileColor: users.profileColor,
    })
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        eq(users.loginMethod, "password"),
        like(users.username, term)
      )
    )
    .orderBy(asc(users.username))
    .limit(20);
}

export async function getFriendAccountById(userId: number) {
  const db = requireDb(await getDb());
  const [account] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      profileColor: users.profileColor,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.loginMethod, "password")))
    .limit(1);
  return account ?? null;
}

export async function listFriendships(userId: number) {
  const db = requireDb(await getDb());
  const pairs = await db
    .select({ low: friendships.userLowId, high: friendships.userHighId })
    .from(friendships)
    .where(
      or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId))
    )
    .orderBy(desc(friendships.createdAt))
    .limit(200);
  const friendIds = pairs.map(pair =>
    pair.low === userId ? pair.high : pair.low
  );
  if (!friendIds.length) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      profileColor: users.profileColor,
    })
    .from(users)
    .where(inArray(users.id, friendIds))
    .orderBy(asc(users.username))
    .limit(200);
}

export async function listFriendRequests(userId: number) {
  const db = requireDb(await getDb());
  const incoming = await db
    .select({
      id: friendRequests.id,
      createdAt: friendRequests.createdAt,
      user: {
        id: users.id,
        username: users.username,
        name: users.name,
        profileColor: users.profileColor,
      },
    })
    .from(friendRequests)
    .innerJoin(users, eq(friendRequests.fromUserId, users.id))
    .where(
      and(
        eq(friendRequests.toUserId, userId),
        eq(friendRequests.status, "pending")
      )
    )
    .orderBy(desc(friendRequests.createdAt))
    .limit(50);
  const outgoing = await db
    .select({
      id: friendRequests.id,
      createdAt: friendRequests.createdAt,
      user: {
        id: users.id,
        username: users.username,
        name: users.name,
        profileColor: users.profileColor,
      },
    })
    .from(friendRequests)
    .innerJoin(users, eq(friendRequests.toUserId, users.id))
    .where(
      and(
        eq(friendRequests.fromUserId, userId),
        eq(friendRequests.status, "pending")
      )
    )
    .orderBy(desc(friendRequests.createdAt))
    .limit(50);
  return { incoming, outgoing };
}

export async function areFriends(userId: number, friendId: number) {
  const db = requireDb(await getDb());
  const low = Math.min(userId, friendId);
  const high = Math.max(userId, friendId);
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(eq(friendships.userLowId, low), eq(friendships.userHighId, high))
    )
    .limit(1);
  return Boolean(friendship);
}

export async function createOrRefreshFriendRequest(
  fromUserId: number,
  toUserId: number
) {
  const db = requireDb(await getDb());
  const [existing] = await db
    .select({ id: friendRequests.id, status: friendRequests.status })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, fromUserId),
        eq(friendRequests.toUserId, toUserId)
      )
    )
    .limit(1);
  if (existing?.status === "pending") return { success: true, pending: true };
  if (existing) {
    await db
      .update(friendRequests)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(friendRequests.id, existing.id));
  } else {
    await db
      .insert(friendRequests)
      .values({ fromUserId, toUserId })
      .onDuplicateKeyUpdate({
        set: { status: "pending", updatedAt: new Date() },
      });
  }
  return { success: true, pending: false };
}

export async function respondToFriendRequest(
  userId: number,
  requestId: number,
  accept: boolean
) {
  const db = requireDb(await getDb());
  const [request] = await db
    .select({
      fromUserId: friendRequests.fromUserId,
      status: friendRequests.status,
    })
    .from(friendRequests)
    .where(
      and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, userId))
    )
    .limit(1);
  if (!request) return { success: false } as const;
  if (
    accept &&
    request.status === "accepted" &&
    (await areFriends(userId, request.fromUserId))
  ) {
    return { success: true } as const;
  }
  if (request.status !== "pending") return { success: false } as const;
  if (accept) {
    const low = Math.min(userId, request.fromUserId);
    const high = Math.max(userId, request.fromUserId);
    await db
      .insert(friendships)
      .values({ userLowId: low, userHighId: high })
      .onDuplicateKeyUpdate({ set: { userLowId: low } });
    await db
      .update(friendRequests)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(
        and(
          eq(friendRequests.status, "pending"),
          or(
            and(
              eq(friendRequests.fromUserId, request.fromUserId),
              eq(friendRequests.toUserId, userId)
            ),
            and(
              eq(friendRequests.fromUserId, userId),
              eq(friendRequests.toUserId, request.fromUserId)
            )
          )
        )
      );
  } else {
    await db
      .update(friendRequests)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(friendRequests.id, requestId));
  }
  return { success: true } as const;
}

export async function removeFriendship(userId: number, friendId: number) {
  const db = requireDb(await getDb());
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.userLowId, Math.min(userId, friendId)),
        eq(friendships.userHighId, Math.max(userId, friendId))
      )
    );
  return { success: true } as const;
}

export async function listDirectMessages(userId: number, friendId: number) {
  const db = requireDb(await getDb());
  const items = await db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      recipientId: directMessages.recipientId,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .where(
      or(
        and(
          eq(directMessages.senderId, userId),
          eq(directMessages.recipientId, friendId)
        ),
        and(
          eq(directMessages.senderId, friendId),
          eq(directMessages.recipientId, userId)
        )
      )
    )
    .orderBy(desc(directMessages.createdAt), desc(directMessages.id))
    .limit(100);
  return items.reverse();
}

export async function createDirectMessage(
  senderId: number,
  recipientId: number,
  body: string
) {
  const db = requireDb(await getDb());
  await db.insert(directMessages).values({ senderId, recipientId, body });
  return { success: true } as const;
}
