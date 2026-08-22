import * as mupdf from 'mupdf';

/**
 * Generates an in-memory sample multi-page assessment PDF with embedded diagrams
 * (raster images and vector-drawn geometric/circuit setups) for testing.
 */
export function generateSamplePdfWithImages(): Uint8Array {
	const doc = new mupdf.PDFDocument();
	const font = doc.addSimpleFont(new mupdf.Font('Helvetica'));

	// 1. Circuit diagram test pattern (120x80)
	const px1 = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 120, 80], false);
	px1.clear(0x2563eb); // blue base
	const pixels1 = px1.getPixels();
	for (let y = 30; y < 50; y++) {
		for (let x = 0; x < 120; x++) {
			const idx = (y * 120 + x) * 3;
			pixels1[idx] = 0xf5; // R
			pixels1[idx + 1] = 0x9e; // G
			pixels1[idx + 2] = 0x0b; // B (amber)
		}
	}
	const img1 = new mupdf.Image(px1);
	const imgObj1 = doc.addImage(img1);

	// 2. Thermodynamic cycle diagram (100x100)
	const px2 = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 100, 100], false);
	px2.clear(0x10b981); // emerald green
	const img2 = new mupdf.Image(px2);
	const imgObj2 = doc.addImage(img2);

	// 3. Sensor plot diagram (90x90)
	const px3 = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 90, 90], false);
	px3.clear(0xe11d48); // rose red
	const img3 = new mupdf.Image(px3);
	const imgObj3 = doc.addImage(img3);

	// Page 1: Questions 1 & 2 with DiagramA & FigureB + Vector Coordinate System
	const p1 = doc.addPage(
		[0, 0, 595, 842],
		0,
		{
			Font: { F0: font },
			XObject: { DiagramA: imgObj1, FigureB: imgObj2 },
		},
		`
BT /F0 16 Tf 50 780 Td (ADVANCED PHYSICS ASSESSMENT - SECTION A) Tj ET
BT /F0 11 Tf 50 745 Td (Question 1: Consider the high-frequency circuit schematic illustrated in Diagram A below.) Tj ET
BT /F0 11 Tf 50 730 Td (Determine the equivalent impedance across terminals X and Y under resonant frequency conditions.) Tj ET
q 240 0 0 140 50 560 cm /DiagramA Do Q
BT /F0 10 Tf 50 540 Td (Figure A.1: Dual-stage resonant tank circuit topology.) Tj ET
BT /F0 11 Tf 50 480 Td (Question 2: Refer to the thermodynamic state indicator shown in Figure B.) Tj ET
BT /F0 11 Tf 50 465 Td (Calculate the entropy generation rate and total heat rejected during cycle C-D in kiloJoules.) Tj ET
q 160 0 0 140 50 300 cm /FigureB Do Q
BT /F0 10 Tf 50 280 Td (Figure B.2: Non-equilibrium thermodynamic cycle profile.) Tj ET

% Vector Geometry Diagram on Page 1 (Free-body / coordinate axes)
q 1.5 w 0 0 0 RG
70 120 m 200 120 l S
70 120 m 70 230 l S
200 120 m 192 125 l 192 115 l 200 120 l f
70 230 m 65 222 l 75 222 l 70 230 l f
70 120 m 170 200 l S
170 200 m 160 198 l 166 190 l 170 200 l f
90 120 20 0 45 re S
120 160 30 25 re S
Q
BT /F0 10 Tf 50 100 Td (Figure A.3: Vector force resolution diagram (drawn via PDF vector paths).) Tj ET
`
	);
	doc.insertPage(-1, p1);

	// Page 2: Question 3 (Text with geometric vector polygon)
	const p2 = doc.addPage(
		[0, 0, 595, 842],
		0,
		{
			Font: { F0: font },
		},
		`
BT /F0 16 Tf 50 780 Td (ADVANCED PHYSICS ASSESSMENT - SECTION B) Tj ET
BT /F0 11 Tf 50 740 Td (Question 3: A particle of mass m moves under a central force potential V(r) = -k/r^2.) Tj ET
BT /F0 11 Tf 50 720 Td (Derive the effective radial potential and establish the criterion for closed bounded orbits.) Tj ET
BT /F0 11 Tf 50 690 Td (Demonstrate all Lagrangian equations of motion and conservation of angular momentum steps.) Tj ET

% Vector Diagram: Incline plane & mass
q 2 w 0.2 0.2 0.2 RG
80 480 m 280 480 l 280 580 l 80 480 l S
160 520 40 30 re 0.1 0.4 0.8 rg f
q 1.5 w 0.8 0.1 0.1 RG 180 535 m 180 450 l S 180 450 m 175 458 l 185 458 l 180 450 l f Q
q 1.5 w 0.1 0.7 0.2 RG 180 535 m 240 570 l S 240 570 m 230 568 l 235 560 l 240 570 l f Q
Q
BT /F0 10 Tf 80 430 Td (Figure B.1: Inclined plane friction model with normal and gravitational vectors.) Tj ET
`
	);
	doc.insertPage(-1, p2);

	// Page 3: Question 4 with SensorPlot
	const p3 = doc.addPage(
		[0, 0, 595, 842],
		0,
		{
			Font: { F0: font },
			XObject: { SensorPlot: imgObj3 },
		},
		`
BT /F0 16 Tf 50 780 Td (ADVANCED PHYSICS ASSESSMENT - SECTION C) Tj ET
BT /F0 11 Tf 50 745 Td (Question 4: Analyze the semiconductor sensor calibration curve depicted in SensorPlot.) Tj ET
BT /F0 11 Tf 50 730 Td (Determine the linear sensitivity range and calculate the temperature coefficient of resistance.) Tj ET
q 180 0 0 140 50 560 cm /SensorPlot Do Q
BT /F0 10 Tf 50 540 Td (Figure C.1: Piezo-resistive transducer response across cryogenic temperature sweep.) Tj ET
`
	);
	doc.insertPage(-1, p3);

	const pdfBuffer = doc.saveToBuffer('');
	const outputBytes = new Uint8Array(pdfBuffer.asUint8Array());

	// Cleanup WebAssembly memory
	px1.destroy();
	img1.destroy();
	px2.destroy();
	img2.destroy();
	px3.destroy();
	img3.destroy();
	pdfBuffer.destroy();
	doc.destroy();

	return outputBytes;
}
