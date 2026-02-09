import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderContextual from '../../components/HeaderContextual';
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
    <SafeAreaView style={styles.container}>
      <HeaderContextual
        title="Empreendimentos"
        empreendimento={null}
        cliente={null}
        unidade={null}
      />
      <FlatList
        data={empreendimentos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('NewProject')}
          >
            <Text style={styles.addButtonText}>Novo Empreendimento</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Units', {
              empreendimentoId: item.id,
              empreendimentoNome: item.nome,
              clienteNome: item.cliente || null
            })}
          >
            <Text style={styles.title}>{item.nome}</Text>
            <Text style={styles.subtitle}>{item.endereco}</Text>
            {item.cliente ? <Text style={styles.client}>Cliente: {item.cliente}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' }, // Mudei para um cinza bem claro para destacar a navbar branca
  addButton: {
    marginHorizontal: 15,
    marginBottom: 15,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  client: { fontSize: 12, color: '#007AFF', marginTop: 4 },
});