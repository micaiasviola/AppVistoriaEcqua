import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';

export default function UnitListScreen({ route, navigation }) {
  const { empreendimentoId } = route.params; // Recebe o ID vindo da tela anterior
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUnidades() {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('empreendimento_id', empreendimentoId); // Filtro essencial

      if (error) console.error(error);
      else setUnidades(data);
      setLoading(false);
    }
    fetchUnidades();
  }, [empreendimentoId]);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <TouchableOpacity 
              style={{ padding: 20, backgroundColor: '#f9f9f9', marginBottom: 10, borderRadius: 8 }}
              onPress={() => navigation.navigate('Inspection', { 
                unidadeId: item.id, 
                codigoUnidade: item.codigo 
              })}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Unidade {item.codigo}</Text>
              <Text>Andar: {item.andar}º</Text>
            </TouchableOpacity>
          )}
      />
    </View>
  );
}