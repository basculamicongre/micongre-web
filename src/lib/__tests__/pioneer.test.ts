import { describe, expect, it } from "vitest";
import { isoWeekday, joinNames, nextWeekday, progressMonths, reminderBody, reportPrefill, serviceYearOptions, studyReminders, sumHours } from "@/lib/pioneer/rules";

describe("precursorado: días", () => {
	it("día de la semana ISO", () => {
		expect(isoWeekday("2026-11-09")).toBe(1); // lunes
		expect(isoWeekday("2026-11-08")).toBe(7); // domingo
		expect(nextWeekday(7)).toBe(1);
		expect(nextWeekday(3)).toBe(4);
	});
});

describe("precursorado: informe", () => {
	it("suma solo las horas del mes y cuenta los estudios activos y progresivos", () => {
		const prefill = reportPrefill(
			[
				{ entryDate: "2026-10-31", hours: 3 },
				{ entryDate: "2026-11-01", hours: 2.5 },
				{ entryDate: "2026-11-15", hours: 0.25 },
				{ entryDate: "2026-11-30", hours: 4 },
				{ entryDate: "2026-12-01", hours: 5 },
			],
			[{ status: "active" }, { status: "progressive" }, { status: "return_visit" }, { status: "finished" }],
			2026,
			11,
		);
		expect(prefill).toEqual({ hours: 6.75, bibleStudies: 2 });
		expect(sumHours([{ hours: 0.1 }, { hours: 0.2 }])).toBe(0.3);
	});
});

describe("precursorado: aviso del día anterior", () => {
	it("avisa hoy de los estudios de mañana, sin los terminados ni los sin día", () => {
		// 2026-11-09 es lunes: mañana martes (2).
		const map = studyReminders(
			[
				{ userId: "a", name: "Luis", status: "active", weekday: 2 },
				{ userId: "a", name: "Ana", status: "return_visit", weekday: 2 },
				{ userId: "a", name: "Marta", status: "finished", weekday: 2 },
				{ userId: "b", name: "Pedro", status: "progressive", weekday: 3 },
				{ userId: "b", name: "Sin día", status: "active", weekday: null },
			],
			"2026-11-09",
		);
		expect([...map.entries()]).toEqual([["a", ["Ana", "Luis"]]]);
		expect(reminderBody(["Ana", "Luis"], 2)).toBe("Mañana (martes) toca visitar a Ana y Luis.");
		// El domingo avisa los del lunes.
		expect(studyReminders([{ userId: "a", name: "Ana", status: "active", weekday: 1 }], "2026-11-08").get("a")).toEqual(["Ana"]);
	});

	it("une nombres en español", () => {
		expect(joinNames(["Ana"])).toBe("Ana");
		expect(joinNames(["Ana", "Luis", "Marta"])).toBe("Ana, Luis y Marta");
	});
});

describe("precursorado: progreso del año de servicio", () => {
	it("septiembre a agosto: el informe si ya existe; si no, lo anotado", () => {
		const { months, total } = progressMonths(
			2026,
			[{ periodYear: 2026, periodMonth: 9, hours: 50, projectHours: 5 }],
			[
				{ entryDate: "2026-09-10", hours: 3 }, // ya hay informe de septiembre: no se suma
				{ entryDate: "2026-11-02", hours: 2.5 },
				{ entryDate: "2027-08-31", hours: 1 },
				{ entryDate: "2027-09-01", hours: 9 }, // otro año de servicio
			],
		);
		expect(months).toHaveLength(12);
		expect(months[0]).toEqual({ year: 2026, month: 9, reported: 55, logged: 3, hours: 55 });
		expect(months[2]).toMatchObject({ year: 2026, month: 11, reported: null, hours: 2.5 });
		expect(months[11]).toMatchObject({ year: 2027, month: 8, hours: 1 });
		expect(total).toBe(58.5);
	});

	it("años para el selector", () => {
		expect(serviceYearOptions(2026, [null])).toEqual([2026]);
		expect(serviceYearOptions(2026, ["2025-03-01", "2026-10-01"])).toEqual([2026, 2025, 2024]);
	});
});
