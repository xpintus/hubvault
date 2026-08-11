import ODAShipments from '@/pages/operations/ODAShipments';
import RouteMaster from '@/pages/operations/RouteMaster';
import Distributor from '@/pages/public/RouteLoadDistributor';
import { MapPinned, PackageCheck, PackageX } from 'lucide-react';
import { useState } from 'react';

export default function RouteLoadDistributor(){
  const [view,setView]=useState<'distributor'|'oda'|'routes'>('distributor');
  return <div className="space-y-4"><nav className="grid grid-cols-3 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><button onClick={()=>setView('distributor')} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${view==='distributor'?'bg-brand-600 text-white shadow':'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}><PackageCheck className="h-4 w-4"/>Load Distribution</button><button onClick={()=>setView('oda')} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${view==='oda'?'bg-amber-500 text-white shadow':'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}><PackageX className="h-4 w-4"/>ODA Shipments</button><button onClick={()=>setView('routes')} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${view==='routes'?'bg-emerald-600 text-white shadow':'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}><MapPinned className="h-4 w-4"/>Route Master</button></nav><div className={view==='distributor'?'block':'hidden'}><Distributor/></div><div className={view==='oda'?'block':'hidden'}><ODAShipments/></div><div className={view==='routes'?'block':'hidden'}><RouteMaster/></div></div>;
}
