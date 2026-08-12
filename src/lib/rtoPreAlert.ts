import * as XLSX from 'xlsx';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface RTOBagSummary { bagId: string; shipmentCount: number; awbs: string[]; totalValue: number }
export interface RTOPreAlertResult { fileName: string; totalShipments: number; totalValue: number; bags: RTOBagSummary[]; ignoredRows: number }
export interface RTOTripDetails { fileName: string; tripId: string; originHubCode: string; originAddress: string; destinationHubCode: string; destinationAddress: string; dispatchTime: string; movementType: string; transporterName: string; driverName: string; vehicleNumber: string; vehicleType: string; connectionId: string; totalManifests: string; totalShipments: string; totalWeight: string; totalValue: string }

const normalize = (value: unknown) => String(value ?? '').trim();
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const BAG_KEYS = ['bagid','bagnumber','bagno','bag','containerno','containerid','sealbagid'];
const AWB_KEYS = ['awb','awbno','awbnumber','trackingid','trackingnumber','waybill','waybillno','shipmentid','consignmentno'];
const VALUE_KEYS = ['totalamount','shipmentvalue','invoicevalue','amount'];

function findColumn(headers: string[], candidates: string[]) {
  return headers.find((header) => candidates.includes(key(header))) ??
    headers.find((header) => candidates.some((candidate) => key(header).includes(candidate)));
}

export async function parseRTOPreAlertFile(file: File): Promise<RTOPreAlertResult> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Please upload an XLSX, XLS or CSV file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('File size must be 25 MB or less.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The uploaded file has no readable sheet.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) throw new Error('No shipment rows were found in the file.');
  const headers = Object.keys(rows[0]);
  const bagColumn = findColumn(headers, BAG_KEYS);
  const awbColumn = findColumn(headers, AWB_KEYS);
  const valueColumn = findColumn(headers, VALUE_KEYS);
  if (!bagColumn) throw new Error(`Bag ID column not found. Available columns: ${headers.join(', ')}`);

  const grouped = new Map<string, Map<string, number>>();
  let ignoredRows = 0;
  rows.forEach((row, index) => {
    const bagId = normalize(row[bagColumn]);
    const awb = awbColumn ? normalize(row[awbColumn]) : `ROW-${index + 2}`;
    if (!bagId || !awb) { ignoredRows += 1; return; }
    if (!grouped.has(bagId)) grouped.set(bagId, new Map());
    if (!grouped.get(bagId)!.has(awb)) grouped.get(bagId)!.set(awb, Number(valueColumn ? row[valueColumn] : 0) || 0);
  });
  const bags = [...grouped.entries()].map(([bagId, shipments]) => ({ bagId, awbs: [...shipments.keys()], shipmentCount: shipments.size, totalValue: [...shipments.values()].reduce((sum, value) => sum + value, 0) })).sort((a, b) => a.bagId.localeCompare(b.bagId, undefined, { numeric: true }));
  if (!bags.length) throw new Error('No valid Bag ID and shipment records were found.');
  return { fileName: file.name, bags, ignoredRows, totalShipments: bags.reduce((sum, bag) => sum + bag.shipmentCount, 0), totalValue: bags.reduce((sum, bag) => sum + bag.totalValue, 0) };
}

const emptyTrip = (fileName: string): RTOTripDetails => ({ fileName, tripId:'',originHubCode:'',originAddress:'',destinationHubCode:'',destinationAddress:'',dispatchTime:'',movementType:'',transporterName:'',driverName:'',vehicleNumber:'',vehicleType:'',connectionId:'',totalManifests:'',totalShipments:'',totalWeight:'',totalValue:'' });
function tripFromText(text: string, fileName: string) {
  const details = emptyTrip(fileName);
  const compact = text.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
  const labels: Array<[keyof RTOTripDetails, RegExp]> = [
    ['tripId',/Trip\s*ID\s*[:|]?\s*(TR-[A-Z0-9-]+)/i],
    ['originHubCode',/Origin\s*Hub\s*Code\s*[:|]?\s*([A-Z0-9/.-]+)/i],
    ['originAddress',/Origin\s*Address\s*[:|]?\s*(.+?)(?=\s+Dispatch\s*Time\b)/i],
    ['dispatchTime',/Dispatch\s*Time\s*[:|]?\s*(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})/i],
    ['destinationHubCode',/Destination\s*Hub\s*Code\s*[:|]?\s*([A-Z0-9/.-]+)/i],
    ['destinationAddress',/Destination\s*Address\s*[:|]?\s*(.+?)(?=\s+Movement\s*Type\b)/i],
    ['movementType',/Movement\s*Type\s*[:|]?\s*([A-Z0-9_-]+)/i],
    ['transporterName',/Transporter\s*Name\s*[:|]?\s*(.+?)(?=\s+Driver\s*Name\b)/i],
    ['driverName',/Driver\s*Name\s*[:|]?\s*(.+?)(?=\s+Vehicle\s*Number\b)/i],
    ['vehicleNumber',/Vehicle\s*Number\s*[:|]?\s*([A-Z0-9-]+)/i],
    ['vehicleType',/Vehicle\s*Type\s*[:|]?\s*(.+?)(?=\s+Connection\s*ID\b)/i],
    ['connectionId',/Connection\s*ID\s*[:|]?\s*([A-Z0-9-]+)/i],
    ['totalValue',/Total\s*Value\s*[:|]?\s*([\d,.]+)/i],
    ['totalWeight',/Total\s*Weight\s*[:|]?\s*([\d,.]+)/i],
    ['totalManifests',/Total\s*No\.?\s*of\s*Manifests\s*[:|]?\s*(\d+)/i],
    ['totalShipments',/Total\s*No\.?\s*of\s*Shipments\s*[:|]?\s*(\d+)/i],
  ];
  labels.forEach(([field, pattern]) => { const match = compact.match(pattern); if (match) details[field] = normalize(match[1]); });
  const cell = (name: string) => normalize(text.match(new RegExp(`\\[CELL:${name}\\]\\s*([^\\n\\r]+)`, 'i'))?.[1]).replace(/^[^a-z0-9₹]+/i, '');
  const cellValues: Partial<Record<keyof RTOTripDetails, string>> = {
    tripId: cell('tripId'), originHubCode: cell('originHubCode'), originAddress: cell('originAddress'),
    dispatchTime: cell('dispatchTime'), destinationHubCode: cell('destinationHubCode'), destinationAddress: cell('destinationAddress'),
    movementType: cell('movementType'), transporterName: cell('transporterName'), driverName: cell('driverName'),
    vehicleNumber: cell('vehicleNumber'), vehicleType: cell('vehicleType'), connectionId: cell('connectionId'),
    totalValue: cell('totalValue'), totalWeight: cell('totalWeight'), totalManifests: cell('totalManifests'), totalShipments: cell('totalShipments'),
  };
  const validCell: Partial<Record<keyof RTOTripDetails, (value: string) => boolean>> = {
    tripId: (value) => /^TR[-\s]*\d[\d-]{5,}$/i.test(value),
    originHubCode: (value) => /^(?:E?1|I|L)\s*\/\s*[A-Z0-9]+\s*\/\s*\d+\s*\/\s*[A-Z0-9]+$/i.test(value),
    destinationHubCode: (value) => /^[A-Z][A-Z0-9.-]{2,10}$/i.test(value) && !/DETAIL/i.test(value),
    movementType: (value) => /^(RLH|LH|FM|LM|RTO)$/i.test(value),
    transporterName: (value) => value.length >= 4 && !/(DETAIL|NAME|TRANSPORTER)/i.test(value),
    driverName: (value) => value.length >= 4 && !/(DETAIL|NAME|DRIVER)/i.test(value),
    vehicleNumber: (value) => /^[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4}$/i.test(value),
    connectionId: (value) => /^\d{7,12}$/.test(value.replace(/\D/g, '')),
    dispatchTime: (value) => /\d{4}[-/]\d{2}[-/]\d{2}/.test(value),
    totalValue: (value) => /\d/.test(value), totalWeight: (value) => /\d/.test(value),
    totalManifests: (value) => /^\d+$/.test(value), totalShipments: (value) => /^\d+$/.test(value),
    originAddress: (value) => value.length > 12 && !/DETAIL/i.test(value),
    destinationAddress: (value) => value.length > 12 && !/DETAIL/i.test(value),
  };
  Object.entries(cellValues).forEach(([fieldName, value]) => {
    const field = fieldName as keyof RTOTripDetails;
    if (value && (validCell[field]?.(value) ?? true)) details[field] = value;
  });
  // Log10 trip sheets do not always print explicit "Origin/Destination Hub Code"
  // labels. OCR also commonly inserts spaces around slashes and hyphens.
  if (!details.tripId) {
    const match = compact.match(/\bTR\s*[-–—]\s*\d[\d\s-]{5,}\d\b/i);
    if (match) details.tripId = match[0].replace(/\s+/g, '').replace(/[–—]/g, '-').toUpperCase();
  }
  details.tripId = details.tripId.replace(/\s+/g, '').replace(/[–—]/g, '-').toUpperCase();
  if (!details.originHubCode) {
    const match = compact.match(/(?:Route\s*\/\s*Sort\s*Center\s*Movement\s*[:\-]?\s*)?([A-Z]\d\s*\/\s*[A-Z0-9]+\s*\/\s*\d+\s*\/\s*[A-Z0-9]+)\s+(?:Origin(?:\s+Hub)?(?:\s+Code)?|Origin\s+Address)/i);
    if (match) details.originHubCode = match[1].replace(/\s*\/\s*/g, '/').toUpperCase();
  }
  // Frequent OCR confusion in Valmo codes: E1 is read as 1 or El.
  if (/^(?:1|I|L)\/[^/]+\/\d+\//i.test(details.originHubCode)) details.originHubCode = `E1/${details.originHubCode.split('/').slice(1).join('/')}`.toUpperCase();
  if (/^EL\//i.test(details.originHubCode)) details.originHubCode = details.originHubCode.replace(/^EL\//i, 'E1/').toUpperCase();
  if (!details.destinationHubCode) {
    const match = compact.match(/(?:\bto\b|Destination(?:\s+Sort\s+Center)?(?:\s+Hub)?(?:\s+Code)?\s*[:\-]?)\s*([A-Z][A-Z0-9.-]{2,})\s+(?:Destination\s+Address|Movement\s+Type)/i);
    if (match) details.destinationHubCode = match[1].toUpperCase();
  }
  // For LM trip sheets, the destination sort center is normally the second
  // segment of E1/<SORT-CENTER>/<ROUTE>/<HUB> when OCR misses the right column.
  if (!details.destinationHubCode && details.originHubCode.split('/').length >= 4) details.destinationHubCode = details.originHubCode.split('/')[1].toUpperCase();
  if (!details.connectionId) {
    const candidates = [...compact.matchAll(/\b\d{8,12}\b/g)].map((match) => match[0]);
    details.connectionId = candidates.length ? candidates[candidates.length - 1] : '';
  }
  if (!details.vehicleNumber) {
    const match = compact.match(/\b[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4}\b/i);
    if (match) details.vehicleNumber = match[0].replace(/\s+/g, '').toUpperCase();
  }
  details.vehicleNumber = details.vehicleNumber.replace(/\s+/g, '').toUpperCase();
  details.connectionId = details.connectionId.replace(/\D/g, '');
  return details;
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  // Phone screenshots often contain a browser header and a large blank footer.
  // Find the vertical document bounds before upscaling so table text stays large.
  const probe = document.createElement('canvas');
  probe.width = bitmap.width; probe.height = bitmap.height;
  const probeContext = probe.getContext('2d', { willReadFrequently: true });
  if (!probeContext) throw new Error('Image processing is not supported in this browser.');
  probeContext.drawImage(bitmap, 0, 0);
  const probePixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
  const rowHasContent = (y: number) => {
    let dark = 0;
    for (let x = 0; x < probe.width; x += 4) {
      const index = (y * probe.width + x) * 4;
      if ((probePixels[index] + probePixels[index + 1] + probePixels[index + 2]) / 3 < 205) dark += 1;
    }
    return dark >= Math.max(3, Math.floor(probe.width / 120));
  };
  // Exclude the phone navigation/gesture area at the bottom. Otherwise its
  // dark scrollbar is mistaken for document content and shifts every crop.
  let top = 0; let bottom = Math.max(0, Math.floor(bitmap.height * .80));
  while (top < bottom && !rowHasContent(top)) top += 2;
  while (bottom > top && !rowHasContent(bottom)) bottom -= 2;
  // Ignore a dark mobile browser toolbar when a white document begins below it.
  for (let y = top; y < Math.min(bottom, Math.floor(bitmap.height * .35)); y += 2) {
    const index = (y * probe.width + Math.floor(probe.width / 2)) * 4;
    const brightness = (probePixels[index] + probePixels[index + 1] + probePixels[index + 2]) / 3;
    if (brightness > 235) { top = Math.max(0, y - 8); break; }
  }
  top = Math.max(0, top - 12); bottom = Math.min(bitmap.height - 1, bottom + 12);
  const cropHeight = Math.max(1, bottom - top + 1);
  const scale = Math.max(1.5, Math.min(4, 2600 / Math.max(bitmap.width, cropHeight)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(cropHeight * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is not supported in this browser.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, top, bitmap.width, cropHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = .299 * pixels.data[index] + .587 * pixels.data[index + 1] + .114 * pixels.data[index + 2];
    const enhanced = gray < 190 ? Math.max(0, gray * .72) : Math.min(255, gray * 1.08);
    pixels.data[index] = enhanced; pixels.data[index + 1] = enhanced; pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function recognizeImage(image: File | HTMLCanvasElement) {
  const Tesseract = await import('tesseract.js');
  const source = image instanceof File ? await prepareImage(image) : image;
  const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/tesseract`;
  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    workerBlobURL: false,
    gzip: true,
    errorHandler: (error) => console.error('Trip sheet OCR worker error', error),
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
    const result = await worker.recognize(source);
    let text = result.data.text;
    // The supplied Valmo screenshot has a dense transport table in the lower
    // right. A dedicated block pass prevents sparse OCR from skipping it.
    if (source instanceof HTMLCanvasElement) {
      await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
      const panel = await worker.recognize(source, { rectangle: { left: Math.floor(source.width * .48), top: Math.floor(source.height * .43), width: Math.floor(source.width * .5), height: Math.floor(source.height * .55) } });
      text += `\n${panel.data.text}`;
      // Valmo mobile trip sheet: scan every value cell separately. Removing
      // labels, grid borders and barcodes gives OCR enough pixels for small text.
      await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
      const cells: Array<[keyof RTOTripDetails, number, number, number, number]> = [
        ['tripId', .34, .14, .40, .055],
        ['originHubCode', .19, .61, .29, .038], ['originAddress', .19, .645, .29, .07], ['dispatchTime', .19, .705, .29, .038],
        ['totalValue', .19, .77, .29, .038], ['totalWeight', .19, .81, .29, .038], ['totalManifests', .19, .855, .29, .052], ['totalShipments', .19, .925, .29, .052],
        ['destinationHubCode', .62, .61, .35, .038], ['destinationAddress', .62, .635, .35, .07], ['movementType', .62, .695, .35, .038],
        ['transporterName', .62, .735, .35, .038], ['driverName', .62, .77, .35, .038], ['vehicleNumber', .62, .805, .35, .038], ['vehicleType', .62, .835, .35, .038],
        ['connectionId', .67, .925, .28, .06],
      ];
      for (const [field, x, y, width, height] of cells) {
        const result = await worker.recognize(source, { rectangle: { left: Math.floor(source.width * x), top: Math.floor(source.height * y), width: Math.floor(source.width * width), height: Math.floor(source.height * height) } });
        const value = result.data.text.replace(/\s+/g, ' ').trim();
        if (value) text += `\n[CELL:${field}] ${value}`;
      }
    }
    return text;
  } finally { await worker.terminate(); }
}

export async function parseRTOTripDocument(file: File): Promise<RTOTripDetails> {
  if (!/\.(pdf|png|jpe?g|mht|mhtml)$/i.test(file.name)) throw new Error('Please upload a PDF, PNG, JPG, JPEG, MHT or MHTML trip sheet.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Trip sheet image/PDF must be 15 MB or less.');
  let text = '';
  if (/\.(?:mht|mhtml)$/i.test(file.name)) {
    const source = await file.text();
    const htmlStart = source.search(/<!doctype\s+html|<html\b/i);
    const boundary = source.match(/boundary="?([^"\r\n;]+)"?/i)?.[1];
    if (htmlStart < 0) throw new Error('No readable HTML trip sheet was found in this MHT file.');
    let html = source.slice(htmlStart);
    if (boundary) html = html.split(`--${boundary}`)[0];
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style,noscript').forEach((element) => element.remove());
    text = (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim();
  } else if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += `${content.items.map((item) => 'str' in item ? item.str : '').join(' ')}\n`;
      if (text.replace(/\s/g, '').length < 80) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        const context = canvas.getContext('2d'); if (!context) continue;
        await page.render({ canvasContext: context, viewport }).promise;
        text += `${await recognizeImage(canvas)}\n`;
      }
    }
  } else {
    try { text = await recognizeImage(file); }
    catch (cause) {
      console.error('Trip sheet image OCR failed', cause);
      throw new Error('Image OCR could not start. Check your internet once for the OCR language download, then retry with a clear JPG or PNG.');
    }
  }
  if (!text.trim()) throw new Error('No readable text was found in this image. Upload a clear, straight trip-sheet photo.');
  return tripFromText(text.replace(/\r/g, '\n'), file.name);
}

export function buildRTOPreAlertMail(input: { result: RTOPreAlertResult; trip: RTOTripDetails | null; footageLinks: Record<string,string>; hubName: string; dispatchDate: string; recipientName: string; remarks: string; sealNumber?: string }) {
  return buildCompactRTOPreAlertMail(input);
  /* legacy formatter retained below for migration safety
  const date = dispatchDate ? new Date(`${dispatchDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';
  const route = trip ? `${trip.originHubCode} to ${trip.destinationHubCode}` : hubName || 'Hub';
  const subject = `RTO Pre-Alert | ${trip?.tripId || route} | ${result.totalShipments} Shipments`;
  const bagLines = result.bags.map((bag, index) => `${index + 1}. Bag ID: ${bag.bagId} — ${bag.shipmentCount} shipment${bag.shipmentCount === 1 ? '' : 's'}${footageLinks[bag.bagId]?.trim() ? ` — Bagging Footage: ${footageLinks[bag.bagId].trim()}` : ''}`).join('\n');
  const body = `Dear ${recipientName.trim() || 'Team'},

Please find below the RTO shipment pre-alert details dated ${date}.

Trip ID: ${trip?.tripId || 'N/A'}
Route / Sort Center Movement: ${route}
Origin: ${trip ? `${trip.originHubCode} — ${trip.originAddress}` : hubName || 'N/A'}
Destination Sort Center: ${trip ? `${trip.destinationHubCode} — ${trip.destinationAddress}` : 'N/A'}
Dispatch Time: ${trip?.dispatchTime || date}
Movement Type: ${trip?.movementType || 'N/A'}
Connection ID: ${trip?.connectionId || 'N/A'}

Transporter: ${trip?.transporterName || 'N/A'}
Driver: ${trip?.driverName || 'N/A'}
Vehicle: ${trip ? `${trip.vehicleNumber || 'N/A'} (${trip.vehicleType || 'N/A'})` : 'N/A'}

Total Bags: ${result.bags.length}
Total Shipments: ${result.totalShipments}
Total Shipment Value: ₹${result.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
Total Weight: ${trip?.totalWeight || 'N/A'}

Bag-wise Summary:
${bagLines}
${remarks.trim() ? `\nRemarks: ${remarks.trim()}\n` : ''}
The RTO manifest and trip sheet are attached for your reference. Kindly acknowledge receipt and arrange further processing at the destination sort center.

Regards,
${hubName || 'Hub Operations Team'}`;
  return { subject, body };
  */
}

function buildCompactRTOPreAlertMail(input: { result: RTOPreAlertResult; trip: RTOTripDetails | null; footageLinks: Record<string,string>; hubName: string; dispatchDate: string; recipientName: string; remarks: string; sealNumber?: string }) {
  const { result, trip, footageLinks, hubName, dispatchDate, recipientName, remarks, sealNumber = '' } = input;
  const date = dispatchDate ? new Date(`${dispatchDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';
  const route = trip ? `${trip.originHubCode} to ${trip.destinationHubCode}` : hubName || 'Hub';
  const subject = `RTO Pre-Alert | ${trip?.tripId || route} | ${result.totalShipments} Shipments`;
  const rows = result.bags.map((bag) => ({ bag: bag.bagId, count: String(bag.shipmentCount), footage: footageLinks[bag.bagId]?.trim() || '-' }));
  const bagWidth = Math.max(6, ...rows.map((row) => row.bag.length));
  const footageWidth = Math.max(15, ...rows.map((row) => row.footage.length));
  const line = `+${'-'.repeat(bagWidth + 2)}+-----------+${'-'.repeat(footageWidth + 2)}+`;
  const cell = (value: string, width: number) => ` ${value.padEnd(width)} `;
  const table = [line, `|${cell('Bag ID', bagWidth)}|${cell('Shipments', 9)}|${cell('Bagging Footage', footageWidth)}|`, line, ...rows.map((row) => `|${cell(row.bag, bagWidth)}|${cell(row.count, 9)}|${cell(row.footage, footageWidth)}|`), line].join('\n');
  const body = `Dear ${recipientName.trim() || 'Team'},

Please find the RTO pre-alert details dated ${date}.

TRIP DETAILS
Trip ID       : ${trip?.tripId || 'N/A'}
Route         : ${route}
Connection ID : ${trip?.connectionId || 'N/A'}
${sealNumber.trim() ? `Seal Number   : ${sealNumber.trim()}\n` : ''}

TRANSPORTER DETAILS
Transporter   : ${trip?.transporterName || 'N/A'}
Driver        : ${trip?.driverName || 'N/A'}
Vehicle No.   : ${trip?.vehicleNumber || 'N/A'}
Vehicle Type  : ${trip?.vehicleType || 'N/A'}

Total Bags      : ${result.bags.length}
Total Shipments : ${result.totalShipments}

BAG-WISE SHIPMENT SUMMARY
${table}
${remarks.trim() ? `\nRemarks: ${remarks.trim()}\n` : ''}
The RTO manifest and trip sheet are attached for reference. Kindly acknowledge receipt.

Regards,
${hubName || 'Hub Operations Team'}`;
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]!));
  const detail = (label: string, value: string) => `<td style="width:33.33%;padding:14px 16px;border:1px solid #e2e8f0;background:#ffffff"><div style="font-size:10px;line-height:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${escape(label)}</div><div style="margin-top:5px;font-size:14px;line-height:20px;font-weight:700;color:#0f172a">${escape(value || 'N/A')}</div></td>`;
  const bagRows = result.bags.map((bag, index) => { const link = footageLinks[bag.bagId]?.trim(); const safeLink = link && /^https:\/\//i.test(link) ? link : ''; return `<tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'}"><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:700;color:#312e81">${escape(bag.bagId)}</td><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;color:#0f172a">${bag.shipmentCount}</td><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:center">${safeLink ? `<a href="${escape(safeLink)}" style="display:inline-block;padding:7px 12px;border-radius:8px;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700">View Footage</a>` : '<span style="font-size:12px;color:#94a3b8">Not provided</span>'}</td></tr>`; }).join('');
  const html = `<div style="margin:0;background:#f1f5f9;padding:24px 8px;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="max-width:720px;margin:0 auto;overflow:hidden;border:1px solid #dbe4f0;border-radius:18px;background:#ffffff;box-shadow:0 8px 30px rgba(15,23,42,.08)"><div style="padding:28px;background:linear-gradient(135deg,#111827,#312e81 55%,#6d28d9);color:#ffffff"><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c4b5fd"> Operations</div><h1 style="margin:8px 0 4px;font-size:25px;line-height:32px">RTO Pre-Alert</h1><p style="margin:0;color:#ddd6fe;font-size:13px">${escape(date)} &nbsp;•&nbsp; ${escape(route)}</p></div><div style="padding:26px"><p style="margin:0 0 10px;font-size:15px">Dear <strong>${escape(recipientName.trim() || 'Team')}</strong>,</p><p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#475569">Please find below the RTO dispatch pre-alert. The manifest and trip sheet are attached for verification and further processing.</p><div style="margin-bottom:20px;border-radius:14px;background:#eef2ff;padding:16px;text-align:center"><span style="display:inline-block;margin:0 14px"><small style="display:block;color:#6366f1;font-weight:700">TOTAL BAGS</small><strong style="font-size:24px;color:#312e81">${result.bags.length}</strong></span><span style="display:inline-block;margin:0 14px"><small style="display:block;color:#6366f1;font-weight:700">TOTAL SHIPMENTS</small><strong style="font-size:24px;color:#312e81">${result.totalShipments}</strong></span></div><h2 style="margin:0 0 10px;font-size:14px;color:#312e81">Trip & Transport Details</h2><table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden"><tr>${detail('Trip ID',trip?.tripId || 'N/A')}${detail('Route',route)}${detail('Connection ID',trip?.connectionId || 'N/A')}</tr><tr>${detail('Transporter',trip?.transporterName || 'N/A')}${detail('Driver',trip?.driverName || 'N/A')}${detail('Vehicle',`${trip?.vehicleNumber || 'N/A'}${trip?.vehicleType ? ` • ${trip.vehicleType}` : ''}`)}</tr></table><h2 style="margin:24px 0 10px;font-size:14px;color:#312e81">Bag-wise Shipment Summary</h2><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:13px"><thead><tr style="background:#312e81;color:#ffffff"><th style="padding:12px 14px;text-align:left">Bag ID</th><th style="padding:12px 14px;text-align:center">Shipments</th><th style="padding:12px 14px;text-align:center">Bagging Footage</th></tr></thead><tbody>${bagRows}</tbody></table>${remarks.trim() ? `<div style="margin-top:18px;padding:13px 15px;border-left:4px solid #f59e0b;background:#fffbeb;font-size:13px;color:#92400e"><strong>Remarks:</strong> ${escape(remarks.trim())}</div>` : ''}<p style="margin:22px 0 0;font-size:14px;line-height:22px;color:#475569">Kindly acknowledge receipt and confirm further processing.</p><p style="margin:20px 0 0;font-size:14px;line-height:21px">Regards,<br><strong>${escape(hubName || 'Hub Operations Team')}</strong><br><span style="color:#64748b">Hub Operations</span></p></div><div style="padding:13px 24px;background:#0f172a;text-align:center;font-size:10px;color:#94a3b8">Generated securely by HubVault Operations OS</div></div></div>`;
  const brandedHtml = html
    .replace('> Operations</div>', `>LM-DC-${escape(hubName || 'Hub')}</div>`)
    .replace('</table><h2 style="margin:24px', `${sealNumber.trim() ? `<div style="margin-top:12px;padding:12px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0"><span style="font-size:10px;font-weight:700;color:#64748b">SEAL NUMBER</span><strong style="display:block;margin-top:3px;color:#0f172a">${escape(sealNumber.trim())}</strong></div>` : ''}</table><h2 style="margin:24px`);
  return { subject, body, html: brandedHtml };
}
