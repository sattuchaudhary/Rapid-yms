import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { Camera, Building } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { VehicleData } from './types';
import { StatusBadge } from './StatusBadge';

interface VehicleHeroCardProps {
  vehicle: VehicleData;
  displayPhoto: string;
  imageCount: number;
  totalDays: number;
  totalCharges: number;
  onPressPhoto: () => void;
}

export function VehicleHeroCard({
  vehicle,
  displayPhoto,
  imageCount,
  totalDays,
  totalCharges,
  onPressPhoto,
}: VehicleHeroCardProps) {
  const categoryLabel =
    vehicle.vehicleType === 'TW'
      ? 'Two Wheeler (2W)'
      : vehicle.vehicleType === 'THREE_W'
      ? 'Three Wheeler (3W)'
      : vehicle.vehicleType === 'CV'
      ? 'Commercial (CV)'
      : 'Four Wheeler (4W)';

  return (
    <View style={styles.heroCard}>
      {/* Top Main Row */}
      <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPressPhoto}
          style={styles.photoWrapper}
        >
          <Image source={{ uri: displayPhoto }} style={styles.photo} />
          {imageCount > 0 && (
            <View style={styles.photoBadge}>
              <Camera size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
              <ThemedText style={styles.photoBadgeText}>{imageCount}</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.infoWrapper}>
          <ThemedText style={styles.vehicleNumber}>
            {vehicle.vehicleNumber.toUpperCase()}
          </ThemedText>

          <ThemedText style={styles.modelText} numberOfLines={1}>
            {vehicle.brand || 'Vehicle'} {vehicle.model || ''}{' '}
            {vehicle.color ? `• ${vehicle.color}` : ''}
          </ThemedText>

          <ThemedText style={styles.categoryText}>{categoryLabel}</ThemedText>

          <View style={{ marginTop: 6 }}>
            <StatusBadge vehicle={vehicle} size="small" />
          </View>
        </View>
      </View>

      {/* Hero Quick Footer Info Bar */}
      <View style={styles.heroFooter}>
        <View style={styles.footerItem}>
          <Building size={14} color="#4F46E5" />
          <ThemedText style={styles.footerLabel}>Slot:</ThemedText>
          <ThemedText style={styles.footerValue}>
            {vehicle.yardLocation
              ? `${vehicle.yardLocation.zone}-${vehicle.yardLocation.slot}`
              : 'A-ZONE'}
          </ThemedText>
        </View>

        <View style={styles.footerDivider} />

        <View style={styles.footerItem}>
          <ThemedText style={styles.footerLabel}>Duration:</ThemedText>
          <ThemedText style={styles.footerValue}>{totalDays} Days</ThemedText>
        </View>

        <View style={styles.footerDivider} />

        <View style={styles.footerItem}>
          <ThemedText style={styles.footerLabel}>Due:</ThemedText>
          <ThemedText style={[styles.footerValue, { color: '#16A34A', fontWeight: '800' }]}>
            ₹{totalCharges.toLocaleString('en-IN')}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  infoWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  modelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  categoryText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  footerValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  footerDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
});
