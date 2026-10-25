import { and, asc, desc, eq, isNull, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertNote,
  InsertStudyMaterial,
  InsertTask,
  InsertUser,
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

export async function createPasswordUser(values: {
  openId: string;
  username: string;
  passwordHash: string;
}) {
  const db = requireDb(await getDb());
  await db.insert(users).values({
    openId: values.openId,
    username: values.username,
    passwordHash: values.passwordHash,
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
