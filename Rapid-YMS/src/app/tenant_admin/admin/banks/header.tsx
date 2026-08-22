import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MoreVertical,
  Search,
  X,
} from 'lucide-react-native';

export interface BanksHeaderProps {
  title?: string;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  isSearching?: boolean;
  onToggleSearch?: (searching: boolean) => void;
}

export default function BanksHeader({
  title = 'Bank Management',
  searchQuery,
  onSearchChange,
  onBackPress,
  onMenuPress,
  isSearching = false,
  onToggleSearch,
}: BanksHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearching) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isSearching]);

  const handleCloseSearch = () => {
    onToggleSearch?.(false);
    onSearchChange('');
  };

  const handleCrossPress = () => {
    if (searchQuery && searchQuery.length > 0) {
      onSearchChange('');
    } else {
      handleCloseSearch();
    }
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
      {isSearching ? (
        /* Search Active Header Bar */
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleCloseSearch}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close Search"
          >
            <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.searchBarContainer}>
            <Search size={17} color="#64748B" strokeWidth={2.2} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search bank, sub-bank, address..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleCrossPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={searchQuery.length > 0 ? 'Clear text' : 'Close search'}
            >
              <X size={15} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onMenuPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Bank Options"
          >
            <MoreVertical size={21} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      ) : (
        /* Normal Header Bar */
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onBackPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.centerContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onMenuPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Bank Options"
          >
            <MoreVertical size={21} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  searchBarContainer: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
