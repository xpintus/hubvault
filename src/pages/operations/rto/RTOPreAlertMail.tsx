import { Button, Card, Input, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useHub } from '@/lib/hubContext';
import { buildRTOPreAlertMail, parseRTOPreAlertFile, RTOPreAlertResult } from '@/lib/rtoPreAlert';
import { CheckCircle2, Clipboard, FileSpreadsheet, Mail, Package, RotateCcw, Send, Upload, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

export default function RTOPreAlertMail() {
  const { selectedHub } = useHub();
  const toast = useToast();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<RTOPreAlertResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dispatchDate, setDispatchDate] = useState(today());
  const [recipientName, setRecipientName] = useState('Team');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [remarks, setRemarks] = useState('');
  const mail = useMemo(() => result ? buildRTOPreAlertMail({ result, hubName: selectedHub?.name ?? 'Hub', dispatchDate, recipientName, remarks }) : null, [result, selectedHub?.name, dispatchDate, recipientName, remarks]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try { setResult(await parseRTOPreAlertFile(file)); toast.success('RTO file analysed successfully'); }
    catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : 'Unable to read the RTO file'); }
    finally { setBusy(false); if (uploadRef.current) uploadRef.current.value = ''; }
  }
  async function copyMail() {
    if (!mail) return;
    await navigator.clipboard.writeText(`Subject: ${mail.subject}\n\n${mail.body}`);
    toast.success('Mail copied');
  }
  function openMail() {
    if (!mail) return;
    const params = new URLSearchParams({ subject: mail.subject, body: mail.body });
    if (cc.trim()) params.set('cc', cc.trim());
    window.location.href = `mailto:${to.trim()}?${params.toString()}`;
  }
  function reset() { setResult(null); setError(''); setRemarks(''); }

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-xl sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-200">RTO communication desk</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">RTO Pre-Alert Mail Generator</h2><p className="mt-2 max-w-2xl text-sm text-indigo-100/70">Upload the RTO file. HubVault will count unique shipments bag-wise and prepare a professional pre-alert mail.</p></div><div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-2xl font-black">{result?.bags.length ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-indigo-200">Bags</p></div><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-2xl font-black">{result?.totalShipments ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-indigo-200">Shipments</p></div></div></div>
    </section>

    {!result ? <Card className="p-5 sm:p-8"><button type="button" onClick={() => uploadRef.current?.click()} disabled={busy} className="flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-5 text-center transition hover:border-brand-500 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/20"><span className="rounded-2xl bg-brand-600 p-4 text-white shadow-lg"><Upload className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-black">{busy ? 'Reading RTO file…' : 'Upload RTO file'}</h3><p className="mt-1 text-sm text-neutral-500">XLSX, XLS or CSV · Bag ID and AWB columns are detected automatically</p></button><input ref={uploadRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void upload(event.target.files?.[0])} />{error && <div className="mt-4 flex items-start gap-2 rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300"><XCircle className="h-4 w-4 shrink-0" />{error}</div>}</Card> : <>
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-3"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /><div><p className="font-black">{result.fileName}</p><p className="text-xs text-neutral-500">{result.bags.length} bags · {result.totalShipments} unique shipments</p></div></div><Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>Reset</Button></div><div className="max-h-[470px] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-neutral-50 text-left text-[10px] uppercase tracking-wider text-neutral-500 dark:bg-neutral-900"><tr><th className="p-3">#</th><th className="p-3">Bag ID</th><th className="p-3 text-right">Shipments</th></tr></thead><tbody>{result.bags.map((bag, index) => <tr key={bag.bagId} className="border-t border-neutral-100 dark:border-neutral-800"><td className="p-3 text-neutral-400">{index + 1}</td><td className="p-3 font-mono font-bold">{bag.bagId}</td><td className="p-3 text-right"><span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-black text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Package className="h-3.5 w-3.5" />{bag.shipmentCount}</span></td></tr>)}</tbody></table></div>{result.ignoredRows > 0 && <p className="border-t border-warning-200 bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">{result.ignoredRows} incomplete rows were ignored.</p>}</Card>
        <div className="space-y-5"><Card className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Input label="To email" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="operations@example.com" /><Input label="CC (optional)" type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="manager@example.com" /><Input label="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /><Input label="Dispatch date" type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} /></div><div className="mt-4"><Textarea label="Additional remarks (optional)" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Vehicle, seal or dispatch details…" /></div></Card>
          {mail && <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800"><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-brand-600" /><p className="font-black">Mail Preview</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div><div className="space-y-3 p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Subject</p><p className="mt-1 text-sm font-bold">{mail.subject}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Message</p><pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 font-sans text-sm leading-6 dark:bg-neutral-900">{mail.body}</pre></div><p className="text-xs text-neutral-500">Your email app will open with this draft. Attach the uploaded RTO file before sending.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" icon={<Clipboard className="h-4 w-4" />} onClick={() => void copyMail()}>Copy Mail</Button><Button icon={<Send className="h-4 w-4" />} onClick={openMail}>Open Email App</Button></div></div></Card>}
        </div>
      </div>
    </>}
  </div>;
}
