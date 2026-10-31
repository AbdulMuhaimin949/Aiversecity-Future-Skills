import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { createdAt, dataOriginEnum, updatedAt } from "./common";

/**
 * Reference catalogue imported from the pipeline CSVs
 * (`pipeline/data/bronze/source_catalogue.csv`, `pipeline/data/silver/*.csv`).
 * Primary keys are the original pipeline IDs so imports are idempotent.
 */

export const dataSourcesTable = pgTable(
  "data_sources",
  {
    sourceId: text("source_id").primaryKey(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceType: text("source_type").notNull(),
    publicationDate: date("publication_date"),
    retrievalDate: date("retrieval_date"),
    licenceOrUsageNotes: text("licence_or_usage_notes"),
    verificationStatus: text("verification_status").notNull(),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "data_sources_synthetic_consistent",
      sql`(${t.dataOrigin} = 'SYNTHETIC') = (${t.verificationStatus} like 'SYNTHETIC%')`,
    ),
  ],
);

export const occupationsTable = pgTable(
  "occupations",
  {
    occupationId: text("occupation_id").primaryKey(),
    canonicalTitle: text("canonical_title").notNull(),
    masco2020Code: text("masco_2020_code"),
    escoCode: text("esco_code"),
    industrySector: text("industry_sector").notNull(),
    careerLevel: text("career_level").notNull(),
    roleDescription: text("role_description"),
    minEducationLevel: text("min_education_level"),
    minExperienceYears: integer("min_experience_years").notNull().default(0),
    mycolCriticalStatus: text("mycol_critical_status"),
    primarySdgId: text("primary_sdg_id"),
    sdgRationale: text("sdg_rationale"),
    sourceId: text("source_id")
      .notNull()
      .references(() => dataSourcesTable.sourceId, { onUpdate: "cascade" }),
    verificationStatus: text("verification_status").notNull(),
    isSynthetic: boolean("is_synthetic").notNull(),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("occupations_sector_idx").on(t.industrySector),
    index("occupations_source_idx").on(t.sourceId),
    index("occupations_masco_idx").on(t.masco2020Code),
    check(
      "occupations_career_level",
      sql`${t.careerLevel} in ('Entry', 'Mid', 'Senior', 'Lead')`,
    ),
    check(
      "occupations_min_experience_nonnegative",
      sql`${t.minExperienceYears} >= 0`,
    ),
    check(
      "occupations_origin_matches_flag",
      sql`${t.isSynthetic} = (${t.dataOrigin} = 'SYNTHETIC')`,
    ),
  ],
);

export const skillsTable = pgTable(
  "skills",
  {
    skillId: text("skill_id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    skillCategory: text("skill_category").notNull(),
    skillType: text("skill_type").notNull(),
    synonyms: text("synonyms")
      .array()
      // No column default: drizzle-kit re-detects array defaults on every push.
      .notNull(),
    description: text("description"),
    escoSkillUri: text("esco_skill_uri"),
    sourceId: text("source_id")
      .notNull()
      .references(() => dataSourcesTable.sourceId, { onUpdate: "cascade" }),
    verificationStatus: text("verification_status").notNull(),
    isSynthetic: boolean("is_synthetic").notNull(),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("skills_category_idx").on(t.skillCategory),
    index("skills_source_idx").on(t.sourceId),
    index("skills_name_lower_idx").on(sql`lower(${t.canonicalName})`),
    check(
      "skills_origin_matches_flag",
      sql`${t.isSynthetic} = (${t.dataOrigin} = 'SYNTHETIC')`,
    ),
  ],
);

export const occupationSkillsTable = pgTable(
  "occupation_skills",
  {
    occSkillId: text("occ_skill_id").primaryKey(),
    occupationId: text("occupation_id")
      .notNull()
      .references(() => occupationsTable.occupationId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skillsTable.skillId, { onUpdate: "cascade" }),
    importanceLevel: text("importance_level").notNull(),
    requiredProficiency: smallint("required_proficiency").notNull(),
    transferabilityWeight: numeric("transferability_weight", {
      precision: 4,
      scale: 3,
      mode: "number",
    }).notNull(),
    sourceId: text("source_id")
      .notNull()
      .references(() => dataSourcesTable.sourceId, { onUpdate: "cascade" }),
    verificationStatus: text("verification_status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("occupation_skills_pair_unique").on(t.occupationId, t.skillId),
    index("occupation_skills_skill_idx").on(t.skillId),
    check(
      "occupation_skills_importance",
      sql`${t.importanceLevel} in ('Required', 'Preferred')`,
    ),
    check(
      "occupation_skills_proficiency_range",
      sql`${t.requiredProficiency} between 1 and 5`,
    ),
    check(
      "occupation_skills_weight_range",
      sql`${t.transferabilityWeight} between 0 and 1`,
    ),
  ],
);

export const insertDataSourceSchema = createInsertSchema(dataSourcesTable).omit(
  { createdAt: true, updatedAt: true },
);
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSourcesTable.$inferSelect;

export const insertOccupationSchema = createInsertSchema(occupationsTable).omit(
  { createdAt: true, updatedAt: true },
);
export type InsertOccupation = z.infer<typeof insertOccupationSchema>;
export type Occupation = typeof occupationsTable.$inferSelect;

export const insertSkillSchema = createInsertSchema(skillsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skillsTable.$inferSelect;

export const insertOccupationSkillSchema = createInsertSchema(
  occupationSkillsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertOccupationSkill = z.infer<typeof insertOccupationSkillSchema>;
export type OccupationSkill = typeof occupationSkillsTable.$inferSelect;
