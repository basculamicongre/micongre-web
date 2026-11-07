// Reglas puras del módulo «Literatura» (con pruebas en __tests__/literature.test.ts). Se pueden importar en servidor y cliente.

export type LiteratureCategoryCode = "bible" | "book" | "brochure" | "tract" | "magazine" | "other";

export const CATEGORY_LABEL: Record<LiteratureCategoryCode, string> = {
	bible: "Biblia",
	book: "Libro",
	brochure: "Folleto",
	tract: "Tratado",
	magazine: "Revista",
	other: "Otro",
};

export const AUDIENCE_LABEL = {
	publishers: "Publicadores",
	group_overseers: "Superintendentes de grupo",
} as const;

export const MAX_OFFER_QUANTITY = 999;

/** Código para mostrar: el de la publicación y, si es revista, su número («wp26 · 09/2026»). */
export function publicationCode(code: string, issue: string): string {
	const m = /^(\d{4})-(\d{2})$/.exec(issue);
	return m ? `${code} · ${m[2]}/${m[1]}` : issue ? `${code} · ${issue}` : code;
}

/** «código — título», lo que se busca y se elige en las listas. */
export function publicationLabel(p: { code: string; issue: string; title: string }): string {
	return `${publicationCode(p.code, p.issue)} — ${p.title}`;
}

/** La solicitud se ve en Mi Panel (y se puede responder) desde que se envía hasta su fecha de fin, inclusive. */
export function isOfferOpen(offer: { endsOn: string; notified: boolean }, today: string): boolean {
	return offer.notified && today <= offer.endsOn;
}

export interface OfferRecipient {
	userId: string;
	fullName: string;
	groupName: string | null;
}

export interface OfferResponse {
	userId: string;
	answer: "yes" | "no";
	quantity: number;
}

export interface OfferSummaryRow extends OfferRecipient {
	quantity: number;
}

export interface OfferSummary {
	yes: OfferSummaryRow[];
	no: OfferRecipient[];
	pending: OfferRecipient[];
	/** Suma de las cantidades de quienes dijeron que sí. */
	total: number;
}

const collator = new Intl.Collator("es");
const byName = (a: OfferRecipient, b: OfferRecipient) =>
	collator.compare(a.groupName ?? "￿", b.groupName ?? "￿") || collator.compare(a.fullName, b.fullName);

/** Lista de la solicitud: quiénes sí (con cantidad), quiénes no y quiénes no han respondido. Quien respondió pero ya no está entre los
 * destinatarios (p. ej. dejó de ser superintendente) se conserva en su lista; `people` da su nombre. */
export function summarizeOffer(recipients: OfferRecipient[], responses: OfferResponse[], people: Map<string, OfferRecipient> = new Map()): OfferSummary {
	const answered = new Map(responses.map((r) => [r.userId, r]));
	const known = new Map(recipients.map((r) => [r.userId, r]));
	const yes: OfferSummaryRow[] = [];
	const no: OfferRecipient[] = [];
	for (const r of responses) {
		const person = known.get(r.userId) ?? people.get(r.userId);
		if (!person) continue;
		if (r.answer === "yes") yes.push({ ...person, quantity: r.quantity });
		else no.push(person);
	}
	const pending = recipients.filter((r) => !answered.has(r.userId));
	return {
		yes: yes.sort(byName),
		no: no.sort(byName),
		pending: pending.sort(byName),
		total: yes.reduce((sum, r) => sum + r.quantity, 0),
	};
}

export interface InventoryLine {
	publicationId: string;
	locationId: string;
	quantity: number;
}

/** Total de cada publicación sumando todas las ubicaciones. */
export function inventoryTotals(lines: InventoryLine[]): Map<string, number> {
	const totals = new Map<string, number>();
	for (const l of lines) totals.set(l.publicationId, (totals.get(l.publicationId) ?? 0) + l.quantity);
	return totals;
}
