import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/export/builders/meetingDates";

const month = (date: string) => parseRange(new URLSearchParams({ date, scope: "month" }));

describe("parseRange (mes = semanas cuyo lunes cae en el mes)", () => {
	it("la semana del lunes 30 de noviembre de 2026 cuenta en noviembre", () => {
		const nov = month("2026-11-30");
		expect(nov).toMatchObject({ from: "2026-11-02", to: "2026-12-06", label: "noviembre de 2026", slug: "2026-11" });
		// El sábado 5 de diciembre de esa semana queda en noviembre, no en diciembre.
		expect(month("2026-12-07")).toMatchObject({ from: "2026-12-07", to: "2027-01-03" });
	});

	it("un mes que empieza en lunes empieza ese día", () => {
		expect(month("2027-02-10")).toMatchObject({ from: "2027-02-01", to: "2027-02-28" });
	});

	it("la semana sigue siendo de lunes a domingo", () => {
		expect(parseRange(new URLSearchParams({ date: "2026-12-03", scope: "week" }))).toMatchObject({ from: "2026-11-30", to: "2026-12-06" });
	});
});
