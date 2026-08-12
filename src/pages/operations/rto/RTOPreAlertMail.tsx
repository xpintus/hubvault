import { Button, Card, Input, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useHub } from '@/lib/hubContext';
import { loadRTOSortCenters, RTOSortCenter } from '@/lib/rtoSortCenters';
import RTOSortCenterDirectory from '@/components/rto/RTOSortCenterDirectory';
import { buildRTOPreAlertMail, parseRTOPreAlertFile, parseRTOTripDocument, RTOTripDetails, RTOPreAlertResult } from '@/lib/rtoPreAlert';
import { CheckCircle2, Clipboard, FileSpreadsheet, Mail, Package, RotateCcw, Send, Settings, Upload, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

export default function RTOPreAlertMail() {
  const { selectedHub, selectedHubId } = useHub();
  const toast = useToast();
  const uploadRef = useRef<HTMLInputElement>(null);
  const tripRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<RTOPreAlertResult | null>(null);
  const [trip, setTrip] = useState<RTOTripDetails | null>(null);
  const [footageLinks, setFootageLinks] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dispatchDate, setDispatchDate] = useState(today());
  const [recipientName, setRecipientName] = useState('Team');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [tab, setTab] = useState<'generator'|'directory'>('generator');
  const [sortCenters, setSortCenters] = useState<RTOSortCenter[]>([]);
  const [sortCenterId, setSortCenterId] = useState('');
  const mail = useMemo(() => result ? buildRTOPreAlertMail({ result, trip, footageLinks, hubName: selectedHub?.name ?? 'Hub', dispatchDate, recipientName, remarks, sealNumber }) : null, [result, trip, footageLinks, selectedHub?.name, dispatchDate, recipientName, remarks, sealNumber]);
  useEffect(() => { void loadRTOSortCenters(selectedHubId).then(setSortCenters).catch(() => setSortCenters([])); }, [selectedHubId]);
  function chooseSortCenter(id: string) { setSortCenterId(id); const center = sortCenters.find((item) => item.id === id); if (center) { setTo(center.toEmail); setCc(center.ccEmail); setRecipientName(center.name); } }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try { setResult(await parseRTOPreAlertFile(file)); toast.success('RTO file analysed successfully'); }
    catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : 'Unable to read the RTO file'); }
    finally { setBusy(false); if (uploadRef.current) uploadRef.current.value = ''; }
  }
  async function uploadTrip(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try { setTrip(await parseRTOTripDocument(file)); toast.success('Trip sheet details extracted'); }
    catch (cause) { setTrip(null); setError(cause instanceof Error ? cause.message : 'Unable to read trip sheet'); }
    finally { setBusy(false); if (tripRef.current) tripRef.current.value = ''; }
  }
  async function copyMail() {
    if (!mail) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mail.html], { type: 'text/html' }), 'text/plain': new Blob([mail.body], { type: 'text/plain' }) })]);
      else await navigator.clipboard.writeText(mail.body);
      toast.success('Professional email copied with formatting');
    } catch { await navigator.clipboard.writeText(mail.body); toast.success('Mail copied'); }
  }
  function openMail() {
    if (!mail) return;
    const params = new URLSearchParams({ subject: mail.subject, body: mail.body });
    if (cc.trim()) params.set('cc', cc.trim());
    window.location.href = `mailto:${to.trim()}?${params.toString()}`;
  }
  function reset() { setResult(null); setTrip(null); setFootageLinks({}); setError(''); setRemarks(''); }

  if (tab === 'directory') return <div className="space-y-5"><div className="flex w-fit gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><button onClick={() => setTab('generator')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-500"><Mail className="h-4 w-4" />Mail Generator</button><button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow"><Settings className="h-4 w-4" />Sort Center Directory</button></div><RTOSortCenterDirectory onChange={setSortCenters} /></div>;

  return <div className="space-y-5">
    <div className="flex w-fit gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow"><Mail className="h-4 w-4" />Mail Generator</button><button onClick={() => setTab('directory')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-500"><Settings className="h-4 w-4" />Sort Center Directory</button></div>
    <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-xl sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-200">RTO communication desk</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">RTO Pre-Alert Mail Generator</h2><p className="mt-2 max-w-2xl text-sm text-indigo-100/70">Upload the RTO file. HubVault will count unique shipments bag-wise and prepare a professional pre-alert mail.</p></div><div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-2xl font-black">{result?.bags.length ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-indigo-200">Bags</p></div><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-2xl font-black">{result?.totalShipments ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-indigo-200">Shipments</p></div></div></div>
    </section>

    {!result ? <Card className="p-5 sm:p-8"><div className="grid gap-4 md:grid-cols-2"><button type="button" onClick={() => uploadRef.current?.click()} disabled={busy} className="flex min-h-60 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-5 text-center transition hover:border-brand-500 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/20"><span className="rounded-2xl bg-brand-600 p-4 text-white shadow-lg"><FileSpreadsheet className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-black">Upload RTO Excel</h3><p className="mt-1 text-sm text-neutral-500">Bag ID, AWB and shipment value</p></button><button type="button" onClick={() => tripRef.current?.click()} disabled={busy} className="flex min-h-60 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-5 text-center transition hover:border-violet-500 dark:border-violet-800 dark:bg-violet-950/20"><span className="rounded-2xl bg-violet-600 p-4 text-white shadow-lg"><Upload className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-black">Upload Trip Sheet</h3><p className="mt-1 text-sm text-neutral-500">PDF, PNG, JPG or JPEG · route and vehicle details</p></button></div><input ref={uploadRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void upload(event.target.files?.[0])} /><input ref={tripRef} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => void uploadTrip(event.target.files?.[0])} />{trip && <p className="mt-4 rounded-xl bg-success-50 p-3 text-sm font-bold text-success-700">Trip loaded: {trip.tripId} · {trip.originHubCode} → {trip.destinationHubCode}</p>}{error && <div className="mt-4 flex items-start gap-2 rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300"><XCircle className="h-4 w-4 shrink-0" />{error}</div>}</Card> : <>
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-3"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /><div><p className="font-black">{result.fileName}</p><p className="text-xs text-neutral-500">{result.bags.length} bags · {result.totalShipments} unique shipments</p></div></div><Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>Reset</Button></div>{!trip && <div className="border-b border-warning-200 bg-warning-50 p-3"><Button size="sm" variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => tripRef.current?.click()}>Add Trip Sheet</Button><input ref={tripRef} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => void uploadTrip(event.target.files?.[0])} /></div>}{trip && <div className="border-b border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900"><p className="font-black">{trip.tripId}: {trip.originHubCode} → {trip.destinationHubCode}</p><p className="mt-1 text-neutral-500">{trip.vehicleNumber} · {trip.driverName} · {trip.transporterName}</p></div>}<div className="max-h-[470px] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-neutral-50 text-left text-[10px] uppercase tracking-wider text-neutral-500 dark:bg-neutral-900"><tr><th className="p-3">#</th><th className="p-3">Bag ID / Footage</th><th className="p-3 text-right">Shipments</th></tr></thead><tbody>{result.bags.map((bag, index) => <tr key={bag.bagId} className="border-t border-neutral-100 align-top dark:border-neutral-800"><td className="p-3 text-neutral-400">{index + 1}</td><td className="p-3"><p className="font-mono font-bold">{bag.bagId}</p><input type="url" value={footageLinks[bag.bagId] ?? ''} onChange={(event) => setFootageLinks((current) => ({ ...current, [bag.bagId]: event.target.value }))} placeholder="Optional Google Drive footage link" className="mt-2 w-full rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-brand-500 dark:border-neutral-700" /></td><td className="p-3 text-right"><span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-black text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Package className="h-3.5 w-3.5" />{bag.shipmentCount}</span><p className="mt-2 text-xs text-neutral-500">₹{bag.totalValue.toLocaleString('en-IN')}</p></td></tr>)}</tbody></table></div>{result.ignoredRows > 0 && <p className="border-t border-warning-200 bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">{result.ignoredRows} incomplete rows were ignored.</p>}</Card>
        <div className="space-y-5"><Card className="p-5"><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Sort Center</label><select value={sortCenterId} onChange={(event) => chooseSortCenter(event.target.value)} className="input-base"><option value="">Select saved sort center</option>{sortCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div><Input label="Seal Number (optional)" value={sealNumber} onChange={(event) => setSealNumber(event.target.value)} placeholder="Enter seal number" /></div></Card><Card className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Input label="To email" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="operations@example.com" /><Input label="CC (optional)" type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="manager@example.com" /><Input label="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /><Input label="Dispatch date" type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} /></div><div className="mt-4"><Textarea label="Additional remarks (optional)" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Vehicle, seal or dispatch details…" /></div></Card>
          {mail && <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-brand-600" /><p className="font-black">Professional Mail Preview</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div><div className="space-y-3 p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Subject</p><p className="mt-1 text-sm font-bold">{mail.subject}</p></div><div className="max-h-[560px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700" dangerouslySetInnerHTML={{ __html: mail.html }} /><p className="text-xs text-neutral-500">Copy Mail preserves the colorful format in Gmail/Outlook. Open Email App uses a clean plain-text version. Attach the RTO files before sending.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" icon={<Clipboard className="h-4 w-4" />} onClick={() => void copyMail()}>Copy Formatted Mail</Button><Button icon={<Send className="h-4 w-4" />} onClick={openMail}>Open Email App</Button></div></div></Card>}
        </div>
      </div>
    </>}
  </div>;
}
