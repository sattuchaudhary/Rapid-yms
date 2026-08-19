import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ExecutiveRoot() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Executive Workspace</Text>
      <Text style={styles.subtitle}>Checkout Desk Ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
});
