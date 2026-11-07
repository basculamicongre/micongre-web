import type { Database } from "@/db/client";
import { literaturePublications, type LiteratureCategory } from "@/db/schema";

// Catálogo de publicaciones desde la Biblioteca de JW.ORG en español. Cada sección lista sus publicaciones de la más nueva a la más
// vieja, 12 por página, y cada una trae su código (`data-pub`), el número si es revista (`data-issue`), el título y la portada.
// El catálogo completo viene precargado (migrations/0080); para mantenerlo al día basta con revisar la primera página de cada
// sección y las revistas del año en curso y el siguiente (el job diario y el botón «Actualizar desde JW.ORG»).

const BASE = "https://www.jw.org/es/biblioteca";

export const JW_SECTIONS: { path: string; category: LiteratureCategory }[] = [
	{ path: "biblia", category: "bible" },
	{ path: "libros", category: "book" },
	{ path: "folletos", category: "brochure" },
	{ path: "tratados", category: "tract" },
];

export interface JwPublication {
	code: string;
	issue: string;
	title: string;
	category: LiteratureCategory;
	imageUrl: string | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const ITEM = /<div class="link" data-pub="([^"]+)"([^>]*)>[\s\S]*?<div class="emailSubject">([\s\S]*?)<\/div>\s*<div class="image">([^<]*)<\/div>/g;

/** Publicaciones de una página de la Biblioteca (sin repetir código + número). */
export function parseLibraryPage(html: string, category: LiteratureCategory): JwPublication[] {
	const seen = new Set<string>();
	const out: JwPublication[] = [];
	for (const m of html.matchAll(ITEM)) {
		const code = m[1].trim();
		const issue = /data-issue="([^"]*)"/.exec(m[2])?.[1] ?? "";
		const title = decode(m[3]).replace(/\s+/g, " ").trim();
		const key = `${code}|${issue}`;
		if (!code || !title || seen.has(key)) continue;
		seen.add(key);
		const image = m[4].trim();
		out.push({ code, issue, title, category, imageUrl: image.startsWith("https://") ? image : null });
	}
	return out;
}

/** Id fijo de una publicación de JW.ORG: el mismo en todas las instalaciones (lo usa también el catálogo precargado). */
export function jwPublicationId(code: string, issue: string): string {
	return `pub_${code}${issue ? `_${issue}` : ""}`;
}

async function fetchPage(url: string): Promise<string> {
	const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MiCongre)", Accept: "text/html" } });
	if (!response.ok) throw new Error(`jw_${response.status}`);
	return response.text();
}

export interface CatalogSyncResult {
	checked: number;
	added: number;
	failed: string[];
}

/** Agrega al catálogo las publicaciones nuevas de JW.ORG (las que ya están no se tocan, por si se corrigieron a mano). */
export async function syncJwCatalog(db: Database, now = new Date()): Promise<CatalogSyncResult> {
	const year = now.getUTCFullYear();
	const pages = [
		...JW_SECTIONS.map((s) => ({ url: `${BASE}/${s.path}/`, category: s.category })),
		{ url: `${BASE}/revistas/?yearFilter=${year}`, category: "magazine" as const },
		{ url: `${BASE}/revistas/?yearFilter=${year + 1}`, category: "magazine" as const },
	];
	const result: CatalogSyncResult = { checked: 0, added: 0, failed: [] };
	const found: JwPublication[] = [];
	await Promise.all(
		pages.map(async (p) => {
			try {
				found.push(...parseLibraryPage(await fetchPage(p.url), p.category));
			} catch {
				result.failed.push(p.url.replace(BASE, ""));
			}
		}),
	);
	result.checked = found.length;
	if (found.length === 0) return result;

	const existing = await db.select({ code: literaturePublications.code, issue: literaturePublications.issue }).from(literaturePublications);
	const have = new Set(existing.map((e) => `${e.code}|${e.issue}`));
	const fresh = found.filter((f) => !have.has(`${f.code}|${f.issue}`)).filter((f, i, all) => all.findIndex((o) => o.code === f.code && o.issue === f.issue) === i);
	// D1 admite hasta 100 parámetros por consulta: de 10 en 10 (7 columnas cada una).
	for (let i = 0; i < fresh.length; i += 10) {
		await db
			.insert(literaturePublications)
			.values(
				fresh.slice(i, i + 10).map((f) => ({
					id: jwPublicationId(f.code, f.issue),
					code: f.code,
					issue: f.issue,
					title: f.title,
					category: f.category,
					imageUrl: f.imageUrl,
					source: "jw" as const,
				})),
			)
			.onConflictDoNothing();
	}
	result.added = fresh.length;
	return result;
}
