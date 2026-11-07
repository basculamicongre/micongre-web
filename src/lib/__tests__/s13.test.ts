import { describe, expect, it } from "vitest";
import { availableServiceYears, buildS13, s13BlockCount, s13Date, s13Lines, s13Pages, serviceYearLabel, type S13Assignment } from "@/lib/territories/s13";
import { s13Layout, s13PageSvg } from "@/lib/territories/s13Svg";

const T = [
	{ id: "b", number: "10", name: "Centro" },
	{ id: "a", number: "2", name: null },
];
const a = (id: string, territoryId: string, assigneeName: string, assignedOn: string, resolvedOn: string | null, status: S13Assignment["status"]): S13Assignment => ({
	id,
	territoryId,
	assigneeName,
	assignedOn,
	resolvedOn,
	status,
});

describe("S-13 registro de asignación de territorio", () => {
	it("cada salida es una casilla; «se completó» solo el día en que se completó", () => {
		const records = buildS13(
			T,
			[
				a("x0", "a", "Ana", "2025-03-01", "2025-05-10", "completed"), // año anterior: solo da la última fecha
				a("x1", "a", "Beto", "2025-08-15", "2025-10-04", "completed"),
				a("x2", "a", "Carla", "2025-10-10", null, "assigned"),
				a("x3", "b", "Fito", "2026-09-02", null, "assigned"), // año siguiente: no va
			],
			[
				{ territoryId: "a", assignmentId: "x1", date: "2025-09-13" },
				{ territoryId: "a", assignmentId: "x1", date: "2025-09-20" },
				{ territoryId: "a", assignmentId: null, date: "2025-10-04" }, // salida vieja sin asignación: va por fecha
				{ territoryId: "a", assignmentId: "x2", date: "2025-10-11" },
				{ territoryId: "a", assignmentId: "x1", date: "2025-08-30" }, // antes del año
			],
			2025,
		);
		expect(records.map((r) => r.number)).toEqual(["2", "10"]);
		expect(records[0].previousCompleted).toBe("2025-05-10");
		expect(records[0].lastCompleted).toBe("2025-10-04");
		expect(records[0].lastPreached).toBe("2025-10-11"); // la salida de antes del año no cuenta
		expect(records[1].lastPreached).toBeNull();
		// La línea de la asignación completada lleva esa fecha en «Última fecha en que se completó»; la siguiente, vacía.
		expect(s13Lines(records, 4).map((l) => [l.number, l.lastCompleted])).toEqual([
			["2", "2025-10-04"],
			["2", null],
			["10", null],
		]);
		const [beto, carla] = records[0].assignments;
		expect(beto.sessions).toEqual(["2025-09-13", "2025-09-20", "2025-10-04"]);
		expect(beto.blocks).toEqual([
			{ assigneeName: "Beto", preachedOn: "2025-09-13", completedOn: null },
			{ assigneeName: "Beto", preachedOn: "2025-09-20", completedOn: null },
			{ assigneeName: "Beto", preachedOn: "2025-10-04", completedOn: "2025-10-04" },
		]);
		expect(carla.blocks).toEqual([{ assigneeName: "Carla", preachedOn: "2025-10-11", completedOn: null }]);
		expect(records[1].assignments).toEqual([]);
		expect(serviceYearLabel(2025)).toBe("2025 - 2026");
		expect(s13Date("2025-09-03")).toBe("03/09/25");
	});

	it("una asignación que no se completa en el año lleva la última fecha anterior", () => {
		const records = buildS13([T[1]], [a("o", "a", "Ana", "2024-01-01", "2025-06-01", "completed"), a("x", "a", "Beto", "2025-09-01", null, "assigned")], [], 2025);
		expect(s13Lines(records, 4).map((l) => l.lastCompleted)).toEqual(["2025-06-01"]);
	});

	it("sin salidas: una casilla con el nombre y, si se completó, la fecha", () => {
		const [r] = buildS13([T[1]], [a("x", "a", "Ana", "2025-09-01", "2025-09-30", "completed")], [], 2025);
		expect(r.assignments[0].blocks).toEqual([{ assigneeName: "Ana", preachedOn: null, completedOn: "2025-09-30" }]);
	});

	it("columnas: 4 como el formulario, más si hace falta (hasta 8); Carta vertical u horizontal", () => {
		const sessions = Array.from({ length: 6 }, (_, i) => ({ territoryId: "a", assignmentId: "x", date: `2025-10-0${i + 1}` }));
		const records = buildS13(T, [a("x", "a", "Ana", "2025-09-01", null, "assigned")], sessions, 2025);
		expect(s13BlockCount(records)).toBe(6);
		expect(s13BlockCount(buildS13(T, [], [], 2025))).toBe(4);
		expect(s13Layout(4)).toMatchObject({ width: 612, height: 792, linesPerPage: 20 });
		expect(s13Layout(6)).toMatchObject({ width: 792, height: 612, linesPerPage: 14 });
		const lines = s13Lines(records, 4);
		expect(lines.map((l) => [l.number, l.blocks.length, l.continuation])).toEqual([
			["2", 4, false],
			["2", 2, true],
			["10", 0, false],
		]);
		expect(s13Pages(Array.from({ length: 45 }, () => lines[2]), 20).map((p) => p.length)).toEqual([20, 20, 5]);
		expect(s13Pages([], 20)).toEqual([[]]);
		const svg = s13PageSvg(lines, "2025 - 2026", s13Layout(4));
		expect(svg).toContain("REGISTRO DE ASIGNACIÓN DE TERRITORIO");
		expect(svg).toContain('width="612" height="792"');
	});

	it("años que se pueden elegir", () => {
		expect(availableServiceYears([{ assignedOn: "2024-02-01" }], 2026)).toEqual([2026, 2025, 2024, 2023]);
		expect(availableServiceYears([], 2026)).toEqual([2026]);
	});
});
