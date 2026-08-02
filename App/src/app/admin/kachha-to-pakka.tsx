import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiRequest } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import { getCachedVehicleById, queueOfflineJob, cacheVehicles, saveDraft, getDraftById, deleteDraft } from '@/services/sqlite';
import {
  ChevronLeft,
  Camera,
  Check,
  AlertTriangle,
  FileText,
  Calendar,
  ImageIcon,
  Car,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

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
  const navigation = useNavigation();
  const { id, draftId } = useLocalSearchParams<{ id: string; draftId?: string }>();
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId || null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const [uploadMethod, setUploadMethod] = useState<'single_pdf' | 'separate' | null>(null);

  // Repo kit photos state — key: docKey, value: local URI or uploaded URL
  const [photos, setPhotos] = useState<Record<string, string>>({
    pre_intimation: '',
    post_intimation: '',
    yard_inventory: '',
    bank_inventory: '',
    combined_pdf: '',
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({
    pre_intimation: false,
    post_intimation: false,
    yard_inventory: false,
    bank_inventory: false,
    combined_pdf: false,
  });

  // Restore draft state when draftId is passed
  useEffect(() => {
    if (draftId) {
      const record = getDraftById(draftId);
      if (record && record.data) {
        try {
          const d = JSON.parse(record.data);
          if (d.uploadMethod) setUploadMethod(d.uploadMethod);
          if (d.photos) setPhotos(d.photos);
          if (d.vehicle) setVehicle(d.vehicle);
          setActiveDraftId(draftId);
        } catch (err) {
          console.warn('[KachhaToPakka] Failed to restore draft:', err);
        }
      }
    }
  }, [draftId]);

  const handleAutoSaveDraft = useCallback(() => {
    const hasPhotos = Object.values(photos).some(p => !!p);
    if (!hasPhotos && !uploadMethod) return;
    const title = vehicle?.vehicleNumber ? `Repo Kit: ${vehicle.vehicleNumber}` : 'Kachha to Pakka';
    const subtitle = `Bank: ${vehicle?.bankName || 'N/A'} • Repo Kit Upload`;
    const payload = { vehicle, uploadMethod, photos, id };
    const newId = saveDraft('KACHHA_TO_PAKKA', title, subtitle, payload, activeDraftId || undefined);
    setActiveDraftId(newId);
  }, [vehicle, uploadMethod, photos, id, activeDraftId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      const hasPhotos = Object.values(photos).some(p => !!p);
      if ((hasPhotos || uploadMethod) && !formSubmitted) {
        handleAutoSaveDraft();
      }
    });
    return unsubscribe;
  }, [navigation, photos, uploadMethod, formSubmitted, handleAutoSaveDraft]);

  const [docUploadMode, setDocUploadMode] = useState<Record<string, 'image' | 'pdf'>>({
    pre_intimation: 'image',
    post_intimation: 'image',
    yard_inventory: 'image',
    bank_inventory: 'image',
    combined_pdf: 'pdf',
  });

  const [fileTypes, setFileTypes] = useState<Record<string, 'image' | 'pdf'>>({
    pre_intimation: 'image',
    post_intimation: 'image',
    yard_inventory: 'image',
    bank_inventory: 'image',
    combined_pdf: 'pdf',
  });

  // Date State for Transition (Pakka Date)
  const [pakkaDate, setPakkaDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPakkaDate(selectedDate);
    }
  };

  const fetchVehicle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        const res = await apiRequest(`/api/vehicles/${id}`);
        if (!isMounted.current) return;
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
      } else {
        const cached = getCachedVehicleById(id as string);
        if (!isMounted.current) return;
        if (cached) {
          if (cached.yardStatus !== 'KACHHA') {
            Alert.alert(
              'Already Converted',
              `This vehicle is already in "${cached.yardStatus}" status.`,
              [{ text: 'Go Back', onPress: () => router.back() }]
            );
            return;
          }
          setVehicle(cached);
        } else {
          Alert.alert('Offline', 'Vehicle details not found in cache.');
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        Alert.alert('Error', err.message || 'Failed to load vehicle details');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchVehicle();
  }, [id, fetchVehicle]);

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
        uploadFile(docKey, compressed.uri, false);
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
        uploadFile(docKey, compressed.uri, false);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick image');
    }
  };

  const uploadFile = async (docKey: string, localUri: string, isPdf = false) => {
    // Show local preview immediately
    setPhotos(prev => ({ ...prev, [docKey]: localUri }));
    setUploading(prev => ({ ...prev, [docKey]: true }));
    setFileTypes(prev => ({ ...prev, [docKey]: isPdf ? 'pdf' : 'image' }));

    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (!isOnline) {
        // Store local URI for offline
        setPhotos(prev => ({ ...prev, [docKey]: localUri }));
        return;
      }

      const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

      // Get presigned URL
      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=${mimeType}&folder=repokit&fileSize=200000`
      );
      const { uploadUrl, publicUrl } = presignRes.data;

      if (!uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(localUri).then(r => r.blob());
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': mimeType },
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
      }

      setPhotos(prev => ({ ...prev, [docKey]: publicUrl }));
    } catch (err: any) {
      console.error(`[KachhaToPakka] Upload failed for ${docKey}:`, err);
      Alert.alert('Upload Error', 'Could not upload file. Using local copy.');
    } finally {
      setUploading(prev => ({ ...prev, [docKey]: false }));
    }
  };

  const pickPDF = async (docKey: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        uploadFile(docKey, file.uri, true);
      }
    } catch (err: any) {
      Alert.alert('PDF Error', err.message || 'Could not pick PDF file');
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
    // Check files are captured
    if (uploadMethod === 'single_pdf') {
      if (!photos.combined_pdf) {
        Alert.alert('Document Missing', 'Please upload the combined Repo Kit PDF file.');
        return;
      }
    } else {
      const missing = REPO_KIT_DOCS.filter(doc => !photos[doc.key]);
      if (missing.length > 0) {
        Alert.alert(
          'Documents Missing',
          `Please capture these required photos:\n\n${missing.map(d => `• ${d.label}`).join('\n')}`
        );
        return;
      }
    }

    // Check any uploads still in progress
    const stillUploading = Object.values(uploading).some(Boolean);
    if (stillUploading) {
      Alert.alert('Please Wait', 'Files are still uploading. Please wait and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;
      const dateStr = pakkaDate.toISOString();

      if (!isOnline) {
        // Offline: Queue check-in transition job
        const offlinePhotos = uploadMethod === 'single_pdf'
          ? {
              pre_intimation: photos.combined_pdf,
              post_intimation: photos.combined_pdf,
              yard_inventory: photos.combined_pdf,
              bank_inventory: photos.combined_pdf,
            }
          : photos;

        queueOfflineJob(
          'KACHHA_TO_PAKKA',
          {
            vehicleId: id,
            repoKitDate: dateStr,
            pakkaDate: dateStr,
          },
          offlinePhotos as any
        );
        // Update local SQLite cache
        if (vehicle) {
          try {
            cacheVehicles([{
              id: vehicle.id,
              vehicleNumber: vehicle.vehicleNumber,
              brand: vehicle.brand ?? null,
              model: vehicle.model ?? null,
              vehicleType: vehicle.vehicleType,
              entryDate: vehicle.entryDate ?? null,
              yardStatus: 'PAKKA',
              bankName: vehicle.bank?.name ?? vehicle.bankName ?? null,
              tenantId: vehicle.tenantId,
            }]);
          } catch (cacheErr) {
            console.warn('[KachhaToPakka] Failed to update local cache offline:', cacheErr);
          }
        }
        if (isMounted.current) setSuccessVisible(true);
        return;
      }

      // Step 1: Register all 4 repo kit photos in the vehicle's photo gallery
      const photoRegistrations = uploadMethod === 'single_pdf'
        ? REPO_KIT_DOCS.map(doc =>
            apiRequest(`/api/vehicles/${id}/photos`, {
              method: 'POST',
              body: JSON.stringify({
                photoType: doc.key,
                s3Url: photos.combined_pdf,
              }),
            })
          )
        : REPO_KIT_DOCS.map(doc =>
            apiRequest(`/api/vehicles/${id}/photos`, {
              method: 'POST',
              body: JSON.stringify({
                photoType: doc.key,
                s3Url: photos[doc.key],
              }),
            })
          );

      await Promise.all(photoRegistrations);

      if (!isMounted.current) return;

      // Step 2: Update vehicle status to PAKKA
      const res = await apiRequest(`/api/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          yardStatus: 'PAKKA',
          repoKitDate: dateStr,
          pakkaDate: dateStr,
        }),
      });

      if (!isMounted.current) return;

      if (res.success) {
        setFormSubmitted(true);
        if (activeDraftId) {
          deleteDraft(activeDraftId);
          setActiveDraftId(null);
        }

        // Update local SQLite cache
        if (vehicle) {
          try {
            cacheVehicles([{
              id: vehicle.id,
              vehicleNumber: vehicle.vehicleNumber,
              brand: vehicle.brand ?? null,
              model: vehicle.model ?? null,
              vehicleType: vehicle.vehicleType,
              entryDate: vehicle.entryDate ?? null,
              yardStatus: 'PAKKA',
              bankName: vehicle.bank?.name ?? vehicle.bankName ?? null,
              tenantId: vehicle.tenantId || '',
            }]);
          } catch (cacheErr) {
            console.warn('[KachhaToPakka] Failed to update local vehicle cache:', cacheErr);
          }
        }
        setSuccessVisible(true);
      } else {
        throw new Error(res.error || 'Transition failed');
      }
    } catch (err: any) {
      if (isMounted.current) {
        Alert.alert('Error', err.message || 'Failed to complete Kachha→Pakka transition');
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  const allPhotosReady = uploadMethod === 'single_pdf' ? !!photos.combined_pdf : REPO_KIT_DOCS.every(doc => !!photos[doc.key]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
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
        {/* Vehicle Banner Card */}
        {vehicle && (
          <View style={styles.vehicleBannerCard}>
            <View style={styles.vehicleThumbnailPlaceholder}>
              {vehicle.photos && vehicle.photos.length > 0 && (vehicle.photos[0]?.s3Url || vehicle.photos[0]?.uri) ? (
                <Image 
                  source={{ uri: vehicle.photos[0]?.s3Url || vehicle.photos[0]?.uri }} 
                  style={styles.vehicleThumbnail} 
                />
              ) : (
                <Car size={28} color="#4F46E5" />
              )}
            </View>
            <View style={styles.vehicleMeta}>
              <ThemedText style={styles.plateNumber}>{(vehicle.vehicleNumber || '').toUpperCase()}</ThemedText>
              <ThemedText style={styles.inventoryNo}>
                INV-{new Date(vehicle.entryDate || Date.now()).getFullYear()}-{String(vehicle.id || '').substring(0, 6).toUpperCase()}
              </ThemedText>
              <View style={styles.statusBadge}>
                <ThemedText style={styles.statusBadgeText}>KACHHA — Billing Inactive</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Date Selection Section */}
        <View style={styles.dateSectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Calendar size={18} color="#4F46E5" />
            <ThemedText style={styles.dateSectionTitle}>Transition Date (Pakka Date)</ThemedText>
          </View>
          <ThemedText style={styles.dateSectionSubtitle}>
            Select the date of transition to PAKKA status. Billing starts from this date.
          </ThemedText>
          
          <TouchableOpacity 
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.datePickerBtnText}>
              {pakkaDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </ThemedText>
            <ThemedText style={styles.changeDateLabel}>Change Date</ThemedText>
          </TouchableOpacity>
          
          {Platform.OS === 'ios' ? (
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { paddingBottom: 30 }]}>
                  <ThemedText style={[styles.modalHeader, { marginBottom: 15, textAlign: 'center' }]}>Select Transition Date</ThemedText>
                  <DateTimePicker
                    value={pakkaDate}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setPakkaDate(selectedDate);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#4F46E5',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                      marginTop: 15,
                    }}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Done</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          ) : (
            showDatePicker && (
              <DateTimePicker
                value={pakkaDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
            )
          )}
        </View>

        {/* Method Selection Header Row */}
        {uploadMethod !== null && (
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sectionTitle}>
                {uploadMethod === 'single_pdf' ? '📄 Combined Repo Kit Upload' : '📁 Upload Repo Kit Documents'}
              </ThemedText>
              <ThemedText style={styles.sectionSubtitle}>
                {uploadMethod === 'single_pdf' ? 'Upload 1 PDF containing all pages' : 'All 4 documents are mandatory'}
              </ThemedText>
            </View>
            <TouchableOpacity 
              style={styles.switchMethodBtn}
              onPress={() => setUploadMethod(prev => prev === 'single_pdf' ? 'separate' : 'single_pdf')}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.switchMethodText}>Switch Mode</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode 1: Single Combined PDF Upload Card */}
        {uploadMethod === 'single_pdf' && (
          <View style={[styles.docCard, !!photos.combined_pdf && styles.docCardDone]}>
            <View style={styles.docHeader}>
              <View style={styles.docIndexCircle}>
                {photos.combined_pdf ? (
                  <Check size={14} color="#FFFFFF" />
                ) : (
                  <FileText size={14} color="#FFFFFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.docLabel}>Combined Repo Kit PDF File</ThemedText>
                <ThemedText style={styles.docDesc}>
                  Select a single PDF containing Pre-Intimation, Post-Intimation, Yard Inventory, and Bank Inventory.
                </ThemedText>
              </View>
              {!!photos.combined_pdf && !uploading.combined_pdf && (
                <View style={styles.docDoneBadge}>
                  <ThemedText style={styles.docDoneBadgeText}>✓ Loaded</ThemedText>
                </View>
              )}
            </View>

            {uploading.combined_pdf ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <ThemedText style={styles.uploadingText}>Uploading PDF to cloud...</ThemedText>
              </View>
            ) : photos.combined_pdf ? (
              <View>
                <View style={styles.pdfPreviewCard}>
                  <FileText size={38} color="#EF4444" />
                  <ThemedText style={styles.pdfPreviewText}>Repo Kit PDF Selected</ThemedText>
                  {photos.combined_pdf.startsWith('http') ? (
                    <ThemedText style={styles.pdfSubText} numberOfLines={1}>
                      {photos.combined_pdf}
                    </ThemedText>
                  ) : (
                    <ThemedText style={styles.pdfSubText} numberOfLines={1}>
                      Local File: {photos.combined_pdf.split('/').pop()}
                    </ThemedText>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.pdfPickerBtn, { marginTop: 10 }]}
                  onPress={() => pickPDF('combined_pdf')}
                  activeOpacity={0.8}
                >
                  <FileText size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.pdfPickerBtnText}>Choose Another PDF</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.pdfPickerBtn}
                onPress={() => pickPDF('combined_pdf')}
                activeOpacity={0.8}
              >
                <FileText size={18} color="#4F46E5" style={{ marginRight: 6 }} />
                <ThemedText style={styles.pdfPickerBtnText}>Select Combined PDF File</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Mode 2: 4 Separate Documents Upload Cards (Original) */}
        {uploadMethod === 'separate' && REPO_KIT_DOCS.map((doc, index) => {
          const hasPhoto = !!photos[doc.key];
          const isUploading = uploading[doc.key];
          const fileType = fileTypes[doc.key];

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
                    <ThemedText style={styles.docDoneBadgeText}>✓ Loaded</ThemedText>
                  </View>
                )}
              </View>

              {/* Upload Mode Selector */}
              {!hasPhoto && !isUploading && (
                <View style={styles.uploadModeRow}>
                  <TouchableOpacity
                    style={[styles.uploadModeBtn, docUploadMode[doc.key] === 'image' && styles.uploadModeBtnActive]}
                    onPress={() => setDocUploadMode(prev => ({ ...prev, [doc.key]: 'image' }))}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.uploadModeText, docUploadMode[doc.key] === 'image' && styles.uploadModeTextActive]}>
                      📷 Image
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.uploadModeBtn, docUploadMode[doc.key] === 'pdf' && styles.uploadModeBtnActive]}
                    onPress={() => setDocUploadMode(prev => ({ ...prev, [doc.key]: 'pdf' }))}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.uploadModeText, docUploadMode[doc.key] === 'pdf' && styles.uploadModeTextActive]}>
                      📄 PDF File
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              {isUploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <ThemedText style={styles.uploadingText}>Uploading to cloud...</ThemedText>
                </View>
              ) : hasPhoto ? (
                <View>
                  {fileType === 'pdf' ? (
                    <View style={styles.pdfPreviewCard}>
                      <FileText size={38} color="#EF4444" />
                      <ThemedText style={styles.pdfPreviewText}>PDF Document Selected</ThemedText>
                      {photos[doc.key].startsWith('http') ? (
                        <ThemedText style={styles.pdfSubText} numberOfLines={1}>
                          {photos[doc.key]}
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.pdfSubText} numberOfLines={1}>
                          Local File: {photos[doc.key].split('/').pop()}
                        </ThemedText>
                      )}
                    </View>
                  ) : (
                    <Image source={{ uri: photos[doc.key] }} style={styles.docPreview} />
                  )}

                  {docUploadMode[doc.key] === 'pdf' ? (
                    <TouchableOpacity
                      style={styles.pdfPickerBtn}
                      onPress={() => pickPDF(doc.key)}
                      activeOpacity={0.8}
                    >
                      <FileText size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.pdfPickerBtnText}>Choose Another PDF</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.captureActionRow, { marginTop: 10 }]}>
                      <TouchableOpacity
                        style={[styles.retakeActionBtn, { backgroundColor: '#EEF2FF', borderColor: '#DBEAFE' }]}
                        onPress={() => capturePhoto(doc.key)}
                        activeOpacity={0.7}
                      >
                        <Camera size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                        <ThemedText style={[styles.retakeActionBtnText, { color: '#4F46E5' }]}>Retake (Camera)</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.retakeActionBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                        onPress={() => pickFromGallery(doc.key)}
                        activeOpacity={0.7}
                      >
                        <ImageIcon size={14} color="#475569" style={{ marginRight: 4 }} />
                        <ThemedText style={[styles.retakeActionBtnText, { color: '#475569' }]}>Choose Gallery</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                docUploadMode[doc.key] === 'pdf' ? (
                  <TouchableOpacity
                    style={styles.pdfPickerBtn}
                    onPress={() => pickPDF(doc.key)}
                    activeOpacity={0.8}
                  >
                    <FileText size={18} color="#4F46E5" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.pdfPickerBtnText}>Select PDF Document</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.captureActionRow}>
                    <TouchableOpacity
                      style={[styles.captureActionBtn, { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' }]}
                      onPress={() => capturePhoto(doc.key)}
                      activeOpacity={0.8}
                    >
                      <Camera size={18} color="#4F46E5" style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.captureActionBtnText, { color: '#4F46E5' }]}>Camera</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.captureActionBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                      onPress={() => pickFromGallery(doc.key)}
                      activeOpacity={0.8}
                    >
                      <ImageIcon size={18} color="#475569" style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.captureActionBtnText, { color: '#475569' }]}>Gallery</ThemedText>
                    </TouchableOpacity>
                  </View>
                )
              )}
            </View>
          );
        })}

        {/* Progress Indicator */}
        {uploadMethod !== null && (
          <>
            <View style={styles.progressBar}>
              {uploadMethod === 'single_pdf' ? (
                <View
                  style={[styles.progressDot, !!photos.combined_pdf && styles.progressDotDone, { width: 40 }]}
                />
              ) : (
                REPO_KIT_DOCS.map(doc => (
                  <View
                    key={doc.key}
                    style={[styles.progressDot, photos[doc.key] && styles.progressDotDone]}
                  />
                ))
              )}
            </View>
            <ThemedText style={styles.progressText}>
              {uploadMethod === 'single_pdf'
                ? (photos.combined_pdf ? 'Combined PDF loaded successfully' : 'No PDF selected yet')
                : `${REPO_KIT_DOCS.filter(d => photos[d.key]).length} / ${REPO_KIT_DOCS.length} documents captured`}
            </ThemedText>
          </>
        )}

        {/* Submit Button */}
        {uploadMethod !== null && (
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
                  {allPhotosReady
                    ? (uploadMethod === 'single_pdf' ? 'Submit Combined PDF & Convert' : 'Submit Repo Kit & Convert to Pakka')
                    : (uploadMethod === 'single_pdf' ? 'Select Combined PDF First' : 'Complete All 4 Documents First')}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Upload Mode Initial Selection Modal */}
        <Modal
          visible={uploadMethod === null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => router.back()}
        >
          <View style={styles.methodOverlay}>
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <FileText size={28} color="#4F46E5" />
                <ThemedText style={styles.methodTitle}>Repo Kit Upload Method</ThemedText>
              </View>
              <ThemedText style={styles.methodDesc}>
                Choose how you want to upload the repo kit documents to convert this vehicle to PAKKA status.
              </ThemedText>

              <TouchableOpacity
                style={[styles.methodBtn, styles.methodBtnRecommend]}
                activeOpacity={0.8}
                onPress={() => setUploadMethod('single_pdf')}
              >
                <View style={styles.methodBtnIconCol}>
                  <FileText size={22} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ThemedText style={styles.methodBtnTitle}>Single Combined PDF</ThemedText>
                    <View style={styles.recommendBadge}>
                      <ThemedText style={styles.recommendBadgeText}>Recommended</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.methodBtnDesc}>
                    Upload one combined PDF file containing all pages in one go
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.methodBtn}
                activeOpacity={0.8}
                onPress={() => setUploadMethod('separate')}
              >
                <View style={[styles.methodBtnIconCol, { backgroundColor: '#F1F5F9' }]}>
                  <ImageIcon size={22} color="#64748B" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.methodBtnTitle}>4 Separate Documents</ThemedText>
                  <ThemedText style={styles.methodBtnDesc}>
                    Upload individual documents/images for each of the 4 slots
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.methodCancelBtn}
                activeOpacity={0.7}
                onPress={() => router.back()}
              >
                <ThemedText style={styles.methodCancelText}>Cancel & Go Back</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
            <View style={styles.successIconWrapper}>
              <Check size={36} color="#FFFFFF" />
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
                  {pakkaDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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

  vehicleBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  vehicleThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  vehicleThumbnailPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vehicleMeta: {
    flex: 1,
    gap: 4,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inventoryNo: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },

  dateSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  dateSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    height: 44,
  },
  datePickerBtnText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  changeDateLabel: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
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
    backgroundColor: '#4F46E5',
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
    backgroundColor: '#EEF2FF',
  },
  captureDocBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },

  captureActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  captureActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
  },
  captureActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  retakeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  retakeActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  uploadModeRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  uploadModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  uploadModeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  uploadModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  uploadModeTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  pdfPreviewCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
    width: '100%',
  },
  pdfPreviewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  pdfSubText: {
    fontSize: 11,
    color: '#EF4444',
    textAlign: 'center',
    maxWidth: '90%',
  },
  pdfPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#EEF2FF',
    width: '100%',
  },
  pdfPickerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },

  docPreview: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'cover' },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  retakeBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },

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
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    height: 52,
    marginTop: 10,
    shadowColor: '#4F46E5',
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
  successIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
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

  // Upload Method Selection Styles
  methodOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  methodDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 20,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  methodBtnRecommend: {
    backgroundColor: '#EEF2FF',
    borderColor: '#BFDBFE',
  },
  methodBtnIconCol: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  methodBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  methodBtnDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 14,
  },
  recommendBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  recommendBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  methodCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  methodCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },

  // Toggle mode switch components
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  switchMethodBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchMethodText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
});
