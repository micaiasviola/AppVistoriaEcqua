import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function NewProjectScreen({ route, navigation }) {
  const params = route?.params || {};
  const editingId = params?.empreendimentoId || null;
  const [nome, setNome] = useState(params?.nome || '');
  const [endereco, setEndereco] = useState(params?.endereco || '');
  const [cliente, setCliente] = useState(params?.cliente || '');
  const [loading, setLoading] = useState(false);

  async function handleCreateOrUpdate() {
    if (!nome || !endereco) return Alert.alert("Atenção", "Nome e Endereço são obrigatórios.");

    setLoading(true);
    if (editingId) {
      const { error } = await supabase.from('empreendimentos').update({ nome, endereco, cliente }).eq('id', editingId);
      setLoading(false);
      if (error) Alert.alert('Erro', error.message); else {
        Alert.alert('Sucesso', 'Empreendimento atualizado!');
        if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
      }
    } else {
      const { error } = await supabase
        .from('empreendimentos')
        .insert([{ nome, endereco, cliente }]);

      setLoading(false);

      if (error) {
        Alert.alert("Erro", error.message);
      } else {
        Alert.alert("Sucesso", "Empreendimento cadastrado!");
        if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
      }
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    Alert.alert('Excluir empreendimento', 'Excluir este empreendimento removerá permanentemente todas as unidades e vistorias associadas. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          // busca unidades
          const { data: units, error: uErr } = await supabase.from('unidades').select('id').eq('empreendimento_id', editingId);
          if (uErr) console.error('Erro buscando unidades:', uErr);
          const unitIds = (units || []).map(u => u.id);

          // busca vistorias nas unidades
          let vistIds = [];
          if (unitIds.length > 0) {
            const { data: vists, error: vErr } = await supabase.from('vistorias').select('id').in('unidade_id', unitIds);
            if (vErr) console.error('Erro buscando vistorias:', vErr);
            vistIds = (vists || []).map(v => v.id);
          }

          if (vistIds.length > 0) {
            const { data: itens, error: iErr } = await supabase.from('itens_vistoria').select('id').in('vistoria_id', vistIds);
            if (iErr) console.error('Erro buscando itens:', iErr);
            const itemIds = (itens || []).map(it => it.id);
            if (itemIds.length > 0) await supabase.from('fotos_vistoria').delete().in('item_id', itemIds);
            await supabase.from('itens_vistoria').delete().in('vistoria_id', vistIds);
            await supabase.from('vistorias').delete().in('id', vistIds);
          }

          if (unitIds.length > 0) await supabase.from('unidades').delete().in('id', unitIds);

          const { error: delErr } = await supabase.from('empreendimentos').delete().eq('id', editingId);
          if (delErr) {
            console.error('Erro excluindo empreendimento:', delErr);
            Alert.alert('Erro', 'Não foi possível excluir o empreendimento.');
          } else {
            Alert.alert('Sucesso', 'Empreendimento e dados associados excluídos.');
            if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
          }
        } catch (e) {
          console.error('Erro ao excluir empreendimento:', e);
          Alert.alert('Erro', 'Não foi possível excluir o empreendimento.');
        } finally { setLoading(false); }
      } }
    ]);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
        onPress={() => {
          if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('UnidadesTab', { screen: 'Home' });
        }}
      >
        <Text style={{ color: '#007AFF', fontSize: 18 }}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.label}>Nome da Obra</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Sky Pinheiros" />

      <Text style={styles.label}>Endereço</Text>
      <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} placeholder="Rua Arruda Alvim, 180" />

      <Text style={styles.label}>Cliente / Construtora</Text>
      <TextInput style={styles.input} value={cliente} onChangeText={setCliente} placeholder="Ex: Ricardo Gazoli" />

      <TouchableOpacity style={styles.button} onPress={handleCreateOrUpdate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>{editingId ? 'ATUALIZAR OBRA' : 'SALVAR OBRA'}</Text>}
      </TouchableOpacity>
      {editingId ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: '#c0392b', marginTop: 12 }]} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>EXCLUIR OBRA</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});