import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  ScanText,
  Copy,
  Check,
  Share2,
  Trash2,
  RefreshCw,
  Sparkles,
  FileText,
  Clock,
  HelpCircle,
} from 'lucide-react-native';
import { extractRawTextFromDocument, GeneralOcrResult } from '@/services/ocrService';

export default function OcrScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<GeneralOcrResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const triggerHaptic = (type: 'light' | 'success' | 'error' = 'light') => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  // Pick Image from Camera
  const handlePickCamera = async () => {
    try {
      triggerHaptic();
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera access is required to capture documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setOcrResult(null);
        setCopied(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not open camera');
    }
  };

  // Pick Image from Gallery
  const handlePickGallery = async () => {
    try {
      triggerHaptic();
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery access is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setOcrResult(null);
        setCopied(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not pick image from gallery');
    }
  };

  // Run OCR
  const handleExtractText = async () => {
    if (!imageUri) return;

    setLoading(true);
    setStatusMessage('Preprocessing image and running OCR...');
    triggerHaptic();

    try {
      const result = await extractRawTextFromDocument(imageUri);
      setOcrResult(result);
      triggerHaptic('success');
    } catch (err: any) {
      triggerHaptic('error');
      Alert.alert(
        'OCR Extraction Error',
        err.message || 'Failed to extract text from this image. Please ensure the document is clear and well-lit.'
      );
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  // Copy to Clipboard
  const handleCopy = async () => {
    if (!ocrResult?.rawText) return;
    try {
      triggerHaptic('success');
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(ocrResult.rawText);
      } else {
        // Fallback or React Native Share/Clipboard
        await Share.share({ message: ocrResult.rawText });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignore
    }
  };

  // Share Extracted Text
  const handleShare = async () => {
    if (!ocrResult?.rawText) return;
    try {
      triggerHaptic();
      await Share.share({
        title: 'Extracted OCR Text',
        message: ocrResult.rawText,
      });
    } catch (err: any) {
      console.warn('Share error:', err);
    }
  };

  // Reset / Clear
  const handleReset = () => {
    triggerHaptic();
    setImageUri(null);
    setOcrResult(null);
    setCopied(false);
  };

  const lineCount = ocrResult?.rawText ? ocrResult.rawText.split('\n').length : 0;
  const charCount = ocrResult?.rawText ? ocrResult.rawText.length : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>OCR Scanner</Text>
          <Text style={styles.headerSubtitle}>Extract exact formatted text from image</Text>
        </View>
        {(imageUri || ocrResult) && (
          <TouchableOpacity
            style={styles.resetHeaderButton}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload Action Buttons Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Document or Image</Text>
          <Text style={styles.cardSubtitle}>
            Capture a clear photo or select a document from your device gallery.
          </Text>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cameraButton]}
              onPress={handlePickCamera}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Camera size={22} color="#0062FF" />
              </View>
              <Text style={styles.actionButtonText}>Camera</Text>
              <Text style={styles.actionButtonSubtext}>Take a photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.galleryButton]}
              onPress={handlePickGallery}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <ImageIcon size={22} color="#7C3AED" />
              </View>
              <Text style={[styles.actionButtonText, { color: '#7C3AED' }]}>Gallery</Text>
              <Text style={styles.actionButtonSubtext}>Choose from files</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Image Preview & Scan Action */}
        {imageUri && (
          <View style={styles.card}>
            <View style={styles.imageHeaderRow}>
              <View style={styles.imageLabelGroup}>
                <FileText size={16} color="#0062FF" />
                <Text style={styles.imageHeaderText}>Document Preview</Text>
              </View>
              <TouchableOpacity
                onPress={handleReset}
                activeOpacity={0.7}
                style={styles.removeImageBtn}
              >
                <Text style={styles.removeImageText}>Remove</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            </View>

            <TouchableOpacity
              style={[styles.extractButton, loading && styles.extractButtonDisabled]}
              onPress={handleExtractText}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.extractButtonText}>
                    {statusMessage || 'Extracting Text...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonContentRow}>
                  <ScanText size={20} color="#FFFFFF" />
                  <Text style={styles.extractButtonText}>
                    {ocrResult ? 'Re-scan Text' : 'Extract Formatted Text'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* OCR Result Box */}
        {ocrResult && (
          <View style={[styles.card, styles.resultCard]}>
            {/* Header with Stats & Actions */}
            <View style={styles.resultHeader}>
              <View>
                <View style={styles.resultBadgeRow}>
                  <Sparkles size={16} color="#16A34A" />
                  <Text style={styles.resultTitle}>Extracted Text</Text>
                </View>
                <View style={styles.statsRow}>
                  <Clock size={12} color="#64748B" />
                  <Text style={styles.statsText}>
                    {ocrResult.processingTimeMs > 0
                      ? `${(ocrResult.processingTimeMs / 1000).toFixed(1)}s`
                      : 'Done'}
                    {'  •  '}
                    {lineCount} lines{'  •  '}
                    {charCount} chars
                  </Text>
                </View>
              </View>

              <View style={styles.resultActionsGroup}>
                <TouchableOpacity
                  style={[styles.toolButton, copied && styles.copiedToolButton]}
                  onPress={handleCopy}
                  activeOpacity={0.7}
                >
                  {copied ? (
                    <>
                      <Check size={14} color="#16A34A" />
                      <Text style={[styles.toolButtonText, { color: '#16A34A' }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={14} color="#0062FF" />
                      <Text style={styles.toolButtonText}>Copy</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolButton}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Share2 size={14} color="#475569" />
                  <Text style={[styles.toolButtonText, { color: '#475569' }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Extracted Text Box (Preserving exact layout and formatting) */}
            <View style={styles.textBoxContainer}>
              <TextInput
                style={styles.ocrTextInput}
                multiline
                editable={true}
                value={ocrResult.rawText}
                onChangeText={(newText) =>
                  setOcrResult({ ...ocrResult, rawText: newText })
                }
                scrollEnabled={false}
                placeholder="No text extracted"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        )}

        {/* Tips / Instructions */}
        {!imageUri && (
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeaderRow}>
              <HelpCircle size={18} color="#6366F1" />
              <Text style={styles.tipsTitle}>Tips for Best OCR Accuracy</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Ensure good lighting and avoid reflections or heavy shadows on the document.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Hold the phone steady to ensure sharp text focus without motion blur.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Extracts text from invoices, release orders, vehicle papers, RC, and letters in exact line formatting.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  resetHeaderButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  cameraButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  galleryButton: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0062FF',
  },
  actionButtonSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imageLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  removeImageBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeImageText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  imagePreviewContainer: {
    height: 220,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  extractButton: {
    backgroundColor: '#0062FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extractButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  resultCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#FFFFFF',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  resultBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statsText: {
    fontSize: 11,
    color: '#64748B',
  },
  resultActionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  copiedToolButton: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0062FF',
  },
  textBoxContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    minHeight: 180,
  },
  ocrTextInput: {
    fontSize: 13,
    lineHeight: 20,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top',
    padding: 0,
    margin: 0,
  },
  tipsCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338CA',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tipBullet: {
    fontSize: 14,
    color: '#6366F1',
    marginRight: 6,
    lineHeight: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
