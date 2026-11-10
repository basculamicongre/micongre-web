import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const LITERATURE_CATEGORIES = ["bible", "book", "brochure", "tract", "magazine", "other"] as const;
export type LiteratureCategory = (typeof LITERATURE_CATEGORIES)[number];

export const LITERATURE_OFFER_AUDIENCES = ["publishers", "group_overseers"] as const;
export type LiteratureOfferAudience = (typeof LITERATURE_OFFER_AUDIENCES)[number];

// Módulo «Literatura» (migrations/0079 y 0080). Ver lib/literature.
export const literaturePublications = sqliteTable(
	"literature_publications",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		code: text("code").notNull(),
		/** Número de una revista (AAAA-MM); vacío para lo demás. */
		issue: text("issue").notNull().default(""),
		title: text("title").notNull(),
		category: text("category", { enum: LITERATURE_CATEGORIES }).notNull(),
		imageUrl: text("image_url"),
		source: text("source", { enum: ["jw", "manual"] }).notNull().default("manual"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("literature_publications_code_issue_idx").on(t.code, t.issue)],
);

export const literatureLocations = sqliteTable(
	"literature_locations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("literature_locations_name_idx").on(t.name)],
);

/** Corte de inventario: un conteo en una fecha. */
export const literatureInventories = sqliteTable(
	"literature_inventories",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		countDate: text("count_date").notNull(),
		notes: text("notes"),
		createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("literature_inventories_date_idx").on(t.countDate)],
);

export const literatureInventoryItems = sqliteTable(
	"literature_inventory_items",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		inventoryId: text("inventory_id")
			.notNull()
			.references(() => literatureInventories.id, { onDelete: "cascade" }),
		publicationId: text("publication_id")
			.notNull()
			.references(() => literaturePublications.id),
		locationId: text("location_id")
			.notNull()
			.references(() => literatureLocations.id),
		quantity: integer("quantity").notNull().default(0),
	},
	(t) => [uniqueIndex("literature_inventory_items_unique_idx").on(t.inventoryId, t.publicationId, t.locationId)],
);

/** Solicitud: se ofrece una publicación y cada destinatario responde Sí o No desde Mi Panel hasta `endsOn` (inclusive). */
export const literatureOffers = sqliteTable(
	"literature_offers",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicationId: text("publication_id")
			.notNull()
			.references(() => literaturePublications.id),
		audience: text("audience", { enum: LITERATURE_OFFER_AUDIENCES }).notNull(),
		message: text("message"),
		endsOn: text("ends_on").notNull(),
		notifiedAt: integer("notified_at", { mode: "timestamp" }),
		createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("literature_offers_ends_idx").on(t.endsOn)],
);

export const literatureOfferResponses = sqliteTable(
	"literature_offer_responses",
	{
		offerId: text("offer_id")
			.notNull()
			.references(() => literatureOffers.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		answer: text("answer", { enum: ["yes", "no"] }).notNull(),
		quantity: integer("quantity").notNull().default(1),
		respondedAt: integer("responded_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [primaryKey({ columns: [t.offerId, t.userId] })],
);

/** Solicitudes que la persona quitó de su Mi Panel (lo que respondió se conserva en `literature_offer_responses`). */
export const literatureOfferDismissals = sqliteTable(
	"literature_offer_dismissals",
	{
		offerId: text("offer_id")
			.notNull()
			.references(() => literatureOffers.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		dismissedAt: integer("dismissed_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [primaryKey({ columns: [t.offerId, t.userId] })],
);

/** Pedido que un publicador hizo por su cuenta: registro del siervo de literatura, sin avisos (migrations/0084). */
export const literatureOrders = sqliteTable(
	"literature_orders",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicationId: text("publication_id")
			.notNull()
			.references(() => literaturePublications.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		quantity: integer("quantity").notNull(),
		note: text("note"),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("literature_orders_archived_idx").on(t.archivedAt, t.createdAt)],
);
