import React from 'react';
import { useSync } from '@/lib/offline/SyncContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { formatTimeShort } from '@/lib/format';

export default function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useSync();

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 mx-2 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>
        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            onClick={syncNow}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title="Sync Now"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {isSyncing ? (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Syncing...
          </div>
        ) : pendingCount > 0 ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3 h-3" />
            {pendingCount} unsynced change{pendingCount !== 1 && 's'}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            All synced
            {lastSyncTime && ` (${formatTimeShort(lastSyncTime.toISOString())})`}
          </div>
        )}
      </div>
    </div>
  );
}
