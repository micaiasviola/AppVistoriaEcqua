import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function HomeScreen({ navigation }) {
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Adiciona botão "+" no cabeçalho
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('NewProject')}>
          <Text style={{ fontSize: 28, color: '#007AFF', marginRight: 10 }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Recarrega a lista ao voltar para esta tela
  useFocusEffect(
    useCallback(() => {
      fetchEmpreendimentos();
    }, [])
  );

  async function fetchEmpreendimentos() {
    // Agora ordenamos por created_at (garantido pelo SQL acima)
    const { data, error } = await supabase
      .from('empreendimentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Erro Supabase:', error.message);
    else setEmpreendimentos(data || []);
    setLoading(false);
  }

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={empreendimentos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.item}
              onPress={() => navigation.navigate('Units', { empreendimentoId: item.id })}
            >
              <Text style={styles.title}>{item.nome}</Text>
              <Text style={styles.subtitle}>{item.endereco}</Text>
              {/* Exibe o cliente se existir */}
              {item.cliente && <Text style={styles.client}>Cliente: {item.cliente}</Text>}
            </TouchableOpacity>
          )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  item: { padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  subtitle: { color: '#666', marginTop: 4 },
  client: { color: '#007AFF', fontSize: 12, marginTop: 6, fontWeight: '600' }
});