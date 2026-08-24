import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Car,
} from 'lucide-react-native';
import { bulkImportVehicles } from '@/services/api';

export interface ParsedVehicle {
  vehicleNumber: string;
  vehicleType: string;
  bankName: string;
  chassisNumber?: string;
  engineNumber?: string;
  brand?: string;
  model?: string;
  color?: string;
  repoAgency?: string;
  repoDate?: string;
  entryDate?: string;
  customerName?: string;
  customerPhone?: string;
  yardStatus?: 'KACHHA' | 'PAKKA';
  isValid: boolean;
  error?: string;
  rowNumber: number;
}

const SAMPLE_CSV_CONTENT = `Vehicle Number*,Vehicle Type* (TW/THREE_W/FW/CV),Bank Name*,Chassis Number,Engine Number,Brand,Model,Color,Repo Agency,Repo Date (YYYY-MM-DD),Entry Date (YYYY-MM-DD),Customer Name,Customer Phone,Yard Status (KACHHA/PAKKA)
UP16AB1234,FW,HDFC Bank,MA3EFA12S00123456,K12M1234567,Maruti,Swift,White,Rapid Agency,2026-08-20,2026-08-20,Rahul Sharma,9876543210,KACHHA
DL01XY9876,TW,ICICI Bank,MD2A1234567890123,DTSI9876543,Bajaj,Pulsar 150,Black,Express Agency,2026-08-22,2026-08-22,Amit Verma,9123456780,PAKKA
MH04CD5678,CV,Axis Bank,MAT45678901234567,CRDI9988776,Tata,Ace,Silver,Safe Repo,2026-08-23,2026-08-23,Ramesh Patel,9898989898,KACHHA`;

export default function BulkUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
  } | null>(null);

  const [parsing, setParsing] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedVehicle[]>([]);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  // Download Sample Template (.CSV)
  const downloadSampleTemplate = async () => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      const fileName = 'RapidYMS_Vehicle_Import_Sample.csv';

      if (Platform.OS === 'web') {
        const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, SAMPLE_CSV_CONTENT, {
        encoding: 'utf8',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Sample Vehicle Import Template',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Saved', `Template saved as ${fileName}`);
      }
    } catch (err: any) {
      console.error('[Download Template Error]', err);
      Alert.alert('Error', err?.message || 'Could not download template');
    }
  };

  // Parse CSV Line safely handling quotes and commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Process and validate CSV text
  const processCSVContent = (content: string) => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      Alert.alert('Empty File', 'The uploaded file does not contain any vehicle records.');
      setParsedRows([]);
      return;
    }

    const dataLines = lines.slice(1);
    const parsed: ParsedVehicle[] = [];

    dataLines.forEach((line, idx) => {
      const cols = parseCSVLine(line);
      const rowNum = idx + 2;

      const vehicleNumber = (cols[0] || '').toUpperCase().trim();
      const rawType = (cols[1] || '').toUpperCase().trim();
      const bankName = (cols[2] || '').trim();

      // Normalize Vehicle Type
      let vehicleType = 'TW';
      if (['TW', 'TWO_WHEELER', '2W', 'BIKE'].includes(rawType)) vehicleType = 'TW';
      else if (['THREE_W', '3W', 'AUTO'].includes(rawType)) vehicleType = 'THREE_W';
      else if (['FW', 'FOUR_WHEELER', '4W', 'CAR'].includes(rawType)) vehicleType = 'FW';
      else if (['CV', 'COMMERCIAL', 'TRUCK', 'BUS'].includes(rawType)) vehicleType = 'CV';

      // Validation
      let isValid = true;
      let error = '';

      if (!vehicleNumber || vehicleNumber.length < 4) {
        isValid = false;
        error = 'Missing Vehicle Number';
      } else if (!bankName) {
        isValid = false;
        error = 'Missing Bank Name';
      }

      parsed.push({
        vehicleNumber,
        vehicleType,
        bankName,
        chassisNumber: cols[3] || undefined,
        engineNumber: cols[4] || undefined,
        brand: cols[5] || undefined,
        model: cols[6] || undefined,
        color: cols[7] || undefined,
        repoAgency: cols[8] || undefined,
        repoDate: cols[9] || undefined,
        entryDate: cols[10] || undefined,
        customerName: cols[11] || undefined,
        customerPhone: cols[12] || undefined,
        yardStatus: (cols[13] || '').toUpperCase().trim() === 'PAKKA' ? 'PAKKA' : 'KACHHA',
        isValid,
        error,
        rowNumber: rowNum,
      });
    });

    setParsedRows(parsed);
  };

  // Pick Document
  const pickFile = async () => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const asset = res.assets[0];
      setSelectedFile({
        name: asset.name,
        size: asset.size,
        uri: asset.uri,
      });

      setParsing(true);
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'utf8',
      });
      processCSVContent(content);
    } catch (err: any) {
      console.error('[Pick File Error]', err);
      Alert.alert('File Error', 'Could not read the selected file. Please ensure it is a valid CSV.');
    } finally {
      setParsing(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedRows([]);
  };

  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  // Execute Bulk Import
  const handleImport = async () => {
    if (validRows.length === 0) {
      Alert.alert('No Valid Records', 'Please upload a file with valid vehicle records.');
      return;
    }

    try {
      setImporting(true);
      const res = await bulkImportVehicles(validRows);

      if (res?.success) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        let msg = `Successfully imported ${res.importedCount} vehicle(s).`;
        if (res.skippedCount > 0) {
          msg += `\n${res.skippedCount} existing vehicle(s) were skipped to avoid duplicates.`;
        }

        Alert.alert('Import Complete', msg, [
          {
            text: 'Upload More',
            onPress: () => clearFile(),
          },
          {
            text: 'View Vehicles',
            onPress: () => router.replace('/tenant_admin/admin/vehicles' as any),
            style: 'default',
          },
        ]);
      } else {
        throw new Error(res?.error || res?.message || 'Failed to import vehicles');
      }
    } catch (err: any) {
      console.error('[Import Error]', err);
      Alert.alert('Import Failed', err?.message || 'Could not import vehicles.');
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bulk Vehicle Import</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Download Template Card */}
        <TouchableOpacity
          style={styles.templateCard}
          onPress={downloadSampleTemplate}
          activeOpacity={0.75}
        >
          <View style={styles.templateIconBox}>
            <Download size={18} color="#0062FF" />
          </View>
          <View style={styles.templateTextBox}>
            <Text style={styles.templateTitle}>Download Sample Template</Text>
            <Text style={styles.templateSubtitle}>Pre-formatted CSV with mandatory fields</Text>
          </View>
        </TouchableOpacity>

        {/* 2. File Upload Box */}
        {!selectedFile ? (
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={pickFile}
            activeOpacity={0.75}
          >
            {parsing ? (
              <ActivityIndicator size="small" color="#0062FF" />
            ) : (
              <>
                <View style={styles.uploadIconCircle}>
                  <UploadCloud size={24} color="#0062FF" />
                </View>
                <Text style={styles.uploadMainText}>Tap to Select CSV / Excel File</Text>
                <Text style={styles.uploadSubText}>Supports .csv and spreadsheet files</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.selectedFileCard}>
            <View style={styles.fileIconBox}>
              <FileSpreadsheet size={20} color="#16A34A" />
            </View>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={styles.fileMeta}>
                {formatFileSize(selectedFile.size)} • {parsedRows.length} total rows
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeFileBtn}
              onPress={clearFile}
              activeOpacity={0.7}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Validation Summary Badges */}
        {selectedFile && parsedRows.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{parsedRows.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.statValue, { color: '#059669' }]}>{validRows.length}</Text>
              <Text style={[styles.statLabel, { color: '#047857' }]}>Valid</Text>
            </View>
            <View style={[styles.statCard, invalidRows.length > 0 && { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' }]}>
              <Text style={[styles.statValue, invalidRows.length > 0 && { color: '#DC2626' }]}>
                {invalidRows.length}
              </Text>
              <Text style={styles.statLabel}>Errors</Text>
            </View>
          </View>
        )}

        {/* 4. Error list if any */}
        {invalidRows.length > 0 && (
          <View style={styles.errorSection}>
            <View style={styles.errorHeader}>
              <AlertCircle size={14} color="#DC2626" />
              <Text style={styles.errorHeaderText}>Invalid Rows ({invalidRows.length})</Text>
            </View>
            {invalidRows.slice(0, 3).map((item: ParsedVehicle) => (
              <Text key={item.rowNumber} style={styles.errorItemText}>
                • Row {item.rowNumber}: {item.error}
              </Text>
            ))}
          </View>
        )}

        {/* 5. Clean Preview of First few valid rows */}
        {validRows.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Data Preview ({Math.min(validRows.length, 3)} of {validRows.length})</Text>
            <View style={styles.previewCardList}>
              {validRows.slice(0, 3).map((v: ParsedVehicle) => (
                <View key={v.rowNumber} style={styles.previewItem}>
                  <View style={styles.previewItemHeader}>
                    <Text style={styles.previewVehicleNumber}>{v.vehicleNumber}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{v.vehicleType}</Text>
                    </View>
                  </View>
                  <Text style={styles.previewBank}>{v.bankName}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Action */}
      {selectedFile && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[
              styles.importBtn,
              (validRows.length === 0 || importing) && styles.importBtnDisabled,
            ]}
            onPress={handleImport}
            disabled={validRows.length === 0 || importing}
            activeOpacity={0.85}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={18} color="#FFFFFF" />
                <Text style={styles.importBtnText}>
                  Import {validRows.length} Vehicles
                </Text>
              </>
            )}
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 12,
  },
  templateIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTextBox: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  templateSubtitle: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 1,
  },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  uploadMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadSubText: {
    fontSize: 12,
    color: '#64748B',
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  fileMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  removeFileBtn: {
    padding: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  errorSection: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    gap: 4,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  errorHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F1239',
  },
  errorItemText: {
    fontSize: 11,
    color: '#BE123C',
  },
  previewSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  previewCardList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  previewItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  previewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewVehicleNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  previewBank: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0062FF',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  importBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
