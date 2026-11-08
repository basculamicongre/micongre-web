import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

// Módulo «Precursorado» (migrations/0081): herramientas personales del precursor.

export const PIONEER_STUDY_STATUSES = ["return_visit", "active", "progressive", "finished"] as const;
export type PioneerStudyStatus = (typeof PIONEER_STUDY_STATUSES)[number];

export const pioneerHours = sqliteTable(
	"pioneer_hours",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		entryDate: text("entry_date").notNull(),
		hours: real("hours").notNull(),
		comment: text("comment"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("pioneer_hours_user_date_idx").on(t.userId, t.entryDate)],
);

export const pioneerStudies = sqliteTable(
	"pioneer_studies",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		status: text("status", { enum: PIONEER_STUDY_STATUSES }).notNull().default("return_visit"),
		/** 1 = lunes … 7 = domingo. */
		weekday: integer("weekday"),
		comment: text("comment"),
		latitude: real("latitude"),
		longitude: real("longitude"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("pioneer_studies_user_idx").on(t.userId), index("pioneer_studies_weekday_idx").on(t.weekday, t.status)],
);
