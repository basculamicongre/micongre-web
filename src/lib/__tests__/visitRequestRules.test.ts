import { describe, expect, it } from "vitest";
import { canReassignVisit, initialVisitAssignees } from "@/lib/pastoral/visitRequestRules";

describe("initialVisitAssignees", () => {
	it("sin la configuración queda sin asignar (la asigna el comité)", () => {
		expect(initialVisitAssignees({ byGroupOverseer: false, overseerUserId: "o", publisherId: "p" })).toBeNull();
	});
	it("con la configuración va al superintendente del grupo", () => {
		expect(initialVisitAssignees({ byGroupOverseer: true, overseerUserId: "o", publisherId: "p" })).toEqual(["o"]);
	});
	it("sin superintendente, o si quien pide es el superintendente, va al comité", () => {
		expect(initialVisitAssignees({ byGroupOverseer: true, overseerUserId: null, publisherId: "p" })).toBeNull();
		expect(initialVisitAssignees({ byGroupOverseer: true, overseerUserId: "p", publisherId: "p" })).toBeNull();
	});
});

describe("canReassignVisit", () => {
	const base = { isAdmin: false, isCommittee: false, byGroupOverseer: true, overseerUserId: "o", userId: "o" };
	it("el superintendente del grupo puede con la configuración encendida", () => {
		expect(canReassignVisit(base)).toBe(true);
		expect(canReassignVisit({ ...base, byGroupOverseer: false })).toBe(false);
	});
	it("otro hermano no puede", () => {
		expect(canReassignVisit({ ...base, userId: "x" })).toBe(false);
	});
	it("admin y comité siempre pueden", () => {
		expect(canReassignVisit({ ...base, byGroupOverseer: false, userId: "x", isAdmin: true })).toBe(true);
		expect(canReassignVisit({ ...base, byGroupOverseer: false, userId: "x", isCommittee: true })).toBe(true);
	});
});
