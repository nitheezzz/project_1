import {
  boolean,
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
    bio: varchar("bio", { length: 180 }),
    profileColor: varchar("profileColor", { length: 16 }).default("sage"),
    email: varchar("email", { length: 320 }),
    emailVerified: boolean("emailVerified").default(false).notNull(),
    pendingEmail: varchar("pendingEmail", { length: 320 }),
    verificationCode: varchar("verificationCode", { length: 64 }),
    verificationPurpose: mysqlEnum("verificationPurpose", [
      "registration",
      "existing_account",
      "email_change",
    ]),
    verificationExpiresAt: timestamp("verificationExpiresAt"),
    verificationSentAt: timestamp("verificationSentAt"),
    verificationAttempts: int("verificationAttempts").default(0).notNull(),
    verificationSendWindowAt: timestamp("verificationSendWindowAt"),
    verificationSendCount: int("verificationSendCount").default(0).notNull(),
    legalConsentAt: timestamp("legalConsentAt"),
    legalConsentVersion: varchar("legalConsentVersion", { length: 24 }),
    authVersion: int("authVersion").default(0).notNull(),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    usernameIdx: uniqueIndex("users_username_unique").on(table.username),
    emailIdx: uniqueIndex("users_email_unique").on(table.email),
    pendingEmailIdx: uniqueIndex("users_pending_email_unique").on(
      table.pendingEmail
    ),
  })
);

export type EmailVerificationPurpose =
  | "registration"
  | "existing_account"
  | "email_change";

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const accountChallenges = mysqlTable(
  "account_challenges",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    purpose: mysqlEnum("purpose", ["signup", "password_reset"]).notNull(),
    userId: int("userId"),
    username: varchar("username", { length: 24 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    verificationCode: varchar("verificationCode", { length: 64 }),
    expiresAt: timestamp("expiresAt").notNull(),
    sentAt: timestamp("sentAt").notNull(),
    attempts: int("attempts").default(0).notNull(),
    sendWindowAt: timestamp("sendWindowAt"),
    sendCount: int("sendCount").default(1).notNull(),
    verifiedAt: timestamp("verifiedAt"),
    continuationHash: varchar("continuationHash", { length: 64 }),
    continuationExpiresAt: timestamp("continuationExpiresAt"),
    consumedAt: timestamp("consumedAt"),
    legalConsentVersion: varchar("legalConsentVersion", { length: 24 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    identityUnique: uniqueIndex("account_challenges_purpose_username_unique").on(
      table.purpose,
      table.username
    ),
    emailIdx: index("account_challenges_email_idx").on(
      table.purpose,
      table.email
    ),
    userIdx: index("account_challenges_user_idx").on(table.userId),
    expiryIdx: index("account_challenges_expiry_idx").on(table.expiresAt),
  })
);

export type AccountChallenge = typeof accountChallenges.$inferSelect;
export type InsertAccountChallenge = typeof accountChallenges.$inferInsert;

export const accountCompletionLimits = mysqlTable(
  "account_completion_limits",
  {
    ipHash: varchar("ipHash", { length: 64 }).primaryKey(),
    windowAt: timestamp("windowAt").notNull(),
    attempts: int("attempts").default(1).notNull(),
  },
  table => ({
    windowIdx: index("account_completion_limits_window_idx").on(table.windowAt),
  })
);

export const friendRequests = mysqlTable(
  "friend_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    fromUserId: int("fromUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: int("toUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["pending", "accepted", "declined"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    pairUnique: uniqueIndex("friend_requests_pair_unique").on(
      table.fromUserId,
      table.toUserId
    ),
    inboxIdx: index("friend_requests_inbox_idx").on(
      table.toUserId,
      table.status
    ),
  })
);

export const friendships = mysqlTable(
  "friendships",
  {
    id: int("id").autoincrement().primaryKey(),
    userLowId: int("userLowId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: int("userHighId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    pairUnique: uniqueIndex("friendships_pair_unique").on(
      table.userLowId,
      table.userHighId
    ),
    lowIdx: index("friendships_low_idx").on(table.userLowId),
    highIdx: index("friendships_high_idx").on(table.userHighId),
  })
);

export const directMessages = mysqlTable(
  "direct_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    senderId: int("senderId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: int("recipientId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 3000 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    conversationIdx: index("direct_messages_conversation_idx").on(
      table.senderId,
      table.recipientId,
      table.createdAt
    ),
  })
);

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

export const studyMaterials = mysqlTable(
  "study_materials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    fileSize: int("fileSize").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => ({
    userCreatedIdx: index("study_materials_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type InsertStudyMaterial = typeof studyMaterials.$inferInsert;

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
    dueTime: varchar("dueTime", { length: 5 }).default("17:00").notNull(),
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
