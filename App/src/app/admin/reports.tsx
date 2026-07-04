import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { apiRequest } from '@/services/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Car,
  DoorOpen,
  Clock,
  Calendar,
  Package,
  Share2,
} from 'lucide-react-native';

interface ReportItem {
  id: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  title: string;
  description: string;
  apiEndpoint?: string;
  comingSoon?: boolean;
}

export default function ReportsScreen() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reportItems: ReportItem[] = [
    {
      id: 'daily_summary',
      icon: <LayoutDashboard size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Daily Summary Dashboard',
      description: 'Check dynamic status counts and entry trends today.',
      apiEndpoint: '/api/reports/dashboard',
    },
    {
      id: 'vehicles_in_yard',
      icon: <Car size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Vehicles In Yard',
      description: 'List and count of all vehicles currently parked in yard.',
      apiEndpoint: '/api/vehicles?status=IN_YARD&limit=200',
    },
    {
      id: 'released_vehicles',
      icon: <DoorOpen size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Released Vehicles Report',
      description: 'Records of all vehicles released from the yard.',
      apiEndpoint: '/api/vehicles?status=RELEASED&limit=200',
    },
    {
      id: 'pending_payment',
      icon: <Clock size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Pending Payments',
      description: 'Check unsettled release charges and outstanding bills.',
      apiEndpoint: '/api/reports/pending-payments',
    },
    {
      id: 'date_range',
      icon: <Calendar size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Financial Profit & Loss',
      description: 'Summary statement of collections, charges & waivers.',
      apiEndpoint: '/api/reports/profit-loss',
    },
    {
      id: 'inventory',
      icon: <Package size={22} color="#4F46E5" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#4F46E5',
      title: 'Global Roster Inventory',
      description: 'Complete audit of overall yard check-in registration history.',
      apiEndpoint: '/api/vehicles?limit=500',
    },
  ];

  const handleReportTap = async (item: ReportItem) => {
    if (item.comingSoon) {
      Alert.alert('Coming Soon', `${item.title} will be available in the next update.`);
      return;
    }
    if (!item.apiEndpoint) return;

    setLoadingId(item.id);
    setSelectedReport(item);
    setReportData(null);
    setModalVisible(true);

    try {
      const res = await apiRequest(item.apiEndpoint);
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setReportData([]);
        Alert.alert('No Data', 'No records found for this report at the moment.');
      }
    } catch (err: any) {
      setModalVisible(false);
      Alert.alert(
        item.title,
        `Unable to load report data.\nReason: ${err?.message || 'Server unavailable'}`
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedReport || !reportData) return;
    setExportingPDF(true);
    try {
      let rowsHtml = '';
      let summaryHtml = '';
      const title = selectedReport.title;

      if (selectedReport.id === 'daily_summary' && reportData.stats) {
        const s = reportData.stats;
        summaryHtml = `
          <div class="summary-container">
            <div class="summary-card">
              <h3>Total Vehicles</h3>
              <p>${s.totalVehicles ?? 'N/A'}</p>
            </div>
            <div class="summary-card">
              <h3>In Yard</h3>
              <p>${s.inYardVehicles ?? s.totalVehicles ?? 'N/A'}</p>
            </div>
            <div class="summary-card">
              <h3>Released Today</h3>
              <p>${s.releasedVehicles?.today ?? 0}</p>
            </div>
            <div class="summary-card">
              <h3>Entries Today</h3>
              <p>${s.newEntries?.today ?? 0}</p>
            </div>
          </div>
        `;
      } else if (selectedReport.id === 'date_range' && reportData.totalSettledPakka !== undefined) {
        summaryHtml = `
          <div class="summary-container">
            <div class="summary-card">
              <h3>Total Revenue</h3>
              <p>INR ${reportData.totalSettledPakka + reportData.kachhaRevenueRealized}</p>
            </div>
            <div class="summary-card">
              <h3>Settled (Pakka)</h3>
              <p>INR ${reportData.totalSettledPakka}</p>
            </div>
            <div class="summary-card">
              <h3>Kachha Revenue</h3>
              <p>INR ${reportData.kachhaRevenueRealized}</p>
            </div>
            <div class="summary-card">
              <h3>Waivers</h3>
              <p>INR ${reportData.reconciliationLoss}</p>
            </div>
          </div>
        `;
      } else if (Array.isArray(reportData)) {
        summaryHtml = `
          <div class="summary-container">
            <div class="summary-card">
              <h3>Total Records</h3>
              <p>${reportData.length}</p>
            </div>
          </div>
        `;

        rowsHtml = `
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle Number</th>
                <th>Category</th>
                <th>Status</th>
                <th>Brand/Model</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.map((v: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><b>${(v.vehicleNumber ?? 'N/A').toUpperCase()}</b></td>
                  <td>${v.vehicleType ?? 'N/A'}</td>
                  <td><span class="status-badge status-${(v.yardStatus ?? 'IN_YARD').toLowerCase()}">${v.yardStatus ?? 'IN_YARD'}</span></td>
                  <td>${v.brand ?? ''} ${v.model ?? ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        summaryHtml = `
          <pre style="background: #F1F5F9; padding: 15px; border-radius: 8px;">
            ${JSON.stringify(reportData, null, 2)}
          </pre>
        `;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1E293B; padding: 25px; }
            h1 { color: #4F46E5; margin-bottom: 5px; font-size: 24px; }
            .subtitle { color: #64748B; font-size: 13px; margin-bottom: 25px; border-bottom: 2px solid #EEF2FF; padding-bottom: 10px; }
            .summary-container { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 30px; }
            .summary-card { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px; padding: 16px; min-width: 150px; flex: 1; }
            .summary-card h3 { margin: 0 0 10px 0; font-size: 11px; color: #4F46E5; text-transform: uppercase; letter-spacing: 0.5px; }
            .summary-card p { margin: 0; font-size: 22px; font-weight: 800; color: #1E1B4B; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
            th { background-color: #F8FAFC; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
            .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; display: inline-block; }
            .status-in_yard { background: #D1FAE5; color: #065F46; }
            .status-released { background: #FEE2E2; color: #991B1B; }
            .status-kachha { background: #FEF3C7; color: #92400E; }
            .status-pakka { background: #EFF6FF; color: #1E40AF; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="subtitle">Generated on ${new Date().toLocaleString('en-IN')} | Enterprise Yard Management Suite</div>
          ${summaryHtml}
          ${rowsHtml}
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
    } catch (e: any) {
      Alert.alert('PDF Export Error', e.message || 'Failed to print document.');
    } finally {
      setExportingPDF(false);
    }
  };

  const renderModalContent = () => {
    if (!reportData) {
      return (
        <View style={styles.modalCenter}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <ThemedText style={{ marginTop: 10, color: '#64748B' }}>Compiling live report...</ThemedText>
        </View>
      );
    }

    if (selectedReport?.id === 'daily_summary' && reportData.stats) {
      const s = reportData.stats;
      return (
        <View style={styles.reportDetailWrapper}>
          <View style={styles.metricsContainer}>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>TOTAL VEHICLES</ThemedText>
              <ThemedText style={styles.metricVal}>{s.totalVehicles ?? 0}</ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>IN YARD</ThemedText>
              <ThemedText style={styles.metricVal}>{s.inYardVehicles ?? s.totalVehicles ?? 0}</ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>RELEASED TODAY</ThemedText>
              <ThemedText style={styles.metricVal}>{s.releasedVehicles?.today ?? 0}</ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>ENTRIES TODAY</ThemedText>
              <ThemedText style={styles.metricVal}>{s.newEntries?.today ?? 0}</ThemedText>
            </View>
          </View>
          <View style={styles.breakdownCard}>
            <ThemedText style={styles.sectionTitle}>Check-in Breakdown</ThemedText>
            <View style={styles.breakdownRow}>
              <ThemedText style={styles.breakdownLabel}>Monthly Entries (30 days)</ThemedText>
              <ThemedText style={styles.breakdownVal}>{s.newEntries?.thirtyDays ?? 0}</ThemedText>
            </View>
            <View style={styles.breakdownRow}>
              <ThemedText style={styles.breakdownLabel}>Monthly Releases (30 days)</ThemedText>
              <ThemedText style={styles.breakdownVal}>{s.releasedVehicles?.thirtyDays ?? 0}</ThemedText>
            </View>
          </View>
        </View>
      );
    }

    if (selectedReport?.id === 'date_range' && reportData.totalSettledPakka !== undefined) {
      return (
        <View style={styles.reportDetailWrapper}>
          <View style={styles.metricsContainer}>
            <View style={[styles.metricCard, { flexBasis: '100%' }]}>
              <ThemedText style={styles.metricLabel}>TOTAL ACCRUED REVENUE</ThemedText>
              <ThemedText style={[styles.metricVal, { color: '#10B981' }]}>
                ₹{(reportData.totalSettledPakka + reportData.kachhaRevenueRealized).toLocaleString('en-IN')}
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>SETTLED (PAKKA)</ThemedText>
              <ThemedText style={styles.metricVal}>₹{reportData.totalSettledPakka?.toLocaleString('en-IN') ?? 0}</ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>KACHHA REVENUE</ThemedText>
              <ThemedText style={styles.metricVal}>₹{reportData.kachhaRevenueRealized?.toLocaleString('en-IN') ?? 0}</ThemedText>
            </View>
            <View style={[styles.metricCard, { flexBasis: '100%' }]}>
              <ThemedText style={styles.metricLabel}>RECONCILIATION LOSS (WAIVERS)</ThemedText>
              <ThemedText style={[styles.metricVal, { color: '#EF4444' }]}>
                ₹{reportData.reconciliationLoss?.toLocaleString('en-IN') ?? 0}
              </ThemedText>
            </View>
          </View>
        </View>
      );
    }

    if (Array.isArray(reportData)) {
      return (
        <View style={{ gap: 12 }}>
          <ThemedText style={styles.sectionTitle}>Detail Records ({reportData.length})</ThemedText>
          {reportData.length === 0 ? (
            <ThemedText style={styles.emptyText}>No records matching search filters.</ThemedText>
          ) : (
            reportData.map((v: any, index: number) => (
              <View key={v.id || index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.plateBadge}>
                    <ThemedText style={styles.plateText}>{(v.vehicleNumber ?? 'N/A').toUpperCase()}</ThemedText>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    (v.yardStatus ?? 'IN_YARD') === 'IN_YARD' ? styles.statusInYard : styles.statusReleased
                  ]}>
                    <ThemedText style={[
                      styles.statusBadgeText,
                      (v.yardStatus ?? 'IN_YARD') === 'IN_YARD' ? { color: '#065F46' } : { color: '#991B1B' }
                    ]}>
                      {v.yardStatus ?? 'IN_YARD'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.itemBody}>
                  {v.brand && (
                    <ThemedText style={styles.itemSub}>Brand/Model: {v.brand} {v.model}</ThemedText>
                  )}
                  {v.vehicleType && (
                    <ThemedText style={styles.itemSub}>Category: {v.vehicleType}</ThemedText>
                  )}
                  {v.checkInDate && (
                    <ThemedText style={styles.itemSub}>Check-In: {new Date(v.checkInDate).toLocaleDateString('en-IN')}</ThemedText>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      );
    }

    return (
      <View style={{ padding: 10 }}>
        <ThemedText style={styles.emptyText}>Report structure parsed successfully.</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Reports Dashboard</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.reportsList}>
          {reportItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.reportRow,
                index < reportItems.length - 1 && styles.reportRowBorder,
              ]}
              onPress={() => handleReportTap(item)}
              activeOpacity={0.7}
              disabled={loadingId === item.id}
            >
              {/* Icon */}
              <View style={[styles.reportIconBg, { backgroundColor: item.iconBgColor }]}>
                {item.icon}
              </View>

              {/* Labels */}
              <View style={styles.reportTextBlock}>
                <ThemedText style={styles.reportTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.reportDescription}>{item.description}</ThemedText>
              </View>

              {/* Arrow / Loader */}
              {loadingId === item.id ? (
                <ActivityIndicator size="small" color="#94A3B8" />
              ) : (
                <ChevronRight size={18} color="#CBD5E1" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ThemedText style={styles.footerNote}>
          Tap any report category to load live summaries and generate exports.
        </ThemedText>
      </ScrollView>

      {/* Report Preview Modal */}
      <Modal
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn} activeOpacity={0.7}>
              <ChevronLeft size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <ThemedText style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedReport?.title}
              </ThemedText>
              <ThemedText style={styles.modalHeaderSub} numberOfLines={1}>
                Live Interactive Statement
              </ThemedText>
            </View>

            {reportData && (
              <TouchableOpacity
                onPress={handleExportPDF}
                disabled={exportingPDF}
                style={styles.exportBtn}
                activeOpacity={0.7}
              >
                {exportingPDF ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <>
                    <Share2 size={16} color="#4F46E5" />
                    <ThemedText style={styles.exportText}>Export PDF</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Modal Content Scroll Area */}
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {renderModalContent()}
          </ScrollView>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reportsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  reportRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportIconBg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reportTextBlock: {
    flex: 1,
    gap: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#64748B',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  reportDetailWrapper: {
    gap: 16,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '45%',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // List Layout
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plateBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  plateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusInYard: {
    backgroundColor: '#D1FAE5',
  },
  statusReleased: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  itemBody: {
    gap: 2,
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
  },
});
