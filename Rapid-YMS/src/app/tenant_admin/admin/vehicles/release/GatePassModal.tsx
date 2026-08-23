import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  Printer,
  Share2,
  X,
  FileCheck2,
  Building2,
  Calendar,
  UserCheck,
  CreditCard,
} from 'lucide-react-native';
import { GatePassResult } from './types';

export interface GatePassModalProps {
  visible: boolean;
  onClose: () => void;
  gatePassData: GatePassResult | null;
  vehicle: any;
  recipientName: string;
  recipientPhone: string;
  recipientType: string;
  paidAmount: number;
  paymentMode: string;
  releaseType: string;
}

export default function GatePassModal({
  visible,
  onClose,
  gatePassData,
  vehicle,
  recipientName,
  recipientPhone,
  recipientType,
  paidAmount,
  paymentMode,
  releaseType,
}: GatePassModalProps) {
  if (!visible || !vehicle) return null;

  const gpNumber = gatePassData?.gatePassNumber || `GP-${Date.now().toString().slice(-8)}`;
  const vehicleNumber = (vehicle?.vehicleNumber || '').toUpperCase();
  const bankName = vehicle?.bankName || vehicle?.bank?.name || 'Financier Partner';
  const releaseDateFormatted = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const generateHtmlReceipt = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { size: auto; margin: 12mm; }
            body {
              font-family: 'Courier New', Courier, monospace, system-ui, -apple-system;
              padding: 10px;
              color: #0F172A;
              background-color: #ffffff;
              text-align: center;
              font-size: 13px;
              line-height: 1.5;
            }
            .ticket-box {
              max-width: 380px;
              margin: 0 auto;
              border: 2px dashed #334155;
              border-radius: 12px;
              padding: 20px;
              text-align: left;
            }
            .header-title {
              text-align: center;
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 1px;
              margin-bottom: 2px;
              color: #0F172A;
            }
            .header-sub {
              text-align: center;
              font-size: 10px;
              font-weight: 700;
              color: #059669;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 15px;
            }
            .divider {
              border-top: 1px dashed #CBD5E1;
              margin: 12px 0;
            }
            .gp-badge {
              background: #F1F5F9;
              border: 1px solid #CBD5E1;
              border-radius: 6px;
              padding: 8px;
              text-align: center;
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 1.5px;
              color: #0062FF;
              margin-bottom: 12px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 12px;
            }
            .label {
              color: #64748B;
              font-weight: 600;
            }
            .val {
              font-weight: 800;
              color: #0F172A;
              text-align: right;
            }
            .amount-row {
              background: #ECFDF5;
              border: 1px solid #A7F3D0;
              border-radius: 6px;
              padding: 8px 10px;
              margin-top: 10px;
            }
            .amount-val {
              color: #059669;
              font-size: 15px;
              font-weight: 900;
            }
            .footer-note {
              text-align: center;
              font-size: 9px;
              color: #94A3B8;
              margin-top: 15px;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="ticket-box">
            <div class="header-title">RAPID YMS</div>
            <div class="header-sub">Official Vehicle Exit Clearance</div>
            
            <div class="gp-badge">${gpNumber}</div>

            <div class="row">
              <span class="label">VEHICLE PLATE:</span>
              <span class="val">${vehicleNumber}</span>
            </div>
            <div class="row">
              <span class="label">BRAND / MODEL:</span>
              <span class="val">${vehicle.brand || ''} ${vehicle.model || 'Vehicle'}</span>
            </div>
            <div class="row">
              <span class="label">FINANCIER:</span>
              <span class="val">${bankName}</span>
            </div>
            <div class="row">
              <span class="label">RELEASE TYPE:</span>
              <span class="val">${releaseType} RELEASE</span>
            </div>

            <div class="divider"></div>

            <div class="row">
              <span class="label">HANDOVER TO:</span>
              <span class="val">${recipientName || 'Authorized Recipient'}</span>
            </div>
            <div class="row">
              <span class="label">RECIPIENT TYPE:</span>
              <span class="val">${recipientType}</span>
            </div>
            <div class="row">
              <span class="label">CONTACT NO:</span>
              <span class="val">${recipientPhone || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">EXIT DATE & TIME:</span>
              <span class="val">${releaseDateFormatted}</span>
            </div>

            <div class="amount-row">
              <div class="row" style="padding:0;">
                <span class="label" style="color:#065F46;">TOTAL TARIFF PAID:</span>
                <span class="amount-val">₹${paidAmount.toLocaleString('en-IN')} (${paymentMode})</span>
              </div>
            </div>

            <div class="footer-note">
              This is a computer generated official exit pass.<br />
              Yard Security Gate Clearance Verified.
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      const html = generateHtmlReceipt();
      await Print.printAsync({ html });
    } catch (err: any) {
      console.warn('[Print Gate Pass Error]', err);
      Alert.alert('Print Error', err?.message || 'Failed to trigger print service.');
    }
  };

  const handleShare = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const html = generateHtmlReceipt();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Gate Pass - ${gpNumber}`,
        });
      } else {
        Alert.alert('Gate Pass Ready', `Gate pass file saved to ${uri}`);
      }
    } catch (err: any) {
      console.warn('[Share Gate Pass Error]', err);
      Alert.alert('Share Error', err?.message || 'Failed to share gate pass PDF.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Top Success Header */}
          <View style={styles.modalTopHeader}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={32} color="#FFFFFF" strokeWidth={2.8} />
            </View>
            <Text style={styles.modalMainTitle}>Vehicle Released!</Text>
            <Text style={styles.modalSubTitle}>
              Exit clearance gate pass has been generated and yard inventory is updated.
            </Text>
          </View>

          {/* Printable Ticket Receipt Card */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.ticketScrollArea}>
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeaderBox}>
                <Text style={styles.ticketBrand}>RAPID YMS</Text>
                <Text style={styles.ticketHeaderSub}>OFFICIAL VEHICLE GATE PASS</Text>
              </View>

              {/* GP Number Badge */}
              <View style={styles.gpNumberBox}>
                <Text style={styles.gpNumberLabel}>CLEARANCE PASS NO.</Text>
                <Text style={styles.gpNumberText}>{gpNumber}</Text>
              </View>

              {/* Ticket Details Rows */}
              <View style={styles.ticketRowsContainer}>
                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Vehicle Plate:</Text>
                  <Text style={styles.ticketRowValBold}>{vehicleNumber}</Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Brand / Model:</Text>
                  <Text style={styles.ticketRowVal}>
                    {vehicle.brand || ''} {vehicle.model || 'Vehicle'}
                  </Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Financier Bank:</Text>
                  <Text style={styles.ticketRowVal} numberOfLines={1}>
                    {bankName}
                  </Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Release Category:</Text>
                  <Text style={styles.ticketRowVal}>{releaseType}</Text>
                </View>

                <View style={styles.ticketDivider} />

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Handed Over To:</Text>
                  <Text style={styles.ticketRowValBold}>{recipientName || 'Owner / Customer'}</Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Recipient Role:</Text>
                  <Text style={styles.ticketRowVal}>{recipientType}</Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Mobile Number:</Text>
                  <Text style={styles.ticketRowVal}>{recipientPhone || 'N/A'}</Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={styles.ticketRowLabel}>Release Time:</Text>
                  <Text style={styles.ticketRowVal}>{releaseDateFormatted}</Text>
                </View>

                {/* Amount Paid Box */}
                <View style={styles.ticketAmountBox}>
                  <Text style={styles.ticketAmountLabel}>Settlement Amount:</Text>
                  <Text style={styles.ticketAmountVal}>
                    ₹{paidAmount.toLocaleString('en-IN')} ({paymentMode})
                  </Text>
                </View>

                <View style={styles.slotFreedBanner}>
                  <Text style={styles.slotFreedText}>
                    ✓ Assigned Yard Slot is now freed & active
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons Row */}
          <View style={styles.modalActionsRow}>
            {/* Print Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.printBtn]}
              onPress={handlePrint}
              activeOpacity={0.8}
            >
              <Printer size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.printBtnText}>Print Pass</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={16} color="#0062FF" strokeWidth={2.2} />
              <Text style={styles.shareBtnText}>Share PDF</Text>
            </TouchableOpacity>
          </View>

          {/* Done Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Done & View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalTopHeader: {
    alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  modalMainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubTitle: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  ticketScrollArea: {
    maxHeight: 330,
    marginVertical: 6,
  },
  ticketCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    padding: 14,
  },
  ticketHeaderBox: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 10,
  },
  ticketBrand: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.2,
  },
  ticketHeaderSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  gpNumberBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  gpNumberLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  gpNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0062FF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  ticketRowsContainer: {
    gap: 5,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketRowLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  ticketRowVal: {
    fontSize: 11.5,
    color: '#1E293B',
    fontWeight: '700',
    textAlign: 'right',
  },
  ticketRowValBold: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '900',
    textAlign: 'right',
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  ticketAmountBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ticketAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  ticketAmountVal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#059669',
  },
  slotFreedBanner: {
    marginTop: 4,
    alignItems: 'center',
  },
  slotFreedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  printBtn: {
    backgroundColor: '#0F172A',
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0062FF',
  },
  doneBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
