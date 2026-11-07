import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { coVisitSchedules } from "./coVisit";
import { notifications } from "./notifications";
import { users } from "./users";

export const EVENT_KINDS = ["memorial", "circuit_assembly", "regional_convention", "co_visit", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_MEETING_ACTIONS = ["none", "cancel", "move"] as const;
export type EventMeetingAction = (typeof EVENT_MEETING_ACTIONS)[number];

// Eventos de la congregación (migrations/0076): afectan la semana de su fecha de inicio. Cada reunión se configura por separado
// (`midweek_*`, `weekend_*`): sin cambio, cancelarla o moverla a otro día y hora de esa semana. Ver lib/events.
export const congregationEvents = sqliteTable(
	"congregation_events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		kind: text("kind", { enum: EVENT_KINDS }).notNull(),
		title: text("title"),
		startDate: text("start_date").notNull(),
		endDate: text("end_date").notNull(),
		message: text("message"),
		notifyDaysBefore: integer("notify_days_before").notNull().default(15),
		midweekAction: text("midweek_action", { enum: EVENT_MEETING_ACTIONS }).notNull().default("none"),
		midweekDay: text("midweek_day"),
		midweekTime: text("midweek_time"),
		weekendAction: text("weekend_action", { enum: EVENT_MEETING_ACTIONS }).notNull().default("none"),
		weekendDay: text("weekend_day"),
		weekendTime: text("weekend_time"),
		coVisitId: text("co_visit_id").references(() => coVisitSchedules.id, { onDelete: "cascade" }),
		notificationId: text("notification_id").references(() => notifications.id, { onDelete: "set null" }),
		notifiedAt: integer("notified_at", { mode: "timestamp" }),
		createdByUserId: text("created_by_user_id").references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("congregation_events_start_idx").on(t.startDate)],
);

export type CongregationEvent = typeof congregationEvents.$inferSelect;
