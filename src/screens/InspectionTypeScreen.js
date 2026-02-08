import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InspectionTypeScreen({ route, navigation }) {
  const { unidadeId, codigoUnidade } = route.params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('UnidadesTab', { screen: 'Home' })}
        >
          <Ionicons name="home-outline" size={18} color="#111" style={styles.homeIcon} />
          <Text style={styles.homeText}>Inicio</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.header}>Unidade {codigoUnidade}</Text>
      <Text style={styles.subHeader}>Selecione o tipo</Text>

      {/* VISTORIA COM CONSTRUTORA (Agora usa a mesma tela com flag especial) */}
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('VistoriaList', { 
          unidadeId, 
          codigoUnidade,
          modoConstrutora: true,
          tipoVistoria: 'construtora'
        })}
      >
        <Text style={styles.icon}>🏗️</Text>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Construtora</Text>
          <Text style={styles.cardDesc}>Apontamentos e entrega de chaves</Text>
        </View>
      </TouchableOpacity>

      {/* VISTORIA DE ENTRADA PADRÃO */}
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('VistoriaList', { 
          unidadeId, 
          codigoUnidade,
          modoConstrutora: false,
          tipoVistoria: 'entrada'
        })}
      >
        <Text style={styles.icon}>🔑</Text>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Entrada</Text>
          <Text style={styles.cardDesc}>Levantamento inicial de defeitos</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('VistoriaList', { 
          unidadeId, 
          codigoUnidade,
          modoConstrutora: false,
          tipoVistoria: 'revistoria'
        })}
      >
        <Text style={styles.icon}>🟡</Text>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Revistoria</Text>
          <Text style={styles.cardDesc}>Validar correcoes pendentes</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.card, styles.disabled]}
        onPress={() => Alert.alert("Em Breve", "Modulo em desenvolvimento.")}
      >
        <Text style={styles.icon}>✅</Text>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Entrega</Text>
          <Text style={styles.cardDesc}>Validacao final com o cliente</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f6f7f9' },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  homeButton: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f3' },
  homeIcon: { marginRight: 6 },
  homeText: { fontSize: 12, fontWeight: '600', color: '#111' },
  header: { fontSize: 22, fontWeight: '700', textAlign: 'left', marginBottom: 4, color: '#222' },
  subHeader: { fontSize: 13, textAlign: 'left', marginBottom: 16, color: '#6b7280' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eef0f3' },
  disabled: { opacity: 0.6 },
  icon: { fontSize: 22, marginRight: 12 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 2 },
  cardDesc: { color: '#6b7280', fontSize: 12 }
});