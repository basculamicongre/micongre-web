// Mapa de todos los territorios: junta los dibujos en uno solo, pero SOLO los polígonos de cada territorio (con su color) y un rótulo
// con su número en el centro de sus polígonos, para ver de un vistazo qué zonas quedan sin cubrir. Los puntos, líneas y textos de cada
// territorio no se muestran aquí. Solo para mostrar: nunca se guarda.
import { boundsOf, type TerritoryFeature, type TerritoryMapData } from "./geo";

export interface TerritoryMapEntry {
	id: string;
	number: string;
	name?: string | null;
	mapData: TerritoryMapData | null;
}

/** Fila de la simbología (lista de números y nombres) al exportar el mapa. */
export interface LegendEntry {
	number: string;
	name: string | null;
	color: string;
}

/** Colores bien distintos entre sí y legibles con texto blanco encima. */
export const TERRITORY_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#c026d3", "#65a30d", "#dc2626", "#0d9488", "#9333ea", "#ea580c"];

/** Territorios con al menos un polígono, cada uno con su color (en el orden recibido). */
function withPolygons(entries: TerritoryMapEntry[]) {
	return entries
		.map((e) => ({ entry: e, polygons: (e.mapData?.features ?? []).filter((f) => f.geometry.type === "Polygon") }))
		.filter((x) => x.polygons.length > 0)
		.map((x, i) => ({ ...x, color: TERRITORY_COLORS[i % TERRITORY_COLORS.length] as string }));
}

export function buildAllTerritoriesMap(entries: TerritoryMapEntry[]): TerritoryMapData {
	const features: TerritoryFeature[] = [];
	for (const { entry, polygons, color } of withPolygons(entries)) {
		for (const f of polygons) {
			features.push({ ...f, properties: { fid: `${entry.id}:${f.properties.fid}`, color } });
		}
		const box = boundsOf({ type: "FeatureCollection", features: polygons });
		if (box) {
			features.push({
				type: "Feature",
				geometry: { type: "Point", coordinates: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] },
				properties: { fid: `${entry.id}:label`, kind: "text", text: entry.number, color },
			});
		}
	}
	return { type: "FeatureCollection", features };
}

/** Simbología del mapa de todos los territorios: número, nombre y color de cada uno (los mismos colores del mapa). */
export function allTerritoriesLegend(entries: TerritoryMapEntry[]): LegendEntry[] {
	return withPolygons(entries).map(({ entry, color }) => ({ number: entry.number, name: entry.name?.trim() || null, color }));
}
