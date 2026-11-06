import { describe, expect, it } from "vitest";
import { canChangeDepartureAt } from "@/lib/preaching/departureRules";
import { departureText, listDepartures, resolveDeparture, type TerritoryMapData } from "@/lib/territories/geo";

const point = (fid: string, props: Record<string, unknown>) => ({
	type: "Feature" as const,
	geometry: { type: "Point" as const, coordinates: [-86.2, 12.1] as [number, number] },
	properties: { fid, ...props },
});

describe("puntos de salida", () => {
	const data: TerritoryMapData = {
		type: "FeatureCollection",
		features: [
			point("p0", { label: "Casa" }),
			point("p1", { departure: true, label: "Parque", address: "Frente al parque central" }),
			point("p2", { departure: true, label: "Pulpería", departureDefault: true }),
			point("t", { kind: "text", text: "Hola", departure: true }),
		],
	};

	it("varios por territorio; uno predeterminado", () => {
		const list = listDepartures(data);
		expect(list.map((d) => [d.fid, d.isDefault])).toEqual([
			["p1", false],
			["p2", true],
		]);
		expect(resolveDeparture(list, "p1")?.name).toBe("Parque");
		expect(resolveDeparture(list, "borrado")?.fid).toBe("p2");
		expect(resolveDeparture(list, null)?.fid).toBe("p2");
		expect(departureText(list[0])).toBe("Parque — Frente al parque central");
		expect(departureText(list[1])).toBe("Pulpería");
	});

	it("sin marca de predeterminado, el primero; sin puntos, null", () => {
		const list = listDepartures({ type: "FeatureCollection", features: [point("a", { departure: true }), point("b", { departure: true })] });
		expect(list.map((d) => d.isDefault)).toEqual([true, false]);
		expect(list[0].name).toBe("Punto de salida");
		expect(resolveDeparture(listDepartures(null), null)).toBeNull();
	});

	it("se puede cambiar hasta 2 horas después de la hora de la salida", () => {
		expect(canChangeDepartureAt("2026-11-07", "08:00", { date: "2026-11-06", minutes: 23 * 60 })).toBe(true);
		expect(canChangeDepartureAt("2026-11-07", "08:00", { date: "2026-11-07", minutes: 10 * 60 })).toBe(true);
		expect(canChangeDepartureAt("2026-11-07", "08:00", { date: "2026-11-07", minutes: 10 * 60 + 1 })).toBe(false);
		// Una salida a las 23:00 se puede cambiar hasta la 1:00 del día siguiente.
		expect(canChangeDepartureAt("2026-11-07", "23:00", { date: "2026-11-08", minutes: 60 })).toBe(true);
		expect(canChangeDepartureAt("2026-11-07", "23:00", { date: "2026-11-08", minutes: 61 })).toBe(false);
	});
});
