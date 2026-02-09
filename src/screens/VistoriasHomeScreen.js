import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderContextual from '../../components/HeaderContextual';
import { supabase } from '../services/supabase';

export default function VistoriasHomeScreen({ navigation }) {
  const [revistorias, setRevistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyAgendadas, setShowOnlyAgendadas] = useState(true);


  useFocusEffect(
    useCallback(() => {
      fetchRevistorias();
    }, [showOnlyAgendadas])
  );

  async function fetchRevistorias() {
    setLoading(true);
    // Buscar revistorias (pode filtrar somente agendadas quando toggle ativo)
    const query = supabase
      .from('vistorias')
      .select('id, revisao_num, data_vistoria, data_agendada, created_at, tipo_vistoria, status, unidades ( id, codigo, andar, empreendimentos ( nome, cliente ) )')
      .eq('tipo_vistoria', 'revistoria')
      .order('data_agendada', { ascending: true });
    if (showOnlyAgendadas) query.eq('status', 'agendada');
    const { data, error } = await query;

    if (error) {
      console.error(error);
      setRevistorias([]);
      setLoading(false);
      return;
    }
    setRevistorias(data || []);
    setLoading(false);
  }
  // (fetchUnidades não é necessário aqui)



  const formatDateTime = (value) => {
    if (!value) return '';
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
    const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const abrirDetalhe = (vistoria) => {
    navigation.navigate('VistoriaDetail', {
      vistoriaId: vistoria.id,
      unidadeId: vistoria.unidades?.id,
      codigoUnidade: vistoria.unidades?.codigo,
      tipoVistoria: 'revistoria'
    });
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <HeaderContextual
        title="Revistorias"
        empreendimento={null}
        cliente={null}
        unidade={null}
        rightContent={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ marginRight: 8, color: '#6b7280' }}>{showOnlyAgendadas ? 'Somente agendadas' : 'Todas'}</Text>
            <Switch value={showOnlyAgendadas} onValueChange={(v) => setShowOnlyAgendadas(v)} />
          </View>
        }
      />
      <FlatList
        data={revistorias}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.subHeader}>Lista de revistorias</Text>}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma revistoria encontrada.</Text>}
        renderItem={({ item }) => {
          const when = item.data_agendada || item.data_vistoria || item.created_at;
          const upcoming = (() => {
            if (!when) return false;
            const dt = new Date(when);
            const now = new Date();
            const diffMs = dt - now;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 3;
          })();
          return (
            <TouchableOpacity style={[styles.card, upcoming ? styles.upcomingCard : null]} onPress={() => abrirDetalhe(item)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[styles.unitTitle, upcoming ? { color: '#b91c1c' } : null]}>Unidade {item.unidades?.codigo} {item.revisao_num ? `• Rev ${item.revisao_num}` : ''}</Text>
                  <Text style={styles.unitSub}>{item.unidades?.empreendimentos?.cliente || item.unidades?.empreendimentos?.nome || 'Cliente'}</Text>
                  <Text style={styles.unitSub}>{formatDateTime(when)}</Text>
                </View>
                <View style={styles.statusBox}>
                  <Text style={[styles.statusText, item.status === 'agendada' ? styles.statusAgendada : styles.statusOther]}>{item.status?.toUpperCase()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f6f7f9' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  header: { fontSize: 18, fontWeight: '700', color: '#222' },
  pendingBadge: { backgroundColor: '#ff6b35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pendingText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  subHeader: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  statusBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#eef6ff' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#0366d6' },
  statusAgendada: { backgroundColor: 'transparent', color: '#0366d6' },
  statusOther: { color: '#666' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eef0f3' },
  unitTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  unitSub: { color: '#6b7280', marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 30, color: '#999' }
  ,
  upcomingCard: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' }
});
