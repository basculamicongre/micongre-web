import { describe, expect, it } from "vitest";
import { PRIVILEGE_GROUPS, groupPrivileges } from "@/lib/rbac/privilegeGroups";
import { PRIVILEGE_CODES } from "@/lib/rbac/roles";

describe("grupos de privilegios", () => {
	it("en el orden definido, sin grupos vacíos y lo desconocido en «Otros»", () => {
		const groups = groupPrivileges([
			{ code: "zz_new", name: "Nuevo" },
			{ code: "mic_2", name: "Micrófono 2" },
			{ code: "accounts_admin", name: "Cuentas de usuarios" },
			{ code: "mic_1", name: "Micrófono 1" },
		]);
		expect(groups.map((g) => [g.label, g.items.map((i) => i.code)])).toEqual([
			["Administrar", ["accounts_admin"]],
			["Operativo", ["mic_1", "mic_2"]],
			["Otros", ["zz_new"]],
		]);
	});

	it("cada código aparece una sola vez y todos los conocidos están", () => {
		const all = PRIVILEGE_GROUPS.flatMap((g) => g.codes);
		expect(new Set(all).size).toBe(all.length);
		for (const code of Object.values(PRIVILEGE_CODES)) expect(all).toContain(code);
	});
});
