// Reglas puras de las solicitudes de actualización de datos (con pruebas en __tests__/dataRequests.test.ts).

export type DataRequestKind = "personal" | "emergency";
export const DATA_REQUEST_KIND_LABEL: Record<DataRequestKind, string> = {
	personal: "Datos personales",
	emergency: "Contacto de emergencia",
};

/** Texto de la tarjeta de Mi Panel (y del push), uno por tipo: cada solicitud es de una sola cosa. */
export const PANEL_PROMPT: Record<DataRequestKind, string> = {
	personal: "Solicitan que actualices tus datos, no va a tomar mucho tiempo.",
	emergency: "Solicitan que actualices tu contacto de emergencia, no va a tomar mucho tiempo.",
};

export interface PersonalData {
	fullName: string;
	birthDate: string | null;
	baptismDate: string | null;
	phone: string | null;
	email: string | null;
}

export interface EmergencyData {
	name: string;
	phone: string;
	relation: string | null;
}

export type DataError =
	| "name_required"
	| "name_too_long"
	| "invalid_birth_date"
	| "invalid_baptism_date"
	| "baptism_before_birth"
	| "invalid_phone"
	| "invalid_email"
	| "emergency_name_required"
	| "emergency_phone_required"
	| "too_long";

export const DATA_ERROR_MESSAGE: Record<DataError, string> = {
	name_required: "Escribe tu nombre.",
	name_too_long: "El nombre es demasiado largo.",
	invalid_birth_date: "Revisa la fecha de nacimiento.",
	invalid_baptism_date: "Revisa la fecha de bautismo.",
	baptism_before_birth: "La fecha de bautismo no puede ser antes del nacimiento.",
	invalid_phone: "Revisa el teléfono (solo números, espacios, +, - y paréntesis).",
	invalid_email: "Revisa el email.",
	emergency_name_required: "Escribe el nombre del contacto de emergencia.",
	emergency_phone_required: "Escribe el teléfono del contacto de emergencia.",
	too_long: "Algún dato es demasiado largo.",
};

function blank(v: string | null | undefined): string | null {
	const t = (v ?? "").trim().replace(/\s+/g, " ");
	return t ? t : null;
}

/** Fecha AAAA-MM-DD real y no futura. */
export function isValidPastDate(value: string, today: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T12:00:00Z`);
	if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
	return value >= "1900-01-01" && value <= today;
}

export function isValidPhone(value: string): boolean {
	return /^[+(\d][\d\s()+-]{5,29}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 6;
}

export function isValidEmail(value: string): boolean {
	return value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Limpia y valida los datos personales. */
export function validatePersonal(input: Partial<PersonalData>, today: string): { ok: true; value: PersonalData } | { ok: false; error: DataError } {
	const fullName = blank(input.fullName);
	if (!fullName) return { ok: false, error: "name_required" };
	if (fullName.length > 120) return { ok: false, error: "name_too_long" };
	const birthDate = blank(input.birthDate);
	if (birthDate && !isValidPastDate(birthDate, today)) return { ok: false, error: "invalid_birth_date" };
	const baptismDate = blank(input.baptismDate);
	if (baptismDate && !isValidPastDate(baptismDate, today)) return { ok: false, error: "invalid_baptism_date" };
	if (birthDate && baptismDate && baptismDate < birthDate) return { ok: false, error: "baptism_before_birth" };
	const phone = blank(input.phone);
	if (phone && !isValidPhone(phone)) return { ok: false, error: "invalid_phone" };
	const email = blank(input.email)?.toLowerCase() ?? null;
	if (email && !isValidEmail(email)) return { ok: false, error: "invalid_email" };
	return { ok: true, value: { fullName, birthDate, baptismDate, phone, email } };
}

/** Limpia y valida el contacto de emergencia (nombre y teléfono obligatorios; la relación es opcional). */
export function validateEmergency(input: Partial<EmergencyData>): { ok: true; value: EmergencyData } | { ok: false; error: DataError } {
	const name = blank(input.name);
	if (!name) return { ok: false, error: "emergency_name_required" };
	const phone = blank(input.phone);
	if (!phone) return { ok: false, error: "emergency_phone_required" };
	if (!isValidPhone(phone)) return { ok: false, error: "invalid_phone" };
	const relation = blank(input.relation);
	if (name.length > 120 || (relation?.length ?? 0) > 60) return { ok: false, error: "too_long" };
	return { ok: true, value: { name, phone, relation } };
}

/** Qué solicitudes crear (una sola cosa por solicitud): una por persona, salvo quien ya la tiene pendiente (`pending` = "userId:kind"). */
export function planRequests(userIds: string[], kind: DataRequestKind, pending: Set<string>): { userId: string; kind: DataRequestKind }[] {
	return [...new Set(userIds)].filter((userId) => !pending.has(`${userId}:${kind}`)).map((userId) => ({ userId, kind }));
}
