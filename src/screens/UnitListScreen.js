import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function UnitListScreen({ route, navigation }) {
  const { empreendimentoId } = route.params;
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('NewUnit', { empreendimentoId })}>
          <Text style={{ fontSize: 28, color: '#007AFF', marginRight: 10 }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchUnidades();
    }, [])
  );

  async function fetchUnidades() {
    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .eq('empreendimento_id', empreendimentoId)
      .order('codigo', { ascending: true });

    if (error) console.error(error);
    else setUnidades(data || []);
    setLoading(false);
  }

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('UnidadesTab', { screen: 'Home' })}
        >
          <Ionicons name="home-outline" size={18} color="#111" style={styles.homeIcon} />
          <Text style={styles.homeText}>Inicio</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.header}>Unidades</Text>
      <Text style={styles.subHeader}>Selecione uma unidade</Text>
      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma unidade cadastrada.</Text>}
        renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => navigation.navigate('InspectionType', { 
                unidadeId: item.id, 
                codigoUnidade: item.codigo 
              })}
            >
              <Text style={styles.unitCode}>Unidade {item.codigo}</Text>
              {item.andar != null ? <Text style={styles.floor}>{item.andar}º Andar</Text> : null}
            </TouchableOpacity>
          )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f6f7f9' },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  homeButton: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f3' },
  homeIcon: { marginRight: 6 },
  homeText: { fontSize: 12, fontWeight: '600', color: '#111' },
  header: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 4 },
  subHeader: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#eef0f3' },
  unitCode: { fontSize: 16, fontWeight: '600', color: '#111' },
  floor: { color: '#6b7280', marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 30, color: '#999' }
});