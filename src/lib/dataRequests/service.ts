import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { dataUpdateRequests, fieldServiceGroups, users } from "@/db/schema";
import type { Session } from "@/lib/auth/session";
import { chunked } from "@/lib/cleaning/meetings";
import { nicaraguaToday } from "@/lib/preaching/recurring";
import { notifyUsers } from "@/lib/push/dispatch";
import { getManagedGroupIds, getOwnFieldServiceGroupId } from "@/lib/rbac/guards";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";
import { notHiddenAdmin } from "@/lib/rbac/visibility";
import { PANEL_PROMPT, planRequests, validateEmergency, validatePersonal, type DataError, type DataRequestKind, type EmergencyData, type PersonalData } from "./rules";

export class DataRequestFailure extends Error {
	constructor(
		public code: DataError | "forbidden" | "invalid_scope" | "no_targets" | "nothing_pending",
		public status = 400,
	) {
		super(code);
	}
}

/** A quién puede pedirle datos: el admin a cualquiera (`all`); con el privilegio, a su grupo (los que supervisa y el propio). */
export async function requesterScope(db: Database, session: Session): Promise<{ all: boolean; groupIds: string[] } | null> {
	if (session.role === "admin") return { all: true, groupIds: [] };
	if (!session.privilegeCodes.includes(PRIVILEGE_CODES.DATA_UPDATE_REQUEST)) return null;
	const [managed, own] = await Promise.all([getManagedGroupIds(db, session.userId), getOwnFieldServiceGroupId(db, session.userId)]);
	const groupIds = [...new Set([...managed, ...(own ? [own] : [])])];
	return groupIds.length ? { all: false, groupIds } : null;
}

export function canRequestData(session: { role: string; privilegeCodes: string[] } | null): boolean {
	return !!session && (session.role === "admin" || session.privilegeCodes.includes(PRIVILEGE_CODES.DATA_UPDATE_REQUEST));
}

export interface RequestPerson {
	id: string;
	fullName: string;
	groupId: string | null;
	hasAccount: boolean;
	pending: DataRequestKind[];
}

/** Lo que necesita el diálogo para pedir: grupos y personas a su alcance (con lo que ya tienen pendiente). */
export async function requestOptions(db: Database, session: Session) {
	const scope = await requesterScope(db, session);
	if (!scope) throw new DataRequestFailure("forbidden", 403);
	const groups = await db
		.select({ id: fieldServiceGroups.id, name: fieldServiceGroups.name })
		.from(fieldServiceGroups)
		.where(scope.all ? undefined : inArray(fieldServiceGroups.id, scope.groupIds))
		.orderBy(asc(fieldServiceGroups.name));
	const people = await db
		.select({ id: users.id, fullName: users.fullName, groupId: users.fieldServiceGroupId, accountStatus: users.accountStatus })
		.from(users)
		.where(scope.all ? notHiddenAdmin : and(notHiddenAdmin, inArray(users.fieldServiceGroupId, scope.groupIds)))
		.orderBy(asc(users.fullName));
	const pending = await pendingByUser(db, people.map((p) => p.id));
	return {
		canCongregation: scope.all,
		groups,
		people: people.map<RequestPerson>((p) => ({
			id: p.id,
			fullName: p.fullName,
			groupId: p.groupId,
			hasAccount: p.accountStatus === "active",
			pending: pending.get(p.id) ?? [],
		})),
	};
}

async function pendingByUser(db: Database, userIds: string[]): Promise<Map<string, DataRequestKind[]>> {
	const out = new Map<string, DataRequestKind[]>();
	for (const part of chunked(userIds)) {
		const rows = await db
			.select({ userId: dataUpdateRequests.userId, kind: dataUpdateRequests.kind })
			.from(dataUpdateRequests)
			.where(and(inArray(dataUpdateRequests.userId, part), isNull(dataUpdateRequests.completedAt)));
		for (const r of rows) out.set(r.userId, [...new Set([...(out.get(r.userId) ?? []), r.kind])]);
	}
	return out;
}

export interface CreateInput {
	/** Una sola cosa por solicitud. */
	kind: DataRequestKind;
	scope: "user" | "group" | "congregation";
	userIds?: string[];
	groupId?: string;
}

/** Crea las solicitudes (solo para personas con cuenta activa, sin repetir las pendientes) y les avisa por push. */
export async function createRequests(db: Database, session: Session, input: CreateInput): Promise<{ created: number; people: number; skipped: number }> {
	const scope = await requesterScope(db, session);
	if (!scope) throw new DataRequestFailure("forbidden", 403);
	const conditions = [notHiddenAdmin, eq(users.accountStatus, "active")];
	if (input.scope === "congregation") {
		if (!scope.all) throw new DataRequestFailure("forbidden", 403);
	} else if (input.scope === "group") {
		if (!input.groupId) throw new DataRequestFailure("invalid_scope");
		if (!scope.all && !scope.groupIds.includes(input.groupId)) throw new DataRequestFailure("forbidden", 403);
		conditions.push(eq(users.fieldServiceGroupId, input.groupId));
	} else {
		if (!input.userIds?.length) throw new DataRequestFailure("invalid_scope");
		if (!scope.all) conditions.push(inArray(users.fieldServiceGroupId, scope.groupIds));
	}
	let targets = (await db.select({ id: users.id }).from(users).where(and(...conditions))).map((u) => u.id);
	if (input.scope === "user") {
		const wanted = new Set(input.userIds);
		targets = targets.filter((id) => wanted.has(id));
		if (targets.length !== wanted.size) throw new DataRequestFailure("forbidden", 403);
	}
	if (targets.length === 0) throw new DataRequestFailure("no_targets");

	const pending = await pendingByUser(db, targets);
	const pendingKeys = new Set([...pending].flatMap(([u, ks]) => ks.map((k) => `${u}:${k}`)));
	const rows = planRequests(targets, input.kind, pendingKeys);
	// D1: hasta 100 parámetros por consulta (3 columnas por fila).
	for (let i = 0; i < rows.length; i += 30) {
		await db.insert(dataUpdateRequests).values(rows.slice(i, i + 30).map((r) => ({ ...r, requestedByUserId: session.userId })));
	}
	const notified = [...new Set(rows.map((r) => r.userId))];
	if (notified.length) await notifyUsers(db, notified, { title: input.kind === "personal" ? "Actualiza tus datos" : "Contacto de emergencia", body: PANEL_PROMPT[input.kind], url: "/panel" });
	return { created: rows.length, people: notified.length, skipped: targets.length - notified.length };
}

export interface MyDataRequest {
	kinds: DataRequestKind[];
	personal: PersonalData;
	emergency: { name: string | null; phone: string | null; relation: string | null };
}

/** Mi Panel: lo que le han pedido a la persona (null = no hay tarjeta) y sus datos actuales para precargar el formulario. */
export async function myDataRequest(db: Database, userId: string): Promise<MyDataRequest | null> {
	const kinds = (await pendingByUser(db, [userId])).get(userId) ?? [];
	if (kinds.length === 0) return null;
	const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!u) return null;
	return {
		kinds,
		personal: { fullName: u.fullName, birthDate: u.birthDate, baptismDate: u.baptismDate, phone: u.phone, email: u.email },
		emergency: { name: u.emergencyContactName, phone: u.emergencyContactPhone, relation: u.emergencyContactRelation },
	};
}

/** Guarda lo que la persona llenó y cierra esa solicitud. Solo acepta lo que tiene pendiente (la app y la web mandan una cosa a la vez). */
export async function saveMyData(db: Database, userId: string, input: { personal?: Partial<PersonalData>; emergency?: Partial<EmergencyData> }): Promise<void> {
	const kinds = (await pendingByUser(db, [userId])).get(userId) ?? [];
	const set: Partial<typeof users.$inferInsert> = {};
	const done: DataRequestKind[] = [];
	if (input.personal && kinds.includes("personal")) {
		const r = validatePersonal(input.personal, nicaraguaToday());
		if (!r.ok) throw new DataRequestFailure(r.error);
		Object.assign(set, r.value);
		done.push("personal");
	}
	if (input.emergency && kinds.includes("emergency")) {
		const r = validateEmergency(input.emergency);
		if (!r.ok) throw new DataRequestFailure(r.error);
		Object.assign(set, { emergencyContactName: r.value.name, emergencyContactPhone: r.value.phone, emergencyContactRelation: r.value.relation });
		done.push("emergency");
	}
	if (done.length === 0) throw new DataRequestFailure("nothing_pending", 409);
	await db.update(users).set(set).where(eq(users.id, userId));
	await db
		.update(dataUpdateRequests)
		.set({ completedAt: new Date() })
		.where(and(eq(dataUpdateRequests.userId, userId), inArray(dataUpdateRequests.kind, done), isNull(dataUpdateRequests.completedAt)));
}
