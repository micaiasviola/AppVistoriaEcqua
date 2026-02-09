import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderContextual from '../../components/HeaderContextual';
import { supabase } from '../services/supabase';

const TITULOS = {
  construtora: 'Vistoria Construtora',
  entrada: 'Vistoria de Entrada',
  entrega: 'Vistoria de Entrega',
  revistoria: 'Revistoria'
};

const formatDate = (value) => {
  if (!value) return '';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export default function VistoriaListScreen({ route, navigation }) {
  const { unidadeId, codigoUnidade, tipoVistoria, modoConstrutora } = route.params;
  const [vistorias, setVistorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agendaVisible, setAgendaVisible] = useState(false);
  const [agendaData, setAgendaData] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agendaDateObj, setAgendaDateObj] = useState(new Date());
  const [selectedForReagendar, setSelectedForReagendar] = useState(null);

  const titulo = TITULOS[tipoVistoria] || 'Vistorias';

  useFocusEffect(
    useCallback(() => {
      fetchVistorias();
    }, [unidadeId, tipoVistoria])
  );

  async function fetchVistorias() {
    setLoading(true);
    const { data, error } = await supabase
      .from('vistorias')
      .select('id, tipo_vistoria, revisao_num, data_vistoria, created_at, status')
      .eq('unidade_id', unidadeId)
      .eq('tipo_vistoria', tipoVistoria)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setVistorias([]);
      Alert.alert('Erro', 'Nao foi possivel carregar as vistorias. Verifique se a coluna revisao_num existe no banco.');
      setLoading(false);
      return;
    }
    setVistorias(data || []);
    setLoading(false);
  }

  // Abre modal para reagendar revistoria com seleção de data
  const reagendarRevistoria = (vistoria) => {
    setSelectedForReagendar(vistoria);
    setAgendaDateObj(new Date());
    setAgendaData('');
    setShowDatePicker(false);
    setAgendaVisible(true);
  };

  const confirmarReagendar = async () => {
    if (!selectedForReagendar) return;
    const dataAgendada = agendaData.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendada)) {
      Alert.alert('Erro', 'Informe a data no formato YYYY-MM-DD.');
      return;
    }

    const revisaoNum = (selectedForReagendar.revisao_num || 0) + 1;
    const { data, error } = await supabase
      .from('vistorias')
      .insert({
        unidade_id: unidadeId,
        tipo_vistoria: 'revistoria',
        revisao_num: revisaoNum,
        status: 'agendada',
        vistoria_pai_id: selectedForReagendar.id,
        data_vistoria: dataAgendada,
        data_agendada: dataAgendada
      });

    if (error) {
      Alert.alert('Erro', 'Não foi possível reagendar a revistoria.');
    } else {
      Alert.alert('Sucesso', 'Revistoria reagendada!');
      setAgendaVisible(false);
      setSelectedForReagendar(null);
      setAgendaData('');
      fetchVistorias();
    }
  };

  // Função para gerar PDF (placeholder)
  const gerarPDF = (vistoria) => {
    Alert.alert('PDF', `Gerar PDF da vistoria ${vistoria.revisao_num || ''}`);
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <HeaderContextual
        title={titulo}
        empreendimento={route.params.empreendimentoNome || null}
        cliente={route.params.clienteNome || null}
        unidade={codigoUnidade || null}
      />
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('Inspection', {
          unidadeId,
          codigoUnidade,
          modoConstrutora: !!modoConstrutora,
          tipoVistoria
        })}
      >
        <Text style={styles.primaryBtnText}>Iniciar Vistoria</Text>
      </TouchableOpacity>
      <FlatList
        data={vistorias}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.subHeader}>Unidade {codigoUnidade} • {tipoVistoria}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma vistoria encontrada.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              onPress={() => navigation.navigate('VistoriaDetail', {
                vistoriaId: item.id,
                unidadeId,
                codigoUnidade,
                modoConstrutora: !!modoConstrutora,
                tipoVistoria
              })}
            >
              <Text style={styles.cardTitle}>
                {tipoVistoria === 'revistoria'
                  ? `Revistoria ${item.revisao_num || ''}`
                  : titulo}
              </Text>
              <Text style={styles.cardSub}>Data: {formatDate(item.data_vistoria || item.created_at)}</Text>
              <Text style={styles.cardSub}>Status: {item.status === 'concluida' ? 'Concluída' : item.status}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {item.status !== 'concluida' && (
                <TouchableOpacity style={{ marginRight: 16 }} onPress={() => reagendarRevistoria(item)}>
                  <Ionicons name="refresh" size={18} color="#007AFF" />
                  <Text style={{ fontSize: 12, color: '#007AFF' }}>Reagendar</Text>
                </TouchableOpacity>
              )}
              {item.status === 'concluida' && (
                <TouchableOpacity onPress={() => gerarPDF(item)}>
                  <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                  <Text style={{ fontSize: 12, color: '#007AFF' }}>PDF</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
      {/* MODAL AGENDAR REVISTORIA */}
      <Modal animationType="fade" transparent={true} visible={agendaVisible} onRequestClose={() => setAgendaVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, margin: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>Agendar Revistoria</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Escolha a data</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12, backgroundColor:'#fff' }}>
              <Text>{agendaData ? agendaData : 'Selecionar data'}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={agendaDateObj}
                mode="date"
                display="calendar"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setAgendaDateObj(selectedDate);
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(selectedDate.getDate()).padStart(2, '0');
                    setAgendaData(`${yyyy}-${mm}-${dd}`);
                  }
                }}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity onPress={() => setAgendaVisible(false)} style={{ padding: 12, flex:1, marginRight:8, backgroundColor:'#f0f0f0', borderRadius:8, alignItems:'center' }}><Text>Voltar</Text></TouchableOpacity>
              <TouchableOpacity onPress={confirmarReagendar} style={{ padding: 12, flex:1, backgroundColor:'#007AFF', borderRadius:8, alignItems:'center' }}><Text style={{color:'#fff'}}>AGENDAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  primaryBtn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eef0f3' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  cardSub: { color: '#6b7280', marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 30, color: '#999' }
});
