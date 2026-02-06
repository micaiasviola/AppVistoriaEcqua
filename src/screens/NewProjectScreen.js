import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function NewProjectScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cliente, setCliente] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!nome || !endereco) return Alert.alert("Atenção", "Nome e Endereço são obrigatórios.");

    setLoading(true);
    const { error } = await supabase
      .from('empreendimentos')
      .insert([{ nome, endereco, cliente }]);

    setLoading(false);

    if (error) {
      Alert.alert("Erro", error.message);
    } else {
      Alert.alert("Sucesso", "Empreendimento cadastrado!");
      navigation.goBack();
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome da Obra</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Sky Pinheiros" />

      <Text style={styles.label}>Endereço</Text>
      <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} placeholder="Rua Arruda Alvim, 180" />

      <Text style={styles.label}>Cliente / Construtora</Text>
      <TextInput style={styles.input} value={cliente} onChangeText={setCliente} placeholder="Ex: Ricardo Gazoli" />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>SALVAR OBRA</Text>}
      </TouchableOpacity>
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