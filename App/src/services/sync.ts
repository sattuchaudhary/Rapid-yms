import NetInfo from '@react-native-community/netinfo';
import { getQueuedJobs, deleteQueuedJob, OfflineJob } from './sqlite';
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
      console.log(`[Sync] Processing job ${job.id} of type ${job.type}`);
      await processJob(job);
      // Success, delete job
      deleteQueuedJob(job.id);
      notifyListeners();
    }
    console.log('[Sync] All jobs processed successfully');
  } catch (error) {
    console.error('[Sync] Sync queue halted due to error:', error);
  } finally {
    isSyncing = false;
    notifyListeners();
  }
};

// Process single job
const processJob = async (job: OfflineJob) => {
  const payload = JSON.parse(job.payload);
  const localPhotos: Array<{ type: string; uri: string; lat?: number; lng?: number }> = JSON.parse(job.photos);

  if (job.type === 'CHECK_IN') {
    // 1. Submit the core check-in details
    // We send payload without photos array (since photos are added individually via API)
    const checkinResponse = await apiRequest('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const vehicleId = checkinResponse.data.id;
    console.log(`[Sync] Vehicle check-in created with ID: ${vehicleId}`);

    // 2. Upload photos if any
    for (const photo of localPhotos) {
      try {
        console.log(`[Sync] Requesting presigned URL for photo type: ${photo.type}`);
        const presignedRes = await apiRequest(
          `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=100000`
        );

        const { uploadUrl, publicUrl } = presignedRes.data;

        // Perform actual binary upload to S3 (or simulate if mock)
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
            fileSize: 100000, // Approximate compressed size
            lat: photo.lat,
            lng: photo.lng,
          }),
        });
        console.log(`[Sync] Added photo record in DB for type ${photo.type}`);
      } catch (err) {
        console.error(`[Sync] Error uploading photo of type ${photo.type}:`, err);
        // Continue with other photos, don't crash the entire sync
      }
    }
  } else if (job.type === 'CHECK_OUT') {
    // Submit check-out details
    const vehicleNumber = payload.vehicleNumber;
    // Checkout endpoint check:
    // Let's see: how is checkout triggered in backend?
    // Let's query backend files.
    await apiRequest(`/api/releases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`[Sync] Checkout processed for vehicle: ${vehicleNumber}`);
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
