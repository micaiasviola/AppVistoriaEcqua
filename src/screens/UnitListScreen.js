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
      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma unidade cadastrada.</Text>}
        renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              // Mudança: Vai para a tela de TIPO DE VISTORIA
              onPress={() => navigation.navigate('InspectionType', { 
                unidadeId: item.id, 
                codigoUnidade: item.codigo 
              })}
            >
              <Text style={styles.unitCode}>Unidade {item.codigo}</Text>
              {item.andar && <Text style={styles.floor}>{item.andar}º Andar</Text>}
            </TouchableOpacity>
          )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f5f5f5' },
  card: { backgroundColor: '#fff', padding: 20, marginBottom: 10, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  unitCode: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  floor: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});