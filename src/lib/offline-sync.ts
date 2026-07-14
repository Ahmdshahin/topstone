import { set, get, del, keys } from 'idb-keyval';
import { createClient } from './supabase/client';

export interface SyncOperation {
  id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
}

const SYNC_QUEUE_KEY_PREFIX = 'offline_sync_';

/**
 * Queue a database mutation to be executed when online
 */
export async function queueOfflineMutation(table: string, action: SyncOperation['action'], payload: any) {
  const id = crypto.randomUUID();
  const operation: SyncOperation = {
    id,
    table,
    action,
    payload,
    timestamp: Date.now(),
  };

  await set(`${SYNC_QUEUE_KEY_PREFIX}${id}`, operation);
  
  // If we are currently online, try to sync immediately
  if (typeof window !== 'undefined' && navigator.onLine) {
    flushSyncQueue();
  }
}

/**
 * Flush all queued mutations to Supabase
 */
export async function flushSyncQueue() {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const allKeys = await keys();
  const syncKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith(SYNC_QUEUE_KEY_PREFIX));
  
  if (syncKeys.length === 0) return;

  const supabase = createClient();
  console.log(`[PWA Sync] Found ${syncKeys.length} operations to sync...`);

  // Process sequentially to maintain operation order by timestamp
  const operations: SyncOperation[] = [];
  for (const key of syncKeys) {
    const op = await get<SyncOperation>(key);
    if (op) operations.push(op);
  }

  operations.sort((a, b) => a.timestamp - b.timestamp);

  for (const op of operations) {
    try {
      let result;
      switch (op.action) {
        case 'INSERT':
          result = await supabase.from(op.table).insert(op.payload);
          break;
        case 'UPDATE':
          // Assumes payload has 'id'
          result = await supabase.from(op.table).update(op.payload).eq('id', op.payload.id);
          break;
        case 'DELETE':
          result = await supabase.from(op.table).delete().eq('id', op.payload.id);
          break;
      }

      if (result?.error) {
        console.error(`[PWA Sync] Failed to sync operation ${op.id}:`, result.error);
        // Leave in queue to try again later
      } else {
        console.log(`[PWA Sync] Successfully synced operation ${op.id}`);
        await del(`${SYNC_QUEUE_KEY_PREFIX}${op.id}`);
      }
    } catch (error) {
      console.error(`[PWA Sync] Unexpected error syncing operation ${op.id}:`, error);
    }
  }
}

/**
 * Register global event listeners for network changes
 */
export function registerSyncListeners() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', flushSyncQueue);
  }
}
