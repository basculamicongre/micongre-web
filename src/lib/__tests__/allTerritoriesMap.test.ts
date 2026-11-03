import { describe, expect, it } from "vitest";
import { buildAllTerritoriesMap, TERRITORY_COLORS } from "@/lib/territories/allMaps";
import type { TerritoryMapData } from "@/lib/territories/geo";

const square: TerritoryMapData = {
	type: "FeatureCollection",
	features: [
		{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { fid: "a" } },
		{ type: "Feature", geometry: { type: "Point", coordinates: [10, 10] }, properties: { fid: "b", emoji: "🏠" } },
	],
};

describe("buildAllTerritoriesMap", () => {
	it("colorea cada territorio y pone su número en el centro de sus polígonos", () => {
		const map = buildAllTerritoriesMap([
			{ id: "t1", number: "1", mapData: square },
			{ id: "t2", number: "2", mapData: null },
			{ id: "t3", number: "3", mapData: square },
		]);
		const label1 = map.features.find((f) => f.properties.fid === "t1:label");
		expect(label1?.geometry).toEqual({ type: "Point", coordinates: [1, 1] });
		expect(label1?.properties).toMatchObject({ kind: "text", text: "1", color: TERRITORY_COLORS[0] });
		// El territorio sin mapa no gasta color.
		expect(map.features.find((f) => f.properties.fid === "t3:a")?.properties.color).toBe(TERRITORY_COLORS[1]);
		expect(map.features.some((f) => f.properties.fid.startsWith("t2:"))).toBe(false);
		expect(map.features).toHaveLength(6);
	});
});
