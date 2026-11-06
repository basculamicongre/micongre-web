import { assertCanAccessTerritoriesModule } from "@/lib/rbac/guards";
import { loadTerritoryRecord, parseRecordParams } from "@/lib/territories/record";
import { s13BlockCount, s13Lines, s13Pages, serviceYearLabel } from "@/lib/territories/s13";
import { s13Layout, s13PageSvg } from "@/lib/territories/s13Svg";
import type { BuilderContext } from "../registry";
import type { ReportDoc } from "../types";

/** S-13 con el formato oficial en tamaño Carta: una hoja (SVG) por página; en imagen, un PNG por hoja; en PDF, una página por hoja. */
export async function buildS13({ db, session, params }: BuilderContext): Promise<ReportDoc> {
	assertCanAccessTerritoriesModule(session);
	const { serviceYear, kind } = parseRecordParams(params);
	const data = await loadTerritoryRecord(db, serviceYear, kind);
	const label = serviceYearLabel(data.serviceYear);
	const layout = s13Layout(s13BlockCount(data.records));
	const pages = s13Pages(s13Lines(data.records, layout.blocks), layout.linesPerPage);
	return {
		title: "Registro de asignación de territorio",
		fileName: `S-13 ${data.serviceYear}-${data.serviceYear + 1}${kind === "public_preaching" ? " predicacion publica" : ""}`,
		bare: true,
		theme: "plain",
		blocks: pages.map((lines) => ({ type: "svg", svg: s13PageSvg(lines, label, layout), width: layout.width, height: layout.height, standalone: true })),
	};
}
