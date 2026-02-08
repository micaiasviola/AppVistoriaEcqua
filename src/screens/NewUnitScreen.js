import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function NewUnitScreen({ route, navigation }) {
  const { empreendimentoId } = route.params;
  const [codigo, setCodigo] = useState('');
  const [andar, setAndar] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!codigo) return Alert.alert("Erro", "Código da unidade é obrigatório.");

    setLoading(true);
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Número da Unidade</Text>
      <TextInput style={styles.input} value={codigo} onChangeText={setCodigo} placeholder="Ex: 1501" keyboardType="default" />

      <Text style={styles.label}>Andar (Opcional)</Text>
      <TextInput style={styles.input} value={andar} onChangeText={setAndar} placeholder="Ex: 15" keyboardType="numeric" />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>SALVAR UNIDADE</Text>}
      </TouchableOpacity>
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