import { StyleSheet, Text, View } from 'react-native';

export default function RelatoriosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Relatorios</Text>
      <Text style={styles.subtitle}>Em breve</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 6 }
});
