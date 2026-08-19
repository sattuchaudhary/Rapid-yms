import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft,
  Calendar,
  Camera,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  Upload,
  Warehouse,
  ShieldCheck,
  X,
  FileCheck,
  Info,
} from 'lucide-react-native';
import { getVehicleById, updateVehicle } from '@/services/api';

const REPO_KIT_DOCS = [
  {
    key: 'pre_intimation',
    label: 'Pre-Intimation Letter',
    sublabel: 'Notice letter issued before repossession',
    icon: FileText,
  },
  {
    key: 'post_intimation',
    label: 'Post-Intimation Letter',
    sublabel: 'Notice letter issued after vehicle repossession',
    icon: FileCheck,
  },
  {
    key: 'yard_inventory',
    label: 'Yard Inventory Sheet',
    sublabel: 'Physical inventory checklist at yard entry',
    icon: Warehouse,
  },
  {
    key: 'bank_inventory',
    label: 'Bank Inventory Sheet',
    sublabel: 'Bank audit and inventory verification sheet',
    icon: ShieldCheck,
  },
];

export default function KachhaToPakkaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  // Transition Date
  const [pakkaDate, setPakkaDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Document Upload Method
  const [uploadMethod, setUploadMethod] = useState<'separate' | 'single_pdf'>('separate');

  // Documents state: { key: { uri, name, type } }
  const [docs, setDocs] = useState<Record<string, { uri: string; name?: string; type: 'image' | 'pdf' }>>({});

  // Custom Upload Modal State
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const fetchVehicle = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getVehicleById(id);
      const data = res?.data || res;
      setVehicle(data);

      if (data?.yardStatus === 'PAKKA') {
        Alert.alert(
          'Already Pakka',
          'This vehicle has already been converted to Pakka Yard status.',
          [{ text: 'Go Back', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      console.warn('[Fetch Vehicle Error]', err);
      Alert.alert('Error', err?.message || 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPakkaDate(selectedDate);
    }
  };

  // Open upload source bottom sheet
  const openUploadModal = (docKey: string) => {
    setActiveDocKey(docKey);
  };

  const closeUploadModal = () => {
    setActiveDocKey(null);
  };

  // 1. Camera Pick
  const handleCameraCapture = async () => {
    const docKey = activeDocKey;
    closeUploadModal();
    if (!docKey) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDocs((prev) => ({
          ...prev,
          [docKey]: { uri: result.assets[0].uri, type: 'image' },
        }));
      }
    } catch (err) {
      console.warn('[Camera Error]', err);
    }
  };

  // 2. Gallery Pick
  const handleGalleryPick = async () => {
    const docKey = activeDocKey;
    closeUploadModal();
    if (!docKey) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDocs((prev) => ({
          ...prev,
          [docKey]: { uri: result.assets[0].uri, type: 'image' },
        }));
      }
    } catch (err) {
      console.warn('[Gallery Error]', err);
    }
  };

  // 3. Document / PDF Pick
  const handlePdfPick = async () => {
    const docKey = activeDocKey;
    closeUploadModal();
    if (!docKey) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDocs((prev) => ({
          ...prev,
          [docKey]: {
            uri: result.assets[0].uri,
            name: result.assets[0].name,
            type: 'pdf',
          },
        }));
      }
    } catch (err) {
      console.warn('[DocPicker Error]', err);
    }
  };

  // Submit Kachha to Pakka Transition
  const handleSubmitConversion = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setSubmitting(true);
      const dateStr = pakkaDate.toISOString();

      // Update vehicle status in backend
      await updateVehicle(id!, {
        yardStatus: 'PAKKA',
        pakkaDate: dateStr,
        repoKitDate: dateStr,
      });

      setSuccessModal(true);
    } catch (err: any) {
      console.warn('[KachhaToPakka Error]', err);
      Alert.alert('Update Failed', err?.message || 'Failed to convert vehicle status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishSuccess = () => {
    setSuccessModal(false);
    router.replace(`/tenant_admin/admin/vehicles/details/${id}` as any);
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Header Bar */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={24} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Convert to Pakka</Text>
            <Text style={styles.headerSub}>Pakka Yard Inventory Transition</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading vehicle details...</Text>
        </View>
      ) : vehicle ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 85 }]}
        >
          {/* Vehicle Snapshot Card */}
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleCardRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.vehicleNumber}>{(vehicle.vehicleNumber || 'NO NUMBER').toUpperCase()}</Text>
                <Text style={styles.vehicleDetailsText}>
                  {vehicle.brand ? `${vehicle.brand} ` : ''}{vehicle.model || 'Vehicle'} • {vehicle.bankName || vehicle.bank?.name || 'Bank'}
                </Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Kachha Status</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Pakka / Repo Kit Date */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Pakka Transition Date</Text>
            <Text style={styles.sectionSub}>Date when repo kit documents were verified</Text>

            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <View style={styles.dateSelectorLeft}>
                <Calendar size={18} color="#0062FF" strokeWidth={2.2} />
                <Text style={styles.dateSelectorText}>
                  {pakkaDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.changeBtnText}>Change Date</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={pakkaDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Section 2: Repo Kit Documents */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Repo Kit Documents</Text>
            <Text style={styles.sectionSub}>Upload mandatory notice letters and inventory sheets</Text>

            {/* Toggle Mode: 4 Separate vs Single PDF */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, uploadMethod === 'separate' && styles.toggleBtnActive]}
                onPress={() => setUploadMethod('separate')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, uploadMethod === 'separate' && styles.toggleBtnTextActive]}>
                  Separate Documents (4)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, uploadMethod === 'single_pdf' && styles.toggleBtnActive]}
                onPress={() => setUploadMethod('single_pdf')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, uploadMethod === 'single_pdf' && styles.toggleBtnTextActive]}>
                  Single PDF File
                </Text>
              </TouchableOpacity>
            </View>

            {uploadMethod === 'separate' ? (
              /* 4 Documents List */
              <View style={styles.docsContainer}>
                {REPO_KIT_DOCS.map((doc) => {
                  const uploaded = docs[doc.key];
                  const Icon = doc.icon;

                  return (
                    <View key={doc.key} style={styles.docItemCard}>
                      <View style={styles.docLeftRow}>
                        <View style={styles.docIconBox}>
                          <Icon size={16} color="#0062FF" strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docName}>{doc.label}</Text>
                          <Text style={styles.docSubName}>{doc.sublabel}</Text>
                        </View>
                      </View>

                      {uploaded ? (
                        <View style={styles.attachedBox}>
                          <View style={styles.attachedLeft}>
                            <CheckCircle2 size={15} color="#059669" strokeWidth={2.4} />
                            <Text style={styles.attachedName} numberOfLines={1}>
                              {uploaded.type === 'pdf' ? uploaded.name || 'PDF File Attached' : 'Photo Attached'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              const copy = { ...docs };
                              delete copy[doc.key];
                              setDocs(copy);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <X size={15} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.attachBtn}
                          onPress={() => openUploadModal(doc.key)}
                          activeOpacity={0.75}
                        >
                          <Upload size={14} color="#0062FF" />
                          <Text style={styles.attachBtnText}>Attach Document</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              /* Single PDF Drop Box */
              <View style={styles.singlePdfWrapper}>
                {docs['combined_pdf'] ? (
                  <View style={styles.attachedBox}>
                    <View style={styles.attachedLeft}>
                      <CheckCircle2 size={16} color="#059669" strokeWidth={2.4} />
                      <Text style={styles.attachedName} numberOfLines={1}>
                        {docs['combined_pdf'].name || 'Combined Repo Kit PDF Attached'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const copy = { ...docs };
                        delete copy['combined_pdf'];
                        setDocs(copy);
                      }}
                    >
                      <X size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.pdfUploadBox}
                    onPress={() => openUploadModal('combined_pdf')}
                    activeOpacity={0.75}
                  >
                    <Upload size={22} color="#0062FF" strokeWidth={2} />
                    <Text style={styles.pdfUploadTitle}>Upload Combined Repo Kit PDF</Text>
                    <Text style={styles.pdfUploadSub}>Select a single PDF file containing all 4 letters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Info Note */}
          <View style={styles.infoBanner}>
            <Info size={15} color="#0062FF" style={{ marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Converting will update vehicle status to <Text style={{ fontWeight: '800' }}>PAKKA</Text> and include it in active yard stock.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      {/* Sticky Bottom Button */}
      {!loading && vehicle && (
        <View style={[styles.stickyFooter, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={[styles.submitActionBtn, submitting && styles.submitActionBtnDisabled]}
            onPress={handleSubmitConversion}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.submitActionBtnText}>Convert to Pakka</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 🌟 Custom Upload Source Bottom Sheet Modal with Explicit Close Button */}
      <Modal
        visible={!!activeDocKey}
        transparent
        animationType="slide"
        onRequestClose={closeUploadModal}
      >
        <TouchableWithoutFeedback onPress={closeUploadModal}>
          <View style={styles.uploadModalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.uploadModalSheet, { paddingBottom: insets.bottom + 16 }]}>
                {/* Drag Handle */}
                <View style={styles.sheetHandle} />

                {/* Modal Header with Close Button */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Upload Document</Text>
                  <TouchableOpacity
                    style={styles.sheetCloseBtn}
                    onPress={closeUploadModal}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={18} color="#64748B" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Options List */}
                <View style={styles.uploadOptionsList}>
                  {/* 1. Camera Option */}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={handleCameraCapture}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Camera size={20} color="#0062FF" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Take Photo with Camera</Text>
                      <Text style={styles.optionSub}>Capture a photo of the document</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Gallery Option */}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={handleGalleryPick}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <ImageIcon size={20} color="#059669" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Choose from Gallery</Text>
                      <Text style={styles.optionSub}>Select an existing image from phone</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 3. PDF Option */}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={handlePdfPick}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#FFF1F2' }]}>
                      <FileText size={20} color="#E11D48" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Select PDF Document</Text>
                      <Text style={styles.optionSub}>Upload a PDF file from phone storage</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.cancelSheetBtn}
                  onPress={closeUploadModal}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelSheetText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.successModalBox}>
            <View style={styles.successIcon}>
              <CheckCircle2 size={40} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <Text style={styles.successModalTitle}>Converted to Pakka!</Text>
            <Text style={styles.successModalSub}>
              {vehicle?.vehicleNumber?.toUpperCase()} is now successfully converted to <Text style={{ fontWeight: '800', color: '#0062FF' }}>PAKKA</Text> Yard inventory.
            </Text>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={handleFinishSuccess} activeOpacity={0.85}>
              <Text style={styles.modalDoneBtnText}>View Vehicle Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vehicleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  vehicleNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  vehicleDetailsText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statusPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: -4,
    marginBottom: 2,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0062FF',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  docsContainer: {
    gap: 8,
  },
  docItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  docLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  docSubName: {
    fontSize: 10.5,
    color: '#64748B',
  },
  attachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  attachedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  attachedName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    gap: 5,
  },
  attachBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  singlePdfWrapper: {
    paddingVertical: 2,
  },
  pdfUploadBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pdfUploadTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0062FF',
  },
  pdfUploadSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerText: {
    fontSize: 11.5,
    color: '#1E293B',
    lineHeight: 16,
    flex: 1,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  submitActionBtn: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#0062FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  submitActionBtnDisabled: {
    opacity: 0.7,
  },
  submitActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // 🌟 Custom Upload Source Bottom Sheet Modal
  uploadModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  uploadModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOptionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  cancelSheetBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelSheetText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },

  // Success Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successModalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  successModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  successModalSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalDoneBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalDoneBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
