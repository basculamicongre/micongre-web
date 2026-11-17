// Extrae el catálogo de bosquejos del EPUB oficial S-99a ("Títulos de los
// discursos públicos ordenados por temas"). Igual que src/lib/mwb/parseProgram.ts,
// el EPUB es un ZIP estándar descomprimido en memoria con `fflate` y recorrido
// con expresiones regulares (Cloudflare Workers no trae DOMParser).
//
// Estructura verificada del XHTML principal: una serie de bloques
// `<div class="section">` con un `<h2><strong>CATEGORÍA</strong></h2>` seguido
// de un `<div class="pGroup">` con un `<p>NÚMERO. Título</p>` por bosquejo.
// Las entradas "(No está disponible)" (ediciones anteriores) y "(No usar)" (las nuevas) son números retirados: se devuelven con
// `retired: true` y sin título, para marcar el bosquejo «No usar» al importar.

import { unzipSync } from "fflate";

export interface ParsedTalkOutline {
	number: number;
	category: string;
	/** Vacío si `retired`. */
	title: string;
	/** «(No usar)» o «(No está disponible)» en el S-99a. */
	retired: boolean;
}

const CATEGORY_RE = /<h2[^>]*>(?:<span[^>]*><\/span>)?<strong>([\s\S]*?)<\/strong>\s*<\/h2>/g;
const ENTRY_RE = /<p[^>]*>\s*(\d+)\.\s*([\s\S]*?)<\/p>/g;
const NOT_AVAILABLE_RE = /^\(?\s*(no est[aá] disponible|no usar)\s*\)?\.?$/i;

function stripTags(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function decodeEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export function parseOutlinesFromHtml(html: string): ParsedTalkOutline[] {
	const categories = [...html.matchAll(CATEGORY_RE)].map((m) => ({
		index: m.index ?? 0,
		name: stripTags(m[1]),
	}));
	if (categories.length === 0) return [];

	const outlines: ParsedTalkOutline[] = [];
	for (let i = 0; i < categories.length; i++) {
		const from = categories[i].index;
		const to = categories[i + 1]?.index ?? html.length;
		const section = html.slice(from, to);

		for (const entry of section.matchAll(ENTRY_RE)) {
			const title = stripTags(entry[2]);
			if (!title) continue;
			const retired = NOT_AVAILABLE_RE.test(title);
			outlines.push({ number: Number(entry[1]), category: categories[i].name, title: retired ? "" : title, retired });
		}
	}
	return outlines;
}

export function parseS99aEpub(epubBytes: ArrayBuffer): ParsedTalkOutline[] {
	const files = unzipSync(new Uint8Array(epubBytes));
	const decoder = new TextDecoder("utf-8");

	for (const [name, data] of Object.entries(files)) {
		if (!/\.x?html$/i.test(name) || /cover|toc/i.test(name)) continue;

		const html = decoder.decode(data);
		const outlines = parseOutlinesFromHtml(html);
		if (outlines.length > 0) return outlines;
	}

	return [];
}

/** Pie de página del PDF («S-99a-S 2/26») y números de página sueltos: no son parte de ningún título. */
const PDF_NOISE_RE = /^(S-99a\b.*|\d+\s*\/\s*\d+|\d+)$/i;
const TEXT_ENTRY_RE = /^(\d{1,3})\.\s*(.*)$/;

function isHeadingLine(line: string): boolean {
	return /\p{Lu}/u.test(line) && line === line.toLocaleUpperCase("es") && !/^\d/.test(line);
}

/**
 * La misma lista leída como texto plano, renglón por renglón (lo que sale del PDF del S-99a): las categorías son los renglones en
 * MAYÚSCULAS, cada bosquejo empieza con «N.» y un título largo sigue en el renglón de abajo (se une). Lo de antes de la primera
 * categoría (título e índice) y el pie de página se ignoran.
 */
export function parseS99aText(text: string): ParsedTalkOutline[] {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.replace(/\s+/g, " ").trim())
		.filter(Boolean);
	const outlines: ParsedTalkOutline[] = [];
	let category: string | null = null;
	let last: ParsedTalkOutline | null = null;
	for (const line of lines) {
		if (PDF_NOISE_RE.test(line)) continue;
		const entry = TEXT_ENTRY_RE.exec(line);
		if (entry && category) {
			const title = entry[2].trim();
			const retired = NOT_AVAILABLE_RE.test(title);
			last = { number: Number(entry[1]), category, title: retired ? "" : title, retired };
			outlines.push(last);
			continue;
		}
		if (isHeadingLine(line)) {
			category = line;
			last = null;
			continue;
		}
		if (last && !last.retired) last.title = `${last.title} ${line}`.trim();
	}
	return outlines.filter((o) => o.retired || o.title);
}
