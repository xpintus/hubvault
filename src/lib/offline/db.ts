import Dexie, { Table } from 'dexie';
import { CollectionEntry, Collector, Due, Recovery, DenominationInput, Party, PartyTransaction } from '@/types';

// Extend types to include offline tracking fields
export interface OfflineCollectionEntry extends CollectionEntry {
  client_id?: string;
  created_offline?: boolean;
}

export interface OfflineCollector extends Collector {
  client_id?: string;
  created_offline?: boolean;
}

export interface OfflineDue extends Due {
  client_id?: string;
  created_offline?: boolean;
}

export interface OfflineRecovery extends Recovery {
  client_id?: string;
  created_offline?: boolean;
}

export interface OfflineDenomination extends DenominationInput {
  id: string;
  collection_entry_id: string;
  client_id?: string;
  created_offline?: boolean;
  updated_at?: string;
}

export interface OfflineParty extends Party {
  client_id?: string;
  created_offline?: boolean;
}

export interface OfflinePartyTransaction extends PartyTransaction {
  client_id?: string;
  created_offline?: boolean;
}

export interface SyncQueueItem {
  id: string; // client generated UUID for the queue item
  user_id: string;
  hub_id: string;
  table_name: 'collection_entries' | 'collectors' | 'dues' | 'recoveries' | 'denominations' | 'parties' | 'party_transactions';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  created_at: string;
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error_message?: string;
}

// In-memory fallback for Node.js / test environments where IndexedDB is not available
class InMemoryTable<T extends { id: string }, Key = string> {
  private data = new Map<string, T>();

  async add(item: T): Promise<Key> {
    this.data.set(item.id, { ...item });
    return item.id as unknown as Key;
  }

  async put(item: T): Promise<Key> {
    this.data.set(item.id, { ...item });
    return item.id as unknown as Key;
  }

  async get(id: string): Promise<T | undefined> {
    const item = this.data.get(id);
    return item ? { ...item } : undefined;
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async toArray(): Promise<T[]> {
    return Array.from(this.data.values()).map((v) => ({ ...v }));
  }

  where(field: string) {
    const getItems = () => Array.from(this.data.values());
    return {
      equals: (val: any) => ({
        first: async () => getItems().find((i: any) => i[field] === val),
        modify: async (changes: any) => {
          getItems().forEach((i: any) => {
            if (i[field] === val) {
              Object.assign(i, changes);
              this.data.set(i.id, i);
            }
          });
        },
        toArray: async () => getItems().filter((i: any) => i[field] === val),
      }),
      anyOf: (vals: any[]) => ({
        sortBy: async (_sortField: string) =>
          getItems()
            .filter((i: any) => vals.includes(i[field]))
            .sort((a: any, b: any) => String(a[_sortField] || '').localeCompare(String(b[_sortField] || ''))),
        count: async () => getItems().filter((i: any) => vals.includes(i[field])).length,
        toArray: async () => getItems().filter((i: any) => vals.includes(i[field])),
      }),
    };
  }
}

const isIndexedDbSupported = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

export class HubVaultDB extends Dexie {
  collection_entries!: Table<OfflineCollectionEntry, string>;
  collectors!: Table<OfflineCollector, string>;
  dues!: Table<OfflineDue, string>;
  recoveries!: Table<OfflineRecovery, string>;
  denominations!: Table<OfflineDenomination, string>;
  parties!: Table<OfflineParty, string>;
  party_transactions!: Table<OfflinePartyTransaction, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor(dbName = 'HubVaultDB_default') {
    super(dbName);
    this.version(1).stores({
      collection_entries: 'id, collection_date, collector_id, hub_id, status, client_id, updated_at',
      collectors: 'id, employee_id, hub_id, status, client_id, updated_at',
      dues: 'id, collector_id, hub_id, status, client_id, updated_at',
      recoveries: 'id, collector_id, hub_id, due_id, client_id, updated_at',
      denominations: 'id, collection_entry_id, client_id, updated_at',
      sync_queue: 'id, user_id, hub_id, table_name, operation, status, created_at'
    });

    // KhataBook added two object stores after the original database shipped.
    // A Dexie schema change must increment the version or existing browsers keep
    // the v1 schema and `db.parties` / `db.party_transactions` fail at runtime.
    this.version(2).stores({
      collection_entries: 'id, collection_date, collector_id, hub_id, status, client_id, updated_at',
      collectors: 'id, employee_id, hub_id, status, client_id, updated_at',
      dues: 'id, collector_id, hub_id, status, client_id, updated_at',
      recoveries: 'id, collector_id, hub_id, due_id, client_id, updated_at',
      denominations: 'id, collection_entry_id, client_id, updated_at',
      parties: 'id, hub_id, name, mobile, client_id, updated_at',
      party_transactions: 'id, party_id, hub_id, transaction_date, client_id, updated_at',
      sync_queue: 'id, user_id, hub_id, table_name, operation, status, created_at'
    });

    if (!isIndexedDbSupported) {
      (this as any).collection_entries = new InMemoryTable<OfflineCollectionEntry>();
      (this as any).collectors = new InMemoryTable<OfflineCollector>();
      (this as any).dues = new InMemoryTable<OfflineDue>();
      (this as any).recoveries = new InMemoryTable<OfflineRecovery>();
      (this as any).denominations = new InMemoryTable<OfflineDenomination>();
      (this as any).parties = new InMemoryTable<OfflineParty>();
      (this as any).party_transactions = new InMemoryTable<OfflinePartyTransaction>();
      (this as any).sync_queue = new InMemoryTable<SyncQueueItem>();
    }
  }

  async clearUserOfflineData() {
    await Promise.all([
      this.collection_entries.clear(),
      this.collectors.clear(),
      this.dues.clear(),
      this.recoveries.clear(),
      this.denominations.clear(),
      this.parties.clear(),
      this.party_transactions.clear(),
      this.sync_queue.clear()
    ]);
  }
}

let activeUserId: string | null = null;
const userDbMap = new Map<string, HubVaultDB>();

export function setActiveUserId(uid: string | null) {
  activeUserId = uid;
}

export function getActiveUserId(): string | null {
  return activeUserId;
}

export function getUserDB(userId?: string | null): HubVaultDB {
  const targetId = userId || activeUserId || 'anonymous';
  const dbName = `HubVaultDB_${targetId}`;
  if (!userDbMap.has(targetId)) {
    userDbMap.set(targetId, new HubVaultDB(dbName));
  }
  return userDbMap.get(targetId)!;
}

export function resetAllUserDBs() {
  userDbMap.forEach((database) => {
    try {
      database.close();
    } catch (e) {
      // ignore
    }
  });
  userDbMap.clear();
  activeUserId = null;
}

// Purge legacy unpartitioned global database if present
if (isIndexedDbSupported) {
  try {
    Dexie.delete('HubVaultDB').catch(() => {});
  } catch (e) {
    // ignore
  }
}

// Dynamic proxy `db` exporting active user's tables and methods
export const db: HubVaultDB = new Proxy({} as HubVaultDB, {
  get(_target, prop: keyof HubVaultDB) {
    const currentDb = getUserDB(activeUserId);
    const value = (currentDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(currentDb);
    }
    return value;
  }
});
