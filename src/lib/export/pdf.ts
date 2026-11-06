// Solo cliente: una imagen (PNG) → PDF de una página, sin dependencias (la imagen va como JPEG dentro del PDF).

async function pngToJpeg(png: Blob): Promise<{ bytes: Uint8Array; width: number; height: number }> {
	const bitmap = await createImageBitmap(png);
	const canvas = document.createElement("canvas");
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("render_failed");
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(bitmap, 0, 0);
	const jpeg: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
	if (!jpeg) throw new Error("render_failed");
	return { bytes: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** PDF tamaño carta con la imagen centrada arriba, a un ancho de `widthPt` puntos. */
export async function imageToPdf(png: Blob, widthPt = 420): Promise<Blob> {
	const { bytes, width, height } = await pngToJpeg(png);
	const pageW = 612;
	const pageH = 792;
	const w = widthPt;
	const h = (height / width) * w;
	const x = (pageW - w) / 2;
	const y = pageH - 60 - h;

	const enc = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const offsets: number[] = [];
	let length = 0;
	const push = (data: Uint8Array | string) => {
		const b = typeof data === "string" ? enc.encode(data) : data;
		chunks.push(b);
		length += b.length;
	};
	const object = (n: number, body: string, stream?: Uint8Array) => {
		offsets[n] = length;
		push(`${n} 0 obj\n${body}\n`);
		if (stream) {
			push("stream\n");
			push(stream);
			push("\nendstream\n");
		}
		push("endobj\n");
	};

	const content = enc.encode(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`);
	push("%PDF-1.4\n");
	object(1, "<< /Type /Catalog /Pages 2 0 R >>");
	object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
	object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
	object(4, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`, bytes);
	object(5, `<< /Length ${content.length} >>`, content);

	const xref = length;
	let table = `xref\n0 6\n0000000000 65535 f \n`;
	for (let n = 1; n <= 5; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
	push(table);
	push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

	return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/** PDF de varias páginas, siempre tamaño Carta: cada imagen en su propia página (horizontal si la imagen es más ancha que alta),
 * ajustada al área útil y centrada. Las hojas oficiales dibujadas ya traen sus márgenes, así que van con margen 0. */
export async function imagesToPdf(pngs: Blob[], { margin = 0 }: { margin?: number } = {}): Promise<Blob> {
	const images = [];
	for (const png of pngs) images.push(await pngToJpeg(png));

	const enc = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const offsets: number[] = [];
	let length = 0;
	const push = (data: Uint8Array | string) => {
		const b = typeof data === "string" ? enc.encode(data) : data;
		chunks.push(b);
		length += b.length;
	};
	const object = (n: number, body: string, stream?: Uint8Array) => {
		offsets[n] = length;
		push(`${n} 0 obj\n${body}\n`);
		if (stream) {
			push("stream\n");
			push(stream);
			push("\nendstream\n");
		}
		push("endobj\n");
	};

	// 1 catálogo, 2 páginas; por cada hoja i: página 3+3i, imagen 4+3i, contenido 5+3i.
	const total = 2 + images.length * 3;
	push("%PDF-1.4\n");
	object(1, "<< /Type /Catalog /Pages 2 0 R >>");
	object(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${images.length} >>`);
	for (const [i, img] of images.entries()) {
		const landscape = img.width > img.height;
		const pageW = landscape ? 792 : 612;
		const pageH = landscape ? 612 : 792;
		const availW = pageW - margin * 2;
		const availH = pageH - margin * 2;
		const scale = Math.min(availW / img.width, availH / img.height);
		const w = img.width * scale;
		const h = img.height * scale;
		const x = (pageW - w) / 2;
		const y = pageH - margin - h - (availH - h) / 2;
		const content = enc.encode(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`);
		const n = 3 + i * 3;
		object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`);
		object(n + 1, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`, img.bytes);
		object(n + 2, `<< /Length ${content.length} >>`, content);
	}

	const xref = length;
	let table = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
	for (let n = 1; n <= total; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
	push(table);
	push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
	return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
