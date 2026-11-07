import { assertCanAccessLiteratureModule } from "@/lib/rbac/guards";
import { formatShortDate } from "@/lib/dateFormat";
import { getInventory, getOffer, listLocations, listPublications } from "@/lib/literature/service";
import { AUDIENCE_LABEL, inventoryTotals, publicationCode } from "@/lib/literature/rules";
import type { BuilderContext } from "../registry";
import type { ReportBlock, ReportDoc } from "../types";

const collator = new Intl.Collator("es", { numeric: true });

/** Lista de una solicitud: a quién se le entrega (y cuántas), y quiénes dijeron que no o no respondieron. */
async function buildOffer({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessLiteratureModule(session);
	const offer = await getOffer(db, params.get("id") ?? "");
	const { summary, publication } = offer;
	const byGroup = offer.audience === "group_overseers";
	const blocks: ReportBlock[] = [
		{
			type: "keyValue",
			items: [
				{ label: "Publicación", value: `${publicationCode(publication.code, publication.issue)} — ${publication.title}` },
				{ label: "Para", value: AUDIENCE_LABEL[offer.audience] },
				{ label: "Fecha de fin", value: formatShortDate(offer.endsOn) },
				{ label: "Total a entregar", value: String(summary.total) },
			],
		},
		{ type: "heading", text: `Sí (${summary.yes.length})`, level: 2 },
	];
	if (summary.yes.length === 0) blocks.push({ type: "paragraph", text: "Nadie ha dicho que sí.", muted: true });
	else
		blocks.push({
			type: "table",
			table: {
				sheetName: "Sí",
				columns: [{ label: byGroup ? "Superintendente" : "Nombre", width: 3 }, { label: "Grupo", width: 2 }, { label: "Cantidad", width: 1, align: "center" }, { label: "Entregado", width: 1, align: "center" }],
				rows: [...summary.yes.map((r) => [r.fullName, r.groupName ?? "", r.quantity, ""]), ["Total", "", summary.total, ""]],
			},
		});
	if (summary.no.length) {
		blocks.push({ type: "heading", text: `No (${summary.no.length})`, level: 2 });
		blocks.push({ type: "paragraph", text: summary.no.map((r) => r.fullName).join(", ") });
	}
	if (summary.pending.length) {
		blocks.push({ type: "heading", text: `Sin responder (${summary.pending.length})`, level: 2 });
		blocks.push({ type: "paragraph", text: summary.pending.map((r) => r.fullName).join(", "), muted: true });
	}
	return {
		title: "Solicitud de literatura",
		subtitle: publication.title,
		fileName: `Literatura ${publication.code}${publication.issue ? ` ${publication.issue}` : ""}`,
		blocks,
	};
}

/** Corte de inventario: por ubicación y el total de cada publicación. */
async function buildInventory({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessLiteratureModule(session);
	const [inventory, publications, locations] = await Promise.all([getInventory(db, params.get("id") ?? ""), listPublications(db), listLocations(db)]);
	const pub = new Map(publications.map((p) => [p.id, p]));
	const label = (id: string) => {
		const p = pub.get(id);
		return p ? { code: publicationCode(p.code, p.issue), title: p.title } : { code: "", title: "—" };
	};
	const byCode = (a: { publicationId: string }, b: { publicationId: string }) => collator.compare(label(a.publicationId).code, label(b.publicationId).code);
	const blocks: ReportBlock[] = [];
	if (inventory.notes) blocks.push({ type: "paragraph", text: inventory.notes, muted: true });
	for (const loc of locations) {
		const items = inventory.items.filter((i) => i.locationId === loc.id).sort(byCode);
		if (items.length === 0) continue;
		blocks.push({ type: "heading", text: loc.name, level: 2 });
		blocks.push({
			type: "table",
			table: {
				sheetName: loc.name.slice(0, 30),
				columns: [{ label: "Código", width: 1 }, { label: "Publicación", width: 4 }, { label: "Cantidad", width: 1, align: "right" }],
				rows: [...items.map((i) => [label(i.publicationId).code, label(i.publicationId).title, i.quantity]), ["", "Total", items.reduce((s, i) => s + i.quantity, 0)]],
			},
		});
	}
	const totals = [...inventoryTotals(inventory.items)].map(([publicationId, quantity]) => ({ publicationId, quantity })).sort(byCode);
	if (totals.length) {
		blocks.push({ type: "pageBreak" });
		blocks.push({ type: "heading", text: "Total por publicación", level: 2 });
		blocks.push({
			type: "table",
			table: {
				sheetName: "Totales",
				columns: [{ label: "Código", width: 1 }, { label: "Publicación", width: 4 }, { label: "Cantidad", width: 1, align: "right" }],
				rows: totals.map((t) => [label(t.publicationId).code, label(t.publicationId).title, t.quantity]),
			},
		});
	} else blocks.push({ type: "paragraph", text: "El corte no tiene publicaciones.", muted: true });
	return {
		title: "Inventario de literatura",
		subtitle: `Corte del ${formatShortDate(inventory.countDate)}`,
		fileName: `Inventario de literatura ${inventory.countDate}`,
		blocks,
	};
}

export async function buildLiterature(ctx: BuilderContext): Promise<ReportDoc> {
	return ctx.params.get("kind") === "literature-inventory" ? buildInventory(ctx) : buildOffer(ctx);
}
