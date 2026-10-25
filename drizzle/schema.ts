import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** User identities. Local studywithfun accounts use a synthetic openId and a unique username. */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    username: varchar("username", { length: 24 }),
    passwordHash: text("passwordHash"),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    usernameIdx: uniqueIndex("users_username_unique").on(table.username),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const notes = mysqlTable(
  "notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body"),
    pdfStorageKey: varchar("pdfStorageKey", { length: 512 }),
    pdfFileName: varchar("pdfFileName", { length: 255 }),
    pdfFileSize: int("pdfFileSize"),
    category: mysqlEnum("category", ["study", "planning", "reflection"])
      .default("study")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userDateIdx: index("notes_user_date_idx").on(table.userId, table.date),
  })
);

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    details: text("details"),
    dueDate: date("dueDate", { mode: "string" }),
    assignee: varchar("assignee", { length: 160 }),
    studyContext: varchar("studyContext", { length: 180 }),
    status: mysqlEnum("status", ["todo", "in_progress", "done"])
      .default("todo")
      .notNull(),
    priority: mysqlEnum("priority", ["low", "normal", "high"])
      .default("normal")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userDueIdx: index("tasks_user_due_idx").on(table.userId, table.dueDate),
    userStatusIdx: index("tasks_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const userPreferences = mysqlTable("user_preferences", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  spotifyLink: text("spotifyLink"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
