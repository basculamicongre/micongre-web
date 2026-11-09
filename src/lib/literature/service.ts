import { and, asc, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
	fieldServiceGroups,
	literatureInventories,
	literatureInventoryItems,
	literatureLocations,
	literatureOfferDismissals,
	literatureOrders,
	literatureOfferResponses,
	literatureOffers,
	literaturePublications,
	users,
	type LiteratureCategory,
	type LiteratureOfferAudience,
} from "@/db/schema";
import { chunked } from "@/lib/cleaning/meetings";
import { formatShortDayMonth } from "@/lib/dateFormat";
import { nicaraguaToday } from "@/lib/preaching/recurring";
import { notifyUsers } from "@/lib/push/dispatch";
import { notHiddenAdmin } from "@/lib/rbac/visibility";
import { MAX_OFFER_QUANTITY, isOfferOpen, summarizeOffer, type OfferRecipient, type OfferSummary } from "./rules";

export class LiteratureFailure extends Error {
	constructor(
		public code: string,
		public status = 400,
	) {
		super(code);
	}
}

// ── Catálogo ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PublicationView {
	id: string;
	code: string;
	issue: string;
	title: string;
	category: LiteratureCategory;
	imageUrl: string | null;
	source: "jw" | "manual";
}

const publicationColumns = {
	id: literaturePublications.id,
	code: literaturePublications.code,
	issue: literaturePublications.issue,
	title: literaturePublications.title,
	category: literaturePublications.category,
	imageUrl: literaturePublications.imageUrl,
	source: literaturePublications.source,
};

export async function listPublications(db: Database): Promise<PublicationView[]> {
	return db.select(publicationColumns).from(literaturePublications).orderBy(asc(literaturePublications.category), asc(literaturePublications.code), desc(literaturePublications.issue));
}

export async function createPublication(db: Database, input: { code: string; title: string; category: LiteratureCategory }): Promise<string> {
	const code = input.code.trim();
	const [dup] = await db
		.select({ id: literaturePublications.id })
		.from(literaturePublications)
		.where(and(eq(literaturePublications.code, code), eq(literaturePublications.issue, "")))
		.limit(1);
	if (dup) throw new LiteratureFailure("duplicate_code", 409);
	const [row] = await db
		.insert(literaturePublications)
		.values({ code, title: input.title.trim(), category: input.category, source: "manual" })
		.returning({ id: literaturePublications.id });
	return row.id;
}

/** Solo se borran las agregadas a mano y que no estén en un inventario ni en una solicitud. */
export async function deletePublication(db: Database, id: string): Promise<void> {
	const [row] = await db.select({ source: literaturePublications.source }).from(literaturePublications).where(eq(literaturePublications.id, id)).limit(1);
	if (!row) throw new LiteratureFailure("not_found", 404);
	if (row.source !== "manual") throw new LiteratureFailure("jw_publication", 409);
	const [inInventory] = await db.select({ id: literatureInventoryItems.id }).from(literatureInventoryItems).where(eq(literatureInventoryItems.publicationId, id)).limit(1);
	const [inOffer] = await db.select({ id: literatureOffers.id }).from(literatureOffers).where(eq(literatureOffers.publicationId, id)).limit(1);
	const [inOrder] = await db.select({ id: literatureOrders.id }).from(literatureOrders).where(eq(literatureOrders.publicationId, id)).limit(1);
	if (inInventory || inOffer || inOrder) throw new LiteratureFailure("in_use", 409);
	await db.delete(literaturePublications).where(eq(literaturePublications.id, id));
}

async function assertPublication(db: Database, id: string) {
	const [row] = await db.select({ id: literaturePublications.id, title: literaturePublications.title }).from(literaturePublications).where(eq(literaturePublications.id, id)).limit(1);
	if (!row) throw new LiteratureFailure("invalid_publication");
	return row;
}

// ── Ubicaciones ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function listLocations(db: Database): Promise<{ id: string; name: string; inUse: boolean }[]> {
	const [rows, used] = await Promise.all([
		db.select({ id: literatureLocations.id, name: literatureLocations.name }).from(literatureLocations),
		db.selectDistinct({ id: literatureInventoryItems.locationId }).from(literatureInventoryItems),
	]);
	const usedIds = new Set(used.map((u) => u.id));
	const collator = new Intl.Collator("es", { numeric: true });
	return rows.map((r) => ({ ...r, inUse: usedIds.has(r.id) })).sort((a, b) => collator.compare(a.name, b.name));
}

async function assertUniqueLocation(db: Database, name: string, exceptId?: string) {
	const rows = await db.select({ id: literatureLocations.id, name: literatureLocations.name }).from(literatureLocations);
	const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
	if (rows.some((r) => r.id !== exceptId && fold(r.name) === fold(name))) throw new LiteratureFailure("duplicate_location", 409);
}

export async function createLocation(db: Database, name: string): Promise<string> {
	await assertUniqueLocation(db, name);
	const [row] = await db.insert(literatureLocations).values({ name: name.trim() }).returning({ id: literatureLocations.id });
	return row.id;
}

export async function renameLocation(db: Database, id: string, name: string): Promise<void> {
	await assertUniqueLocation(db, name, id);
	await db.update(literatureLocations).set({ name: name.trim() }).where(eq(literatureLocations.id, id));
}

/** Una ubicación que ya está en algún corte no se borra (el corte la necesita); se puede cambiar de nombre. */
export async function deleteLocation(db: Database, id: string): Promise<void> {
	const [used] = await db.select({ id: literatureInventoryItems.id }).from(literatureInventoryItems).where(eq(literatureInventoryItems.locationId, id)).limit(1);
	if (used) throw new LiteratureFailure("in_use", 409);
	await db.delete(literatureLocations).where(eq(literatureLocations.id, id));
}

// ── Inventario (cortes) ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface InventorySummary {
	id: string;
	countDate: string;
	notes: string | null;
	lines: number;
	total: number;
}

export async function listInventories(db: Database): Promise<InventorySummary[]> {
	const [rows, items] = await Promise.all([
		db.select().from(literatureInventories).orderBy(desc(literatureInventories.countDate), desc(literatureInventories.createdAt)),
		db.select({ inventoryId: literatureInventoryItems.inventoryId, quantity: literatureInventoryItems.quantity }).from(literatureInventoryItems),
	]);
	return rows.map((r) => {
		const own = items.filter((i) => i.inventoryId === r.id);
		return { id: r.id, countDate: r.countDate, notes: r.notes, lines: own.length, total: own.reduce((s, i) => s + i.quantity, 0) };
	});
}

export interface InventoryItemView {
	id: string;
	publicationId: string;
	locationId: string;
	quantity: number;
}

export async function getInventory(db: Database, id: string) {
	const [row] = await db.select().from(literatureInventories).where(eq(literatureInventories.id, id)).limit(1);
	if (!row) throw new LiteratureFailure("not_found", 404);
	const items: InventoryItemView[] = await db
		.select({
			id: literatureInventoryItems.id,
			publicationId: literatureInventoryItems.publicationId,
			locationId: literatureInventoryItems.locationId,
			quantity: literatureInventoryItems.quantity,
		})
		.from(literatureInventoryItems)
		.where(eq(literatureInventoryItems.inventoryId, id));
	return { id: row.id, countDate: row.countDate, notes: row.notes, items };
}

/** Nuevo corte; con `copyFromId` empieza con las mismas líneas (y cantidades) de ese corte, para solo ajustar lo que cambió. */
export async function createInventory(db: Database, input: { countDate: string; notes?: string | null; copyFromId?: string | null }, userId: string): Promise<string> {
	const [row] = await db
		.insert(literatureInventories)
		.values({ countDate: input.countDate, notes: input.notes?.trim() || null, createdByUserId: userId })
		.returning({ id: literatureInventories.id });
	if (input.copyFromId) {
		const source = await db
			.select({ publicationId: literatureInventoryItems.publicationId, locationId: literatureInventoryItems.locationId, quantity: literatureInventoryItems.quantity })
			.from(literatureInventoryItems)
			.where(eq(literatureInventoryItems.inventoryId, input.copyFromId));
		// 5 columnas por fila: de 15 en 15 para no pasar de 100 parámetros.
		for (let i = 0; i < source.length; i += 15) {
			await db.insert(literatureInventoryItems).values(source.slice(i, i + 15).map((s) => ({ ...s, inventoryId: row.id })));
		}
	}
	return row.id;
}

export async function updateInventory(db: Database, id: string, input: { countDate?: string; notes?: string | null }): Promise<void> {
	const result = await db
		.update(literatureInventories)
		.set({
			...(input.countDate ? { countDate: input.countDate } : {}),
			...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
			updatedAt: new Date(),
		})
		.where(eq(literatureInventories.id, id))
		.returning({ id: literatureInventories.id });
	if (result.length === 0) throw new LiteratureFailure("not_found", 404);
}

export async function deleteInventory(db: Database, id: string): Promise<void> {
	await db.delete(literatureInventories).where(eq(literatureInventories.id, id));
}

/** Agrega una línea al corte; si esa publicación ya está en esa ubicación, se reemplaza la cantidad. */
export async function upsertInventoryItem(db: Database, inventoryId: string, input: { publicationId: string; locationId: string; quantity: number }): Promise<string> {
	await assertPublication(db, input.publicationId);
	const [location] = await db.select({ id: literatureLocations.id }).from(literatureLocations).where(eq(literatureLocations.id, input.locationId)).limit(1);
	if (!location) throw new LiteratureFailure("invalid_location");
	const [inventory] = await db.select({ id: literatureInventories.id }).from(literatureInventories).where(eq(literatureInventories.id, inventoryId)).limit(1);
	if (!inventory) throw new LiteratureFailure("not_found", 404);
	const [row] = await db
		.insert(literatureInventoryItems)
		.values({ inventoryId, ...input })
		.onConflictDoUpdate({
			target: [literatureInventoryItems.inventoryId, literatureInventoryItems.publicationId, literatureInventoryItems.locationId],
			set: { quantity: input.quantity },
		})
		.returning({ id: literatureInventoryItems.id });
	await db.update(literatureInventories).set({ updatedAt: new Date() }).where(eq(literatureInventories.id, inventoryId));
	return row.id;
}

export async function updateInventoryItem(db: Database, inventoryId: string, itemId: string, quantity: number): Promise<void> {
	await db
		.update(literatureInventoryItems)
		.set({ quantity })
		.where(and(eq(literatureInventoryItems.id, itemId), eq(literatureInventoryItems.inventoryId, inventoryId)));
}

export async function deleteInventoryItem(db: Database, inventoryId: string, itemId: string): Promise<void> {
	await db.delete(literatureInventoryItems).where(and(eq(literatureInventoryItems.id, itemId), eq(literatureInventoryItems.inventoryId, inventoryId)));
}

// ── Solicitudes ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A quién se le pregunta: los publicadores con cuenta activa, o los superintendentes de los grupos activos (responden por su grupo). */
export async function offerRecipients(db: Database, audience: LiteratureOfferAudience): Promise<OfferRecipient[]> {
	const groups = await db.select({ id: fieldServiceGroups.id, name: fieldServiceGroups.name, overseerUserId: fieldServiceGroups.overseerUserId, active: fieldServiceGroups.active }).from(fieldServiceGroups);
	const groupName = new Map(groups.map((g) => [g.id, g.name]));
	const people = await db
		.select({ id: users.id, fullName: users.fullName, groupId: users.fieldServiceGroupId })
		.from(users)
		.where(and(eq(users.accountStatus, "active"), notHiddenAdmin));
	if (audience === "publishers") {
		return people.map((p) => ({ userId: p.id, fullName: p.fullName, groupName: p.groupId ? (groupName.get(p.groupId) ?? null) : null }));
	}
	const byId = new Map(people.map((p) => [p.id, p]));
	const out: OfferRecipient[] = [];
	for (const g of groups) {
		const person = g.active && g.overseerUserId ? byId.get(g.overseerUserId) : undefined;
		if (person && !out.some((o) => o.userId === person.id)) out.push({ userId: person.id, fullName: person.fullName, groupName: g.name });
	}
	return out;
}

export interface OfferView {
	id: string;
	publication: PublicationView;
	audience: LiteratureOfferAudience;
	message: string | null;
	endsOn: string;
	notifiedAt: Date | null;
	open: boolean;
	createdAt: Date;
	summary: OfferSummary;
}

async function loadOffers(db: Database, where?: ReturnType<typeof eq>): Promise<OfferView[]> {
	const rows = await db
		.select({ offer: literatureOffers, publication: publicationColumns })
		.from(literatureOffers)
		.innerJoin(literaturePublications, eq(literaturePublications.id, literatureOffers.publicationId))
		.where(where)
		.orderBy(desc(literatureOffers.createdAt));
	if (rows.length === 0) return [];
	const ids = rows.map((r) => r.offer.id);
	const responses = (await Promise.all(chunked(ids).map((part) => db.select().from(literatureOfferResponses).where(inArray(literatureOfferResponses.offerId, part))))).flat();
	const audiences = [...new Set(rows.map((r) => r.offer.audience))];
	const recipientsBy = new Map(await Promise.all(audiences.map(async (a) => [a, await offerRecipients(db, a)] as const)));
	// Quien respondió y ya no es destinatario (p. ej. dejó de ser superintendente) se sigue mostrando con su nombre.
	const missing = [...new Set(responses.map((r) => r.userId))].filter((id) => !audiences.some((a) => recipientsBy.get(a)?.some((p) => p.userId === id)));
	const extra = missing.length
		? (await Promise.all(chunked(missing).map((part) => db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, part))))).flat()
		: [];
	const people = new Map(extra.map((p) => [p.id, { userId: p.id, fullName: p.fullName, groupName: null }]));
	const today = nicaraguaToday();
	return rows.map(({ offer, publication }) => ({
		id: offer.id,
		publication,
		audience: offer.audience,
		message: offer.message,
		endsOn: offer.endsOn,
		notifiedAt: offer.notifiedAt,
		open: isOfferOpen({ endsOn: offer.endsOn, notified: !!offer.notifiedAt }, today),
		createdAt: offer.createdAt,
		summary: summarizeOffer(
			recipientsBy.get(offer.audience) ?? [],
			responses.filter((r) => r.offerId === offer.id),
			people,
		),
	}));
}

export async function listOffers(db: Database): Promise<OfferView[]> {
	return loadOffers(db);
}

export async function getOffer(db: Database, id: string): Promise<OfferView> {
	const [offer] = await loadOffers(db, eq(literatureOffers.id, id));
	if (!offer) throw new LiteratureFailure("not_found", 404);
	return offer;
}

export interface OfferInput {
	publicationId: string;
	audience: LiteratureOfferAudience;
	message?: string | null;
	endsOn: string;
}

export async function createOffer(db: Database, input: OfferInput, userId: string): Promise<string> {
	await assertPublication(db, input.publicationId);
	if (input.endsOn < nicaraguaToday()) throw new LiteratureFailure("past_end_date");
	const [row] = await db
		.insert(literatureOffers)
		.values({ publicationId: input.publicationId, audience: input.audience, message: input.message?.trim() || null, endsOn: input.endsOn, createdByUserId: userId })
		.returning({ id: literatureOffers.id });
	return row.id;
}

/** Cambiar la publicación o a quién va solo se puede antes de enviarla (después las respuestas ya no corresponderían). */
export async function updateOffer(db: Database, id: string, input: Partial<OfferInput>): Promise<void> {
	const [offer] = await db.select().from(literatureOffers).where(eq(literatureOffers.id, id)).limit(1);
	if (!offer) throw new LiteratureFailure("not_found", 404);
	if (offer.notifiedAt && ((input.publicationId && input.publicationId !== offer.publicationId) || (input.audience && input.audience !== offer.audience))) {
		throw new LiteratureFailure("already_sent", 409);
	}
	if (input.publicationId) await assertPublication(db, input.publicationId);
	await db
		.update(literatureOffers)
		.set({
			...(input.publicationId ? { publicationId: input.publicationId } : {}),
			...(input.audience ? { audience: input.audience } : {}),
			...(input.message !== undefined ? { message: input.message?.trim() || null } : {}),
			...(input.endsOn ? { endsOn: input.endsOn } : {}),
			updatedAt: new Date(),
		})
		.where(eq(literatureOffers.id, id));
}

export async function deleteOffer(db: Database, id: string): Promise<void> {
	await db.delete(literatureOffers).where(eq(literatureOffers.id, id));
}

/** Envía la solicitud: desde ahora se ve en Mi Panel de cada destinatario (hasta la fecha de fin) y les llega el push. Reenviar
 * solo vuelve a avisar a quienes todavía no respondieron. */
export async function sendOffer(db: Database, id: string): Promise<{ sent: number }> {
	const offer = await getOffer(db, id);
	if (offer.endsOn < nicaraguaToday()) throw new LiteratureFailure("expired", 409);
	await db.update(literatureOffers).set({ notifiedAt: new Date(), updatedAt: new Date() }).where(eq(literatureOffers.id, id));
	// Reenviar avisa a quienes no han respondido, menos a quien ya la quitó de su Mi Panel.
	const dismissed = new Set(
		(await db.select({ userId: literatureOfferDismissals.userId }).from(literatureOfferDismissals).where(eq(literatureOfferDismissals.offerId, id))).map((d) => d.userId),
	);
	const to = offer.summary.pending.map((p) => p.userId).filter((u) => !dismissed.has(u));
	const forGroup = offer.audience === "group_overseers" ? " para tu grupo" : "";
	await notifyUsers(db, to, {
		title: "Literatura",
		body: `¿Quieres «${offer.publication.title}»${forGroup}? Responde en Mi Panel hasta el ${formatShortDayMonth(offer.endsOn)}.`,
		url: "/panel",
	});
	return { sent: to.length };
}

// ── Mi Panel ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface MyOffer {
	id: string;
	title: string;
	code: string;
	issue: string;
	imageUrl: string | null;
	message: string | null;
	endsOn: string;
	forGroup: string | null;
	answer: "yes" | "no" | null;
	quantity: number;
}

/** Solicitudes abiertas para esta persona (enviadas y sin vencer), con lo que ya respondió. */
export async function myOpenOffers(db: Database, userId: string): Promise<MyOffer[]> {
	const today = nicaraguaToday();
	const rows = await db
		.select({ offer: literatureOffers, publication: publicationColumns })
		.from(literatureOffers)
		.innerJoin(literaturePublications, eq(literaturePublications.id, literatureOffers.publicationId))
		.where(and(isNotNull(literatureOffers.notifiedAt), gte(literatureOffers.endsOn, today)))
		.orderBy(asc(literatureOffers.endsOn));
	if (rows.length === 0) return [];
	const audiences = [...new Set(rows.map((r) => r.offer.audience))];
	const recipients = new Map(await Promise.all(audiences.map(async (a) => [a, (await offerRecipients(db, a)).find((p) => p.userId === userId)] as const)));
	const candidates = rows.filter((r) => recipients.get(r.offer.audience));
	if (candidates.length === 0) return [];
	const dismissed = new Set(
		(
			await db
				.select({ offerId: literatureOfferDismissals.offerId })
				.from(literatureOfferDismissals)
				.where(and(eq(literatureOfferDismissals.userId, userId), inArray(literatureOfferDismissals.offerId, candidates.map((r) => r.offer.id))))
		).map((d) => d.offerId),
	);
	const mine = candidates.filter((r) => !dismissed.has(r.offer.id));
	if (mine.length === 0) return [];
	const responses = await db
		.select()
		.from(literatureOfferResponses)
		.where(and(eq(literatureOfferResponses.userId, userId), inArray(literatureOfferResponses.offerId, mine.map((r) => r.offer.id))));
	return mine.map(({ offer, publication }) => {
		const r = responses.find((x) => x.offerId === offer.id);
		return {
			id: offer.id,
			title: publication.title,
			code: publication.code,
			issue: publication.issue,
			imageUrl: publication.imageUrl,
			message: offer.message,
			endsOn: offer.endsOn,
			forGroup: offer.audience === "group_overseers" ? (recipients.get(offer.audience)?.groupName ?? null) : null,
			answer: r?.answer ?? null,
			quantity: r?.quantity ?? 1,
		};
	});
}

export async function respondToOffer(db: Database, offerId: string, userId: string, answer: "yes" | "no", quantity: number): Promise<void> {
	const [offer] = await db.select().from(literatureOffers).where(eq(literatureOffers.id, offerId)).limit(1);
	if (!offer) throw new LiteratureFailure("not_found", 404);
	if (!isOfferOpen({ endsOn: offer.endsOn, notified: !!offer.notifiedAt }, nicaraguaToday())) throw new LiteratureFailure("closed", 409);
	const recipients = await offerRecipients(db, offer.audience);
	if (!recipients.some((r) => r.userId === userId)) throw new LiteratureFailure("not_recipient", 403);
	const qty = answer === "yes" ? Math.min(MAX_OFFER_QUANTITY, Math.max(1, Math.round(quantity))) : 0;
	await db
		.insert(literatureOfferResponses)
		.values({ offerId, userId, answer, quantity: qty })
		.onConflictDoUpdate({
			target: [literatureOfferResponses.offerId, literatureOfferResponses.userId],
			set: { answer, quantity: qty, respondedAt: new Date() },
		});
}

/** Quita la solicitud del Mi Panel de esta persona (haya respondido o no; lo respondido se conserva y ya no se le reenvía). */
export async function dismissOffer(db: Database, offerId: string, userId: string): Promise<void> {
	const [offer] = await db.select({ audience: literatureOffers.audience }).from(literatureOffers).where(eq(literatureOffers.id, offerId)).limit(1);
	if (!offer) throw new LiteratureFailure("not_found", 404);
	const recipients = await offerRecipients(db, offer.audience);
	if (!recipients.some((r) => r.userId === userId)) throw new LiteratureFailure("not_recipient", 403);
	await db.insert(literatureOfferDismissals).values({ offerId, userId }).onConflictDoNothing();
}

// ── Pedidos (registro del siervo de literatura; no avisan a nadie) ─────────────────────────────────────────────────────────────

export interface OrderView {
	id: string;
	publicationId: string;
	title: string;
	code: string;
	issue: string;
	imageUrl: string | null;
	userId: string;
	userName: string;
	quantity: number;
	note: string | null;
	archived: boolean;
	/** AAAA-MM-DD (hora de Nicaragua). */
	createdAt: string;
}

function nicaraguaDate(d: Date): string {
	return new Date(d.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
}

/** Pedidos activos (o los archivados), el más reciente primero, y las personas que se pueden elegir. */
export async function listOrders(db: Database, archived: boolean): Promise<{ items: OrderView[]; people: { id: string; fullName: string }[] }> {
	const [rows, people] = await Promise.all([
		db
			.select({ order: literatureOrders, publication: publicationColumns, userName: users.fullName })
			.from(literatureOrders)
			.innerJoin(literaturePublications, eq(literaturePublications.id, literatureOrders.publicationId))
			.innerJoin(users, eq(users.id, literatureOrders.userId))
			.where(archived ? isNotNull(literatureOrders.archivedAt) : isNull(literatureOrders.archivedAt))
			.orderBy(desc(literatureOrders.createdAt)),
		db.select({ id: users.id, fullName: users.fullName }).from(users).where(notHiddenAdmin).orderBy(asc(users.fullName)),
	]);
	return {
		items: rows.map(({ order, publication, userName }) => ({
			id: order.id,
			publicationId: publication.id,
			title: publication.title,
			code: publication.code,
			issue: publication.issue,
			imageUrl: publication.imageUrl,
			userId: order.userId,
			userName,
			quantity: order.quantity,
			note: order.note,
			archived: !!order.archivedAt,
			createdAt: nicaraguaDate(order.createdAt),
		})),
		people,
	};
}

async function assertPerson(db: Database, id: string) {
	const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), notHiddenAdmin)).limit(1);
	if (!row) throw new LiteratureFailure("invalid_person");
}

export async function createOrder(
	db: Database,
	input: { publicationId: string; userId: string; quantity: number; note?: string | null },
	createdBy: string,
): Promise<string> {
	await assertPublication(db, input.publicationId);
	await assertPerson(db, input.userId);
	const id = crypto.randomUUID();
	await db.insert(literatureOrders).values({
		id,
		publicationId: input.publicationId,
		userId: input.userId,
		quantity: input.quantity,
		note: input.note?.trim() || null,
		createdByUserId: createdBy,
	});
	return id;
}

export async function updateOrder(
	db: Database,
	id: string,
	input: { publicationId?: string; userId?: string; quantity?: number; note?: string | null; archived?: boolean },
): Promise<void> {
	const [row] = await db.select({ id: literatureOrders.id }).from(literatureOrders).where(eq(literatureOrders.id, id)).limit(1);
	if (!row) throw new LiteratureFailure("not_found", 404);
	if (input.publicationId) await assertPublication(db, input.publicationId);
	if (input.userId) await assertPerson(db, input.userId);
	await db
		.update(literatureOrders)
		.set({
			...(input.publicationId ? { publicationId: input.publicationId } : {}),
			...(input.userId ? { userId: input.userId } : {}),
			...(input.quantity ? { quantity: input.quantity } : {}),
			...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
			...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
			updatedAt: new Date(),
		})
		.where(eq(literatureOrders.id, id));
}

export async function deleteOrder(db: Database, id: string): Promise<void> {
	await db.delete(literatureOrders).where(eq(literatureOrders.id, id));
}
