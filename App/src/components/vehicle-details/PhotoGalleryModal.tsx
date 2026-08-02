import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Camera, FileText, Share2, X, ChevronLeft } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { PhotoItem } from './types';

const { width } = Dimensions.get('window');

interface PhotoGalleryModalProps {
  visible: boolean;
  photos: PhotoItem[];
  sharingInProgress: boolean;
  selectedPhotos: string[];
  activePhotoUrl: string | null;
  onClose: () => void;
  onSelectPhoto: (url: string) => void;
  onClearSelection: () => void;
  onSharePhoto: (url: string) => void;
  onShareBatchPhotos: (urls: string[]) => void;
  setActivePhotoUrl: (url: string | null) => void;
}

export function PhotoGalleryModal({
  visible,
  photos = [],
  sharingInProgress,
  selectedPhotos,
  activePhotoUrl,
  onClose,
  onSelectPhoto,
  onClearSelection,
  onSharePhoto,
  onShareBatchPhotos,
  setActivePhotoUrl,
}: PhotoGalleryModalProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'images' | 'pdfs'>('all');

  const { imagePhotos, pdfPhotos } = useMemo(() => {
    const images: PhotoItem[] = [];
    const pdfs: PhotoItem[] = [];
    photos.forEach(p => {
      if (p.s3Url.toLowerCase().split('?')[0].endsWith('.pdf')) {
        pdfs.push(p);
      } else {
        images.push(p);
      }
    });
    return { imagePhotos: images, pdfPhotos: pdfs };
  }, [photos]);

  const displayedPhotos =
    filterTab === 'images' ? imagePhotos : filterTab === 'pdfs' ? pdfPhotos : photos;

  return (
    <>
      {/* Photo Gallery Drawer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalTitle}>Inspection Attachments</ThemedText>
                <ThemedText style={styles.modalSub}>
                  {photos.length} items logged{' '}
                  {selectedPhotos.length > 0 ? `| ${selectedPhotos.length} selected` : ''}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
                onPress={() => setFilterTab('all')}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    filterTab === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All ({photos.length})
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterTab === 'images' && styles.filterChipActive,
                ]}
                onPress={() => setFilterTab('images')}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    filterTab === 'images' && styles.filterChipTextActive,
                  ]}
                >
                  📷 Images ({imagePhotos.length})
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterTab === 'pdfs' && styles.filterChipActive,
                ]}
                onPress={() => setFilterTab('pdfs')}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    filterTab === 'pdfs' && styles.filterChipTextActive,
                  ]}
                >
                  📄 PDFs ({pdfPhotos.length})
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Photos Grid */}
            <FlatList
              data={displayedPhotos}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
              columnWrapperStyle={{ gap: 10 }}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Camera size={38} color="#94A3B8" />
                  <ThemedText style={styles.emptyText}>
                    No attachments in this category.
                  </ThemedText>
                </View>
              )}
              renderItem={({ item }) => {
                const isSelected = selectedPhotos.includes(item.s3Url);
                const isPdf = item.s3Url.toLowerCase().split('?')[0].endsWith('.pdf');

                return (
                  <View style={styles.photoCard}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setActivePhotoUrl(item.s3Url)}
                      style={{ width: '100%', height: '100%' }}
                    >
                      {isPdf ? (
                        <View style={styles.pdfPlaceholder}>
                          <FileText size={32} color="#EF4444" />
                          <ThemedText style={styles.pdfText}>PDF Document</ThemedText>
                        </View>
                      ) : (
                        <Image source={{ uri: item.s3Url }} style={styles.photoImg} />
                      )}
                    </TouchableOpacity>

                    {/* Selection Checkbox */}
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxActive,
                      ]}
                      onPress={() => onSelectPhoto(item.s3Url)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.tick}>{isSelected ? '✓' : ''}</ThemedText>
                    </TouchableOpacity>

                    {/* Share Button */}
                    <TouchableOpacity
                      style={styles.shareMiniBtn}
                      onPress={() => onSharePhoto(item.s3Url)}
                      activeOpacity={0.7}
                    >
                      <Share2 size={12} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Tag */}
                    <View style={styles.typeTag}>
                      <ThemedText style={styles.typeTagText}>
                        {item.photoType.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                );
              }}
            />

            {/* Bottom Actions */}
            <View style={styles.actionsRow}>
              {selectedPhotos.length > 0 ? (
                <>
                  <TouchableOpacity
                    onPress={() => onShareBatchPhotos(selectedPhotos)}
                    style={[styles.btn, styles.btnPrimary]}
                    disabled={sharingInProgress}
                  >
                    {sharingInProgress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.btnText}>
                        Share Selected ({selectedPhotos.length})
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onClearSelection}
                    style={[styles.btn, styles.btnSecondary]}
                  >
                    <ThemedText style={styles.btnTextSecondary}>Clear</ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    const allUrls = photos.map(p => p.s3Url);
                    onShareBatchPhotos(allUrls);
                  }}
                  style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
                  disabled={sharingInProgress || photos.length === 0}
                >
                  {sharingInProgress ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.btnText}>Share All Attachments</ThemedText>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnClose]}>
                <ThemedText style={styles.btnTextClose}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lightbox Fullscreen Viewer */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activePhotoUrl !== null}
        onRequestClose={() => setActivePhotoUrl(null)}
      >
        <View style={styles.fullscreenOverlay}>
          {activePhotoUrl ? (
            <>
              <View style={styles.fullscreenHeader}>
                <TouchableOpacity
                  onPress={() => setActivePhotoUrl(null)}
                  style={styles.fullscreenBackBtn}
                >
                  <ChevronLeft size={20} color="#FFFFFF" />
                  <ThemedText style={styles.fullscreenBackText}>Back</ThemedText>
                </TouchableOpacity>

                <ThemedText style={styles.fullscreenTitle}>Attachment Preview</ThemedText>

                <TouchableOpacity
                  onPress={() => onSharePhoto(activePhotoUrl)}
                  style={styles.fullscreenBackBtn}
                  disabled={sharingInProgress}
                >
                  {sharingInProgress ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Share2 size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.fullscreenBody}>
                {activePhotoUrl.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                  <View style={styles.pdfFullWrapper}>
                    <FileText size={72} color="#EF4444" style={{ marginBottom: 16 }} />
                    <ThemedText style={styles.pdfFullTitle}>PDF Document File</ThemedText>
                    <ThemedText style={styles.pdfFullSub}>
                      This PDF file can be downloaded or opened in your external browser / viewer.
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.openPdfBtn}
                      onPress={() => Linking.openURL(activePhotoUrl)}
                    >
                      <ThemedText style={styles.openPdfBtnText}>Open in Viewer</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Image
                    source={{ uri: activePhotoUrl }}
                    style={styles.fullImg}
                    resizeMode="contain"
                  />
                )}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#4F46E5',
  },
  photoCard: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  pdfPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  pdfText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 4,
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  tick: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  shareMiniBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  typeTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#4F46E5',
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  btnClose: {
    backgroundColor: '#64748B',
    flex: 0.7,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnTextSecondary: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 13,
  },
  btnTextClose: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  fullscreenBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  fullscreenBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImg: {
    width: width,
    height: '100%',
  },
  pdfFullWrapper: {
    alignItems: 'center',
    padding: 24,
  },
  pdfFullTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  pdfFullSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  openPdfBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  openPdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
