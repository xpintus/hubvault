import Dexie, { Table } from 'dexie';
import { CollectionEntry, Collector, Due, Recovery, DenominationInput } from '@/types';

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

export interface SyncQueueItem {
  id: string; // client generated UUID for the queue item
  user_id: string;
  hub_id: string;
  table_name: 'collection_entries' | 'collectors' | 'dues' | 'recoveries' | 'denominations';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  created_at: string;
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error_message?: string;
}

export class HubVaultDB extends Dexie {
  collection_entries!: Table<OfflineCollectionEntry, string>;
  collectors!: Table<OfflineCollector, string>;
  dues!: Table<OfflineDue, string>;
  recoveries!: Table<OfflineRecovery, string>;
  denominations!: Table<OfflineDenomination, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super('HubVaultDB');
    this.version(1).stores({
      collection_entries: 'id, collection_date, collector_id, hub_id, status, client_id, updated_at',
      collectors: 'id, employee_id, hub_id, status, client_id, updated_at',
      dues: 'id, collector_id, hub_id, status, client_id, updated_at',
      recoveries: 'id, collector_id, hub_id, due_id, client_id, updated_at',
      denominations: 'id, collection_entry_id, client_id, updated_at',
      sync_queue: 'id, user_id, hub_id, table_name, operation, status, created_at'
    });
  }

  async clearUserOfflineData() {
    await Promise.all([
      this.collection_entries.clear(),
      this.collectors.clear(),
      this.dues.clear(),
      this.recoveries.clear(),
      this.denominations.clear(),
      this.sync_queue.clear()
    ]);
  }
}

export const db = new HubVaultDB();
