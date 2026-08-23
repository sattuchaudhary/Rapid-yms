import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  FlatList,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Camera,
  X,
  FileText,
  CheckCircle2,
  Maximize2,
  Car,
  FileCheck,
  ShieldCheck,
  MoreVertical,
  Download,
  Printer,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Share2,
  Warehouse,
  ImageIcon,
  Plus,
  PlusCircle,
  UploadCloud,
  FileUp,
} from 'lucide-react-native';
import { apiRequest } from '@/services/api';

// Safely resolve expo-media-library without crashing if not in compiled native binary
let SafeMediaLibrary: any = null;
try {
  SafeMediaLibrary = require('expo-media-library');
} catch (e) {
  SafeMediaLibrary = null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 38) / 2;

export interface VehiclePhotosProps {
  vehicle: any;
  onRefresh?: () => void;
}

export type PhotoCategoryTab = 'entry' | 'pakka' | 'release' | 'additional';

export interface GalleryPhotoItem {
  id?: string;
  key: string;
  title: string;
  photoType: string;
  url: string;
  isPdf?: boolean;
}

// 1. Mandatory Entry Angles
const ENTRY_MANDATORY_ANGLES = [
  { key: 'FRONT', label: 'Front View' },
  { key: 'REAR', label: 'Rear View' },
  { key: 'LEFT', label: 'Left Side' },
  { key: 'RIGHT', label: 'Right Side' },
  { key: 'ODOMETER', label: 'Odometer / Meter' },
  { key: 'CHASSIS', label: 'Chassis Plate' },
];

// 2. Standard Pakka Docs
const PAKKA_STANDARD_DOCS = [
  { key: 'pre_intimation', label: 'Pre-Intimation Letter' },
  { key: 'post_intimation', label: 'Post-Intimation Letter' },
  { key: 'yard_inventory', label: 'Yard Inventory Sheet' },
  { key: 'bank_inventory', label: 'Bank Inventory Sheet' },
  { key: 'combined_pdf', label: 'Single Combined Repo PDF' },
];

/**
 * Helper: Trigger a browser download for a URL, working around cross-origin
 * <a download> limitations by fetching the bytes first and creating a
 * same-origin blob: URL. Falls back to opening in a new tab if the fetch
 * fails (e.g. the remote host blocks CORS entirely).
 */
async function webDownloadFile(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return true;
  } catch (err) {
    console.warn('[webDownloadFile] blob download failed, falling back to new tab:', err);
    try {
      window.open(url, '_blank');
    } catch {}
    return false;
  }
}

/**
 * Highly Polished 2D Zoom & Pan Slide Component
 * - 0-Conflict with FlatList swipe when scale is 1.0 (onMoveShouldSetPanResponder only claims when zoomed or pinching)
 * - Jump-Free finger transition (smoothly handles 2-finger pinch -> 1-finger pan transition)
 * - Aspect-Ratio letterbox aware pan boundaries (clamps strictly to real image dimensions)
 * - Double-Tap focal point zoom (zooms into the exact tapped area instead of dumb center)
 * - Single-Tap immersive mode toggle
 */
function ZoomableSlide({
  item,
  onToggleControls,
  onZoomChange,
}: {
  item: GalleryPhotoItem;
  onToggleControls: () => void;
  onZoomChange: (isZoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Track raw numerical values in refs for real-time gesture arithmetic
  const scaleVal = useRef(1);
  const panVal = useRef({ x: 0, y: 0 });

  // Natural aspect ratio calculation for strict letterbox-aware boundary clamping
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (item.url && !item.isPdf) {
      Image.getSize(
        item.url,
        (width, height) => {
          if (width > 0 && height > 0) {
            setAspectRatio(width / height);
          }
        },
        () => {
          setAspectRatio(SCREEN_WIDTH / (SCREEN_HEIGHT * 0.65));
        }
      );
    }
  }, [item.url]);

  useEffect(() => {
    const scaleSub = scale.addListener(({ value }) => {
      scaleVal.current = value;
      onZoomChange(value > 1.05);
    });
    const panSub = pan.addListener((value) => {
      panVal.current = value;
    });

    return () => {
      scale.removeListener(scaleSub);
      pan.removeListener(panSub);
    };
  }, []);

  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<any>(null);

  const initialDistanceRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchCountRef = useRef<number>(0);

  const getDistance = (touches: any[]) => {
    const [t1, t2] = touches;
    return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
  };

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  };

  // Calculate actual rendered dimensions (resizeMode="contain")
  const getMaxPanBounds = (currentScale: number) => {
    const screenRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
    let renderedWidth = SCREEN_WIDTH;
    let renderedHeight = SCREEN_HEIGHT;

    if (aspectRatio > screenRatio) {
      renderedWidth = SCREEN_WIDTH;
      renderedHeight = SCREEN_WIDTH / aspectRatio;
    } else {
      renderedHeight = SCREEN_HEIGHT;
      renderedWidth = SCREEN_HEIGHT * aspectRatio;
    }

    const maxPanX = Math.max(0, (renderedWidth * currentScale - SCREEN_WIDTH) / 2);
    const maxPanY = Math.max(0, (renderedHeight * currentScale - SCREEN_HEIGHT) / 2);
    return { maxPanX, maxPanY };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isMultiTouch = evt.nativeEvent.touches.length >= 2;
        const isZoomedPan =
          scaleVal.current > 1.05 &&
          (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4);
        return isMultiTouch || isZoomedPan;
      },
      onPanResponderGrant: (evt) => {
        initialPanRef.current = { x: panVal.current.x, y: panVal.current.y };
        initialScaleRef.current = scaleVal.current;
        lastTouchCountRef.current = evt.nativeEvent.touches.length;

        if (evt.nativeEvent.touches.length >= 2) {
          initialDistanceRef.current = getDistance(evt.nativeEvent.touches);
        } else if (evt.nativeEvent.touches.length === 1) {
          initialTouchPosRef.current = {
            x: evt.nativeEvent.touches[0].pageX,
            y: evt.nativeEvent.touches[0].pageY,
          };
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        const touchCount = touches.length;

        if (touchCount !== lastTouchCountRef.current) {
          lastTouchCountRef.current = touchCount;
          initialPanRef.current = { x: panVal.current.x, y: panVal.current.y };
          initialScaleRef.current = scaleVal.current;

          if (touchCount >= 2) {
            initialDistanceRef.current = getDistance(touches);
          } else if (touchCount === 1) {
            initialTouchPosRef.current = {
              x: touches[0].pageX,
              y: touches[0].pageY,
            };
          }
          return;
        }

        if (touchCount >= 2) {
          const currentDistance = getDistance(touches);
          if (initialDistanceRef.current > 0) {
            const distanceRatio = currentDistance / initialDistanceRef.current;
            const newScale = clamp(initialScaleRef.current * distanceRatio, 1, 4.5);
            scale.setValue(newScale);

            const { maxPanX, maxPanY } = getMaxPanBounds(newScale);
            const clampedX = clamp(panVal.current.x, -maxPanX, maxPanX);
            const clampedY = clamp(panVal.current.y, -maxPanY, maxPanY);
            pan.setValue({ x: clampedX, y: clampedY });
          }
        } else if (touchCount === 1 && scaleVal.current > 1.05) {
          const deltaX = touches[0].pageX - initialTouchPosRef.current.x;
          const deltaY = touches[0].pageY - initialTouchPosRef.current.y;

          const targetX = initialPanRef.current.x + deltaX;
          const targetY = initialPanRef.current.y + deltaY;

          const { maxPanX, maxPanY } = getMaxPanBounds(scaleVal.current);

          pan.setValue({
            x: clamp(targetX, -maxPanX, maxPanX),
            y: clamp(targetY, -maxPanY, maxPanY),
          });
        }
      },
      onPanResponderRelease: () => {
        if (scaleVal.current <= 1.05) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
          ]).start();
        } else {
          const { maxPanX, maxPanY } = getMaxPanBounds(scaleVal.current);
          Animated.spring(pan, {
            toValue: {
              x: clamp(panVal.current.x, -maxPanX, maxPanX),
              y: clamp(panVal.current.y, -maxPanY, maxPanY),
            },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleTouchPress = (evt: any) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 280;
    const { locationX, locationY } = evt.nativeEvent;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (scaleVal.current > 1.2) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
        ]).start();
      } else {
        const TARGET_SCALE = 2.5;
        const { maxPanX, maxPanY } = getMaxPanBounds(TARGET_SCALE);

        const tapOffsetX = (SCREEN_WIDTH / 2 - locationX) * (TARGET_SCALE - 1);
        const tapOffsetY = (SCREEN_HEIGHT / 2 - locationY) * (TARGET_SCALE - 1);

        Animated.parallel([
          Animated.spring(scale, { toValue: TARGET_SCALE, useNativeDriver: true }),
          Animated.spring(pan, {
            toValue: {
              x: clamp(tapOffsetX, -maxPanX, maxPanX),
              y: clamp(tapOffsetY, -maxPanY, maxPanY),
            },
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        onToggleControls();
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  return (
    <View style={styles.slideItem} {...panResponder.panHandlers}>
      <TouchableWithoutFeedback onPress={handleTouchPress}>
        <Animated.View
          style={[
            styles.animatedImageWrapper,
            {
              transform: [
                { scale },
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: item.url }}
            style={styles.slideImage}
            resizeMode="contain"
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

export default function VehiclePhotos({ vehicle, onRefresh }: VehiclePhotosProps) {
  const [activeTab, setActiveTab] = useState<PhotoCategoryTab>('entry');

  // Gallery Lightbox state
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryList, setGalleryList] = useState<GalleryPhotoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 3-Dots Action Sheet state
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatusText, setActionStatusText] = useState('');

  // Upload for Missing / New Field State
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{
    key: string;
    label: string;
    photoType: string;
    category: PhotoCategoryTab;
  } | null>(null);

  const rawPhotos: any[] = vehicle?.photos || [];
  const releaseData = vehicle?.release;

  const getPhotoUrl = (item: any): string => {
    if (typeof item === 'string') return item;
    return item?.s3Url || item?.fileUrl || item?.url || '';
  };

  const isPdfUrl = (url: string): boolean => {
    if (!url) return false;
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
  };

  const handleOpenDoc = async (url: string) => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open document.');
      });
    }
  };

  const isMatchingEntryAngle = (photo: any, angleKey: string) => {
    const raw = (photo?.photoType || photo?.angle || photo?.title || photo?.type || '').toUpperCase();
    if (angleKey === 'REAR') return raw === 'REAR' || raw === 'BACK' || raw.includes('REAR') || raw.includes('BACK');
    if (angleKey === 'FRONT') return raw === 'FRONT' || raw.includes('FRONT');
    if (angleKey === 'LEFT') return raw === 'LEFT' || raw.includes('LEFT');
    if (angleKey === 'RIGHT') return raw === 'RIGHT' || raw.includes('RIGHT');
    if (angleKey === 'ODOMETER') return raw === 'ODOMETER' || raw === 'METER' || raw.includes('ODOMETER') || raw.includes('METER');
    if (angleKey === 'CHASSIS') return raw === 'CHASSIS' || raw.includes('CHASSIS');
    return raw === angleKey;
  };

  const isMatchingPakkaDoc = (photo: any, docKey: string) => {
    const raw = (photo?.photoType || photo?.angle || photo?.title || photo?.type || '').toLowerCase();
    if (docKey === 'pre_intimation') return raw.includes('pre_intimation') || raw.includes('pre-intimation');
    if (docKey === 'post_intimation') return raw.includes('post_intimation') || raw.includes('post-intimation');
    if (docKey === 'yard_inventory') return raw.includes('yard_inventory') || raw.includes('yard-inventory');
    if (docKey === 'bank_inventory') return raw.includes('bank_inventory') || raw.includes('bank-inventory');
    if (docKey === 'combined_pdf') return raw.includes('combined_pdf') || raw.includes('repokit') || raw.includes('pakka_doc');
    return raw.includes(docKey);
  };

  // Categorize Data
  const data = useMemo(() => {
    const consumedIds = new Set<string>();

    // 1. Entry Photos
    const entryList: Array<{ id?: string; key: string; label: string; photoType: string; url: string | null; isMandatory: boolean; isPdf: boolean }> = [];
    ENTRY_MANDATORY_ANGLES.forEach((angle) => {
      const match = rawPhotos.find((p) => isMatchingEntryAngle(p, angle.key));
      if (match) consumedIds.add(match.id || match.s3Url || angle.key);
      const url = match ? getPhotoUrl(match) : null;
      entryList.push({
        id: match?.id,
        key: angle.key,
        label: angle.label,
        photoType: match?.photoType || angle.key.toLowerCase(),
        url,
        isMandatory: true,
        isPdf: url ? isPdfUrl(url) : false,
      });
    });

    rawPhotos.forEach((p) => {
      if (consumedIds.has(p.id || p.s3Url)) return;
      const type = (p?.photoType || p?.angle || p?.title || p?.type || '').toLowerCase();
      if (
        type.includes('dashboard') ||
        type.includes('engine') ||
        type.includes('customer') ||
        type.includes('gate_overview') ||
        type.includes('entry') ||
        type.includes('overview')
      ) {
        consumedIds.add(p.id || p.s3Url);
        const url = getPhotoUrl(p);
        entryList.push({
          id: p.id,
          key: p.id || type,
          label: type.replace(/_/g, ' ').toUpperCase(),
          photoType: p.photoType || type,
          url,
          isMandatory: false,
          isPdf: isPdfUrl(url),
        });
      }
    });

    // 2. Pakka Docs
    const pakkaList: Array<{ id?: string; key: string; label: string; photoType: string; url: string | null; isPdf: boolean }> = [];
    PAKKA_STANDARD_DOCS.forEach((doc) => {
      const match = rawPhotos.find((p) => isMatchingPakkaDoc(p, doc.key));
      if (match) consumedIds.add(match.id || match.s3Url || doc.key);
      const url = match ? getPhotoUrl(match) : null;
      pakkaList.push({
        id: match?.id,
        key: doc.key,
        label: doc.label,
        photoType: match?.photoType || doc.key,
        url,
        isPdf: url ? isPdfUrl(url) : false,
      });
    });

    rawPhotos.forEach((p) => {
      if (consumedIds.has(p.id || p.s3Url)) return;
      const type = (p?.photoType || p?.angle || p?.title || p?.type || '').toLowerCase();
      if (
        type.includes('repokit') ||
        type.includes('pakka') ||
        type.includes('intimation') ||
        type.includes('loan') ||
        type.includes('noc') ||
        type.includes('surrender') ||
        type.includes('police') ||
        type.includes('insurance') ||
        type.includes('rc_copy')
      ) {
        consumedIds.add(p.id || p.s3Url);
        const url = getPhotoUrl(p);
        pakkaList.push({
          id: p.id,
          key: p.id || type,
          label: type.replace(/_/g, ' ').toUpperCase(),
          photoType: p.photoType || type,
          url,
          isPdf: isPdfUrl(url),
        });
      }
    });

    // 3. Release Docs
    const releaseList: Array<{ id?: string; key: string; label: string; photoType: string; url: string; isPdf: boolean }> = [];
    if (releaseData) {
      if (releaseData.releaseLetter) releaseList.push({ key: 'rel_1', label: 'Release Letter / Order', photoType: 'release_letter', url: releaseData.releaseLetter, isPdf: isPdfUrl(releaseData.releaseLetter) });
      if (releaseData.customerIdProof) releaseList.push({ key: 'rel_2', label: 'Customer ID Proof (Aadhar)', photoType: 'customer_id', url: releaseData.customerIdProof, isPdf: isPdfUrl(releaseData.customerIdProof) });
      if (releaseData.paymentReceipt) releaseList.push({ key: 'rel_3', label: 'Payment / Dues Receipt', photoType: 'payment_receipt', url: releaseData.paymentReceipt, isPdf: isPdfUrl(releaseData.paymentReceipt) });
      if (releaseData.thirdPartyIdProof) releaseList.push({ key: 'rel_4', label: 'Third Party ID Proof', photoType: 'third_party_id', url: releaseData.thirdPartyIdProof, isPdf: isPdfUrl(releaseData.thirdPartyIdProof) });
      if (releaseData.handoverPhoto1) releaseList.push({ key: 'rel_5', label: 'Customer Handover Photo', photoType: 'handover_photo_1', url: releaseData.handoverPhoto1, isPdf: isPdfUrl(releaseData.handoverPhoto1) });
      if (releaseData.handoverPhoto2) releaseList.push({ key: 'rel_6', label: 'Delivery Condition Photo', photoType: 'handover_photo_2', url: releaseData.handoverPhoto2, isPdf: isPdfUrl(releaseData.handoverPhoto2) });
      if (releaseData.gatePassUrl) releaseList.push({ key: 'rel_7', label: 'Gate Pass PDF', photoType: 'gate_pass', url: releaseData.gatePassUrl, isPdf: isPdfUrl(releaseData.gatePassUrl) });
    }

    rawPhotos.forEach((p) => {
      if (consumedIds.has(p.id || p.s3Url)) return;
      const type = (p?.photoType || p?.angle || p?.title || p?.type || '').toLowerCase();
      if (
        type.includes('release') ||
        type.includes('handover') ||
        type.includes('gate_pass') ||
        type.includes('gatepass') ||
        type.includes('exit') ||
        type.includes('delivery')
      ) {
        consumedIds.add(p.id || p.s3Url);
        const url = getPhotoUrl(p);
        releaseList.push({
          id: p.id,
          key: p.id || type,
          label: type.replace(/_/g, ' ').toUpperCase(),
          photoType: p.photoType || type,
          url,
          isPdf: isPdfUrl(url),
        });
      }
    });

    // 4. Additional Photos
    const additionalList: Array<{ id?: string; key: string; label: string; photoType: string; url: string; isPdf: boolean }> = [];
    rawPhotos.forEach((p, idx) => {
      if (consumedIds.has(p.id || p.s3Url)) return;
      const url = getPhotoUrl(p);
      const title = p.photoType
        ? p.photoType.replace(/_/g, ' ').toUpperCase()
        : p.angle || p.title || `Photo #${idx + 1}`;
      additionalList.push({
        id: p.id,
        key: p.id || `add-${idx}`,
        label: title,
        photoType: p.photoType || `extra_${idx + 1}`,
        url,
        isPdf: isPdfUrl(url),
      });
    });

    // All valid image gallery items across the entire vehicle
    const allGalleryImages: GalleryPhotoItem[] = [];
    [...entryList, ...pakkaList, ...releaseList, ...additionalList].forEach((item) => {
      if (item.url && !item.isPdf) {
        allGalleryImages.push({
          id: item.id,
          key: item.key,
          title: item.label,
          photoType: item.photoType,
          url: item.url,
          isPdf: false,
        });
      }
    });

    return {
      entryList,
      pakkaList,
      releaseList,
      additionalList,
      allGalleryImages,
      counts: {
        entry: entryList.filter((i) => !!i.url).length,
        pakka: pakkaList.filter((i) => !!i.url).length,
        release: releaseList.length,
        additional: additionalList.length,
      },
    };
  }, [rawPhotos, releaseData]);

  // Open Gallery Lightbox at clicked photo
  const openGalleryAt = (clickedUrl: string, listType: PhotoCategoryTab = activeTab) => {
    let sourceList: GalleryPhotoItem[] = [];
    if (listType === 'entry') {
      sourceList = data.entryList
        .filter((i) => !!i.url && !i.isPdf)
        .map((i) => ({ id: i.id, key: i.key, title: i.label, photoType: i.photoType, url: i.url! }));
    } else if (listType === 'pakka') {
      sourceList = data.pakkaList
        .filter((i) => !!i.url && !i.isPdf)
        .map((i) => ({ id: i.id, key: i.key, title: i.label, photoType: i.photoType, url: i.url! }));
    } else if (listType === 'release') {
      sourceList = data.releaseList
        .filter((i) => !i.isPdf)
        .map((i) => ({ id: i.id, key: i.key, title: i.label, photoType: i.photoType, url: i.url }));
    } else if (listType === 'additional') {
      sourceList = data.additionalList
        .filter((i) => !i.isPdf)
        .map((i) => ({ id: i.id, key: i.key, title: i.label, photoType: i.photoType, url: i.url }));
    }

    if (sourceList.length === 0) {
      sourceList = data.allGalleryImages;
    }

    const idx = Math.max(0, sourceList.findIndex((item) => item.url === clickedUrl));
    setGalleryList(sourceList);
    setCurrentIndex(idx);
    setShowControls(true);
    setIsZoomed(false);
    setGalleryVisible(true);
  };

  // Active Photo in Gallery
  const activePhoto = galleryList[currentIndex] || null;

  // Scroll to index safely
  const handleScrollToIndex = (index: number) => {
    if (index >= 0 && index < galleryList.length) {
      setCurrentIndex(index);
      try {
        flatListRef.current?.scrollToIndex({ index, animated: true });
      } catch (err) {
        console.warn('ScrollToIndex failed, fallback to offset:', err);
        flatListRef.current?.scrollToOffset({ offset: index * SCREEN_WIDTH, animated: true });
      }
    }
  };

  // Toggle Controls on Tap
  const handleToggleControls = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setShowControls((prev) => !prev);
  };

  // =========================================================
  // ACTIONS: Download, Share, Print, Replace, Delete
  // =========================================================

  // Helper: safely ensure MediaLibrary permission if native module exists
  const ensureMediaLibraryPermission = async (): Promise<boolean> => {
    if (!SafeMediaLibrary || typeof SafeMediaLibrary.getPermissionsAsync !== 'function') {
      return true; // fallback to sharing/saving via FileSystem
    }
    try {
      const { status, canAskAgain } = await SafeMediaLibrary.getPermissionsAsync();
      if (status === 'granted') return true;
      if (!canAskAgain) {
        Alert.alert(
          'Permission Needed',
          'Photo library access is blocked. Please enable it from device Settings to save photos.'
        );
        return false;
      }
      const { status: newStatus } = await SafeMediaLibrary.requestPermissionsAsync();
      return newStatus === 'granted';
    } catch (e) {
      console.warn('[SafeMediaLibrary error]', e);
      return true;
    }
  };

  // 1. Download / Save Current Photo
  const handleDownloadCurrentPhoto = async () => {
    if (!activePhoto?.url) return;
    setMenuModalVisible(false);

    const filename = `vehicle_${vehicle?.vehicleNumber || 'photo'}_${activePhoto.photoType || 'img'}.jpg`;

    if (Platform.OS === 'web') {
      setActionStatusText('Downloading photo...');
      setActionLoading(true);
      try {
        await webDownloadFile(activePhoto.url, filename);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      const hasPermission = await ensureMediaLibraryPermission();
      if (!hasPermission) return;

      setActionStatusText('Downloading photo...');
      setActionLoading(true);

      const fileUri = `${FileSystem.cacheDirectory}${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { uri } = await FileSystem.downloadAsync(activePhoto.url, fileUri);

      let savedToGallery = false;
      if (SafeMediaLibrary && typeof SafeMediaLibrary.saveToLibraryAsync === 'function') {
        try {
          await SafeMediaLibrary.saveToLibraryAsync(uri);
          savedToGallery = true;
        } catch (e) {
          console.warn('[SafeMediaLibrary save error]', e);
        }
      }

      setActionLoading(false);

      if (savedToGallery) {
        Alert.alert('Saved', 'Photo saved to your device gallery.', [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                  mimeType: 'image/jpeg',
                  dialogTitle: `Share ${activePhoto.title}`,
                });
              }
            },
          },
        ]);
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/jpeg',
            dialogTitle: `Save / Share ${activePhoto.title}`,
          });
        } else {
          Alert.alert('Saved', 'Photo saved to local cache.');
        }
      }
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Could not download photo.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Download / Save ALL Photos
  const handleDownloadAllPhotos = async () => {
    if (data.allGalleryImages.length === 0) {
      Alert.alert('No Photos', 'There are no photos to download.');
      return;
    }
    setMenuModalVisible(false);

    if (Platform.OS === 'web') {
      setActionLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < data.allGalleryImages.length; i++) {
        const item = data.allGalleryImages[i];
        setActionStatusText(`Downloading photo ${i + 1} of ${data.allGalleryImages.length}...`);
        const filename = `vehicle_${vehicle?.vehicleNumber || 'vehicle'}_${i + 1}_${item.photoType}.jpg`;
        const ok = await webDownloadFile(item.url, filename);
        if (ok) successCount++;
        else failCount++;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      setActionLoading(false);
      if (failCount === 0) {
        Alert.alert('Done', `All ${successCount} photos were downloaded.`);
      } else {
        Alert.alert(
          'Partially Complete',
          `${successCount} photo(s) downloaded, ${failCount} failed. Failed photos opened in a new tab instead.`
        );
      }
      return;
    }

    try {
      const hasPermission = await ensureMediaLibraryPermission();
      if (!hasPermission) return;

      setActionLoading(true);
      let successCount = 0;
      const downloadedUris: string[] = [];
      const failedTitles: string[] = [];

      for (let i = 0; i < data.allGalleryImages.length; i++) {
        const item = data.allGalleryImages[i];
        setActionStatusText(`Saving photo ${i + 1} of ${data.allGalleryImages.length}...`);

        const filename = `vehicle_${vehicle?.vehicleNumber || 'photo'}_${i + 1}_${item.photoType}.jpg`;
        const fileUri = `${FileSystem.cacheDirectory}${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        try {
          const res = await FileSystem.downloadAsync(item.url, fileUri);
          downloadedUris.push(res.uri);

          if (SafeMediaLibrary && typeof SafeMediaLibrary.saveToLibraryAsync === 'function') {
            await SafeMediaLibrary.saveToLibraryAsync(res.uri);
          }
          successCount++;
        } catch (e) {
          console.warn(`Failed to save ${item.title}:`, e);
          failedTitles.push(item.title);
        }
      }

      setActionLoading(false);

      if (successCount === 0) {
        throw new Error('Failed to save any photos.');
      }

      if (SafeMediaLibrary && typeof SafeMediaLibrary.saveToLibraryAsync === 'function') {
        if (failedTitles.length === 0) {
          Alert.alert('Success', `All ${successCount} photos saved to your device gallery.`);
        } else {
          Alert.alert(
            'Partially Complete',
            `${successCount} photo(s) saved. ${failedTitles.length} failed: ${failedTitles
              .slice(0, 3)
              .join(', ')}`
          );
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadedUris[0], {
            mimeType: 'image/jpeg',
            dialogTitle: `Share ${vehicle?.vehicleNumber || 'Vehicle'} (${downloadedUris.length} Photos)`,
          });
        } else {
          Alert.alert('Saved', `${downloadedUris.length} photos downloaded.`);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to download all photos.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Print Current Photo
  const handlePrintCurrentPhoto = async () => {
    if (!activePhoto?.url) return;
    setMenuModalVisible(false);
    try {
      setActionStatusText('Generating Print Preview...');
      setActionLoading(true);

      const vehiclePlate = (vehicle?.vehicleNumber || 'VEHICLE').toUpperCase();
      const model = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'N/A';
      const dateStr = vehicle?.entryDate ? new Date(vehicle.entryDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${vehiclePlate} - ${activePhoto.title}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: -apple-system, sans-serif; color: #0F172A; margin: 0; padding: 0; }
            .header { text-align: center; border-bottom: 2px solid #0062FF; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 20px; color: #0062FF; text-transform: uppercase; }
            .header p { margin: 3px 0 0 0; font-size: 11px; color: #64748B; font-weight: 600; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
            .meta-table td { padding: 6px 10px; border: 1px solid #E2E8F0; }
            .photo-box { text-align: center; border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px; background-color: #F8FAFC; }
            .photo-title { font-size: 13px; font-weight: bold; color: #1E293B; margin-bottom: 8px; text-transform: uppercase; }
            .photo-img { max-width: 100%; max-height: 520px; object-fit: contain; border-radius: 6px; }
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94A3B8; border-top: 1px dashed #CBD5E1; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RAPID YARD MANAGEMENT SYSTEM</h1>
            <p>VEHICLE INSPECTION PHOTO REPORT</p>
          </div>
          <table class="meta-table">
            <tr>
              <td><strong>Vehicle Number:</strong> ${vehiclePlate}</td>
              <td><strong>Vehicle Type:</strong> ${vehicle?.vehicleType || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Make & Model:</strong> ${model}</td>
              <td><strong>Bank / Financer:</strong> ${vehicle?.bankName || 'DIRECT'}</td>
            </tr>
            <tr>
              <td><strong>Inward Entry Date:</strong> ${dateStr}</td>
              <td><strong>Yard Status:</strong> ${vehicle?.yardStatus || 'IN YARD'}</td>
            </tr>
          </table>
          <div class="photo-box">
            <div class="photo-title">${activePhoto.title}</div>
            <img src="${activePhoto.url}" class="photo-img" />
          </div>
          <div class="footer">
            *** System Generated Document • Timestamp: ${new Date().toLocaleString('en-IN')} ***
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
            printWin.close();
          }, 400);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print photo.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Print ALL Photos A4 Audit Sheet
  const handlePrintAllPhotos = async () => {
    if (data.allGalleryImages.length === 0) {
      Alert.alert('No Photos', 'There are no photos to print.');
      return;
    }
    setMenuModalVisible(false);
    try {
      setActionStatusText(`Generating ${data.allGalleryImages.length} Photos Sheet...`);
      setActionLoading(true);

      const vehiclePlate = (vehicle?.vehicleNumber || 'VEHICLE').toUpperCase();
      const model = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'N/A';
      const dateStr = vehicle?.entryDate ? new Date(vehicle.entryDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

      const photoCardsHtml = data.allGalleryImages
        .map(
          (p) => `
          <div style="width: 47%; margin: 1.5%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px; background-color: #F8FAFC; box-sizing: border-box; text-align: center; page-break-inside: avoid;">
            <div style="font-size: 10px; font-weight: bold; color: #1E293B; margin-bottom: 4px; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.title}</div>
            <img src="${p.url}" style="width: 100%; height: 160px; object-fit: contain; border-radius: 4px; background-color: #E2E8F0;" />
          </div>
        `
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${vehiclePlate} - All Inspection Photos</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: -apple-system, sans-serif; color: #0F172A; margin: 0; padding: 0; }
            .header { text-align: center; border-bottom: 2px solid #0062FF; padding-bottom: 6px; margin-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18px; color: #0062FF; text-transform: uppercase; }
            .header p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; font-weight: 600; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
            .meta-table td { padding: 4px 8px; border: 1px solid #E2E8F0; }
            .grid { display: flex; flex-wrap: wrap; justify-content: flex-start; }
            .footer { margin-top: 15px; text-align: center; font-size: 8.5px; color: #94A3B8; border-top: 1px dashed #CBD5E1; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RAPID YARD MANAGEMENT SYSTEM</h1>
            <p>COMPLETE VEHICLE INSPECTION PHOTO VAULT</p>
          </div>
          <table class="meta-table">
            <tr>
              <td><strong>Vehicle Number:</strong> ${vehiclePlate}</td>
              <td><strong>Type:</strong> ${vehicle?.vehicleType || 'N/A'}</td>
              <td><strong>Make / Model:</strong> ${model}</td>
            </tr>
            <tr>
              <td><strong>Bank / Financer:</strong> ${vehicle?.bankName || 'DIRECT'}</td>
              <td><strong>Inward Date:</strong> ${dateStr}</td>
              <td><strong>Total Photos:</strong> ${data.allGalleryImages.length} Photos</td>
            </tr>
          </table>
          <div class="grid">
            ${photoCardsHtml}
          </div>
          <div class="footer">
            *** System Generated Document • Total ${data.allGalleryImages.length} Photos Captured ***
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
            printWin.close();
          }, 400);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print all photos.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Replace Existing Photo (Camera or Gallery)
  const handleReplacePhoto = async (source: 'camera' | 'gallery') => {
    if (!activePhoto) return;
    setMenuModalVisible(false);

    try {
      let imageUri: string | null = null;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
        });
        if (!file) return;
        imageUri = URL.createObjectURL(file);
      } else {
        if (source === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Required', 'Camera permission is needed to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'] as any,
            quality: 0.8,
          });
          if (result.canceled || !result.assets || result.assets.length === 0) return;
          imageUri = result.assets[0].uri;
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Required', 'Gallery permission is needed to pick a photo.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'] as any,
            quality: 0.8,
          });
          if (result.canceled || !result.assets || result.assets.length === 0) return;
          imageUri = result.assets[0].uri;
        }
      }

      if (!imageUri) return;

      setActionStatusText('Compressing & Uploading photo...');
      setActionLoading(true);

      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );

      let actualFileSize = 120000;
      if (Platform.OS !== 'web') {
        try {
          const info = await FileSystem.getInfoAsync(compressed.uri);
          if (info.exists && (info as any).size) {
            actualFileSize = (info as any).size;
          }
        } catch {}
      }

      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=${actualFileSize}`
      );
      const { uploadUrl, publicUrl } = presignRes?.data || {};

      if (uploadUrl && !uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(compressed.uri).then((r) => r.blob());
        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }

      const finalPublicUrl = publicUrl || compressed.uri;

      if (vehicle?.id) {
        await apiRequest(`/api/vehicles/${vehicle.id}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: activePhoto.photoType || 'extra',
            s3Url: finalPublicUrl,
            fileSize: actualFileSize,
          }),
        });

        if (activePhoto.id) {
          try {
            await apiRequest(`/api/vehicles/${vehicle.id}/photos/${activePhoto.id}`, {
              method: 'DELETE',
            });
          } catch (e) {
            console.warn('[ReplacePhoto] Old photo delete skipped:', e);
          }
        }
      }

      Alert.alert('Success', `${activePhoto.title} updated successfully.`);
      setGalleryVisible(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not replace photo.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Delete Current Photo
  const handleDeleteCurrentPhoto = () => {
    if (!activePhoto) return;
    setMenuModalVisible(false);

    Alert.alert(
      'Delete Photo',
      `Are you sure you want to delete ${activePhoto.title}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionStatusText('Deleting photo...');
              setActionLoading(true);

              if (vehicle?.id && activePhoto.id) {
                await apiRequest(`/api/vehicles/${vehicle.id}/photos/${activePhoto.id}`, {
                  method: 'DELETE',
                });
              }

              Alert.alert('Deleted', `${activePhoto.title} has been removed.`);
              setGalleryVisible(false);
              if (onRefresh) onRefresh();
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not delete photo.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // =========================================================
  // UPLOAD FOR MISSING / NEW FIELD (POST-ENTRY UPLOADS)
  // =========================================================

  const handleOpenUploadFor = (
    item: { key: string; label: string; photoType: string },
    category: PhotoCategoryTab
  ) => {
    setUploadTarget({
      key: item.key,
      label: item.label,
      photoType: item.photoType,
      category,
    });
    setUploadModalVisible(true);
  };

  // 1. Upload from Camera
  const handleUploadFromCamera = async () => {
    if (!uploadTarget) return;
    setUploadModalVisible(false);

    try {
      let imageUri: string | null = null;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
        });
        if (!file) return;
        imageUri = URL.createObjectURL(file);
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'] as any,
          quality: 0.8,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        imageUri = result.assets[0].uri;
      }

      if (!imageUri) return;

      setActionStatusText(`Uploading ${uploadTarget.label}...`);
      setActionLoading(true);

      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );

      let actualFileSize = 120000;
      if (Platform.OS !== 'web') {
        try {
          const info = await FileSystem.getInfoAsync(compressed.uri);
          if (info.exists && (info as any).size) {
            actualFileSize = (info as any).size;
          }
        } catch {}
      }

      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=${actualFileSize}`
      );
      const { uploadUrl, publicUrl } = presignRes?.data || {};

      if (uploadUrl && !uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(compressed.uri).then((r) => r.blob());
        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }

      const finalPublicUrl = publicUrl || compressed.uri;

      if (vehicle?.id) {
        await apiRequest(`/api/vehicles/${vehicle.id}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: uploadTarget.photoType,
            s3Url: finalPublicUrl,
            fileSize: actualFileSize,
          }),
        });
      }

      Alert.alert('Success', `${uploadTarget.label} uploaded successfully!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload photo.');
    } finally {
      setActionLoading(false);
      setUploadTarget(null);
    }
  };

  // 2. Upload from Gallery
  const handleUploadFromGallery = async () => {
    if (!uploadTarget) return;
    setUploadModalVisible(false);

    try {
      let imageUri: string | null = null;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
        });
        if (!file) return;
        imageUri = URL.createObjectURL(file);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Gallery permission is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as any,
          quality: 0.8,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;
        imageUri = result.assets[0].uri;
      }

      if (!imageUri) return;

      setActionStatusText(`Uploading ${uploadTarget.label}...`);
      setActionLoading(true);

      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );

      let actualFileSize = 120000;
      if (Platform.OS !== 'web') {
        try {
          const info = await FileSystem.getInfoAsync(compressed.uri);
          if (info.exists && (info as any).size) {
            actualFileSize = (info as any).size;
          }
        } catch {}
      }

      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=${actualFileSize}`
      );
      const { uploadUrl, publicUrl } = presignRes?.data || {};

      if (uploadUrl && !uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(compressed.uri).then((r) => r.blob());
        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }

      const finalPublicUrl = publicUrl || compressed.uri;

      if (vehicle?.id) {
        await apiRequest(`/api/vehicles/${vehicle.id}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: uploadTarget.photoType,
            s3Url: finalPublicUrl,
            fileSize: actualFileSize,
          }),
        });
      }

      Alert.alert('Success', `${uploadTarget.label} uploaded successfully!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload photo.');
    } finally {
      setActionLoading(false);
      setUploadTarget(null);
    }
  };

  // 3. Upload PDF or Document
  const handleUploadFromDocument = async () => {
    if (!uploadTarget) return;
    setUploadModalVisible(false);

    try {
      let fileUri: string | null = null;
      let mimeType = 'application/pdf';
      let fileSize = 150000;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf,image/*';
        input.click();
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
        });
        if (!file) return;
        fileUri = URL.createObjectURL(file);
        mimeType = file.type || 'application/pdf';
        fileSize = file.size || 150000;
      } else {
        const docResult = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });

        if (docResult.canceled || !docResult.assets || docResult.assets.length === 0) return;
        const asset = docResult.assets[0];
        fileUri = asset.uri;
        mimeType = asset.mimeType || 'application/pdf';
        fileSize = asset.size || 150000;
      }

      if (!fileUri) return;

      setActionStatusText(`Uploading ${uploadTarget.label}...`);
      setActionLoading(true);

      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=${encodeURIComponent(mimeType)}&folder=vehicles&fileSize=${fileSize}`
      );
      const { uploadUrl, publicUrl } = presignRes?.data || {};

      if (uploadUrl && !uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(fileUri).then((r) => r.blob());
        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': mimeType },
        });
      }

      const finalPublicUrl = publicUrl || fileUri;

      if (vehicle?.id) {
        await apiRequest(`/api/vehicles/${vehicle.id}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoType: uploadTarget.photoType,
            s3Url: finalPublicUrl,
            fileSize: fileSize,
          }),
        });
      }

      Alert.alert('Success', `${uploadTarget.label} document uploaded successfully!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not upload document.');
    } finally {
      setActionLoading(false);
      setUploadTarget(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Sleek 4-Category Segmented Tabs */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {/* Tab 1: Entry */}
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'entry' && styles.tabItemActive]}
            onPress={() => setActiveTab('entry')}
            activeOpacity={0.8}
          >
            <Car size={13} color={activeTab === 'entry' ? '#0062FF' : '#64748B'} strokeWidth={2.2} />
            <Text style={[styles.tabLabel, activeTab === 'entry' && styles.tabLabelActive]}>
              Entry ({data.counts.entry})
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Pakka */}
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'pakka' && styles.tabItemActive]}
            onPress={() => setActiveTab('pakka')}
            activeOpacity={0.8}
          >
            <FileCheck size={13} color={activeTab === 'pakka' ? '#0062FF' : '#64748B'} strokeWidth={2.2} />
            <Text style={[styles.tabLabel, activeTab === 'pakka' && styles.tabLabelActive]}>
              Pakka Docs ({data.counts.pakka})
            </Text>
          </TouchableOpacity>

          {/* Tab 3: Release */}
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'release' && styles.tabItemActive]}
            onPress={() => setActiveTab('release')}
            activeOpacity={0.8}
          >
            <ShieldCheck size={13} color={activeTab === 'release' ? '#0062FF' : '#64748B'} strokeWidth={2.2} />
            <Text style={[styles.tabLabel, activeTab === 'release' && styles.tabLabelActive]}>
              Release ({data.counts.release})
            </Text>
          </TouchableOpacity>

          {/* Tab 4: Additional */}
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'additional' && styles.tabItemActive]}
            onPress={() => setActiveTab('additional')}
            activeOpacity={0.8}
          >
            <Camera size={13} color={activeTab === 'additional' ? '#0062FF' : '#64748B'} strokeWidth={2.2} />
            <Text style={[styles.tabLabel, activeTab === 'additional' && styles.tabLabelActive]}>
              Additional ({data.counts.additional})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 2. Content Grid */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentScroll}>
        {/* TAB 1: VEHICLE ENTRY */}
        {activeTab === 'entry' && (
          <View style={styles.grid}>
            {data.entryList.map((item) => {
              const hasPhoto = !!item.url;
              return (
                <View key={item.key} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {hasPhoto ? (
                      <View style={styles.badgeSuccess}>
                        <CheckCircle2 size={10} color="#059669" strokeWidth={2.8} />
                      </View>
                    ) : (
                      <View style={styles.badgeMissing}>
                        <Text style={styles.badgeMissingText}>Missing</Text>
                      </View>
                    )}
                  </View>

                  {hasPhoto ? (
                    item.isPdf ? (
                      <TouchableOpacity
                        style={styles.pdfBox}
                        activeOpacity={0.8}
                        onPress={() => handleOpenDoc(item.url!)}
                      >
                        <FileText size={26} color="#DC2626" />
                        <Text style={styles.pdfText}>View PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.imgBox}
                        activeOpacity={0.85}
                        onPress={() => openGalleryAt(item.url!, 'entry')}
                      >
                        <Image source={{ uri: item.url! }} style={styles.img} resizeMode="cover" />
                        <View style={styles.zoomBtn}>
                          <Maximize2 size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity
                      style={styles.emptyBoxInteractive}
                      activeOpacity={0.7}
                      onPress={() => handleOpenUploadFor(item, 'entry')}
                    >
                      <View style={styles.emptyIconCircle}>
                        <Plus size={16} color="#0062FF" strokeWidth={2.8} />
                      </View>
                      <Text style={styles.emptyUploadBtnText}>+ Upload Photo</Text>
                      <Text style={styles.emptySubText}>Tap to add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 2: PAKKA DOCS */}
        {activeTab === 'pakka' && (
          <View style={styles.grid}>
            {data.pakkaList.map((item) => {
              const hasDoc = !!item.url;
              return (
                <View key={item.key} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {hasDoc ? (
                      <View style={styles.badgeSuccess}>
                        <CheckCircle2 size={10} color="#059669" strokeWidth={2.8} />
                      </View>
                    ) : (
                      <View style={styles.badgeMissing}>
                        <Text style={styles.badgeMissingText}>Pending</Text>
                      </View>
                    )}
                  </View>

                  {hasDoc ? (
                    item.isPdf ? (
                      <TouchableOpacity
                        style={styles.pdfBox}
                        activeOpacity={0.8}
                        onPress={() => handleOpenDoc(item.url!)}
                      >
                        <FileText size={26} color="#DC2626" />
                        <Text style={styles.pdfText}>Open Document</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.imgBox}
                        activeOpacity={0.85}
                        onPress={() => openGalleryAt(item.url!, 'pakka')}
                      >
                        <Image source={{ uri: item.url! }} style={styles.img} resizeMode="cover" />
                        <View style={styles.zoomBtn}>
                          <Maximize2 size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity
                      style={styles.emptyBoxInteractive}
                      activeOpacity={0.7}
                      onPress={() => handleOpenUploadFor(item, 'pakka')}
                    >
                      <View style={styles.emptyIconCircle}>
                        <Plus size={16} color="#0062FF" strokeWidth={2.8} />
                      </View>
                      <Text style={styles.emptyUploadBtnText}>+ Upload Doc / PDF</Text>
                      <Text style={styles.emptySubText}>Tap to add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 3: RELEASE */}
        {activeTab === 'release' && (
          <>
            {data.releaseList.length === 0 ? (
              <View style={styles.cleanEmptyState}>
                <Warehouse size={32} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.cleanEmptyTitle}>Vehicle Currently in Yard</Text>
                <Text style={styles.cleanEmptySub}>
                  Release order, customer ID proof, and handover photos will appear here after release.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {data.releaseList.map((item) => (
                  <View key={item.key} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <View style={styles.badgeSuccess}>
                        <CheckCircle2 size={10} color="#059669" strokeWidth={2.8} />
                      </View>
                    </View>

                    {item.isPdf ? (
                      <TouchableOpacity
                        style={styles.pdfBox}
                        activeOpacity={0.8}
                        onPress={() => handleOpenDoc(item.url)}
                      >
                        <FileText size={26} color="#7C3AED" />
                        <Text style={[styles.pdfText, { color: '#7C3AED' }]}>Open PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.imgBox}
                        activeOpacity={0.85}
                        onPress={() => openGalleryAt(item.url, 'release')}
                      >
                        <Image source={{ uri: item.url }} style={styles.img} resizeMode="cover" />
                        <View style={styles.zoomBtn}>
                          <Maximize2 size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* TAB 4: ADDITIONAL */}
        {activeTab === 'additional' && (
          <>
            {/* Dedicated Add New Extra Photo Action Button */}
            <TouchableOpacity
              style={styles.addExtraPhotoBanner}
              activeOpacity={0.8}
              onPress={() =>
                handleOpenUploadFor(
                  {
                    key: `extra_${data.additionalList.length + 1}`,
                    label: `Additional Photo #${data.additionalList.length + 1}`,
                    photoType: 'extra',
                  },
                  'additional'
                )
              }
            >
              <View style={styles.addExtraIconCircle}>
                <PlusCircle size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addExtraPhotoBannerTitle}>+ Add Additional Photo / Doc</Text>
                <Text style={styles.addExtraPhotoBannerSub}>
                  Upload damage angles, challans, or extra paperwork
                </Text>
              </View>
            </TouchableOpacity>

            {data.additionalList.length === 0 ? (
              <View style={styles.cleanEmptyState}>
                <Camera size={32} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.cleanEmptyTitle}>No Additional Photos Yet</Text>
                <Text style={styles.cleanEmptySub}>
                  Tap "+ Add Additional Photo / Doc" above to upload any extra pictures or documents.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {data.additionalList.map((item) => (
                  <View key={item.key} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>

                    {item.isPdf ? (
                      <TouchableOpacity
                        style={styles.pdfBox}
                        activeOpacity={0.8}
                        onPress={() => handleOpenDoc(item.url)}
                      >
                        <FileText size={26} color="#0062FF" />
                        <Text style={[styles.pdfText, { color: '#0062FF' }]}>View PDF</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.imgBox}
                        activeOpacity={0.85}
                        onPress={() => openGalleryAt(item.url, 'additional')}
                      >
                        <Image source={{ uri: item.url }} style={styles.img} resizeMode="cover" />
                        <View style={styles.zoomBtn}>
                          <Maximize2 size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* 3. IMMERSIVE MOBILE GALLERY LIGHTBOX */}
      {/* ========================================================= */}
      <Modal
        visible={galleryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryBackdrop}>
          {showControls && (
            <View style={styles.galleryHeader}>
              <View style={styles.galleryHeaderInfo}>
                <Text style={styles.galleryPhotoTitle} numberOfLines={1}>
                  {activePhoto?.title || 'Photo'}
                </Text>
                <Text style={styles.galleryIndexBadge}>
                  {galleryList.length > 0 ? `${currentIndex + 1} / ${galleryList.length}` : ''}
                </Text>
              </View>

              <View style={styles.headerRightActions}>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => setMenuModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <MoreVertical size={20} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => setGalleryVisible(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.galleryBody}>
            <FlatList
              ref={flatListRef}
              data={galleryList}
              keyExtractor={(item, index) => `${item.key}-${index}`}
              horizontal
              pagingEnabled
              scrollEnabled={!isZoomed}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={currentIndex}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                }, 80);
              }}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (newIndex !== currentIndex && newIndex >= 0 && newIndex < galleryList.length) {
                  setCurrentIndex(newIndex);
                }
              }}
              renderItem={({ item }) => (
                <ZoomableSlide
                  item={item}
                  onToggleControls={handleToggleControls}
                  onZoomChange={setIsZoomed}
                />
              )}
            />

            {showControls && !isZoomed && currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.floatingArrowBtn, { left: 12 }]}
                onPress={() => handleScrollToIndex(currentIndex - 1)}
                activeOpacity={0.8}
              >
                <ChevronLeft size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {showControls && !isZoomed && currentIndex < galleryList.length - 1 && (
              <TouchableOpacity
                style={[styles.floatingArrowBtn, { right: 12 }]}
                onPress={() => handleScrollToIndex(currentIndex + 1)}
                activeOpacity={0.8}
              >
                <ChevronRight size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {showControls && !isZoomed && (
            <View style={styles.bottomThumbStrip}>
              <FlatList
                data={galleryList}
                keyExtractor={(item, idx) => `thumb-${item.key}-${idx}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                contentContainerStyle={styles.thumbScroll}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.thumbBox, index === currentIndex && styles.thumbBoxActive]}
                    onPress={() => handleScrollToIndex(index)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.url }} style={styles.thumbImg} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 4. 3-DOTS OPTIONS SHEET MODAL (Existing Photo Options) */}
      {/* ========================================================= */}
      <Modal
        visible={menuModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetIndicator} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{activePhoto?.title || 'Photo Actions'}</Text>
              <Text style={styles.sheetSub}>Download, Print, or Update this vehicle photo</Text>
            </View>

            <View style={styles.sheetOptionsList}>
              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handleDownloadCurrentPhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Download size={18} color="#0062FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Download / Save Photo</Text>
                  <Text style={styles.sheetOptionSub}>Save this image to device gallery / Share</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handleDownloadAllPhotos}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Share2 size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Download / Save All Photos</Text>
                  <Text style={styles.sheetOptionSub}>
                    Save all {data.allGalleryImages.length} inspection photos to gallery
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handlePrintCurrentPhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <Printer size={18} color="#9333EA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Print This Photo</Text>
                  <Text style={styles.sheetOptionSub}>Print image with vehicle header & plate</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handlePrintAllPhotos}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#FFFBEB' }]}>
                  <FileText size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Print All Photos (A4 Sheet)</Text>
                  <Text style={styles.sheetOptionSub}>Generate full audit PDF of all photos</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handleReplacePhoto('camera')}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Camera size={18} color="#0062FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Retake Photo (Camera)</Text>
                  <Text style={styles.sheetOptionSub}>Replace with newly captured image</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handleReplacePhoto('gallery')}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#F8FAFC' }]}>
                  <ImageIcon size={18} color="#475569" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Upload from Gallery</Text>
                  <Text style={styles.sheetOptionSub}>Select replacement image from storage</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetOptionRow, { borderBottomWidth: 0 }]}
                onPress={handleDeleteCurrentPhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#FEF2F2' }]}>
                  <Trash2 size={18} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetOptionText, { color: '#DC2626' }]}>Delete Photo</Text>
                  <Text style={styles.sheetOptionSub}>Remove this photo from vehicle records</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setMenuModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================= */}
      {/* 5. UPLOAD MODAL FOR MISSING / NEW FIELDS */}
      {/* ========================================================= */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setUploadModalVisible(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetIndicator} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Upload {uploadTarget?.label || 'Photo / Document'}</Text>
              <Text style={styles.sheetSub}>
                Capture photo, choose from device gallery, or upload PDF
              </Text>
            </View>

            <View style={styles.sheetOptionsList}>
              {/* Option 1: Camera */}
              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handleUploadFromCamera}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Camera size={19} color="#0062FF" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Take Photo (Camera)</Text>
                  <Text style={styles.sheetOptionSub}>Open camera to click a new high-quality photo</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Gallery */}
              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={handleUploadFromGallery}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <ImageIcon size={19} color="#16A34A" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Choose from Gallery</Text>
                  <Text style={styles.sheetOptionSub}>Select an existing image from device photos</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Document / PDF */}
              <TouchableOpacity
                style={[styles.sheetOptionRow, { borderBottomWidth: 0 }]}
                onPress={handleUploadFromDocument}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <FileUp size={19} color="#9333EA" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionText}>Upload PDF / Document</Text>
                  <Text style={styles.sheetOptionSub}>Pick a PDF file from device file manager</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setUploadModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action Progress Overlay */}
      {actionLoading && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.progressText}>{actionStatusText || 'Processing...'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    paddingVertical: 8,
  },
  tabBarScroll: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#0062FF',
    fontWeight: '700',
  },

  contentScroll: {
    padding: 12,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  badgeSuccess: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMissing: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeMissingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },

  imgBox: {
    height: 120,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  zoomBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Interactive Upload Box for Missing items
  emptyBoxInteractive: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  emptyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyUploadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  emptySubText: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#94A3B8',
  },

  pdfBox: {
    height: 120,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pdfText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Additional Photos Banner
  addExtraPhotoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  addExtraIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExtraPhotoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0062FF',
  },
  addExtraPhotoBannerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  cleanEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 30,
    marginTop: 10,
    gap: 8,
  },
  cleanEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginTop: 4,
  },
  cleanEmptySub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Fullscreen Mobile Gallery
  galleryBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  galleryHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 30,
  },
  galleryHeaderInfo: {
    flex: 1,
  },
  galleryPhotoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  galleryIndexBadge: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  galleryBody: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  slideItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  animatedImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  floatingArrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  bottomThumbStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    zIndex: 30,
  },
  thumbScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbBox: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    opacity: 0.5,
  },
  thumbBoxActive: {
    borderColor: '#0062FF',
    opacity: 1,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },

  // 3-Dots Bottom Action Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 18,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  sheetIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  sheetOptionsList: {
    gap: 2,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  sheetOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 12,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  // Progress Overlay
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    width: 260,
  },
  progressText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
});
