import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Navbar from '../components/Navbar';
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
      {/* ADICIONE A NAVBAR AQUI */}
      <Navbar />

      {/* Ajuste o paddingTop para compensar a Navbar sobreposta */}
      <View style={{ paddingTop: 110, flex: 1 }}>

        {/* Aqui começa o conteúdo da sua lista */}
        <FlatList
          data={empreendimentos}
          keyExtractor={(item) => item.id}
          // Adicione um padding bottom para a lista não colar no final
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('Units', { empreendimentoId: item.id })}
            >
              <Text style={styles.title}>{item.nome}</Text>
              <Text style={styles.subtitle}>{item.endereco}</Text>
              {item.cliente && <Text style={styles.client}>Cliente: {item.cliente}</Text>}
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' }, // Mudei para um cinza bem claro para destacar a navbar branca
  item: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff', // Item branco
    marginHorizontal: 15, // Margem lateral
    marginBottom: 10, // Espaço entre itens
    borderRadius: 8, // Bordas arredondadas
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  subtitle: { color: '#666', marginTop: 4 },
  client: { color: '#007AFF', fontSize: 12, marginTop: 6, fontWeight: '600' }
});