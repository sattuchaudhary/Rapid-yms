import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  Car,
  Building2,
  User,
  Phone,
  MapPin,
  Copy,
  Layers,
  Key,
} from 'lucide-react-native';

export interface VehicleInfoProps {
  vehicle: any;
}

export default function VehicleInfo({ vehicle }: VehicleInfoProps) {
  if (!vehicle) return null;

  const copyToClipboard = (label: string, text?: string) => {
    if (!text) return;
    Alert.alert('Copied', `${label} (${text}) copied to clipboard.`);
  };

  const handleCallCustomer = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Identification Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Car size={16} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Vehicle Identification</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Vehicle Number</Text>
            <Text style={styles.valueBold}>{(vehicle.vehicleNumber || 'N/A').toUpperCase()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Make & Model</Text>
            <Text style={styles.value}>
              {vehicle.brand ? `${vehicle.brand} ` : ''}{vehicle.model || 'N/A'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Vehicle Type</Text>
            <Text style={styles.value}>{vehicle.vehicleType || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Color</Text>
            <Text style={styles.value}>{vehicle.color || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Chassis Number */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Chassis Number</Text>
            <TouchableOpacity
              style={styles.copyableRow}
              onPress={() => copyToClipboard('Chassis Number', vehicle.chassisNumber)}
              activeOpacity={0.7}
            >
              <Text style={styles.valueMono}>{vehicle.chassisNumber || 'N/A'}</Text>
              {vehicle.chassisNumber && <Copy size={12} color="#0062FF" style={{ marginLeft: 5 }} />}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Engine Number */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Engine Number</Text>
            <TouchableOpacity
              style={styles.copyableRow}
              onPress={() => copyToClipboard('Engine Number', vehicle.engineNumber)}
              activeOpacity={0.7}
            >
              <Text style={styles.valueMono}>{vehicle.engineNumber || 'N/A'}</Text>
              {vehicle.engineNumber && <Copy size={12} color="#0062FF" style={{ marginLeft: 5 }} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. Bank & Financier Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Building2 size={16} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Financier & Repossession</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Bank / Financier</Text>
            <Text style={styles.valueBold}>{vehicle.bankName || vehicle.bank?.name || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Repo Agency</Text>
            <Text style={styles.value}>{vehicle.repoAgency || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Loan / Agreement No</Text>
            <Text style={styles.valueMono}>{vehicle.agreementNo || vehicle.loanAccountNo || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Repo Date</Text>
            <Text style={styles.value}>
              {vehicle.repoDate ? new Date(vehicle.repoDate).toLocaleDateString('en-IN') : 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Yard Location & Inventory Details */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MapPin size={16} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Yard Location & Details</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Yard Location</Text>
            <View style={styles.badgeBox}>
              <Text style={styles.badgeText}>
                {vehicle.yardLocation?.name || vehicle.slotNumber || 'Main Stock Yard'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Key Status</Text>
            <Text style={styles.value}>{vehicle.keyStatus || 'Original Key Present'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Odometer Reading</Text>
            <Text style={styles.value}>{vehicle.meterReading ? `${vehicle.meterReading} KM` : 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Entered By</Text>
            <Text style={styles.value}>{vehicle.enteredBy?.name || 'Gate Guard'}</Text>
          </View>
        </View>
      </View>

      {/* 4. Customer Information */}
      {(vehicle.customerName || vehicle.customerPhone) && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <User size={16} color="#0062FF" strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Customer / Borrower</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Customer Name</Text>
              <Text style={styles.valueBold}>{vehicle.customerName || 'N/A'}</Text>
            </View>

            {vehicle.customerPhone && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => handleCallCustomer(vehicle.customerPhone)}
                    activeOpacity={0.75}
                  >
                    <Phone size={12} color="#059669" />
                    <Text style={styles.callBtnText}>{vehicle.customerPhone}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  valueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  valueMono: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  badgeBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 5,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
});
