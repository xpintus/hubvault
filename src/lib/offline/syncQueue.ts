import { v4 as uuidv4 } from 'uuid';
import { db, getUserDB, getActiveUserId, SyncQueueItem } from './db';

type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';
type TableName = 'collection_entries' | 'collectors' | 'dues' | 'recoveries' | 'denominations';

export async function addToQueue(
  userId: string,
  hubId: string,
  tableName: TableName,
  operation: OperationType,
  payload: any
): Promise<string> {
  const id = uuidv4();

  const item: SyncQueueItem = {
    id,
    user_id: userId,
    hub_id: hubId,
    table_name: tableName,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    status: 'pending'
  };

  const userDb = getUserDB(userId);
  await userDb.sync_queue.add(item);
  return id;
}

export async function getPendingQueue(targetUserId?: string): Promise<SyncQueueItem[]> {
  const uid = targetUserId || getActiveUserId();
  const userDb = getUserDB(uid);

  // Reset any stale 'syncing' entries back to 'pending'
  await userDb.sync_queue
    .where('status')
    .equals('syncing')
    .modify({ status: 'pending' });

  const items = await userDb.sync_queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('created_at');

  if (uid) {
    return items.filter((item) => item.user_id === uid);
  }
  return items;
}

export async function markQueueStatus(
  id: string,
  status: SyncQueueItem['status'],
  errorMessage?: string,
  targetUserId?: string
): Promise<void> {
  const uid = targetUserId || getActiveUserId();
  const userDb = getUserDB(uid);
  const updateData: Partial<SyncQueueItem> = { status };

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage;
  }

  if (status === 'failed') {
    const item = await userDb.sync_queue.get(id);
    if (item) {
      updateData.retry_count = item.retry_count + 1;
    }
  }

  await userDb.sync_queue.update(id, updateData);
}

export async function removeFromQueue(id: string, targetUserId?: string): Promise<void> {
  const uid = targetUserId || getActiveUserId();
  const userDb = getUserDB(uid);
  await userDb.sync_queue.delete(id);
}

export async function getQueueCount(targetUserId?: string): Promise<number> {
  const uid = targetUserId || getActiveUserId();
  const userDb = getUserDB(uid);
  const items = await userDb.sync_queue
    .where('status')
    .anyOf(['pending', 'failed', 'syncing'])
    .toArray();

  if (uid) {
    return items.filter((item) => item.user_id === uid).length;
  }
  return items.length;
}

export async function clearQueue(targetUserId?: string): Promise<void> {
  const uid = targetUserId || getActiveUserId();
  const userDb = getUserDB(uid);
  await userDb.sync_queue.clear();
}
