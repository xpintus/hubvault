import * as XLSX from 'xlsx';

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
export async function parseRTOTripHtml(file: File): Promise<RTOTripDetails> {
  if (!/\.html?$/i.test(file.name)) throw new Error('Please upload the RTO trip HTML file.');
  const document = new DOMParser().parseFromString(await file.text(), 'text/html');
  const details = emptyTrip(file.name);
  const map: Record<string, keyof RTOTripDetails> = {'trip id':'tripId','origin hub code':'originHubCode','origin address':'originAddress','destination hub code':'destinationHubCode','destination address':'destinationAddress','dispatch time':'dispatchTime','movement type':'movementType','transporter name':'transporterName','driver name':'driverName','vehicle number':'vehicleNumber','vehicle type':'vehicleType','connection id':'connectionId','total no. of manifests':'totalManifests','total no. of shipments':'totalShipments','total weight':'totalWeight','total value':'totalValue'};
  document.querySelectorAll('tr').forEach((row) => {
    const cells = [...row.querySelectorAll('th,td')].map((cell) => normalize(cell.textContent));
    for (let index = 0; index < cells.length - 1; index += 1) { const field = map[cells[index].toLowerCase()]; if (field && !details[field]) details[field] = cells[index + 1]; }
  });
  if (!details.tripId || !details.originHubCode || !details.destinationHubCode) throw new Error('Trip ID, origin or destination details could not be found in this HTML file.');
  return details;
}

export function buildRTOPreAlertMail(input: { result: RTOPreAlertResult; trip: RTOTripDetails | null; footageLinks: Record<string,string>; hubName: string; dispatchDate: string; recipientName: string; remarks: string }) {
  const { result, trip, footageLinks, hubName, dispatchDate, recipientName, remarks } = input;
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
}
