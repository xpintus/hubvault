import { v4 as uuidv4 } from 'uuid';
import { db, SyncQueueItem } from './db';

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

  await db.sync_queue.add(item);
  return id;
}

export async function getPendingQueue(): Promise<SyncQueueItem[]> {
  return await db.sync_queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('created_at');
}

export async function markQueueStatus(
  id: string,
  status: SyncQueueItem['status'],
  errorMessage?: string
): Promise<void> {
  const updateData: Partial<SyncQueueItem> = { status };
  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage;
  }

  if (status === 'failed') {
    const item = await db.sync_queue.get(id);
    if (item) {
      updateData.retry_count = item.retry_count + 1;
    }
  }

  await db.sync_queue.update(id, updateData);
}

export async function removeFromQueue(id: string): Promise<void> {
  await db.sync_queue.delete(id);
}

export async function getQueueCount(): Promise<number> {
  return await db.sync_queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .count();
}

export async function clearQueue(): Promise<void> {
    await db.sync_queue.clear();
}
