// Texto de un PDF, renglón por renglón, leído en el navegador con pdf.js (se carga solo al usarlo). Solo cliente.

export async function pdfToText(data: ArrayBuffer): Promise<string> {
	const pdfjs = await import("pdfjs-dist");
	pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
	const task = pdfjs.getDocument({ data: new Uint8Array(data) });
	const doc = await task.promise;
	let out = "";
	for (let page = 1; page <= doc.numPages; page++) {
		const content = await (await doc.getPage(page)).getTextContent();
		let lastY: number | null = null;
		for (const item of content.items) {
			if (!("str" in item)) continue;
			const y = item.transform[5];
			// Un cambio de altura es un renglón nuevo aunque pdf.js no lo marque con hasEOL.
			if (lastY !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
			out += item.str;
			if (item.hasEOL) out += "\n";
			lastY = y;
		}
		out += "\n";
	}
	await task.destroy();
	return out;
}
