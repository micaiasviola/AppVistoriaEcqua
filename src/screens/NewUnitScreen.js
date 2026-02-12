import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function NewUnitScreen({ route, navigation }) {
  const params = route?.params || {};
  const empreendimentoId = params?.empreendimentoId;
  const editingId = params?.unitId || null;
  const [codigo, setCodigo] = useState(params?.codigo || '');
  const [andar, setAndar] = useState(params?.andar || '');
  const [loading, setLoading] = useState(false);

  async function handleCreateOrUpdate() {
    if (!codigo) return Alert.alert("Erro", "Código da unidade é obrigatório.");

    setLoading(true);
    if (editingId) {
      const { error } = await supabase.from('unidades').update({ codigo, andar }).eq('id', editingId);
      setLoading(false);
      if (error) Alert.alert('Erro', error.message); else {
        Alert.alert('Sucesso', 'Unidade atualizada!');
        if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
      }
    } else {
      const { error } = await supabase
        .from('unidades')
        .insert([{ empreendimento_id: empreendimentoId, codigo, andar }]);

      setLoading(false);

      if (error) {
        Alert.alert("Erro", error.message);
      } else {
        Alert.alert("Sucesso", "Unidade salva!");
        if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
      }
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    Alert.alert('Excluir unidade', 'Essa unidade possui vistorias? Todas as vistorias relacionadas serão excluídas permanentemente. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          const { data: vistorias, error: vErr } = await supabase.from('vistorias').select('id').eq('unidade_id', editingId);
          if (vErr) console.error('Erro buscando vistorias:', vErr);
          const vistIds = (vistorias || []).map(v => v.id);
          if (vistIds.length > 0) {
            const { data: itens, error: iErr } = await supabase.from('itens_vistoria').select('id').in('vistoria_id', vistIds);
            if (iErr) console.error('Erro buscando itens:', iErr);
            const itemIds = (itens || []).map(it => it.id);
            if (itemIds.length > 0) await supabase.from('fotos_vistoria').delete().in('item_id', itemIds);
            await supabase.from('itens_vistoria').delete().in('vistoria_id', vistIds);
            await supabase.from('vistorias').delete().in('id', vistIds);
          }

          const { error: delErr } = await supabase.from('unidades').delete().eq('id', editingId);
          if (delErr) {
            console.error('Erro excluindo unidade:', delErr);
            Alert.alert('Erro', 'Não foi possível excluir a unidade.');
          } else {
            Alert.alert('Sucesso', 'Unidade excluída.');
            if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' });
          }
        } catch (e) {
          console.error('Erro ao excluir unidade:', e);
          Alert.alert('Erro', 'Não foi possível excluir a unidade.');
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
      <Text style={styles.label}>Número da Unidade</Text>
      <TextInput style={styles.input} value={codigo} onChangeText={setCodigo} placeholder="Ex: 1501" keyboardType="default" />

      <Text style={styles.label}>Andar (Opcional)</Text>
      <TextInput style={styles.input} value={andar} onChangeText={setAndar} placeholder="Ex: 15" keyboardType="numeric" />

      <TouchableOpacity style={styles.button} onPress={handleCreateOrUpdate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>{editingId ? 'ATUALIZAR UNIDADE' : 'SALVAR UNIDADE'}</Text>}
      </TouchableOpacity>
      {editingId ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: '#c0392b', marginTop: 12 }]} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>EXCLUIR UNIDADE</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 },
  button: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});