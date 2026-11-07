import { describe, expect, it } from "vitest";
import { assignmentKind, buildCalendarItems, monthRange, overlaps } from "@/lib/calendar/build";

describe("calendario", () => {
	it("rango del mes y traslape de lo que dura varios días", () => {
		expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
		expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
		expect(overlaps({ date: "2026-10-30", dateEnd: "2026-11-02" }, "2026-11-01", "2026-11-30")).toBe(true);
		expect(overlaps({ date: "2026-10-30" }, "2026-11-01", "2026-11-30")).toBe(false);
	});

	it("tipo de cada asignación", () => {
		expect(assignmentKind("midweek")).toBe("assignment");
		expect(assignmentKind("operational")).toBe("assignment");
		expect(assignmentKind("cleaning")).toBe("cleaning");
		expect(assignmentKind("outgoing_talk")).toBe("talk");
		expect(assignmentKind("preaching")).toBeNull();
		expect(assignmentKind("territory")).toBeNull();
	});

	it("junta eventos, reuniones y asignaciones del mes, en orden", () => {
		const items = buildCalendarItems("2026-11", {
			events: [
				{ title: "Visita del superintendente", startDate: "2026-11-17", endDate: "2026-11-22" },
				{ title: "Viejo", startDate: "2026-10-01", endDate: "2026-10-01" },
			],
			meetings: [
				{ date: "2026-11-19", time: "19:00", type: "midweek" },
				{ date: "2026-12-03", time: "19:00", type: "midweek" },
			],
			assignments: [
				{ date: "2026-11-19", meetingType: "midweek", label: "Lectura de la Biblia", time: "19:00" },
				{ date: "2026-11-19", meetingType: "preaching", label: "Predicación" },
				{ date: "2026-11-23", dateEnd: "2026-11-29", meetingType: "cleaning", label: "Limpieza profunda" },
			],
		});
		expect(items.map((i) => [i.date, i.kind, i.title])).toEqual([
			["2026-11-17", "event", "Visita del superintendente"],
			["2026-11-19", "meeting", "Reunión de entre semana"],
			["2026-11-19", "assignment", "Lectura de la Biblia"],
			["2026-11-23", "cleaning", "Limpieza profunda"],
		]);
		expect(items[0].dateEnd).toBe("2026-11-22");
	});
});
