import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HeaderContextual from '../../components/HeaderContextual';
import { supabase } from '../services/supabase';

export default function UnitListScreen({ route, navigation }) {
  // Espera-se que route.params contenha dados do empreendimento e cliente
  const { empreendimentoId, empreendimentoNome, clienteNome } = route.params;
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('NewUnit', { empreendimentoId })}>
          <Text style={{ fontSize: 28, color: '#007AFF', marginRight: 10 }}>+</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity onPress={() => {
          // Sempre volta para a tela de empreendimento (HomeScreen)
          navigation.navigate('Home');
        }}>
          <Text style={{ fontSize: 18, color: '#007AFF', marginLeft: 10 }}>Voltar</Text>
        </TouchableOpacity>
      )
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchUnidades();
    }, [])
  );

  async function fetchUnidades() {
    if (!empreendimentoId || empreendimentoId === 'undefined') {
      Alert.alert('Erro de navegação', 'Informação do empreendimento não encontrada. Retornando à tela inicial.');
      navigation.navigate('UnidadesTab', { screen: 'Home' });
      setLoading(false);
      return;
    }
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
      <HeaderContextual
        title="Unidades"
        empreendimento={empreendimentoNome || null}
        cliente={clienteNome || null}
        unidade={null}
        rightContent={
          <View style={styles.logoBox}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        }
      />
      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Text style={styles.subHeader}>Selecione uma unidade</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma unidade cadastrada.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              onPress={() => navigation.navigate('InspectionType', {
                unidadeId: item.id,
                codigoUnidade: item.codigo,
                empreendimentoId,
                empreendimentoNome,
                clienteNome
              })}
            >
              <Text style={styles.unitCode}>Unidade {item.codigo}</Text>
              {item.andar != null ? <Text style={styles.floor}>{item.andar}º Andar</Text> : null}
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate('NewUnit', { empreendimentoId, unitId: item.id, codigo: item.codigo, andar: item.andar })}>
                <Text style={{ color: '#007AFF', fontSize: 13 }}>Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f6f7f9' },
  logoBox: { justifyContent: 'center', alignItems: 'flex-end', height: 40, width: 50 },
  logo: { width: 40, height: 40 },
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