import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../services/supabase';

export default function HomeScreen({ navigation }) {
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Substitua o seu useEffect por este mais robusto:
useEffect(() => {
    async function fetchEmpreendimentos() {
      try {
        console.log('Iniciando busca no Supabase...');
        const { data, error } = await supabase.from('empreendimentos').select('*');
        
        if (error) {
          console.error('Erro do Supabase:', error.message);
        } else {
          console.log('Dados recebidos:', data);
          setEmpreendimentos(data || []);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false); // Isso garante que a bolinha pare de girar
      }
    }
  
    fetchEmpreendimentos();
  }, []);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={{ padding: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Obras ECQUA
      </Text>
      <FlatList
        data={empreendimentos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <TouchableOpacity 
              style={{ padding: 15, borderBottomWidth: 1, borderColor: '#ccc' }}
              onPress={() => navigation.navigate('Units', { empreendimentoId: item.id })}
            >
              <Text style={{ fontSize: 18 }}>{item.nome}</Text>
              <Text style={{ color: '#666' }}>{item.endereco}</Text>
            </TouchableOpacity>
          )}
      />
    </View>
  );
}