import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SupervisorRoot() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supervisor Workspace</Text>
      <Text style={styles.subtitle}>Yard Status Controls Ready</Text>
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
