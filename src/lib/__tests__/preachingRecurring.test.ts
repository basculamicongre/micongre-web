import { describe, expect, it } from "vitest";
import { keptTerritories, nextRecurringDate } from "@/lib/preaching/recurring";

describe("predicación recurrente", () => {
	it("la siguiente salida cae el mismo día de la semana, la primera después de hoy", () => {
		expect(nextRecurringDate("2026-11-04", "2026-11-04")).toBe("2026-11-11");
		expect(nextRecurringDate("2026-11-04", "2026-11-05")).toBe("2026-11-11");
		// Si el job no corrió varios días, salta a la próxima semana que todavía no pasó.
		expect(nextRecurringDate("2026-10-21", "2026-11-04")).toBe("2026-11-11");
	});

	it("sigue solo con los territorios que tienen la misma asignación (mismo capitán)", () => {
		const current = new Map([
			["t1", "a1"],
			["t2", "a9"],
		]);
		const rows = [
			{ territoryId: "t1", assignmentId: "a1" },
			{ territoryId: "t2", assignmentId: "a2" },
			{ territoryId: "t3", assignmentId: "a3" },
			{ territoryId: "t4", assignmentId: null },
		];
		expect(keptTerritories(rows, current)).toEqual([{ territoryId: "t1", assignmentId: "a1" }]);
	});
});
