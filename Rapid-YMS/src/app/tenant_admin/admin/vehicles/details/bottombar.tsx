import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  LogOut,
  Warehouse,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface VehicleDetailBottomBarProps {
  vehicle: any;
  onReleasePress?: () => void;
  onInYardPress?: () => void;
}

export default function VehicleDetailBottomBar({
  vehicle,
  onReleasePress,
  onInYardPress,
}: VehicleDetailBottomBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);

  const status = (vehicle?.yardStatus || 'KACHHA').toUpperCase();
  const isReleased = status === 'RELEASED';
  const isPakka = status === 'PAKKA';
  const isKachha = status === 'KACHHA' || (!isReleased && !isPakka);

  const handleRelease = () => {
    if (isReleased) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onReleasePress?.();
  };

  const handleInYard = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onInYardPress?.();
  };

  return (
    <View style={[styles.bottomContainer, { paddingBottom: bottomPadding }]}>
      <View style={styles.buttonRow}>
        {/* CASE 1: VEHICLE IS ALREADY RELEASED -> FULL LENGTH 'RELEASED' BADGE */}
        {isReleased ? (
          <View style={[styles.actionButton, styles.releasedFullButton]}>
            <CheckCircle2 size={18} color="#059669" strokeWidth={2.4} />
            <Text style={styles.releasedFullText}>Vehicle Already Released</Text>
          </View>
        ) : isPakka ? (
          /* CASE 2: VEHICLE IS PAKKA -> ONLY FULL LENGTH ACTIVE 'RELEASE' BUTTON */
          <TouchableOpacity
            style={[styles.actionButton, styles.releaseButton, styles.fullWidthButton]}
            onPress={handleRelease}
            activeOpacity={0.85}
          >
            <LogOut size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.releaseButtonText}>Release Vehicle</Text>
          </TouchableOpacity>
        ) : (
          /* CASE 3: VEHICLE IS KACHHA -> 2 BUTTONS (LEFT: RELEASE, RIGHT: IN YARD) */
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.releaseButton]}
              onPress={handleRelease}
              activeOpacity={0.85}
            >
              <LogOut size={17} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.releaseButtonText}>Release</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.inYardButton]}
              onPress={handleInYard}
              activeOpacity={0.85}
            >
              <Warehouse size={17} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.inYardButtonText}>In Yard (Pakka)</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingTop: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  fullWidthButton: {
    flex: 1,
    width: '100%',
  },
  // Release Button Styling (Forest Green)
  releaseButton: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  releaseButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // In Yard (Pakka) Button Styling (Enterprise Blue)
  inYardButton: {
    backgroundColor: '#0062FF',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  inYardButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // Released Full Length Disabled / Completed State
  releasedFullButton: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    shadowOpacity: 0,
    elevation: 0,
  },
  releasedFullText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.2,
  },
});
