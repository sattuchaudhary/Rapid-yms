import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Settings,
  MapPin,
  Phone,
  Mail,
  Building,
} from 'lucide-react-native';
import { Bank, VEHICLE_TYPES, TYPE_SHORT_LABELS } from '../types';

export interface ThirdPartyGroupCardProps {
  group: Bank;
  subBanks: Bank[];
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  onAddSubBank: (group: Bank) => void;
  onEditBank: (bank: Bank) => void;
  onDeleteBank: (bank: Bank) => void;
  canManage?: boolean;
}

export default function ThirdPartyGroupCard({
  group,
  subBanks,
  isExpanded,
  onToggleExpand,
  onAddSubBank,
  onEditBank,
  onDeleteBank,
  canManage = true,
}: ThirdPartyGroupCardProps) {
  const handleCall = (phone: string) => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleEmail = (email: string) => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  return (
    <View style={styles.card}>
      {/* Group Header Row */}
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => onToggleExpand(group.id)}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          <GitBranch size={17} color="#D97706" strokeWidth={2.4} />
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          <View style={styles.subCountBadge}>
            <Text style={styles.subCountText}>
              {subBanks.length} Sub-Bank{subBanks.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Group Actions */}
        {canManage && (
          <View style={styles.actionsRow} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.addSubBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onAddSubBank(group);
              }}
              activeOpacity={0.7}
              accessibilityLabel="Add Sub Bank"
            >
              <Plus size={14} color="#0062FF" strokeWidth={2.5} />
              <Text style={styles.addSubText}>Sub-Bank</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onDeleteBank(group);
              }}
              activeOpacity={0.7}
              accessibilityLabel="Delete Group"
            >
              <Trash2 size={15} color="#E11D48" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.chevronWrap}>
          {isExpanded ? (
            <ChevronDown size={18} color="#64748B" strokeWidth={2.2} />
          ) : (
            <ChevronRight size={18} color="#64748B" strokeWidth={2.2} />
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded Sub-Banks List */}
      {isExpanded && (
        <View style={styles.subBanksContainer}>
          {subBanks.length === 0 ? (
            <View style={styles.emptySubs}>
              <Text style={styles.emptySubsText}>
                No sub-banks attached yet. Tap "+ Sub-Bank" to add one.
              </Text>
            </View>
          ) : (
            subBanks.map((sub, index) => (
              <View
                key={sub.id}
                style={[
                  styles.subBankCard,
                  index === subBanks.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.subBankHeader}>
                  <View style={styles.subBankDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subBankName}>{sub.name}</Text>
                  </View>

                  {canManage && (
                    <View style={styles.subActionsRow}>
                      <TouchableOpacity
                        style={styles.subActionBtn}
                        onPress={() => onEditBank(sub)}
                        activeOpacity={0.7}
                      >
                        <Settings size={14} color="#64748B" strokeWidth={2} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.subActionBtn, styles.subDeleteBtn]}
                        onPress={() => onDeleteBank(sub)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={14} color="#E11D48" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Sub Bank Address */}
                {!!sub.branchAddress && (
                  <View style={styles.subAddressRow}>
                    <MapPin size={11} color="#64748B" style={{ marginTop: 1 }} />
                    <Text style={styles.subAddressText} numberOfLines={1}>
                      {sub.branchAddress}
                    </Text>
                  </View>
                )}

                {/* Sub Bank Contact */}
                {(sub.customerCarePhone || sub.customerCareEmail) && (
                  <View style={styles.subContactRow}>
                    {!!sub.customerCarePhone && (
                      <TouchableOpacity
                        style={styles.subContactPill}
                        onPress={() => handleCall(sub.customerCarePhone!)}
                        activeOpacity={0.7}
                      >
                        <Phone size={10} color="#059669" />
                        <Text style={styles.subPhoneText}>{sub.customerCarePhone}</Text>
                      </TouchableOpacity>
                    )}

                    {!!sub.customerCareEmail && (
                      <TouchableOpacity
                        style={styles.subContactPill}
                        onPress={() => handleEmail(sub.customerCareEmail!)}
                        activeOpacity={0.7}
                      >
                        <Mail size={10} color="#2563EB" />
                        <Text style={styles.subEmailText} numberOfLines={1}>
                          {sub.customerCareEmail}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Sub Bank Rates */}
                {sub.parkingRates?.length > 0 && (
                  <View style={styles.subRatesRow}>
                    {VEHICLE_TYPES.map(type => {
                      const match = sub.parkingRates?.find(r => r.vehicleType === type);
                      const daily = match?.pakkaRate ?? match?.dailyRate ?? match?.kachhaRate ?? '-';
                      return (
                        <View key={type} style={styles.subRateChip}>
                          <Text style={styles.subRateType}>{TYPE_SHORT_LABELS[type]}:</Text>
                          <Text style={styles.subRateVal}>₹{daily}/d</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleArea: {
    flex: 1,
  },
  groupName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  subCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  subCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  addSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  chevronWrap: {
    paddingLeft: 2,
  },
  subBanksContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptySubs: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptySubsText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  subBankCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subBankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subBankDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: 8,
  },
  subBankName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  subActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subDeleteBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
  },
  subAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingLeft: 14,
  },
  subAddressText: {
    fontSize: 11,
    color: '#64748B',
  },
  subContactRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingLeft: 14,
    flexWrap: 'wrap',
  },
  subContactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subPhoneText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#059669',
  },
  subEmailText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2563EB',
    maxWidth: 140,
  },
  subRatesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingLeft: 14,
  },
  subRateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subRateType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginRight: 2,
  },
  subRateVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },
});
