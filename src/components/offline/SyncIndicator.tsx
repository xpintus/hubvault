import { formatTimeShort } from '@/lib/format';
import { useSync } from '@/lib/offline/SyncContext';
import { clsx } from 'clsx';
import { AlertCircle,RefreshCw,Wifi,WifiOff } from 'lucide-react';
import { useState } from 'react';

export default function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useSync();
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setPopoverOpen((prev) => !prev)}
        className={clsx(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-95',
          !isOnline
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            : isSyncing
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            : pendingCount > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-[var(--card-bg)] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
        )}
        title={!isOnline ? 'Offline Mode' : isSyncing ? 'Syncing...' : pendingCount > 0 ? `${pendingCount} unsynced changes` : 'All synced'}
      >
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
        ) : pendingCount > 0 ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        )}

        <span className="hidden sm:inline">
          {!isOnline
            ? 'Offline'
            : isSyncing
            ? 'Syncing'
            : pendingCount > 0
            ? `${pendingCount} Unsynced`
            : 'Synced'}
        </span>
      </button>

      {popoverOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--card-bg)] shadow-dropdown border border-neutral-200 dark:border-neutral-800 p-4 text-xs z-50 animate-scale-in origin-top-right space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200">
              {isOnline ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
              {isOnline ? 'Network Connected' : 'Offline Mode Active'}
            </div>
            {isOnline && (
              <button
                onClick={() => { syncNow(); setPopoverOpen(false); }}
                disabled={isSyncing}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
                title="Sync Now"
              >
                <RefreshCw className={clsx('w-4 h-4', isSyncing && 'animate-spin')} />
              </button>
            )}
          </div>

          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {!isOnline
              ? 'Changes you make will be saved to your device and automatically synced when connection is restored.'
              : pendingCount > 0
              ? `${pendingCount} change${pendingCount > 1 ? 's are' : ' is'} waiting to sync to server.`
              : 'All offline changes have been synchronized.'}
          </p>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-neutral-500">
            <span>Last Sync:</span>
            <span className="font-mono">{lastSyncTime ? formatTimeShort(lastSyncTime.toISOString()) : 'Never'}</span>
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => { syncNow(); setPopoverOpen(false); }}
              disabled={isSyncing}
              className="w-full mt-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2 transition active:scale-95"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
