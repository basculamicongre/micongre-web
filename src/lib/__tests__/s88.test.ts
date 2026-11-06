import { describe, expect, it } from "vitest";
import { buildS88Rows } from "@/lib/coVisit/s88";

describe("consolidado S-88", () => {
	it("total, promedio por reunión registrada y reuniones celebradas", () => {
		const rows = buildS88Rows(
			[
				{ periodYear: 2026, periodMonth: 10, meetingType: "weekend", meetingsRecorded: 4, totalInPerson: 300, totalZoom: 41 },
				{ periodYear: 2026, periodMonth: 10, meetingType: "midweek", meetingsRecorded: 3, totalInPerson: 250, totalZoom: 20 },
			],
			[
				{ periodYear: 2026, periodMonth: 10, meetingType: "midweek", count: 4 },
				{ periodYear: 2026, periodMonth: 10, meetingType: "weekend", count: 4 },
				{ periodYear: 2026, periodMonth: 11, meetingType: "midweek", count: 2 },
			],
		);
		expect(rows.map((r) => [r.periodMonth, r.meetingType])).toEqual([
			[11, "midweek"],
			[10, "midweek"],
			[10, "weekend"],
		]);
		expect(rows[1]).toMatchObject({ held: 4, recorded: 3, total: 270, average: 90 });
		expect(rows[2]).toMatchObject({ held: 4, recorded: 4, total: 341, average: 85 });
		// Mes con reuniones pero sin asistencia registrada: aparece en cero, sin promedio.
		expect(rows[0]).toMatchObject({ held: 2, recorded: 0, total: 0, average: null });
	});
});
