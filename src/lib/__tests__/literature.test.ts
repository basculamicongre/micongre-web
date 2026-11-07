import { describe, expect, it } from "vitest";
import { jwPublicationId, parseLibraryPage } from "@/lib/literature/jwCatalog";
import { inventoryTotals, isOfferOpen, publicationCode, publicationLabel, summarizeOffer } from "@/lib/literature/rules";

// Fragmento con la misma estructura que la Biblioteca de JW.ORG (una publicación se repite: la portada y la descripción).
const item = (pub: string, title: string, image: string, issue = "") => `
	<div class="link" data-pub="${pub}"${issue ? ` data-issue="${issue}"` : ""} data-wtlocale="S" >
	</div>
	<div class="language" data-use-default-language-name="true">español</div>
	<div class="emailSubject">
		${title}
	</div>
	<div class="image">${image}</div>`;

const PAGE = `<div class="pagination">Resultados 1 - 12 de 60</div>
	${item("t-fam", "¿Cómo podemos tener una familia feliz?", "https://cms-imgp.jw-cdn.org/img/p/t-fam/S/pt/t-fam_S_lg.jpg")}
	${item("t-fam", "¿Cómo podemos tener una familia feliz?", "https://cms-imgp.jw-cdn.org/img/p/t-fam/S/pt/t-fam_S_lg.jpg")}
	${item("co-inv26", "Invitación para la asamblea regional &amp; más", "")}
	${item("wp26", "LA ATALAYA ¿Es posible alcanzar la paz mundial?", "https://cms-imgp.jw-cdn.org/img/p/wp/202609/S/pt/wp_S_202609_lg.jpg", "2026-09")}`;

describe("catálogo de JW.ORG", () => {
	it("lee código, número, título y portada sin repetir", () => {
		const items = parseLibraryPage(PAGE, "tract");
		expect(items.map((i) => [i.code, i.issue])).toEqual([
			["t-fam", ""],
			["co-inv26", ""],
			["wp26", "2026-09"],
		]);
		expect(items[1].title).toBe("Invitación para la asamblea regional & más");
		expect(items[1].imageUrl).toBeNull();
		expect(items[0].imageUrl).toMatch(/^https:\/\//);
	});

	it("id fijo, igual al del catálogo precargado", () => {
		expect(jwPublicationId("lff", "")).toBe("pub_lff");
		expect(jwPublicationId("w26", "2026-11")).toBe("pub_w26_2026-11");
	});
});

describe("solicitudes de literatura", () => {
	it("código para mostrar", () => {
		expect(publicationCode("wp26", "2026-09")).toBe("wp26 · 09/2026");
		expect(publicationCode("lff", "")).toBe("lff");
		expect(publicationLabel({ code: "lff", issue: "", title: "Disfrute" })).toBe("lff — Disfrute");
	});

	it("se ve desde que se envía hasta la fecha de fin, inclusive", () => {
		expect(isOfferOpen({ endsOn: "2026-11-20", notified: false }, "2026-11-10")).toBe(false);
		expect(isOfferOpen({ endsOn: "2026-11-20", notified: true }, "2026-11-20")).toBe(true);
		expect(isOfferOpen({ endsOn: "2026-11-20", notified: true }, "2026-11-21")).toBe(false);
	});

	it("arma la lista: sí con cantidad y total, no, sin responder; conserva a quien ya no es destinatario", () => {
		const recipients = [
			{ userId: "a", fullName: "Ana", groupName: "Norte" },
			{ userId: "b", fullName: "Beto", groupName: "Centro" },
			{ userId: "c", fullName: "Carla", groupName: null },
			{ userId: "d", fullName: "Dina", groupName: "Centro" },
		];
		const s = summarizeOffer(
			recipients,
			[
				{ userId: "a", answer: "yes", quantity: 2 },
				{ userId: "b", answer: "yes", quantity: 1 },
				{ userId: "c", answer: "no", quantity: 0 },
				{ userId: "x", answer: "yes", quantity: 3 },
			],
			new Map([["x", { userId: "x", fullName: "Xavier", groupName: null }]]),
		);
		// Por grupo y luego por nombre; los sin grupo al final.
		expect(s.yes.map((r) => [r.fullName, r.quantity])).toEqual([
			["Beto", 1],
			["Ana", 2],
			["Xavier", 3],
		]);
		expect(s.total).toBe(6);
		expect(s.no.map((r) => r.fullName)).toEqual(["Carla"]);
		expect(s.pending.map((r) => r.fullName)).toEqual(["Dina"]);
	});
});

describe("inventario", () => {
	it("total por publicación en todas las ubicaciones", () => {
		const t = inventoryTotals([
			{ publicationId: "p1", locationId: "l1", quantity: 5 },
			{ publicationId: "p1", locationId: "l2", quantity: 3 },
			{ publicationId: "p2", locationId: "l1", quantity: 0 },
		]);
		expect(t.get("p1")).toBe(8);
		expect(t.get("p2")).toBe(0);
	});
});
