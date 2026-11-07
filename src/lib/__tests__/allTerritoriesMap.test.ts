import { describe, expect, it } from "vitest";
import { allTerritoriesLegend, buildAllTerritoriesMap, TERRITORY_COLORS } from "@/lib/territories/allMaps";
import type { TerritoryMapData } from "@/lib/territories/geo";

const square: TerritoryMapData = {
	type: "FeatureCollection",
	features: [
		{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { fid: "a" } },
		{ type: "Feature", geometry: { type: "Point", coordinates: [10, 10] }, properties: { fid: "b", emoji: "🏠" } },
	],
};
const onlyPoint: TerritoryMapData = {
	type: "FeatureCollection",
	features: [{ type: "Feature", geometry: { type: "Point", coordinates: [5, 5] }, properties: { fid: "p" } }],
};

describe("buildAllTerritoriesMap", () => {
	it("solo polígonos, cada territorio con su color y su número en el centro", () => {
		const map = buildAllTerritoriesMap([
			{ id: "t1", number: "1", mapData: square },
			{ id: "t2", number: "2", mapData: null },
			{ id: "t4", number: "4", mapData: onlyPoint },
			{ id: "t3", number: "3", mapData: square },
		]);
		const label1 = map.features.find((f) => f.properties.fid === "t1:label");
		expect(label1?.geometry).toEqual({ type: "Point", coordinates: [1, 1] });
		expect(label1?.properties).toMatchObject({ kind: "text", text: "1", color: TERRITORY_COLORS[0] });
		// Sin mapa o sin polígonos no aparece ni gasta color; los puntos no se muestran.
		expect(map.features.find((f) => f.properties.fid === "t3:a")?.properties.color).toBe(TERRITORY_COLORS[1]);
		expect(map.features.some((f) => f.properties.fid.startsWith("t2:") || f.properties.fid.startsWith("t4:"))).toBe(false);
		expect(map.features.some((f) => f.properties.fid.endsWith(":b"))).toBe(false);
		expect(map.features).toHaveLength(4);
	});

	it("simbología con número, nombre y el mismo color", () => {
		expect(
			allTerritoriesLegend([
				{ id: "t1", number: "1", name: "Centro", mapData: square },
				{ id: "t4", number: "4", name: "Solo punto", mapData: onlyPoint },
				{ id: "t3", number: "3", name: "  ", mapData: square },
			]),
		).toEqual([
			{ number: "1", name: "Centro", color: TERRITORY_COLORS[0] },
			{ number: "3", name: null, color: TERRITORY_COLORS[1] },
		]);
	});
});
