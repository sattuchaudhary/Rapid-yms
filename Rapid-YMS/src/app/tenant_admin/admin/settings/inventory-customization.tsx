import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Plus,
  Search,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Save,
  RotateCcw,
  Sliders,
} from 'lucide-react-native';
import { apiRequest } from '@/services/api';

const STORAGE_KEY = 'yms_master_checklist_v2';

export interface CustomInventoryItem {
  id: string;
  itemName: string;
  category: string;
  inputType: 'boolean' | 'text' | 'condition';
  isRequired: boolean;
  enabled: boolean;
  printEnabled: boolean;
  order: number;
}

export const DEFAULT_CHECKLIST: CustomInventoryItem[] = [
  { id: '1', itemName: 'RC-Original', category: 'Documents', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 1 },
  { id: '2', itemName: 'Keys', category: 'Documents', inputType: 'boolean', isRequired: true, enabled: true, printEnabled: true, order: 2 },
  { id: '3', itemName: 'Insurance Certificate', category: 'Documents', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 3 },
  { id: '4', itemName: 'Battery Make', category: 'Electrical', inputType: 'text', isRequired: false, enabled: true, printEnabled: true, order: 4 },
  { id: '5', itemName: 'Horn', category: 'Electrical', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 5 },
  { id: '6', itemName: 'Front Light', category: 'Electrical', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 6 },
  { id: '7', itemName: 'Back Light', category: 'Electrical', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 7 },
  { id: '8', itemName: 'Indicator Lights', category: 'Electrical', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 8 },
  { id: '9', itemName: 'Front Tyre', category: 'Tyres', inputType: 'text', isRequired: false, enabled: true, printEnabled: true, order: 9 },
  { id: '10', itemName: 'Back Tyre', category: 'Tyres', inputType: 'text', isRequired: false, enabled: true, printEnabled: true, order: 10 },
  { id: '11', itemName: 'Spare Tyre', category: 'Tyres', inputType: 'text', isRequired: false, enabled: true, printEnabled: true, order: 11 },
  { id: '12', itemName: 'Side Mirror (Left)', category: 'Body', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 12 },
  { id: '13', itemName: 'Side Mirror (Right)', category: 'Body', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 13 },
  { id: '14', itemName: 'Body Condition', category: 'Condition', inputType: 'condition', isRequired: false, enabled: true, printEnabled: true, order: 14 },
  { id: '15', itemName: 'Tool Kit & Jack', category: 'Tools', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 15 },
  { id: '16', itemName: 'Music System', category: 'Tools', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 16 },
  { id: '17', itemName: 'Meter Running Condition', category: 'Condition', inputType: 'boolean', isRequired: false, enabled: true, printEnabled: true, order: 17 },
];

const CATEGORIES = ['All', 'Documents', 'Tyres', 'Electrical', 'Body', 'Tools', 'Condition', 'Other'];

export default function InventoryCustomizationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<CustomInventoryItem[]>(DEFAULT_CHECKLIST);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CustomInventoryItem | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Documents');
  const [formType, setFormType] = useState<'boolean' | 'text' | 'condition'>('boolean');
  const [formPrint, setFormPrint] = useState<boolean>(true);

  // Load configuration
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const local = await AsyncStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed.sort((a, b) => a.order - b.order));
          setLoading(false);
          return;
        }
      }
      setItems(DEFAULT_CHECKLIST);
    } catch (e) {
      setItems(DEFAULT_CHECKLIST);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save changes
  const handleSave = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      // sync with legacy format
      const legacy = items.map(it => ({ id: it.id, itemName: it.itemName, enabled: it.enabled, printEnabled: it.printEnabled }));
      await AsyncStorage.setItem('yms_master_checklist', JSON.stringify(legacy));

      // sync with backend
      try {
        await apiRequest('/api/inventory/config', {
          method: 'PUT',
          body: JSON.stringify({ items }),
        });
      } catch (err) {}

      Alert.alert('Saved', 'Inventory checklist updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Reorder Item
  const handleMove = (index: number, dir: 'UP' | 'DOWN') => {
    const target = dir === 'UP' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }

    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;

    setItems(updated.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  // Toggle active
  const handleToggle = (id: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, enabled: !it.enabled } : it));
  };

  // Add / Edit
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('Documents');
    setFormType('boolean');
    setFormPrint(true);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: CustomInventoryItem) => {
    setEditingItem(item);
    setFormName(item.itemName);
    setFormCategory(item.category || 'Documents');
    setFormType(item.inputType || 'boolean');
    setFormPrint(item.printEnabled !== false);
    setModalVisible(true);
  };

  const handleSaveModal = () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }

    if (editingItem) {
      setItems(prev =>
        prev.map(it =>
          it.id === editingItem.id
            ? { ...it, itemName: formName.trim(), category: formCategory, inputType: formType, printEnabled: formPrint }
            : it
        )
      );
    } else {
      const newItem: CustomInventoryItem = {
        id: `item_${Date.now()}`,
        itemName: formName.trim(),
        category: formCategory,
        inputType: formType,
        isRequired: false,
        enabled: true,
        printEnabled: formPrint,
        order: items.length + 1,
      };
      setItems(prev => [...prev, newItem]);
    }
    setModalVisible(false);
  };

  // Delete
  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id).map((it, idx) => ({ ...it, order: idx + 1 })));
    setModalVisible(false);
  };

  // Reset to default
  const handleReset = () => {
    Alert.alert('Reset Checklist', 'Reset to default standard items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', onPress: () => setItems(DEFAULT_CHECKLIST) },
    ]);
  };

  // Filtered
  const filtered = useMemo(() => {
    return items.filter(it => {
      const matchSearch = it.itemName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'All' || it.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, selectedCategory]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inventory Customization</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={handleReset} activeOpacity={0.7}>
          <RotateCcw size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Clean Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search checklist items..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catPill, active && styles.catPillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Item List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map(item => {
            const index = items.findIndex(i => i.id === item.id);
            const isFirst = index === 0;
            const isLast = index === items.length - 1;

            return (
              <View key={item.id} style={styles.itemCard}>
                {/* Reorder Buttons */}
                <View style={styles.orderBox}>
                  <TouchableOpacity
                    style={[styles.arrowBtn, isFirst && styles.arrowDisabled]}
                    disabled={isFirst}
                    onPress={() => handleMove(index, 'UP')}
                  >
                    <ChevronUp size={14} color={isFirst ? '#CBD5E1' : '#475569'} />
                  </TouchableOpacity>

                  <Text style={styles.indexNum}>{index + 1}</Text>

                  <TouchableOpacity
                    style={[styles.arrowBtn, isLast && styles.arrowDisabled]}
                    disabled={isLast}
                    onPress={() => handleMove(index, 'DOWN')}
                  >
                    <ChevronDown size={14} color={isLast ? '#CBD5E1' : '#475569'} />
                  </TouchableOpacity>
                </View>

                {/* Main Details (Tap to Edit) */}
                <TouchableOpacity
                  style={styles.itemDetails}
                  activeOpacity={0.7}
                  onPress={() => handleOpenEdit(item)}
                >
                  <Text style={[styles.itemName, !item.enabled && styles.itemDisabled]} numberOfLines={1}>
                    {item.itemName}
                  </Text>
                  <View style={styles.itemSubRow}>
                    <Text style={styles.itemSubText}>{item.category}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.itemSubText}>
                      {item.inputType === 'boolean' ? 'Yes/No' : item.inputType === 'text' ? 'Text / Make' : 'Rating'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Active Toggle Switch */}
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggle(item.id)}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={item.enabled ? '#4F46E5' : '#F8FAFC'}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Clean Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Plus size={18} color="#4F46E5" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Edit / Add Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add Item'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Input Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Item Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spare Tyre, Battery Make"
                placeholderTextColor="#94A3B8"
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            {/* Category Select */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {CATEGORIES.filter(c => c !== 'All').map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.miniPill, formCategory === c && styles.miniPillActive]}
                    onPress={() => setFormCategory(c)}
                  >
                    <Text style={[styles.miniPillText, formCategory === c && styles.miniPillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Type Select */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Input Type</Text>
              <View style={styles.typeRow}>
                {(['boolean', 'text', 'condition'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, formType === t && styles.typeBtnActive]}
                    onPress={() => setFormType(t)}
                  >
                    <Text style={[styles.typeText, formType === t && styles.typeTextActive]}>
                      {t === 'boolean' ? 'Yes / No' : t === 'text' ? 'Make / Text' : 'Condition'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Print on slip */}
            <View style={styles.modalSwitchRow}>
              <Text style={styles.switchLabel}>Print on Gate Receipt</Text>
              <Switch
                value={formPrint}
                onValueChange={setFormPrint}
                trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                thumbColor={formPrint ? '#4F46E5' : '#F8FAFC'}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              {editingItem && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(editingItem.id)}>
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveModal}>
                <Text style={styles.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  categoryBar: {
    paddingVertical: 6,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 90,
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  orderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  arrowBtn: {
    padding: 2,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  indexNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginVertical: 1,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemDisabled: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  dot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingVertical: 11,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  miniPillActive: {
    backgroundColor: '#EEF2FF',
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  miniPillTextActive: {
    color: '#4F46E5',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: '#EEF2FF',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  typeTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
