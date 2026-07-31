import React, { useState } from 'react';
import { useSync } from '@/lib/offline/SyncContext';
import { resolveConflict } from '@/lib/offline/syncEngine';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { AlertTriangle, Server, Smartphone, GitMerge } from 'lucide-react';
import { formatDateLong } from '@/lib/format';

export default function ConflictResolver() {
  const { currentConflict, clearConflict } = useSync();
  const [resolving, setResolving] = useState(false);

  if (!currentConflict) return null;

  const { serverData, localData, queueItem } = currentConflict;

  const handleResolve = async (action: 'keep_local' | 'keep_server' | 'merge') => {
    setResolving(true);
    try {
      // Basic merge: prefer server data but keep local non-conflicting fields
      const mergedPayload = action === 'merge' ? { ...serverData, ...localData } : undefined;
      await resolveConflict(currentConflict, action, mergedPayload);
      clearConflict();
    } catch (e) {
      console.error("Conflict resolution failed", e);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal open={true} onClose={() => {}} title="Sync Conflict Detected">
      <div className="p-4 space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Record was modified by someone else</p>
            <p>The record you are trying to update has been changed on the server since you went offline. Please choose which version to keep.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Server className="w-4 h-4 text-blue-500" />
              Server Version
            </div>
            <pre className="text-xs overflow-auto max-h-40 bg-slate-50 dark:bg-slate-900 p-2 rounded">
              {JSON.stringify(serverData, null, 2)}
            </pre>
            <p className="text-xs text-slate-500 mt-2">
              Updated: {serverData.updated_at ? formatDateLong(serverData.updated_at) : 'Unknown'}
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              Your Offline Version
            </div>
            <pre className="text-xs overflow-auto max-h-40 bg-slate-50 dark:bg-slate-900 p-2 rounded">
              {JSON.stringify(localData, null, 2)}
            </pre>
             <p className="text-xs text-slate-500 mt-2">
              Updated: {localData.updated_at ? formatDateLong(localData.updated_at) : 'Unknown'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            onClick={() => handleResolve('keep_server')}
            disabled={resolving}
            className="justify-start"
          >
            <Server className="w-4 h-4 mr-2" />
            Keep Server Version (Discard my changes)
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('keep_local')}
            disabled={resolving}
            className="justify-start"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Keep My Version (Overwrite server)
          </Button>
          <Button
            variant="primary"
            onClick={() => handleResolve('merge')}
            disabled={resolving}
            className="justify-start"
          >
            <GitMerge className="w-4 h-4 mr-2" />
            Merge (Keep my changes, add missing server data)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
