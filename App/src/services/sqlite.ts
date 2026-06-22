import * as SQLite from 'expo-sqlite';

// Open the database synchronously
const db = SQLite.openDatabaseSync('yms_offline.db');

export interface OfflineJob {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  payload: string; // JSON string of request body
  photos: string;  // JSON string of local image paths array
  createdAt: number;
}

export interface CachedVehicle {
  id: string;
  vehicleNumber: string;
  brand: string | null;
  model: string | null;
  vehicleType: string;
  entryDate: string | null;
  yardStatus: string | null;
  bankName: string | null;
  tenantId: string;
}

// Initialize tables
export const initDatabase = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        photos TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vehicle_cache (
        id TEXT PRIMARY KEY,
        vehicleNumber TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        vehicleType TEXT NOT NULL,
        entryDate TEXT,
        yardStatus TEXT,
        bankName TEXT,
        tenantId TEXT NOT NULL
      );
    `);
    console.log('[SQLite] Tables initialized successfully');
  } catch (error) {
    console.error('[SQLite] Error initializing tables:', error);
  }
};

// Queue operations
export const queueOfflineJob = (type: 'CHECK_IN' | 'CHECK_OUT', payload: object, photos: any[] = []) => {
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const createdAt = Date.now();
  const payloadStr = JSON.stringify(payload);
  const photosStr = JSON.stringify(photos);

  try {
    db.runSync(
      'INSERT INTO offline_queue (id, type, payload, photos, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, type, payloadStr, photosStr, createdAt]
    );
    console.log(`[SQLite] Job queued: ${type} with ID ${id}`);
    return id;
  } catch (error) {
    console.error('[SQLite] Error queuing job:', error);
    throw error;
  }
};

export const getQueuedJobs = (): OfflineJob[] => {
  try {
    return db.getAllSync<OfflineJob>('SELECT * FROM offline_queue ORDER BY createdAt ASC');
  } catch (error) {
    console.error('[SQLite] Error getting queued jobs:', error);
    return [];
  }
};

export const deleteQueuedJob = (id: string) => {
  try {
    db.runSync('DELETE FROM offline_queue WHERE id = ?', [id]);
    console.log(`[SQLite] Job deleted from queue: ${id}`);
  } catch (error) {
    console.error('[SQLite] Error deleting queued job:', error);
  }
};

// Cache operations for vehicles
export const cacheVehicles = (vehicles: CachedVehicle[]) => {
  try {
    // Wrap in transaction using SQL batching
    db.execSync('BEGIN TRANSACTION;');
    for (const v of vehicles) {
      db.runSync(
        `INSERT OR REPLACE INTO vehicle_cache 
        (id, vehicleNumber, brand, model, vehicleType, entryDate, yardStatus, bankName, tenantId) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.vehicleNumber, v.brand, v.model, v.vehicleType, v.entryDate, v.yardStatus, v.bankName, v.tenantId]
      );
    }
    db.execSync('COMMIT;');
    console.log(`[SQLite] Cached ${vehicles.length} vehicles successfully`);
  } catch (error) {
    db.execSync('ROLLBACK;');
    console.error('[SQLite] Error caching vehicles:', error);
  }
};

export const searchCachedVehicles = (query: string): CachedVehicle[] => {
  try {
    const searchQuery = `%${query}%`;
    return db.getAllSync<CachedVehicle>(
      `SELECT * FROM vehicle_cache 
       WHERE vehicleNumber LIKE ? OR brand LIKE ? OR model LIKE ? OR bankName LIKE ? 
       LIMIT 50`,
      [searchQuery, searchQuery, searchQuery, searchQuery]
    );
  } catch (error) {
    console.error('[SQLite] Error searching cached vehicles:', error);
    return [];
  }
};

export const getCachedVehicleByNumber = (vehicleNumber: string): CachedVehicle | null => {
  try {
    return db.getFirstSync<CachedVehicle>(
      'SELECT * FROM vehicle_cache WHERE vehicleNumber = ?',
      [vehicleNumber]
    );
  } catch (error) {
    console.error('[SQLite] Error getting cached vehicle:', error);
    return null;
  }
};

export const clearVehicleCache = () => {
  try {
    db.runSync('DELETE FROM vehicle_cache');
    console.log('[SQLite] Vehicle cache cleared');
  } catch (error) {
    console.error('[SQLite] Error clearing vehicle cache:', error);
  }
};

export interface OfflineStats {
  totalVehicles: number;
  inYard: number;
  released: number;
  todayEntry: number;
}

export const getOfflineStats = (): OfflineStats => {
  try {
    const totalRow = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM vehicle_cache"
    );
    const inYardRow = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM vehicle_cache WHERE yardStatus IN ('KACHHA', 'PAKKA')"
    );
    const releasedRow = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM vehicle_cache WHERE yardStatus = 'RELEASED'"
    );
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntryRow = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM vehicle_cache WHERE entryDate LIKE ?",
      [`${todayStr}%`]
    );

    return {
      totalVehicles: totalRow?.count || 0,
      inYard: inYardRow?.count || 0,
      released: releasedRow?.count || 0,
      todayEntry: todayEntryRow?.count || 0,
    };
  } catch (error) {
    console.error('[SQLite] Error getting offline stats:', error);
    return { totalVehicles: 0, inYard: 0, released: 0, todayEntry: 0 };
  }
};

