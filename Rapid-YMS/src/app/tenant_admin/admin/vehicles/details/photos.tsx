import React, { useState } from 'react';
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
} from 'react-native';
import {
  Camera,
  X,
  Eye,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Maximize2,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface VehiclePhotosProps {
  vehicle: any;
}

const STANDARD_ANGLES = [
  { key: 'FRONT', label: 'Front View' },
  { key: 'REAR', label: 'Rear View' },
  { key: 'LEFT', label: 'Left Side' },
  { key: 'RIGHT', label: 'Right Side' },
  { key: 'ODOMETER', label: 'Odometer / Meter' },
  { key: 'CHASSIS', label: 'Chassis Plate' },
];

export default function VehiclePhotos({ vehicle }: VehiclePhotosProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  const photos: any[] = vehicle?.photos || [];

  const getPhotoForAngle = (angleKey: string) => {
    return photos.find((p) => (p.angle || '').toUpperCase() === angleKey || (p.title || '').toUpperCase().includes(angleKey));
  };

  const getPhotoUrl = (photo: any) => {
    return photo?.s3Url || photo?.fileUrl || photo?.url;
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Top Gallery Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.cameraIconBox}>
            <Camera size={18} color="#0062FF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Vehicle Inspection Photos</Text>
            <Text style={styles.headerSub}>
              {photos.length > 0
                ? `${photos.length} photos uploaded during entry inspection`
                : 'No inspection photos uploaded yet'}
            </Text>
          </View>
        </View>
      </View>

      {/* Grid of 6 Mandatory Angles */}
      <Text style={styles.sectionHeading}>Mandatory Inspection Angles</Text>

      <View style={styles.photoGrid}>
        {STANDARD_ANGLES.map((angle) => {
          const photo = getPhotoForAngle(angle.key);
          const photoUrl = photo ? getPhotoUrl(photo) : null;

          return (
            <View key={angle.key} style={styles.gridCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.angleLabel} numberOfLines={1}>
                  {angle.label}
                </Text>
                {photoUrl ? (
                  <View style={styles.uploadedBadge}>
                    <CheckCircle2 size={11} color="#059669" strokeWidth={2.6} />
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Missing</Text>
                  </View>
                )}
              </View>

              {photoUrl ? (
                <TouchableOpacity
                  style={styles.imageBox}
                  activeOpacity={0.85}
                  onPress={() => setSelectedPhoto({ url: photoUrl, title: angle.label })}
                >
                  <Image source={{ uri: photoUrl }} style={styles.photoImg} resizeMode="cover" />
                  <View style={styles.zoomOverlay}>
                    <Maximize2 size={13} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyImageBox}>
                  <Camera size={22} color="#CBD5E1" strokeWidth={1.8} />
                  <Text style={styles.emptyImageText}>No Photo</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Additional Photos Section if any */}
      {photos.filter((p) => !STANDARD_ANGLES.some((a) => (p.angle || '').toUpperCase() === a.key)).length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { marginTop: 10 }]}>Additional Photos</Text>
          <View style={styles.photoGrid}>
            {photos
              .filter((p) => !STANDARD_ANGLES.some((a) => (p.angle || '').toUpperCase() === a.key))
              .map((photo, idx) => {
                const photoUrl = getPhotoUrl(photo);
                const title = photo.angle || photo.title || `Photo #${idx + 1}`;
                return (
                  <View key={photo.id || `extra-${idx}`} style={styles.gridCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.angleLabel} numberOfLines={1}>
                        {title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.imageBox}
                      activeOpacity={0.85}
                      onPress={() => setSelectedPhoto({ url: photoUrl, title })}
                    >
                      <Image source={{ uri: photoUrl }} style={styles.photoImg} resizeMode="cover" />
                      <View style={styles.zoomOverlay}>
                        <Maximize2 size={13} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        </>
      )}

      {/* Full-Screen Zoom Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalPhotoTitle} numberOfLines={1}>
              {selectedPhoto?.title}
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedPhoto(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalImageContainer}>
            {selectedPhoto?.url && (
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onLoadStart={() => setImgLoading(true)}
                onLoadEnd={() => setImgLoading(false)}
              />
            )}
            {imgLoading && (
              <View style={styles.imageLoader}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cameraIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (SCREEN_WIDTH - 38) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  angleLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  uploadedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  pendingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  imageBox: {
    height: 115,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImageBox: {
    height: 115,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyImageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Modal Full Screen
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  modalPhotoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  imageLoader: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
