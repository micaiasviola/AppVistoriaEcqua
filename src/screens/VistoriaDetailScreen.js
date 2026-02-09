import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

const ordenarApontamentos = (lista) => [...(lista || [])].sort((a, b) => {
  const na = Number(a?.numero_item) || 0;
  const nb = Number(b?.numero_item) || 0;
  return na - nb;
});

export default function VistoriaDetailScreen({ route, navigation }) {
  const { vistoriaId, unidadeId, codigoUnidade, modoConstrutora, tipoVistoria } = route.params;
  const [loading, setLoading] = useState(true);
  const [apontamentos, setApontamentos] = useState([]);
  const [agendaVisible, setAgendaVisible] = useState(false);
  const [agendaData, setAgendaData] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agendaDateObj, setAgendaDateObj] = useState(new Date());

  // Declaração do botão web e helper para montar dados PDF (web-only)
  let VistoriaPDFWebButton = null;
  if (Platform.OS === 'web') {
    VistoriaPDFWebButton = require('../components/VistoriaPDFWebButton').VistoriaPDFWebButton;
  }

  const montarDadosPDFWeb = async () => {
    const { header, dataVistoria } = await montarDadosRelatorio();
    return {
      logo: header.logoUrl,
      cliente: header.cliente,
      referencia: header.referencia,
      emitidoPor: header.emitidoPor,
      registro: header.crea,
      data: header.data,
      imovel: `Unidade ${codigoUnidade}`,
      endereco: '',
      dataEmissao: `SÃO PAULO - SP, ${dataVistoria}`,
      itens: apontamentos.map((item, idx) => ({
        local: `${item.numero_item}. ${item.item}`,
        fotos: item.uris || [],
        descricao: item.descricao,
        obs: item.observacao_interna,
        status: item.status === 'resolvido' ? 'RESOLVIDO E APROVADO' : '',
        dataStatus: item.status === 'resolvido' ? dataVistoria : ''
      }))
    };
  };

  useFocusEffect(
    useCallback(() => {
      carregarVistoria();
    }, [vistoriaId])
  );

  const carregarChecklistPorIds = async (ids) => {
    if (!ids?.length) return {};
    const { data } = await supabase.from('checklist_itens').select('id, descricao, categoria').in('id', ids);
    if (!data) return {};
    return data.reduce((map, item) => {
      map[item.id] = { descricao: item.descricao, categoria: item.categoria };
      return map;
    }, {});
  };

  const carregarFotosPorItens = async (itemIds) => {
    if (!itemIds?.length) return {};
    const { data } = await supabase.from('fotos_vistoria').select('item_id, storage_path').in('item_id', itemIds);
    if (!data) return {};
    return data.reduce((map, foto) => {
      const { data: pub } = supabase.storage.from('vistoria-fotos').getPublicUrl(foto.storage_path);
      if (!map[foto.item_id]) map[foto.item_id] = [];
      map[foto.item_id].push(pub.publicUrl);
      return map;
    }, {});
  };

  const carregarVistoria = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('itens_vistoria')
      .select('*')
      .eq('vistoria_id', vistoriaId)
      .order('numero_item', { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const checklistIds = data.map((i) => i.checklist_item_id).filter(Boolean);
    const itemIds = data.map((i) => i.id);
    const checklistMap = await carregarChecklistPorIds(checklistIds);
    const fotosMap = await carregarFotosPorItens(itemIds);

      const itensFormatados = data.map((i) => ({
      id: i.id,
      vistoria_id: i.vistoria_id,
      checklist_item_id: i.checklist_item_id,
      numero_item: i.numero_item,
      descricao: i.descricao_defeito,
      observacao_interna: i.observacao_interna,
      resolucao_obs: i.resolucao_obs,
      status: i.status,
      categoria: checklistMap[i.checklist_item_id]?.categoria || '',
      item: checklistMap[i.checklist_item_id]?.descricao || i.observacao_interna || '',
      uris: fotosMap[i.id] || []
      }));

    setApontamentos(ordenarApontamentos(itensFormatados));
    setLoading(false);
  };

  const montarDadosRelatorio = async () => {
    const { data: unidade } = await supabase
      .from('unidades')
      .select('codigo, empreendimento_id')
      .eq('id', unidadeId)
      .maybeSingle();

    const { data: empreendimento } = await supabase
      .from('empreendimentos')
      .select('nome, cliente')
      .eq('id', unidade?.empreendimento_id)
      .maybeSingle();

    const { data: vistoria } = await supabase
      .from('vistorias')
      .select('data_vistoria, engenheiro_id')
      .eq('id', vistoriaId)
      .maybeSingle();

    const { data: engenheiro } = await supabase
      .from('engenheiros')
      .select('nome, crea')
      .eq('id', vistoria?.engenheiro_id)
      .maybeSingle();

    const dataRaw = vistoria?.data_vistoria;
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(dataRaw || ''));
    const dataObj = dataRaw ? new Date(isDateOnly ? `${dataRaw}T00:00:00` : dataRaw) : new Date();
    const dataVistoria = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let logoUrl = '';
    try {
      const logoAsset = Asset.fromModule(require('../../assets/images/logo.png'));
      if (!logoAsset.localUri && !logoAsset.uri) {
        await logoAsset.downloadAsync();
      }
      logoUrl = logoAsset.localUri || logoAsset.uri || '';
    } catch (e) {
      console.warn('Nao foi possivel carregar logo:', e);
    }

    return {
      header: {
        cliente: empreendimento?.cliente || empreendimento?.nome || '',
        referencia: 'Relatorio de Vistoria',
        emitidoPor: engenheiro?.nome || 'Engenheiro',
        crea: engenheiro?.crea || '',
        data: dataVistoria,
        logoUrl
      },
      dataVistoria
    };
  };

  // A geração de PDF foi movida para um componente web-only (VistoriaPDFWebButton).

  const agendarRevistoria = async () => {
    const pendentes = apontamentos.filter((i) => i.status !== 'resolvido');
    if (!pendentes.length) {
      Alert.alert('Info', 'Nao ha itens pendentes.');
      return;
    }

    const { data: ultima } = await supabase
      .from('vistorias')
      .select('revisao_num')
      .eq('unidade_id', unidadeId)
      .eq('tipo_vistoria', 'revistoria')
      .order('revisao_num', { ascending: false })
      .limit(1)
      .maybeSingle();

    const revisaoNum = (ultima?.revisao_num || 0) + 1;
    const dataAgendada = agendaData.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendada)) {
      Alert.alert('Erro', 'Informe a data no formato YYYY-MM-DD.');
      return;
    }

    const { data: vistoriaAtual } = await supabase
      .from('vistorias')
      .select('engenheiro_id')
      .eq('id', vistoriaId)
      .maybeSingle();

    const { data: nova, error: novaError } = await supabase
      .from('vistorias')
      .insert([{
        unidade_id: unidadeId,
        engenheiro_id: vistoriaAtual?.engenheiro_id || null,
        data_vistoria: dataAgendada,
        data_agendada: dataAgendada,
        tipo_vistoria: 'revistoria',
        revisao_num: revisaoNum,
        vistoria_pai_id: vistoriaId,
        status: 'agendada'
      }])
      .select()
      .single();

    if (novaError || !nova?.id) {
      console.error('Erro ao criar revistoria:', novaError);
      Alert.alert(
        'Erro',
        'Nao foi possivel criar a revistoria. Verifique se as colunas revisao_num e vistoria_pai_id existem.'
      );
      return;
    }

    const itensPayload = pendentes.map((i) => ({
      vistoria_id: nova.id,
      checklist_item_id: i.checklist_item_id,
      ambiente_id: i.ambiente_id,
      numero_item: i.numero_item,
      descricao_defeito: i.descricao,
      observacao_interna: i.observacao_interna,
      status: 'pendente',
      item_origem_id: i.id
    }));

    const { data: novosItens, error: itensError } = await supabase
      .from('itens_vistoria')
      .insert(itensPayload)
      .select('id, item_origem_id');

    if (itensError) {
      console.error('Erro ao copiar itens:', itensError);
      Alert.alert('Erro', 'Nao foi possivel copiar os itens para a revistoria.');
      return;
    }

    const mapaItens = (novosItens || []).reduce((acc, item) => {
      acc[item.item_origem_id] = item.id;
      return acc;
    }, {});

    const { data: fotosOriginais } = await supabase
      .from('fotos_vistoria')
      .select('item_id, storage_path, tipo')
      .in('item_id', pendentes.map((i) => i.id));

    if (fotosOriginais?.length) {
      const fotosPayload = fotosOriginais
        .filter((f) => mapaItens[f.item_id])
        .map((f) => ({
          item_id: mapaItens[f.item_id],
          storage_path: f.storage_path,
          tipo: f.tipo
        }));

      if (fotosPayload.length) {
        await supabase.from('fotos_vistoria').insert(fotosPayload);
      }
    }

    setAgendaVisible(false);
    setAgendaData('');
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{
          name: 'Inspection',
          params: {
            unidadeId,
            codigoUnidade,
            vistoriaId: nova.id,
            modoConstrutora: false,
            tipoVistoria: 'revistoria'
          }
        }]
      })
    );
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('UnidadesTab', { screen: 'Home' })}
        >
          <Ionicons name="home-outline" size={18} color="#111" style={styles.homeIcon} />
          <Text style={styles.homeText}>Inicio</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{(() => {
          if (tipoVistoria === 'construtora') return 'Vistoria Construtora';
          if (tipoVistoria === 'entrada') return 'Vistoria de Entrada';
          if (tipoVistoria === 'revistoria') return 'Revistoria';
          if (tipoVistoria === 'entrega') return 'Vistoria de Entrega';
          return 'Vistoria';
        })()}</Text>
      </View>
      <Text style={styles.subHeader}>Unidade {codigoUnidade} • {(() => {
        if (tipoVistoria === 'construtora') return 'Construtora';
        if (tipoVistoria === 'entrada') return 'Entrada';
        if (tipoVistoria === 'revistoria') return 'Revistoria';
        if (tipoVistoria === 'entrega') return 'Entrega';
        return tipoVistoria;
      })()}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{
                name: 'Inspection',
                params: {
                  unidadeId,
                  codigoUnidade,
                  vistoriaId,
                  modoConstrutora: !!modoConstrutora,
                  tipoVistoria
                }
              }]
            })
          )}
        >
          <Text style={styles.actionText}>Editar Apontamentos</Text>
        </TouchableOpacity>

        {/* Botão de PDF só aparece no web */}
        {Platform.OS === 'web' && VistoriaPDFWebButton && (
          <VistoriaPDFWebButtonWrapper montarDadosPDFWeb={montarDadosPDFWeb} />
        )}

        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setAgendaVisible(true)}>
          <Text style={styles.actionTextSecondary}>Agendar Revistoria</Text>
        </TouchableOpacity>
      </View>

      <Modal animationType="fade" transparent={true} visible={agendaVisible} onRequestClose={() => setAgendaVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAgendaVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={agendarRevistoria}>
                <Text style={styles.modalConfirmText}>Agendar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {apontamentos.map((item) => (
          <View key={item.id} style={styles.historyItem}>
            {item.uris?.[0] && <Image source={{ uri: item.uris[0] }} style={styles.thumb} />}
            <View style={styles.historyText}>
              <Text style={styles.historyTitle}>{item.numero_item}. {item.item}</Text>
              <Text numberOfLines={2} style={styles.historyDesc}>{item.descricao}</Text>
              {item.status === 'resolvido' && (
                <Text style={styles.statusResolved}>RESOLVIDO</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Wrapper para lidar com async/await do dadosPDF e passar para o botão web
function VistoriaPDFWebButtonWrapper({ montarDadosPDFWeb }) {
  const [dadosPDF, setDadosPDF] = useState(null);

  const handleClick = async () => {
    const dados = await montarDadosPDFWeb();
    setDadosPDF(dados);
  };

  // Só renderiza o botão se já tiver dados
  if (dadosPDF) {
    // carrega o componente web dinamicamente para evitar problemas de bundling
    let Comp = null;
    try {
      Comp = require('../components/VistoriaPDFWebButton').VistoriaPDFWebButton;
    } catch (e) {
      console.warn('VistoriaPDFWebButton não disponível:', e);
      return null;
    }
    return <Comp dadosPDF={dadosPDF} />;
  }

  return (
    <button onClick={handleClick} style={{ padding: 12, background: '#007AFF', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12 }}>
      Gerar PDF
    </button>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f6f7f9' },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  homeButton: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef0f3' },
  homeIcon: { marginRight: 6 },
  homeText: { fontSize: 12, fontWeight: '600', color: '#111' },
  headerRow: { marginBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  subHeader: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 10 },
  modalHint: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  modalCancelText: { color: '#111', fontWeight: '600' },
  modalConfirm: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#007AFF', borderRadius: 8 },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
  actionsRow: { gap: 8, marginBottom: 12 },
  actionBtn: { padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: 'bold' },
  actionBtnSecondary: { padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' },
  actionTextSecondary: { color: '#333', fontWeight: 'bold' },
  historyItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  thumb: { width: 50, height: 50, borderRadius: 6, marginRight: 10 },
  historyText: { flex: 1 },
  historyTitle: { fontWeight: 'bold' },
  historyDesc: { fontSize: 12, color: '#555' },
  statusResolved: { fontSize: 9, color: 'green' }
});
