// Mapa de todos los territorios: junta los dibujos en uno solo, cada territorio con su color y un rótulo con su número en
// el centro de sus polígonos (o de todo su dibujo), para ver de un vistazo qué zonas quedan sin cubrir. Solo para mostrar:
// nunca se guarda.
import { boundsOf, type TerritoryFeature, type TerritoryMapData } from "./geo";

export interface TerritoryMapEntry {
	id: string;
	number: string;
	mapData: TerritoryMapData | null;
}

/** Colores bien distintos entre sí y legibles con texto blanco encima. */
export const TERRITORY_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#c026d3", "#65a30d", "#dc2626", "#0d9488", "#9333ea", "#ea580c"];

export function buildAllTerritoriesMap(entries: TerritoryMapEntry[]): TerritoryMapData {
	const features: TerritoryFeature[] = [];
	entries
		.filter((e) => e.mapData && e.mapData.features.length > 0)
		.forEach((entry, i) => {
			const color = TERRITORY_COLORS[i % TERRITORY_COLORS.length] as string;
			const own = entry.mapData!.features;
			for (const f of own) {
				features.push({ ...f, properties: { ...f.properties, fid: `${entry.id}:${f.properties.fid}`, color } });
			}
			const polygons = own.filter((f) => f.geometry.type === "Polygon");
			const box = boundsOf({ type: "FeatureCollection", features: polygons.length ? polygons : own });
			if (box) {
				features.push({
					type: "Feature",
					geometry: { type: "Point", coordinates: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] },
					properties: { fid: `${entry.id}:label`, kind: "text", text: entry.number, color },
				});
			}
		});
	return { type: "FeatureCollection", features };
}
