import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiRequest } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import {
  ChevronLeft,
  Camera,
  Check,
  AlertTriangle,
  FileText,
  CheckCircle,
} from 'lucide-react-native';

// The 4 mandatory repo kit documents
const REPO_KIT_DOCS = [
  {
    key: 'pre_intimation',
    label: 'Pre-Intimation Letter',
    description: 'Letter sent before repossession',
    icon: '📄',
  },
  {
    key: 'post_intimation',
    label: 'Post-Intimation Letter',
    description: 'Letter sent after repossession',
    icon: '📋',
  },
  {
    key: 'yard_inventory',
    label: 'Yard Inventory Sheet',
    description: 'Physical inventory sheet from yard',
    icon: '📝',
  },
  {
    key: 'bank_inventory',
    label: 'Bank Inventory Sheet',
    description: 'Inventory sheet submitted to bank',
    icon: '🏦',
  },
];

export default function KachhaToPakkaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  // Repo kit photos state — key: docKey, value: local URI or uploaded URL
  const [photos, setPhotos] = useState<Record<string, string>>({
    pre_intimation: '',
    post_intimation: '',
    yard_inventory: '',
    bank_inventory: '',
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({
    pre_intimation: false,
    post_intimation: false,
    yard_inventory: false,
    bank_inventory: false,
  });

  // Repo Kit date (when docs were submitted)
  const today = new Date().toISOString().split('T')[0];

  const fetchVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/api/vehicles/${id}`);
      if (res.success && res.data) {
        if (res.data.yardStatus !== 'KACHHA') {
          Alert.alert(
            'Already Converted',
            `This vehicle is already in "${res.data.yardStatus}" status.`,
            [{ text: 'Go Back', onPress: () => router.back() }]
          );
          return;
        }
        setVehicle(res.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVehicle();
  }, []);

  const capturePhoto = async (docKey: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to capture documents.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1280 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Start upload immediately
        uploadPhoto(docKey, compressed.uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not capture photo');
    }
  };

  const pickFromGallery = async (docKey: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1280 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadPhoto(docKey, compressed.uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick image');
    }
  };

  const uploadPhoto = async (docKey: string, localUri: string) => {
    // Show local preview immediately
    setPhotos(prev => ({ ...prev, [docKey]: localUri }));
    setUploading(prev => ({ ...prev, [docKey]: true }));

    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (!isOnline) {
        // Store local URI for offline
        setPhotos(prev => ({ ...prev, [docKey]: localUri }));
        return;
      }

      // Get presigned URL
      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=repokit&fileSize=200000`
      );
      const { uploadUrl, publicUrl } = presignRes.data;

      if (!uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(localUri).then(r => r.blob());
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
      }

      setPhotos(prev => ({ ...prev, [docKey]: publicUrl }));
    } catch (err: any) {
      console.error(`[KachhaToPakka] Upload failed for ${docKey}:`, err);
      Alert.alert('Upload Error', 'Could not upload photo. Using local copy.');
    } finally {
      setUploading(prev => ({ ...prev, [docKey]: false }));
    }
  };

  const showPhotoOptions = (docKey: string) => {
    Alert.alert('Add Document Photo', 'Choose source', [
      { text: 'Take Photo', onPress: () => capturePhoto(docKey) },
      { text: 'Choose from Gallery', onPress: () => pickFromGallery(docKey) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    // Check all 4 photos are captured
    const missing = REPO_KIT_DOCS.filter(doc => !photos[doc.key]);
    if (missing.length > 0) {
      Alert.alert(
        'Documents Missing',
        `Please capture these required photos:\n\n${missing.map(d => `• ${d.label}`).join('\n')}`
      );
      return;
    }

    // Check any uploads still in progress
    const stillUploading = Object.values(uploading).some(Boolean);
    if (stillUploading) {
      Alert.alert('Please Wait', 'Photos are still uploading. Please wait and try again.');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Register all 4 repo kit photos in the vehicle's photo gallery
      await Promise.all(
        REPO_KIT_DOCS.map(doc =>
          apiRequest(`/api/vehicles/${id}/photos`, {
            method: 'POST',
            body: JSON.stringify({
              photoType: doc.key,
              s3Url: photos[doc.key],
            }),
          })
        )
      );

      // Step 2: Update vehicle status to PAKKA
      const res = await apiRequest(`/api/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          yardStatus: 'PAKKA',
          repoKitDate: today,
          pakkaDate: today,
        }),
      });

      if (res.success) {
        setSuccessVisible(true);
      } else {
        throw new Error(res.error || 'Transition failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete Kachha→Pakka transition');
    } finally {
      setSubmitting(false);
    }
  };

  const allPhotosReady = REPO_KIT_DOCS.every(doc => !!photos[doc.key]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <ThemedText style={styles.loadingText}>Loading vehicle details...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Kachha → Pakka</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <AlertTriangle size={20} color="#B45309" />
          <ThemedText style={styles.infoText}>
            Upload all 4 Repo Kit documents to move this vehicle to PAKKA status. Parking billing will start from today.
          </ThemedText>
        </View>

        {/* Vehicle Banner Card */}
        {vehicle && (
          <View style={styles.vehicleBannerCard}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=400' }} style={styles.vehicleThumbnail} />
            <View style={styles.vehicleMeta}>
              <ThemedText style={styles.plateNumber}>{vehicle.vehicleNumber.toUpperCase()}</ThemedText>
              <ThemedText style={styles.inventoryNo}>
                INV-{new Date(vehicle.entryDate || Date.now()).getFullYear()}-{String(vehicle.id).substring(0, 6).toUpperCase()}
              </ThemedText>
              <View style={styles.statusBadge}>
                <ThemedText style={styles.statusBadgeText}>KACHHA — Billing Inactive</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Document Upload Section */}
        <ThemedText style={styles.sectionTitle}>📁 Upload Repo Kit Documents</ThemedText>
        <ThemedText style={styles.sectionSubtitle}>All 4 documents are mandatory</ThemedText>

        {REPO_KIT_DOCS.map((doc, index) => {
          const hasPhoto = !!photos[doc.key];
          const isUploading = uploading[doc.key];

          return (
            <View key={doc.key} style={[styles.docCard, hasPhoto && styles.docCardDone]}>
              <View style={styles.docHeader}>
                <View style={styles.docIndexCircle}>
                  {hasPhoto ? (
                    <Check size={14} color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.docIndexText}>{index + 1}</ThemedText>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.docLabel}>{doc.label}</ThemedText>
                  <ThemedText style={styles.docDesc}>{doc.description}</ThemedText>
                </View>
                {hasPhoto && !isUploading && (
                  <View style={styles.docDoneBadge}>
                    <ThemedText style={styles.docDoneBadgeText}>✓ Captured</ThemedText>
                  </View>
                )}
              </View>

              {isUploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <ThemedText style={styles.uploadingText}>Uploading to cloud...</ThemedText>
                </View>
              ) : hasPhoto ? (
                <View>
                  <Image source={{ uri: photos[doc.key] }} style={styles.docPreview} />
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => showPhotoOptions(doc.key)}
                    activeOpacity={0.7}
                  >
                    <Camera size={14} color="#2563EB" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.retakeBtnText}>Retake</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureDocBtn}
                  onPress={() => showPhotoOptions(doc.key)}
                  activeOpacity={0.8}
                >
                  <Camera size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.captureDocBtnText}>Tap to Capture Document</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Progress Indicator */}
        <View style={styles.progressBar}>
          {REPO_KIT_DOCS.map(doc => (
            <View
              key={doc.key}
              style={[styles.progressDot, photos[doc.key] && styles.progressDotDone]}
            />
          ))}
        </View>
        <ThemedText style={styles.progressText}>
          {REPO_KIT_DOCS.filter(d => photos[d.key]).length} / {REPO_KIT_DOCS.length} documents captured
        </ThemedText>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, !allPhotosReady && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allPhotosReady || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <FileText size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <ThemedText style={styles.submitBtnText}>
                {allPhotosReady ? 'Submit Repo Kit & Convert to Pakka' : 'Complete All 4 Documents First'}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSuccessVisible(false);
          router.back();
        }}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color="#10B981" />
            </View>
            <ThemedText style={styles.successTitle}>Transition Complete!</ThemedText>
            <ThemedText style={styles.successMsg}>
              Vehicle <ThemedText style={{ fontWeight: '700' }}>{vehicle?.vehicleNumber}</ThemedText> has been moved to{' '}
              <ThemedText style={{ color: '#10B981', fontWeight: '700' }}>PAKKA</ThemedText> status.{'\n\n'}
              Parking billing is now active from today.
            </ThemedText>

            <View style={styles.successInfoCard}>
              <View style={styles.successInfoRow}>
                <ThemedText style={styles.successInfoLabel}>Status</ThemedText>
                <ThemedText style={[styles.successInfoVal, { color: '#10B981' }]}>PAKKA ✓</ThemedText>
              </View>
              <View style={styles.successInfoRow}>
                <ThemedText style={styles.successInfoLabel}>Billing Starts</ThemedText>
                <ThemedText style={styles.successInfoVal}>
                  {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </ThemedText>
              </View>
              <View style={styles.successInfoRow}>
                <ThemedText style={styles.successInfoLabel}>Docs Uploaded</ThemedText>
                <ThemedText style={styles.successInfoVal}>4 / 4</ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setSuccessVisible(false);
                router.back();
              }}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.doneBtnText}>Done — Go Back</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoText: { flex: 1, color: '#B45309', fontSize: 13, lineHeight: 18, fontWeight: '600' },

  vehicleBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  vehicleThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  vehicleMeta: {
    flex: 1,
    gap: 4,
  },
  plateNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inventoryNo: {
    fontSize: 12,
    color: '#BFDBFE',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 14 },

  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  docCardDone: { borderColor: '#10B981', borderWidth: 1.5 },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  docIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  docIndexText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  docLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  docDesc: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '400' },
  docDoneBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  docDoneBadgeText: { color: '#15803D', fontSize: 10, fontWeight: '700' },

  captureDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DBEAFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    backgroundColor: '#EFF6FF',
  },
  captureDocBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  docPreview: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'cover' },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  retakeBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },

  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    justifyContent: 'center',
  },
  uploadingText: { color: '#64748B', fontSize: 13 },

  progressBar: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8, marginBottom: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' },
  progressDotDone: { backgroundColor: '#10B981' },
  progressText: { textAlign: 'center', fontSize: 12, color: '#64748B', marginBottom: 20 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    height: 52,
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD', opacity: 0.7 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  successMsg: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  successInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  successInfoLabel: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  successInfoVal: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  doneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
