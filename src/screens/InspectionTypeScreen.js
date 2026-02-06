import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InspectionTypeScreen({ route, navigation }) {
  const { unidadeId, codigoUnidade, vistoriaId, engenheiroId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Unidade {codigoUnidade}</Text>
      <Text style={styles.subHeader}>Selecione o tipo de vistoria:</Text>

      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('Inspection', { unidadeId, codigoUnidade, vistoriaId, engenheiroId })}
      >
        <Text style={styles.icon}>🔑</Text>
        <View>
          <Text style={styles.cardTitle}>Vistoria de Entrada</Text>
          <Text style={styles.cardDesc}>Levantamento inicial de defeitos.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.card, styles.disabled]}
        onPress={() => Alert.alert("Em Breve", "O módulo de Vistoria de Entrega será desenvolvido na próxima etapa.")}
      >
        <Text style={styles.icon}>✅</Text>
        <View>
          <Text style={styles.cardTitle}>Vistoria de Entrega</Text>
          <Text style={styles.cardDesc}>Validação final com o cliente.</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', justifyContent: 'center' },
  header: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: '#333' },
  subHeader: { fontSize: 16, textAlign: 'center', marginBottom: 30, color: '#666' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 25, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  disabled: { opacity: 0.6 },
  icon: { fontSize: 30, marginRight: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#007AFF', marginBottom: 4 },
  cardDesc: { color: '#666', fontSize: 13 }
});