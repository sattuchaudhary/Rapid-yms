import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';

interface AccordionSectionProps {
  title: string;
  summaryText?: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isDanger?: boolean;
  warningPillText?: string;
}

export function AccordionSection({
  title,
  summaryText,
  icon,
  isExpanded,
  onToggle,
  children,
  isDanger = false,
  warningPillText,
}: AccordionSectionProps) {
  return (
    <View
      style={[
        styles.accordionCard,
        isDanger && { borderColor: '#FEE2E2' },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.accordionHeader,
          isDanger && { backgroundColor: '#FEF2F2' },
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrapper}>{icon}</View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.title, isDanger && { color: '#991B1B' }]}>
              {title}
            </ThemedText>

            {!isExpanded && summaryText ? (
              <ThemedText style={styles.summaryText} numberOfLines={1}>
                {summaryText}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          {warningPillText && !isExpanded ? (
            <View style={styles.warningPill}>
              <ThemedText style={styles.warningPillText}>{warningPillText}</ThemedText>
            </View>
          ) : null}

          <ChevronDown
            size={18}
            color={isDanger ? '#991B1B' : '#64748B'}
            style={[isExpanded && { transform: [{ rotate: '180deg' }] }]}
          />
        </View>
      </TouchableOpacity>

      {isExpanded ? <View style={styles.contentWrapper}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningPill: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  contentWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
});
