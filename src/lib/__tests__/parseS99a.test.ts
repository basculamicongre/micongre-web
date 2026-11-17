import { describe, expect, it } from "vitest";
import { parseOutlinesFromHtml, parseS99aText } from "@/lib/publicTalks/parseS99a";

const html = `
<h2 id="p13"><span id="link0"></span><strong>BIBLIA/DIOS</strong></h2>
<div class="pGroup">
<p class="p14">4. El mundo que nos rodea prueba que Dios existe</p>
<p class="p15">26. (No está disponible)</p>
<p class="p16">124. (No usar)</p>
<p class="p17">133. ¿Importa lo que creemos sobre el origen de los seres humanos?</p>
</div>
<h2><strong>REINO/PARAÍSO</strong></h2>
<p>47. (No está disponible)</p>
<p>49. ¿Viviremos algún día en una Tierra limpia?</p>`;

describe("parseS99a", () => {
	it("marca los números retirados de las dos ediciones («No está disponible» y «No usar») sin título", () => {
		expect(parseOutlinesFromHtml(html)).toEqual([
			{ number: 4, category: "BIBLIA/DIOS", title: "El mundo que nos rodea prueba que Dios existe", retired: false },
			{ number: 26, category: "BIBLIA/DIOS", title: "", retired: true },
			{ number: 124, category: "BIBLIA/DIOS", title: "", retired: true },
			{ number: 133, category: "BIBLIA/DIOS", title: "¿Importa lo que creemos sobre el origen de los seres humanos?", retired: false },
			{ number: 47, category: "REINO/PARAÍSO", title: "", retired: true },
			{ number: 49, category: "REINO/PARAÍSO", title: "¿Viviremos algún día en una Tierra limpia?", retired: false },
		]);
	});

	it("lee el texto del PDF: ignora el índice y el pie, une los títulos partidos en dos renglones", () => {
		const text = [
			"Títulos de los discursos públicos",
			"ordenados por temas",
			"Biblia/Dios",
			"Reino/Paraíso",
			"BIBLIA/DIOS",
			"4. El mundo que nos rodea prueba que Dios existe",
			"76. ¿Pueden los principios bíblicos ayudarnos a afrontar los problemas de nuestro",
			"tiempo?",
			"124. (No usar)",
			"S-99a-S 2/26",
			"REINO/PARAÍSO",
			"171. Usted puede disfrutar de la vida en paz ahora y para",
			"siempre",
			"3",
		].join("\n");
		expect(parseS99aText(text)).toEqual([
			{ number: 4, category: "BIBLIA/DIOS", title: "El mundo que nos rodea prueba que Dios existe", retired: false },
			{ number: 76, category: "BIBLIA/DIOS", title: "¿Pueden los principios bíblicos ayudarnos a afrontar los problemas de nuestro tiempo?", retired: false },
			{ number: 124, category: "BIBLIA/DIOS", title: "", retired: true },
			{ number: 171, category: "REINO/PARAÍSO", title: "Usted puede disfrutar de la vida en paz ahora y para siempre", retired: false },
		]);
	});
});
