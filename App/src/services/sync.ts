import NetInfo from '@react-native-community/netinfo';
import { getQueuedJobs, deleteQueuedJob, OfflineJob, cacheBanks } from './sqlite';
import { apiRequest } from './api';

type SyncListener = (isSyncing: boolean, pendingCount: number) => void;
const listeners = new Set<SyncListener>();

let isSyncing = false;
let isNetworkConnected = false;

export const registerSyncListener = (listener: SyncListener) => {
  listeners.add(listener);
  // Send current state
  const pending = getQueuedJobs().length;
  listener(isSyncing, pending);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  const pending = getQueuedJobs().length;
  listeners.forEach((l) => l(isSyncing, pending));
};

// Main queue worker
export const runSyncQueue = async () => {
  if (isSyncing) return;
  if (!isNetworkConnected) {
    console.log('[Sync] Cannot start sync: Device is offline');
    return;
  }

  const jobs = getQueuedJobs();
  if (jobs.length === 0) {
    return;
  }

  isSyncing = true;
  notifyListeners();

  console.log(`[Sync] Starting synchronization. Found ${jobs.length} jobs.`);

  try {
    for (const job of jobs) {
      try {
        console.log(`[Sync] Processing job ${job.id} of type ${job.type}`);
        await processJob(job);
        // Success, delete job
        deleteQueuedJob(job.id);
        notifyListeners();
      } catch (jobError: any) {
        console.error(`[Sync] Error processing job ${job.id}:`, jobError);
        
        // Double-check current network status
        const state = await NetInfo.fetch();
        if (state.isConnected === false) {
          console.log('[Sync] Device went offline during queue execution. Halting sync.');
          throw jobError; // Re-throw to exit loop and halt
        }
        
        // If we are online, this is a validation/data mismatch error.
        // Delete it from local queue so it does not block subsequent entries forever.
        console.warn(`[Sync] Validation or server error on job ${job.id}. Deleting to prevent queue block.`);
        deleteQueuedJob(job.id);
        notifyListeners();
      }
    }
    console.log('[Sync] All jobs processed successfully');
    await syncBanksOnline();
  } catch (error) {
    console.error('[Sync] Sync queue halted due to connection error:', error);
  } finally {
    isSyncing = false;
    notifyListeners();
  }
};

// Fetch and cache banks locally
export const syncBanksOnline = async () => {
  try {
    console.log('[Sync] Fetching and caching banks from server...');
    const res = await apiRequest('/api/banks');
    if (res.success && res.data) {
      cacheBanks(res.data);
    }
  } catch (err) {
    console.warn('[Sync] Failed to fetch and cache banks online:', err);
  }
};

// Process single job
const processJob = async (job: OfflineJob) => {
  const payload = JSON.parse(job.payload);
  const localPhotos = JSON.parse(job.photos);

  if (job.type === 'CHECK_IN') {
    const photoArray = localPhotos as Array<{ type: string; uri: string; lat?: number; lng?: number }>;
    // 1. Submit the core check-in details
    const checkinResponse = await apiRequest('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const vehicleId = checkinResponse.data.id;
    console.log(`[Sync] Vehicle check-in created with ID: ${vehicleId}`);

    // 2. Upload photos if any
    for (const photo of photoArray) {
      try {
        console.log(`[Sync] Requesting presigned URL for photo type: ${photo.type}`);
        const presignedRes = await apiRequest(
          `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=100000`
        );

        const { uploadUrl, publicUrl } = presignedRes.data;

        if (uploadUrl.includes('mock-s3-bucket')) {
          console.log('[Sync] Mock upload detected. Simulating photo upload...');
        } else {
          console.log(`[Sync] Uploading photo binary to: ${uploadUrl}`);
          const fileBlob = await uriToBlob(photo.uri);
          await fetch(uploadUrl, {
            method: 'PUT',
            body: fileBlob,
            headers: {
              'Content-Type': 'image/jpeg',
            },
          });
          console.log('[Sync] Photo upload to S3 complete');
        }

        // Add photo reference in database
        await apiRequest(`/api/vehicles/${vehicleId}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: photo.type,
            s3Url: publicUrl,
            fileSize: 100000,
            lat: photo.lat,
            lng: photo.lng,
          }),
        });
        console.log(`[Sync] Added photo record in DB for type ${photo.type}`);
      } catch (err) {
        console.error(`[Sync] Error uploading photo of type ${photo.type}:`, err);
      }
    }
  } else if (job.type === 'CHECK_OUT') {
    const vehicleNumber = payload.vehicleNumber;
    const vehicleId = payload.vehicleId;
    await apiRequest(`/api/releases/${vehicleId}/direct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`[Sync] Checkout processed for vehicle: ${vehicleNumber}`);
  } else if (job.type === 'KACHHA_TO_PAKKA') {
    const { vehicleId, repoKitDate, pakkaDate } = payload;
    const photoRecord = localPhotos as Record<string, string>;

    // 1. Upload documents
    for (const key of Object.keys(photoRecord)) {
      const docUri = photoRecord[key];
      if (!docUri) continue;

      try {
        console.log(`[Sync] Requesting presigned URL for repo kit doc: ${key}`);
        const presignedRes = await apiRequest(
          `/api/uploads/presigned-url?fileType=image/jpeg&folder=repokit&fileSize=200000`
        );
        const { uploadUrl, publicUrl } = presignedRes.data;

        if (uploadUrl.includes('mock-s3-bucket')) {
          console.log('[Sync] Mock upload detected for repo kit doc. Simulating...');
        } else {
          const fileBlob = await uriToBlob(docUri);
          await fetch(uploadUrl, {
            method: 'PUT',
            body: fileBlob,
            headers: { 'Content-Type': 'image/jpeg' },
          });
        }

        // Register in DB
        await apiRequest(`/api/vehicles/${vehicleId}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: key,
            s3Url: publicUrl,
          }),
        });
        console.log(`[Sync] Registered repo kit photo ${key} in DB`);
      } catch (err) {
        console.error(`[Sync] Failed to upload repo doc ${key}:`, err);
      }
    }

    // 2. Transition status to PAKKA
    await apiRequest(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify({
        yardStatus: 'PAKKA',
        repoKitDate,
        pakkaDate,
      }),
    });
    console.log(`[Sync] Kachha to Pakka transition synced for vehicle ID: ${vehicleId}`);
  } else if (job.type === 'EDIT_VEHICLE') {
    const { vehicleId } = payload;
    const body = { ...payload };
    delete body.vehicleId;

    await apiRequest(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    console.log(`[Sync] Processed offline vehicle edit for: ${vehicleId}`);
  }
};

// Convert local file URI to binary blob
const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return await response.blob();
};

// Monitor network connection status
export const initializeSyncService = () => {
  NetInfo.addEventListener((state) => {
    const wasConnected = isNetworkConnected;
    isNetworkConnected = !!state.isConnected;
    console.log(`[Sync] Network status: ${isNetworkConnected ? 'ONLINE' : 'OFFLINE'}`);

    if (isNetworkConnected && !wasConnected) {
      console.log('[Sync] Network reconnected, triggering sync queue');
      runSyncQueue();
    }
    notifyListeners();
  });
};
