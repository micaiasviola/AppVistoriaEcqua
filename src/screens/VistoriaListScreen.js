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
      .select('id, tipo_vistoria, revisao_num, data_vistoria, created_at, status, status_aprovacao')
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
    let list = data || [];
    // Para vistorias reprovadas (construtora), buscar se já existe revistoria agendada
    try {
      const enhanced = await Promise.all(list.map(async (v) => {
        if (tipoVistoria === 'construtora' && v.status_aprovacao === 'reprovado') {
          try {
            const { data: rev, error: revErr } = await supabase
              .from('vistorias')
              .select('id, data_agendada, data_vistoria, status')
              .eq('vistoria_pai_id', v.id)
              .eq('tipo_vistoria', 'revistoria')
              .eq('status', 'agendada')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (rev && !revErr) {
              return { ...v, scheduledRevistoria: rev };
            }
          } catch (e) {
            console.error('Erro buscando revistoria agendada:', e);
          }
        }
        return v;
      }));
      list = enhanced;
    } catch (e) {
      console.error('Erro enriquecendo vistorias:', e);
    }

    setVistorias(list);
    setLoading(false);
  }

  // Abre modal para reagendar revistoria com seleção de data
  const reagendarRevistoria = (vistoria) => {
    setSelectedForReagendar(vistoria);
    // Prefill data se já houver revistoria agendada
    const sched = vistoria.scheduledRevistoria;
    if (sched && (sched.data_agendada || sched.data_vistoria)) {
      const d = sched.data_agendada || sched.data_vistoria;
      setAgendaData(d);
      const parsed = new Date(`${d}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setAgendaDateObj(parsed);
    } else {
      setAgendaDateObj(new Date());
      setAgendaData('');
    }
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
    // Se já existe revistoria agendada, atualiza a data; caso contrário, cria uma nova revistoria agendada
    const scheduled = selectedForReagendar.scheduledRevistoria;
    if (scheduled && scheduled.id) {
      const { data, error } = await supabase
        .from('vistorias')
        .update({ data_vistoria: dataAgendada, data_agendada: dataAgendada })
        .eq('id', scheduled.id);
      if (error) {
        Alert.alert('Erro', 'Não foi possível atualizar o agendamento.');
      } else {
        Alert.alert('Sucesso', 'Agendamento atualizado!');
        setAgendaVisible(false);
        setSelectedForReagendar(null);
        setAgendaData('');
        fetchVistorias();
      }
    } else {
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
    }
  };

  // Função para gerar PDF (placeholder)
  const gerarPDF = (vistoria) => {
    Alert.alert('PDF', `Gerar PDF da vistoria ${vistoria.revisao_num || ''}`);
  };

  const excluirVistoria = (vistoria) => {
    (async () => {
      try {
        setLoading(true);
        // Verifica se existem revistorias filhas
        const { data: children, error: childErr } = await supabase
          .from('vistorias')
          .select('id')
          .eq('vistoria_pai_id', vistoria.id)
          .eq('tipo_vistoria', 'revistoria');

        if (childErr) {
          console.error('Erro verificando revistorias filhas:', childErr);
        }

        const childIds = (children || []).map(c => c.id);

        const confirmMsg = childIds.length > 0
          ? 'Essa vistoria possui revistoria(s) pendentes, deseja realmente excluir? Isso excluirá a vistoria e suas revistorias.'
          : 'Confirma exclusão da vistoria? Esta ação não pode ser desfeita.';

        Alert.alert('Excluir vistoria', confirmMsg, [
          { text: 'Cancelar', style: 'cancel', onPress: () => setLoading(false) },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                // Constrói lista de vistorias a remover (pai + filhos)
                const idsToDelete = childIds.length > 0 ? [vistoria.id, ...childIds] : [vistoria.id];

                // Busca itens relacionados a essas vistorias
                const { data: itens, error: itensErr } = await supabase
                  .from('itens_vistoria')
                  .select('id')
                  .in('vistoria_id', idsToDelete);

                if (itensErr) console.error('Erro buscando itens para exclusao:', itensErr);
                const itemIds = (itens || []).map(i => i.id);

                // Exclui fotos vinculadas aos itens
                if (itemIds.length > 0) {
                  const { error: photosErr } = await supabase.from('fotos_vistoria').delete().in('item_id', itemIds);
                  if (photosErr) console.error('Erro excluindo fotos:', photosErr);
                }

                // Exclui itens das vistorias
                const { error: delItensErr } = await supabase.from('itens_vistoria').delete().in('vistoria_id', idsToDelete);
                if (delItensErr) console.error('Erro excluindo itens:', delItensErr);

                // Por fim, exclui as próprias vistorias (pai e filhos)
                const { error: delVErr } = await supabase.from('vistorias').delete().in('id', idsToDelete);
                if (delVErr) {
                  console.error('Erro excluindo vistorias:', delVErr);
                  Alert.alert('Erro', 'Não foi possível excluir a vistoria.');
                } else {
                  Alert.alert('Sucesso', 'Vistoria (e revistorias) excluídas.');
                  fetchVistorias();
                }
              } catch (e) {
                console.error('Erro durante exclusão:', e);
                Alert.alert('Erro', 'Não foi possível excluir a vistoria.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]);
      } catch (e) {
        console.error('Erro preparando exclusão:', e);
        setLoading(false);
        Alert.alert('Erro', 'Não foi possível processar a exclusão.');
      }
    })();
  };

  const editarVistoria = (vistoria) => {
    // Navega para a tela de edição/inspeção da vistoria
    navigation.navigate('Inspection', {
      unidadeId,
      codigoUnidade,
      modoConstrutora: !!modoConstrutora,
      tipoVistoria: vistoria.tipo_vistoria || tipoVistoria,
      vistoriaId: vistoria.id
    });
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
        <Text style={styles.primaryBtnText}>{tipoVistoria === 'revistoria' ? 'Iniciar nova revistoria' : 'Iniciar Vistoria'}</Text>
      </TouchableOpacity>
      <FlatList
        data={vistorias}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.subHeader}>Unidade {codigoUnidade} • {tipoVistoria}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma vistoria encontrada.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <TouchableOpacity style={{ flex: 1 }}
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
                {
                  (() => {
                    let statusLabel = item.status || '';
                    if (item.status_aprovacao === 'aprovado') {
                      statusLabel = 'Aprovada e finalizada';
                    } else if (item.status_aprovacao === 'reprovado') {
                      if (item.scheduledRevistoria && (item.scheduledRevistoria.data_agendada || item.scheduledRevistoria.data_vistoria)) {
                        statusLabel = `Revistoria agendada para ${formatDate(item.scheduledRevistoria.data_agendada || item.scheduledRevistoria.data_vistoria)}`;
                      } else {
                        statusLabel = 'Pendente de revistoria';
                      }
                    } else if (item.status === 'agendada') {
                      statusLabel = 'Agendada';
                    } else {
                      statusLabel = 'Pendente';
                    }
                    return <Text style={styles.cardSub}>Status: {statusLabel}</Text>;
                  })()
                }
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                <TouchableOpacity onPress={() => editarVistoria(item)} style={{ marginLeft: 8 }} accessibilityLabel="Editar vistoria" accessibilityHint="Abrir a vistoria para edição">
                  <Ionicons name="create-outline" size={18} color="#111" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => excluirVistoria(item)} style={{ marginLeft: 12 }} accessibilityLabel="Excluir vistoria" accessibilityHint="Excluir esta vistoria" >
                  <Ionicons name="trash-outline" size={18} color="#c0392b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {(() => {
                // Ação para construtora reprovada: Agendar ou Editar se já houver revistoria
                if (tipoVistoria === 'construtora' && item.status_aprovacao === 'reprovado') {
                  const label = item.scheduledRevistoria ? 'Editar agendamento' : 'Agendar';
                  return (
                    <TouchableOpacity style={{ marginRight: 16 }} onPress={() => reagendarRevistoria(item)}>
                      <Ionicons name="refresh" size={18} color="#007AFF" />
                      <Text style={{ fontSize: 12, color: '#007AFF' }}>{label}</Text>
                    </TouchableOpacity>
                  );
                }
                // Para vistorias não aprovadas, permitir reagendar
                if (item.status_aprovacao !== 'aprovado') {
                  return (
                    <TouchableOpacity style={{ marginRight: 16 }} onPress={() => reagendarRevistoria(item)}>
                      <Ionicons name="refresh" size={18} color="#007AFF" />
                      <Text style={{ fontSize: 12, color: '#007AFF' }}>Reagendar</Text>
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}
              {item.status_aprovacao === 'aprovado' && (
                <TouchableOpacity onPress={() => gerarPDF(item)} style={{ marginRight: 12 }}>
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
          <View style={[styles.modalContent, { margin: 20 }] }>
            <Text style={styles.modalTitle}>Agendar Revistoria</Text>
            <Text style={styles.modalHint}>Escolha a data</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.modalInput}>
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
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAgendaVisible(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Voltar</Text></TouchableOpacity>
              <TouchableOpacity onPress={confirmarReagendar} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>{selectedForReagendar && selectedForReagendar.scheduledRevistoria ? 'ATUALIZAR' : 'AGENDAR'}</Text>
              </TouchableOpacity>
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
  ,
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, flex: 1, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' },
  modalCancelText: { color: '#111', fontWeight: '600' },
  modalConfirm: { paddingVertical: 10, paddingHorizontal: 12, flex: 1, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  modalHint: { fontSize: 12, color: '#6b7280', marginBottom: 6 }
});
