import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ChevronLeft,
  Printer,
  Check,
  Plus,
  Trash2,
  FileText,
  RefreshCw,
  Settings,
  ImageIcon,
} from 'lucide-react-native';

export const MASTER_CHECKLIST_KEY = 'yms_master_checklist';
export const PRINT_CONFIG_KEY = 'yms_print_config';

export interface ChecklistMasterItem {
  id: string;
  itemName: string;
  enabled: boolean;
  printEnabled: boolean;
}

export interface PrintConfig {
  headerTitle: string;
  headerAddress: string;
  showSpecs: boolean;
  showFinancer: boolean;
  showChecklist: boolean;
  showRemarks: boolean;
  showPhotos: boolean;
  photoSize: 'small' | 'medium' | 'large' | 'full';
  showFooter: boolean;
  footerDisclaimer: string;
}

export const DEFAULT_CHECKLIST: ChecklistMasterItem[] = [
  { id: '1', itemName: 'RC-Original', enabled: true, printEnabled: true },
  { id: '2', itemName: 'Key', enabled: true, printEnabled: true },
  { id: '3', itemName: 'Battery', enabled: true, printEnabled: true },
  { id: '4', itemName: 'Horn', enabled: true, printEnabled: true },
  { id: '5', itemName: 'Front Tyre', enabled: true, printEnabled: true },
  { id: '6', itemName: 'Back Tyre', enabled: true, printEnabled: true },
  { id: '7', itemName: 'Spare Tyre', enabled: true, printEnabled: true },
  { id: '8', itemName: 'Tool Kit', enabled: true, printEnabled: true },
  { id: '9', itemName: 'Side Mirror (Left)', enabled: true, printEnabled: true },
  { id: '10', itemName: 'Side Mirror (Right)', enabled: true, printEnabled: true },
  { id: '11', itemName: 'Light Front', enabled: true, printEnabled: true },
  { id: '12', itemName: 'Light Back', enabled: true, printEnabled: true },
  { id: '13', itemName: 'Light Indicator', enabled: true, printEnabled: true },
  { id: '14', itemName: 'Music System', enabled: true, printEnabled: true },
  { id: '15', itemName: 'Meter Running Condition', enabled: true, printEnabled: true },
];

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  headerTitle: 'SHREE PARKING YARD',
  headerAddress: 'GURUGRAM VILLAGE, HARYANA',
  showSpecs: true,
  showFinancer: true,
  showChecklist: true,
  showRemarks: true,
  showPhotos: true,
  photoSize: 'medium',
  showFooter: true,
  footerDisclaimer: '*** THIS IS A COMPUTER SYSTEM GENERATED DOCUMENT. PHYSICAL SIGNATURE NOT REQUIRED. ***',
};

export default function PrintSetupScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'checklist' | 'layout'>('checklist');

  // Master Checklist State
  const [checklist, setChecklist] = useState<ChecklistMasterItem[]>(DEFAULT_CHECKLIST);
  const [newItemModal, setNewItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Print Layout State
  const [config, setConfig] = useState<PrintConfig>(DEFAULT_PRINT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedChecklist = await AsyncStorage.getItem(MASTER_CHECKLIST_KEY);
      if (savedChecklist) {
        setChecklist(JSON.parse(savedChecklist));
      }

      const savedConfig = await AsyncStorage.getItem(PRINT_CONFIG_KEY);
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (e) {
      console.warn('[PrintSetup] Load settings failed:', e);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(MASTER_CHECKLIST_KEY, JSON.stringify(checklist));
      await AsyncStorage.setItem(PRINT_CONFIG_KEY, JSON.stringify(config));
      Alert.alert('Success', 'Print & Inventory setup saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save setup');
    } finally {
      setSaving(false);
    }
  };

  // Checklist Actions
  const toggleItemEnabled = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const toggleItemPrint = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, printEnabled: !item.printEnabled } : item))
    );
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }
    const newItem: ChecklistMasterItem = {
      id: Date.now().toString(),
      itemName: newItemName.trim(),
      enabled: true,
      printEnabled: true,
    };
    setChecklist(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemModal(false);
  };

  const handleDeleteItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const handleResetChecklist = () => {
    Alert.alert('Reset Checklist', 'Reset checklist items to default system items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setChecklist(DEFAULT_CHECKLIST) },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Print & Inventory Setup</ThemedText>
        <TouchableOpacity onPress={saveSettings} style={styles.saveHeaderBtn} activeOpacity={0.8}>
          <Check size={18} color="#FFFFFF" />
          <ThemedText style={styles.saveHeaderBtnText}>Save</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'checklist' && styles.tabBtnActive]}
          onPress={() => setActiveTab('checklist')}
        >
          <Settings size={16} color={activeTab === 'checklist' ? '#4F46E5' : '#64748B'} />
          <ThemedText style={[styles.tabBtnText, activeTab === 'checklist' && styles.tabBtnTextActive]}>
            Checklist Master
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'layout' && styles.tabBtnActive]}
          onPress={() => setActiveTab('layout')}
        >
          <Printer size={16} color={activeTab === 'layout' ? '#4F46E5' : '#64748B'} />
          <ThemedText style={[styles.tabBtnText, activeTab === 'layout' && styles.tabBtnTextActive]}>
            Print Layout & Photos
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'checklist' ? (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sectionTitle}>Inventory Checklist Items</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  Configure which items appear during vehicle check-in and printouts.
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setNewItemModal(true)} activeOpacity={0.8}>
                <Plus size={16} color="#FFFFFF" />
                <ThemedText style={styles.addBtnText}>Add Item</ThemedText>
              </TouchableOpacity>
            </View>

            {checklist.map(item => (
              <View key={item.id} style={styles.checklistItemCard}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.itemTitle}>{item.itemName}</ThemedText>
                  <View style={styles.itemTagsRow}>
                    <ThemedText style={[styles.tag, item.enabled ? styles.tagActive : styles.tagDisabled]}>
                      {item.enabled ? 'Form Active' : 'Form Hidden'}
                    </ThemedText>
                    <ThemedText style={[styles.tag, item.printEnabled ? styles.tagPrint : styles.tagDisabled]}>
                      {item.printEnabled ? 'Print Included' : 'Print Omitted'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.itemControls}>
                  <View style={styles.controlToggle}>
                    <ThemedText style={styles.controlLabel}>In Form</ThemedText>
                    <Switch
                      value={item.enabled}
                      onValueChange={() => toggleItemEnabled(item.id)}
                      trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                      thumbColor={item.enabled ? '#4F46E5' : '#94A3B8'}
                    />
                  </View>

                  <View style={styles.controlToggle}>
                    <ThemedText style={styles.controlLabel}>In Print</ThemedText>
                    <Switch
                      value={item.printEnabled}
                      onValueChange={() => toggleItemPrint(item.id)}
                      trackColor={{ false: '#E2E8F0', true: '#BBF7D0' }}
                      thumbColor={item.printEnabled ? '#16A34A' : '#94A3B8'}
                    />
                  </View>

                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetChecklist} activeOpacity={0.8}>
              <RefreshCw size={16} color="#64748B" />
              <ThemedText style={styles.resetBtnText}>Reset Checklist to System Defaults</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {/* Header & Subtitle Section */}
            <ThemedText style={styles.sectionTitle}>Document Header & Title</ThemedText>
            <View style={styles.cardBox}>
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Header Title / Company Name</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={config.headerTitle}
                  onChangeText={val => setConfig(prev => ({ ...prev, headerTitle: val }))}
                  placeholder="e.g. SHREE PARKING YARD"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Yard Address / Subtitle</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={config.headerAddress}
                  onChangeText={val => setConfig(prev => ({ ...prev, headerAddress: val }))}
                  placeholder="e.g. GURUGRAM VILLAGE, HARYANA"
                />
              </View>
            </View>

            {/* Print Section Visibility Toggles */}
            <ThemedText style={styles.sectionTitle}>Print Section Controls</ThemedText>
            <View style={styles.cardBox}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Vehicle Specifications</ThemedText>
                  <ThemedText style={styles.toggleDesc}>Plate, Category, Make, Model, Engine & Chassis</ThemedText>
                </View>
                <Switch
                  value={config.showSpecs}
                  onValueChange={val => setConfig(prev => ({ ...prev, showSpecs: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showSpecs ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Financer & Repossession Info</ThemedText>
                  <ThemedText style={styles.toggleDesc}>Bank, Repo Agency, Agent & Customer Mob</ThemedText>
                </View>
                <Switch
                  value={config.showFinancer}
                  onValueChange={val => setConfig(prev => ({ ...prev, showFinancer: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showFinancer ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Accessories Checklist Table</ThemedText>
                  <ThemedText style={styles.toggleDesc}>Print enabled checklist items</ThemedText>
                </View>
                <Switch
                  value={config.showChecklist}
                  onValueChange={val => setConfig(prev => ({ ...prev, showChecklist: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showChecklist ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Yard Remarks & Body Condition</ThemedText>
                  <ThemedText style={styles.toggleDesc}>Condition status and customer/yard notes</ThemedText>
                </View>
                <Switch
                  value={config.showRemarks}
                  onValueChange={val => setConfig(prev => ({ ...prev, showRemarks: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showRemarks ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Footer Disclaimer</ThemedText>
                  <ThemedText style={styles.toggleDesc}>System signature and terms disclaimer</ThemedText>
                </View>
                <Switch
                  value={config.showFooter}
                  onValueChange={val => setConfig(prev => ({ ...prev, showFooter: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showFooter ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              {config.showFooter && (
                <View style={[styles.fieldGroup, { marginTop: 10 }]}>
                  <ThemedText style={styles.fieldLabel}>Custom Footer Disclaimer Text</ThemedText>
                  <TextInput
                    style={[styles.textInput, { height: 60 }]}
                    multiline
                    value={config.footerDisclaimer}
                    onChangeText={val => setConfig(prev => ({ ...prev, footerDisclaimer: val }))}
                  />
                </View>
              )}
            </View>

            {/* Photo Print Layout & Size */}
            <ThemedText style={styles.sectionTitle}>Photographs Print Settings</ThemedText>
            <View style={styles.cardBox}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.toggleTitle}>Include Vehicle Photos</ThemedText>
                  <ThemedText style={styles.toggleDesc}>Print vehicle possession photos in report</ThemedText>
                </View>
                <Switch
                  value={config.showPhotos}
                  onValueChange={val => setConfig(prev => ({ ...prev, showPhotos: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                  thumbColor={config.showPhotos ? '#4F46E5' : '#94A3B8'}
                />
              </View>

              {config.showPhotos && (
                <View style={{ marginTop: 12 }}>
                  <ThemedText style={styles.fieldLabel}>Photo Print Display Size</ThemedText>
                  <View style={styles.photoSizeGrid}>
                    {(['small', 'medium', 'large', 'full'] as const).map(size => (
                      <TouchableOpacity
                        key={size}
                        style={[styles.sizeOption, config.photoSize === size && styles.sizeOptionActive]}
                        onPress={() => setConfig(prev => ({ ...prev, photoSize: size }))}
                      >
                        <ThemedText
                          style={[styles.sizeOptionText, config.photoSize === size && styles.sizeOptionTextActive]}
                        >
                          {size === 'small'
                            ? 'Small (4/row)'
                            : size === 'medium'
                            ? 'Medium (3/row)'
                            : size === 'large'
                            ? 'Large (2/row)'
                            : 'Full Width (1/row)'}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add New Item Modal */}
      <Modal visible={newItemModal} transparent animationType="fade" onRequestClose={() => setNewItemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Add Checklist Item</ThemedText>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. GPS Tracker, Spare Key"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNewItemModal(false)}>
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddItem}>
                <ThemedText style={styles.modalSaveText}>Add Item</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4F46E5',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#4F46E5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checklistItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagActive: {
    backgroundColor: '#E0E7FF',
    color: '#4338CA',
  },
  tagPrint: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  tagDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlToggle: {
    alignItems: 'center',
    gap: 2,
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  deleteBtn: {
    padding: 6,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  photoSizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  sizeOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  sizeOptionActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  sizeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  sizeOptionTextActive: {
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
