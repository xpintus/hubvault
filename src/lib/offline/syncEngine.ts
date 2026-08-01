import { supabase } from '../supabase';
import { getActiveUserId,getUserDB,SyncQueueItem } from './db';
import { getPendingQueue,markQueueStatus,removeFromQueue } from './syncQueue';

export type ConflictAction = 'keep_local' | 'keep_server' | 'merge';

export interface SyncConflict {
  queueItem: SyncQueueItem;
  serverData: any;
  localData: any;
}

// Event listeners for SyncContext
type SyncStatusCallback = (isSyncing: boolean) => void;
type ConflictCallback = (conflict: SyncConflict) => void;

let onSyncStatusChange: SyncStatusCallback | null = null;
let onConflict: ConflictCallback | null = null;
let isSyncing = false;

export function setSyncStatusCallback(cb: SyncStatusCallback) {
  onSyncStatusChange = cb;
}

export function setConflictCallback(cb: ConflictCallback) {
  onConflict = cb;
}

function notifySyncStatus(status: boolean) {
  isSyncing = status;
  if (onSyncStatusChange) {
    onSyncStatusChange(status);
  }
}

export async function processSyncQueue(force = false, userId?: string) {
  if (isSyncing) return;
  if (!navigator.onLine && !force) return;

  const activeUid = userId || getActiveUserId();
  if (!activeUid) return;

  const queue = await getPendingQueue(activeUid);
  if (queue.length === 0) return;

  notifySyncStatus(true);
  try {
    for (const item of queue) {
    if (item.user_id !== activeUid) continue;

    // Exponential backoff based on retry count
    if (item.retry_count > 0 && !force) {
      const backoffMs = Math.min(1000 * Math.pow(2, item.retry_count), 60000);
      const itemTime = new Date(item.last_attempt_at || item.created_at).getTime();
      const elapsed = Date.now() - itemTime;
      if (elapsed < backoffMs) {
        continue; // Skip this item for now
      }
    }

    try {
      await markQueueStatus(item.id, 'syncing', undefined, activeUid);

      // 1. Conflict Detection for UPDATEs
      if (item.operation === 'UPDATE' && item.payload.id) {
        const { data: serverData, error: fetchError } = await supabase
          .from(item.table_name)
          .select('*')
          .eq('id', item.payload.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(`Failed to fetch server data for conflict check: ${fetchError.message}`);
        }

        if (serverData && serverData.updated_at) {
          const serverDate = new Date(serverData.updated_at).getTime();
          const localDate = item.payload.updated_at ? new Date(item.payload.updated_at).getTime() : 0;

          // If server is newer and we have a local timestamp
          if (localDate > 0 && serverDate > localDate) {
            // Conflict found!
            await markQueueStatus(item.id, 'conflict', 'Server data is newer', activeUid);
            if (onConflict) {
              onConflict({ queueItem: item, serverData, localData: item.payload });
            }
            continue;
          }
        }
      }

      // 2. Perform Operation
      let error = null;

      if (item.operation === 'INSERT') {
        const { error: insertError } = await supabase
          .from(item.table_name)
          .insert(item.payload);
        error = insertError;
      } else if (item.operation === 'UPDATE') {
        const { error: updateError } = await supabase
          .from(item.table_name)
          .update(item.payload)
          .eq('id', item.payload.id);
        error = updateError;
      } else if (item.operation === 'DELETE') {
        const { error: deleteError } = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', item.payload.id);
        error = deleteError;
      }

      // 3. Handle Result
      if (error) {
        if (error.code === '23505' && item.operation === 'INSERT') {
          // Duplicate ID, already synced before
          await removeFromQueue(item.id, activeUid);
        } else if (error.code === 'PGRST116' && (item.operation === 'UPDATE' || item.operation === 'DELETE')) {
          // Record doesn't exist on server, clear queue item
          await removeFromQueue(item.id, activeUid);
        } else {
          throw new Error(error.message);
        }
      } else {
        await removeFromQueue(item.id, activeUid);
      }

    } catch (err: any) {
      console.error(`Sync error for item ${item.id}:`, err);
      await markQueueStatus(item.id, 'failed', err.message, activeUid);
    }
    }
  } finally {
    notifySyncStatus(false);
  }
}

export async function resolveConflict(conflict: SyncConflict, action: ConflictAction, mergedPayload?: any) {
  const { queueItem } = conflict;
  const userDb = getUserDB(queueItem.user_id);

  if (action === 'keep_server') {
    // Discard local change
    await removeFromQueue(queueItem.id, queueItem.user_id);

    // Also need to update local Dexie DB with server data
    const dexieTable = (userDb as any)[queueItem.table_name];
    if (dexieTable && conflict.serverData) {
      await dexieTable.put(conflict.serverData);
    }

  } else if (action === 'keep_local' || action === 'merge') {
    // Update the payload and force sync
    const newPayload = { ...(action === 'keep_local' ? queueItem.payload : mergedPayload) };

    // Update local updated_at to ensure it overrides server on next try
    newPayload.updated_at = new Date().toISOString();

    await userDb.sync_queue.update(queueItem.id, {
      payload: newPayload,
      status: 'pending',
      retry_count: 0
    });

    // Update local Dexie DB
    const dexieTable = (userDb as any)[queueItem.table_name];
    if (dexieTable) {
      await dexieTable.put(newPayload);
    }

    // Retry sync
    await processSyncQueue(true, queueItem.user_id);
  }
}

// Network Listeners
export function setupNetworkListeners() {
  const handleOnline = () => {
    console.log('[Offline] Back online. Processing sync queue...');
    void processSyncQueue(true);
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
