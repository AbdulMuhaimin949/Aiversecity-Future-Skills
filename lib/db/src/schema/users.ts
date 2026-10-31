import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { createdAt, updatedAt } from "./common";
import { skillsTable } from "./catalogue";

/** Reference list of UI / content languages (seeded: ms, zh-CN, en). */
export const languagesTable = pgTable(
  "languages",
  {
    code: text("code").primaryKey(),
    nameEn: text("name_en").notNull(),
    nativeName: text("native_name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("languages_code_supported", sql`${t.code} in ('ms', 'zh-CN', 'en')`),
    // Only one default language may exist.
    uniqueIndex("languages_single_default")
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ],
);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    displayName: text("display_name"),
    preferredLanguage: text("preferred_language")
      .notNull()
      .default("ms")
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    status: userStatusEnum("status").notNull().default("active"),
    /** Identity provider details, filled in once sign-in is added. */
    authProvider: text("auth_provider"),
    authSubject: text("auth_subject"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`),
    uniqueIndex("users_auth_identity_unique").on(t.authProvider, t.authSubject),
    check(
      "users_auth_identity_pair",
      sql`(${t.authProvider} is null) = (${t.authSubject} is null)`,
    ),
  ],
);

export const rolesTable = pgTable("roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const userRolesTable = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleCode: text("role_code")
      .notNull()
      .references(() => rolesTable.code, { onUpdate: "cascade" }),
    grantedBy: uuid("granted_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleCode] }),
    index("user_roles_role_idx").on(t.roleCode),
  ],
);

/** Career profile (mirrors what the web app currently keeps in localStorage). */
export const userProfilesTable = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("My profile"),
    educationLevel: text("education_level"),
    yearsExperience: integer("years_experience"),
    weeklyLearningHours: integer("weekly_learning_hours"),
    interestSectors: text("interest_sectors")
      .array()
      // No column default: drizzle-kit re-detects array defaults on every push.
      .notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("user_profiles_user_idx").on(t.userId),
    uniqueIndex("user_profiles_one_primary")
      .on(t.userId)
      .where(sql`${t.isPrimary}`),
    check(
      "user_profiles_education_level",
      sql`${t.educationLevel} is null or ${t.educationLevel} in ('SPM/SKM', 'Diploma/DKM', 'Bachelor', 'Master/PhD')`,
    ),
    check(
      "user_profiles_years_experience_range",
      sql`${t.yearsExperience} is null or ${t.yearsExperience} between 0 and 60`,
    ),
    check(
      "user_profiles_weekly_hours_range",
      sql`${t.weeklyLearningHours} is null or ${t.weeklyLearningHours} between 0 and 80`,
    ),
  ],
);

export const profileSkillSourceEnum = pgEnum("profile_skill_source", [
  "manual",
  "cv_scan",
  "synthetic_persona",
]);

export const profileSkillsTable = pgTable(
  "profile_skills",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skillsTable.skillId, { onUpdate: "cascade" }),
    proficiency: smallint("proficiency").notNull(),
    source: profileSkillSourceEnum("source").notNull().default("manual"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.skillId] }),
    index("profile_skills_skill_idx").on(t.skillId),
    check("profile_skills_proficiency_range", sql`${t.proficiency} between 1 and 5`),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertUserProfileSchema = createInsertSchema(
  userProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

export const insertProfileSkillSchema = createInsertSchema(
  profileSkillsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertProfileSkill = z.infer<typeof insertProfileSkillSchema>;
export type ProfileSkill = typeof profileSkillsTable.$inferSelect;

export type Language = typeof languagesTable.$inferSelect;
export type Role = typeof rolesTable.$inferSelect;
export type UserRole = typeof userRolesTable.$inferSelect;
