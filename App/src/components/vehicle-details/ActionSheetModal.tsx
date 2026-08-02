import React from 'react';
import { StyleSheet, View, TouchableOpacity, Modal } from 'react-native';
import { FileText, Pencil, Printer, Share2, Trash2 } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';

interface ActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  onSharePDF: () => void;
  onEditVehicle: () => void;
  onPrintThermal: () => void;
  onShareText: () => void;
  onDeleteVehicle: () => void;
}

export function ActionSheetModal({
  visible,
  onClose,
  onSharePDF,
  onEditVehicle,
  onPrintThermal,
  onShareText,
  onDeleteVehicle,
}: ActionSheetModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetIndicator} />
            <ThemedText style={styles.sheetTitle}>Vehicle Actions</ThemedText>
          </View>

          <View style={styles.sheetList}>
            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                onClose();
                onSharePDF();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
                <FileText size={18} color="#4F46E5" />
              </View>
              <ThemedText style={styles.itemText}>Share Condition Report (PDF)</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                onClose();
                onEditVehicle();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                <Pencil size={18} color="#059669" />
              </View>
              <ThemedText style={styles.itemText}>Edit Vehicle Record</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                onClose();
                onPrintThermal();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                <Printer size={18} color="#7C3AED" />
              </View>
              <ThemedText style={styles.itemText}>Print Thermal Gate Pass</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                onClose();
                onShareText();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                <Share2 size={18} color="#EA580C" />
              </View>
              <ThemedText style={styles.itemText}>Share Details Text</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetItem, styles.sheetItemDelete]}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  onDeleteVehicle();
                }, 150);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Trash2 size={18} color="#EF4444" />
              </View>
              <ThemedText style={[styles.itemText, { color: '#EF4444' }]}>
                Delete Vehicle Record
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    minHeight: 48,
  },
  sheetItemDelete: {
    backgroundColor: '#FEF2F2',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
