import { describe, expect, it } from "vitest";
import { parseWeekStartFromTitle } from "@/lib/mwb/parseProgram";

describe("parseWeekStartFromTitle (encabezados de semana de la guía mwb)", () => {
	it("semana dentro de un mes", () => {
		expect(parseWeekStartFromTitle("21-27 de diciembre", "202611")).toBe("2026-12-21");
	});

	it("semana que cruza de mes", () => {
		expect(parseWeekStartFromTitle("30 de noviembre a 6 de diciembre", "202611")).toBe("2026-11-30");
		expect(parseWeekStartFromTitle("26 de enero a 1 de febrero", "202601")).toBe("2026-01-26");
	});

	it("semana que cruza el año: el encabezado trae los años", () => {
		expect(parseWeekStartFromTitle("28 de diciembre de 2026 a 3 de enero de 2027", "202611")).toBe("2026-12-28");
		expect(parseWeekStartFromTitle("29 de diciembre de 2025 a 4 de enero de 2026", "202511")).toBe("2025-12-29");
	});

	it("encabezado que no es de una semana", () => {
		expect(parseWeekStartFromTitle("Índice", "202611")).toBeNull();
	});
});
