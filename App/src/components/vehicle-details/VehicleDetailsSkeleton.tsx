import React from 'react';
import { StyleSheet, View } from 'react-native';

export function VehicleDetailsSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHeaderCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonMeta}>
          <View style={[styles.skeletonLine, { width: '70%', height: 26 }]} />
          <View style={[styles.skeletonLine, { width: '50%', height: 16, marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '40%', height: 14, marginTop: 6 }]} />
        </View>
      </View>
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
      </View>
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  skeletonHeaderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  skeletonMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonGridBox: {
    width: '48%',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonCard: {
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
