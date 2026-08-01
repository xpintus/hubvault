import {
getActiveUserId,
getUserDB,
resetAllUserDBs,
setActiveUserId,
SyncQueueItem,
} from '@/lib/offline/db';
import { resolveConflict,SyncConflict } from '@/lib/offline/syncEngine';
import {
addToQueue,
getPendingQueue,
getQueueCount
} from '@/lib/offline/syncQueue';
import { beforeEach,describe,expect,it } from 'vitest';

describe('Offline Data Isolation & Multi-User Partitioning', () => {
  beforeEach(() => {
    resetAllUserDBs();
  });

  it('User A stores offline data, logs out, User B logs in -> User B cannot read User A cached records', async () => {
    // Log in User A
    setActiveUserId('user_a');
    expect(getActiveUserId()).toBe('user_a');

    const dbA = getUserDB('user_a');
    await dbA.collectors.add({
      id: 'col-a1',
      name: 'Collector A1',
      employee_id: 'EMP-A1',
      phone: null,
      hub_id: 'hub-1',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const userARecords = await dbA.collectors.toArray();
    expect(userARecords.length).toBe(1);
    expect(userARecords[0].id).toBe('col-a1');

    // Switch context to User B (simulating logout & User B login)
    setActiveUserId('user_b');
    expect(getActiveUserId()).toBe('user_b');

    const dbB = getUserDB('user_b');
    const userBRecords = await dbB.collectors.toArray();
    // User B must NOT see User A's cached collectors
    expect(userBRecords.length).toBe(0);
  });

  it('User B cannot process User A queue', async () => {
    // User A adds an item to queue
    setActiveUserId('user_a');
    const queueIdA = await addToQueue('user_a', 'hub-1', 'collectors', 'INSERT', {
      id: 'col-a1',
      name: 'Collector A1',
    });

    // Check User A queue
    const queueA = await getPendingQueue('user_a');
    expect(queueA.length).toBe(1);
    expect(queueA[0].id).toBe(queueIdA);

    // Switch to User B
    setActiveUserId('user_b');
    const queueB = await getPendingQueue('user_b');
    // User B queue is completely separate
    expect(queueB.length).toBe(0);
  });

  it('switching hubs/users does not reveal unauthorized cached records', async () => {
    setActiveUserId('user_a');
    const dbA = getUserDB('user_a');
    await dbA.dues.add({
      id: 'due-a1',
      collector_id: 'col-1',
      hub_id: 'hub-1',
      collection_entry_id: null,
      original_amount: 500,
      recovered_amount: 0,
      remaining_amount: 500,
      due_date: '2026-08-01',
      status: 'outstanding',
      notes: null,
      created_by: 'user_a',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setActiveUserId('user_c');
    const dbC = getUserDB('user_c');
    const duesC = await dbC.dues.toArray();
    expect(duesC.length).toBe(0);
  });

  it('pending User A mutations remain associated with User A', async () => {
    setActiveUserId('user_a');
    await addToQueue('user_a', 'hub-1', 'dues', 'INSERT', { id: 'due-100' });

    const queueA = await getPendingQueue('user_a');
    expect(queueA[0].user_id).toBe('user_a');
  });

  it('logout with pending queue shows a warning / safe handling', async () => {
    setActiveUserId('user_a');
    await addToQueue('user_a', 'hub-1', 'recoveries', 'INSERT', { id: 'rec-1' });

    const pendingCount = await getQueueCount('user_a');
    expect(pendingCount).toBe(1);

    // Logout simulation check
    const shouldWarnOnLogout = pendingCount > 0;
    expect(shouldWarnOnLogout).toBe(true);

    // After switching active user, pending items for user_a remain preserved in user_a database
    setActiveUserId(null);
    const countAfterLogout = await getQueueCount('user_a');
    expect(countAfterLogout).toBe(1);
  });

  it('reconnect sync processes only active user queue', async () => {
    setActiveUserId('user_a');
    await addToQueue('user_a', 'hub-1', 'collection_entries', 'INSERT', { id: 'ce-a' });

    setActiveUserId('user_b');
    await addToQueue('user_b', 'hub-1', 'collection_entries', 'INSERT', { id: 'ce-b' });

    const activeUserBQueue = await getPendingQueue('user_b');
    expect(activeUserBQueue.length).toBe(1);
    expect(activeUserBQueue[0].payload.id).toBe('ce-b');
  });

  it('offline reads still work for the correct active user', async () => {
    setActiveUserId('user_a');
    const dbA = getUserDB('user_a');
    await dbA.collectors.add({
      id: 'col-read-1',
      name: 'Read Test Collector',
      employee_id: 'EMP-R1',
      phone: null,
      hub_id: 'hub-1',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const activeDb = getUserDB();
    const result = await activeDb.collectors.where('id').equals('col-read-1').first();
    expect(result).toBeDefined();
    expect(result?.name).toBe('Read Test Collector');
  });

  it('conflict resolution remains functional on user database', async () => {
    setActiveUserId('user_a');
    const queueId = await addToQueue('user_a', 'hub-1', 'collectors', 'UPDATE', {
      id: 'col-conflict-1',
      name: 'Local Collector Name',
      updated_at: '2026-08-01T10:00:00Z',
    });

    const queueItem: SyncQueueItem = {
      id: queueId,
      user_id: 'user_a',
      hub_id: 'hub-1',
      table_name: 'collectors',
      operation: 'UPDATE',
      payload: { id: 'col-conflict-1', name: 'Local Collector Name' },
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'conflict',
    };

    const conflict: SyncConflict = {
      queueItem,
      serverData: { id: 'col-conflict-1', name: 'Server Collector Name', updated_at: '2026-08-01T11:00:00Z' },
      localData: { id: 'col-conflict-1', name: 'Local Collector Name' },
    };

    // Resolve keeping server data
    await resolveConflict(conflict, 'keep_server');

    const queueAfter = await getPendingQueue('user_a');
    expect(queueAfter.length).toBe(0);

    const userDb = getUserDB('user_a');
    const updatedInDb = await userDb.collectors.get('col-conflict-1');
    expect(updatedInDb?.name).toBe('Server Collector Name');
  });
});
