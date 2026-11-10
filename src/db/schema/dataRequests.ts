import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const DATA_REQUEST_KINDS = ["personal", "emergency"] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];

/** Solicitud para que una persona actualice sus datos (una fila por persona y tipo; `completedAt` al guardar desde Mi Panel). */
export const dataUpdateRequests = sqliteTable(
	"data_update_requests",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: DATA_REQUEST_KINDS }).notNull(),
		requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(t) => [index("data_update_requests_user_idx").on(t.userId, t.completedAt)],
);
