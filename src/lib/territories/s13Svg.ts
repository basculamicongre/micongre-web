// Dibujo (SVG) de una hoja del S-13 con la distribución del formulario oficial, en tamaño Carta (puntos): número, última fecha
// en que se completó y las casillas «Asignado a» (nombre arriba; abajo, fecha en que se predicó y fecha en que se completó).
// Con 4 o 5 casillas va vertical; con más, horizontal.
import { s13Date, type S13Line } from "./s13";

export interface S13Layout {
	width: number;
	height: number;
	blocks: number;
	linesPerPage: number;
}

const MARGIN = 36;
const NUM_W = 36;
const LAST_W = 63;
const ROW_H = 30.5;
const FONT = "Helvetica, Arial, sans-serif";

/** Carta vertical (612×792) hasta 5 casillas; horizontal (792×612) con más. */
export function s13Layout(blocks: number): S13Layout {
	const landscape = blocks > 5;
	const width = landscape ? 792 : 612;
	const height = landscape ? 612 : 792;
	const body = landscape ? 127 : 141;
	return { width, height, blocks, linesPerPage: Math.floor((height - body - 40) / ROW_H) };
}

function esc(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function text(x: number, y: number, value: string, size: number, opts: { bold?: boolean; anchor?: "start" | "middle" } = {}): string {
	if (!value) return "";
	return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="${FONT}" font-size="${size.toFixed(2)}" ${opts.bold ? 'font-weight="bold" ' : ""}text-anchor="${opts.anchor ?? "middle"}" fill="#000">${esc(value)}</text>`;
}

const line = (x1: number, y1: number, x2: number, y2: number, w: number) =>
	`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#000" stroke-width="${w}"/>`;

/** Tamaño de letra para que un texto quepa en `width` puntos (Helvetica ≈ 0,5 em por carácter). */
function fitSize(value: string, width: number, max: number): number {
	return Math.max(4.5, Math.min(max, width / (Math.max(value.length, 1) * 0.5)));
}

/** Una hoja con `layout.linesPerPage` líneas (las que falten quedan en blanco). */
export function s13PageSvg(lines: S13Line[], serviceYearText: string, layout: S13Layout): string {
	const { width: W, height: H, blocks: N, linesPerPage } = layout;
	const landscape = W > H;
	const L = MARGIN;
	const R = W - MARGIN;
	const NUM_R = L + NUM_W;
	const LAST_R = NUM_R + LAST_W;
	const GW = (R - LAST_R) / N;
	const TOP = landscape ? 90 : 104;
	const HEAD_MID = TOP + 18;
	const BODY = TOP + (landscape ? 37 : 37);
	const BOTTOM = BODY + ROW_H * linesPerPage;
	const dateSize = Math.min(8.5, (GW / 2 - 4) / 4.2);

	const out: string[] = [];
	out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`);
	out.push(text(W / 2, TOP - 44, "REGISTRO DE ASIGNACIÓN DE TERRITORIO", 13.5, { bold: true }));
	out.push(text(L + 1, TOP - 12, "Año de servicio:", 10.5, { bold: true, anchor: "start" }));
	out.push(line(L + 98, TOP - 10, L + 176, TOP - 10, 0.8));
	out.push(text(L + 137, TOP - 13, serviceYearText, 10.5, { bold: true }));

	// Encabezado gris.
	out.push(`<rect x="${L}" y="${TOP}" width="${R - L}" height="${BODY - TOP}" fill="#d9d9d9"/>`);
	out.push(text((L + NUM_R) / 2, TOP + 14, "Núm.", 7.5), text((L + NUM_R) / 2, TOP + 23, "de terr.", 7.5));
	out.push(text((NUM_R + LAST_R) / 2, TOP + 9, "Última fecha", 7.5), text((NUM_R + LAST_R) / 2, TOP + 18, "en que se", 7.5), text((NUM_R + LAST_R) / 2, TOP + 27, "completó*", 7.5));
	const subSize = Math.min(6.3, (GW / 2 - 2) / 6.2);
	for (let g = 0; g < N; g++) {
		const x = LAST_R + g * GW;
		out.push(text(x + GW / 2, TOP + 12.5, "Asignado a", 8));
		for (const [i, label] of ["se asignó", "se completó"].entries()) {
			const cx = x + GW / 4 + (i * GW) / 2;
			out.push(text(cx, HEAD_MID + 8, "Fecha en que", subSize), text(cx, HEAD_MID + 15.5, label, subSize));
		}
		out.push(line(x, HEAD_MID, x + GW, HEAD_MID, 0.5));
		out.push(line(x + GW / 2, HEAD_MID, x + GW / 2, BODY, 0.5));
	}

	// Filas.
	for (let r = 0; r < linesPerPage; r++) {
		const y0 = BODY + r * ROW_H;
		const mid = y0 + ROW_H / 2;
		const row = lines[r];
		for (let g = 0; g < N; g++) {
			const x = LAST_R + g * GW;
			out.push(line(x, mid, x + GW, mid, 0.5));
			out.push(line(x + GW / 2, mid, x + GW / 2, y0 + ROW_H, 0.5));
			const b = row?.blocks[g];
			if (!b) continue;
			out.push(text(x + GW / 2, mid - 4.3, b.assigneeName, fitSize(b.assigneeName, GW - 12, 9)));
			out.push(text(x + GW / 4, y0 + ROW_H - 4.6, s13Date(b.preachedOn), dateSize));
			out.push(text(x + (GW * 3) / 4, y0 + ROW_H - 4.6, s13Date(b.completedOn), dateSize));
		}
		if (row) {
			out.push(text((L + NUM_R) / 2, mid + 4, row.number, fitSize(row.number, NUM_W - 6, 11), { bold: true }));
			out.push(text((NUM_R + LAST_R) / 2, mid + 3, s13Date(row.lastCompleted), 9));
		}
		if (r > 0) out.push(line(L, y0, R, y0, 1.4));
	}

	// Rejilla: columnas y marco.
	out.push(line(NUM_R, TOP, NUM_R, BOTTOM, 0.6));
	for (let g = 0; g <= N; g++) out.push(line(LAST_R + g * GW, TOP, LAST_R + g * GW, BOTTOM, 1.4));
	out.push(line(L, BODY, R, BODY, 1.6));
	out.push(`<rect x="${L}" y="${TOP}" width="${R - L}" height="${BOTTOM - TOP}" fill="none" stroke="#000" stroke-width="2"/>`);

	out.push(text(L, BOTTOM + 13, "*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.", 7.6, { anchor: "start" }));
	out.push(text(L, BOTTOM + 27, "S-13-S", 7.6, { anchor: "start" }));

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${out.join("")}</svg>`;
}
