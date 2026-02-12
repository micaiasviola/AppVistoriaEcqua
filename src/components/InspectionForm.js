import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Image, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

function InspectionForm({
  ambientes,
  categorias,
  itensFinais,
  ambienteIdSel,
  setAmbienteIdSel,
  ambienteNomeSel,
  setAmbienteNomeSel,
  categoriaSel,
  setCategoriaSel,
  itemIdSel,
  setItemIdSel,
  itemNomeSel,
  setItemNomeSel,
  descricao,
  setDescricao,
  fotos,
  setFotos,
  numeroItemSel,
  setNumeroItemSel,
  statusSel,
  setStatusSel,
  resolucaoObs,
  setResolucaoObs,
  vistoriaTipo,
  editandoId,
  confirmarApontamento,
  lidarComFoto,
  removerFoto,
  styles,
  syncing
}) {
  return (
    <View accessible accessibilityLabel="Formulário de inspeção" accessibilityHint="Preencha os campos para adicionar ou editar itens da vistoria">
      {/* 1. AMBIENTE */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label} accessibilityLabel="Campo Ambiente" accessibilityHint="Selecione o ambiente da vistoria">1. Ambiente:</Text>
        <View style={styles.pickerContainer}>
        <Picker
          selectedValue={ambienteIdSel ? String(ambienteIdSel) : ''}
          onValueChange={(val) => {
            setAmbienteIdSel(val);
            const amb = ambientes.find(a => String(a.id) === String(val));
            if (amb) setAmbienteNomeSel(amb.nome);
            setCategoriaSel('');
            setItemIdSel('');
            setItemNomeSel('');
          }}
          style={styles.picker}
          accessibilityLabel="Selecione o ambiente"
          accessibilityHint="Lista de ambientes disponíveis"
        >
          <Picker.Item label="Selecione o ambiente..." value="" accessibilityLabel="Selecione o ambiente" />
          {ambientes.map(amb => (
            <Picker.Item key={amb.id} label={amb.nome} value={String(amb.id)} accessibilityLabel={amb.nome} />
          ))}
        </Picker>
      </View>
      </View>

      {/* 2. DISCIPLINA/CATEGORIA */}
      {ambienteIdSel && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label} accessibilityLabel="Campo Disciplina" accessibilityHint="Selecione a disciplina da vistoria">2. Disciplina:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={categoriaSel ? String(categoriaSel) : ''}
              onValueChange={(val) => {
                setCategoriaSel(val);
                setItemIdSel('');
                setItemNomeSel('');
              }}
              style={styles.picker}
              accessibilityLabel="Selecione a disciplina"
              accessibilityHint="Lista de disciplinas disponíveis"
            >
              <Picker.Item label="Selecione a disciplina..." value="" accessibilityLabel="Selecione a disciplina" />
              {categorias.map(cat => (
                <Picker.Item key={cat} label={cat} value={String(cat)} accessibilityLabel={cat} />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* 3. ITEM */}
      {categoriaSel && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label} accessibilityLabel="Campo Item" accessibilityHint="Selecione o item da vistoria">3. Item:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={itemIdSel ? String(itemIdSel) : ''}
              onValueChange={(val) => {
                setItemIdSel(val);
                const item = itensFinais.find(i => String(i.id) === String(val));
                if (item) setItemNomeSel(item.descricao);
              }}
              style={styles.picker}
              accessibilityLabel="Selecione o item"
              accessibilityHint="Lista de itens disponíveis"
            >
              <Picker.Item label="Selecione o item..." value="" accessibilityLabel="Selecione o item" />
              {itensFinais.map(item => (
                <Picker.Item key={item.id} label={item.descricao} value={String(item.id)} accessibilityLabel={item.descricao} />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* 4. FOTOS */}
      {itemIdSel && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label} accessibilityLabel="Campo Fotos" accessibilityHint="Adicione fotos do item">4. Fotos:</Text>
          <View style={styles.photosRow}>
            {fotos.map((uri, idx) => (
              <View key={idx} style={styles.photoBox} accessible accessibilityLabel={`Foto ${idx + 1}`} accessibilityHint="Visualizar ou remover foto">
                <Image source={{ uri }} style={styles.photoImage} accessibilityLabel={`Imagem do item ${idx + 1}`} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removerFoto(idx)}
                  accessibilityLabel="Remover foto"
                  accessibilityHint="Remove a foto selecionada"
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAddBox} onPress={lidarComFoto} accessibilityLabel="Adicionar foto" accessibilityHint="Abre opções para adicionar foto">
              <Ionicons name="camera" size={32} color="#007AFF" />
              <Text style={styles.photoAddText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. OBSERVAÇÃO */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label} accessibilityLabel="Campo Observação" accessibilityHint="Descreva o item da vistoria">5. Observação:</Text>
        <TextInput
        placeholder="Descreva..."
        value={descricao}
        onChangeText={setDescricao}
        multiline
        style={styles.input}
        accessibilityLabel="Campo de texto Observação"
        accessibilityHint="Digite a descrição do item"
      />
      </View>
      {vistoriaTipo === 'revistoria' && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Resolvido?</Text>
          <Switch
            value={statusSel === 'resolvido'}
            onValueChange={(v) => setStatusSel(v ? 'resolvido' : 'pendente')}
            accessibilityLabel="Status resolvido"
            accessibilityHint="Marque se o item foi resolvido"
          />
        </View>
      )}
      {vistoriaTipo === 'revistoria' && statusSel === 'resolvido' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label} accessibilityLabel="Campo Observação da resolução" accessibilityHint="Descreva como o item foi resolvido">6. Observacao da resolucao:</Text>
          <TextInput
            placeholder="Descreva a resolucao..."
            value={resolucaoObs}
            onChangeText={setResolucaoObs}
            multiline
            style={styles.input}
            accessibilityLabel="Campo de texto Observação da resolução"
            accessibilityHint="Digite como o item foi resolvido"
          />
        </View>
      )}
      <TouchableOpacity onPress={confirmarApontamento} accessibilityRole="button" style={[styles.buttonConfirmar, { marginTop: 8, paddingVertical: 14 }]}>
        {syncing ? (
          <Ionicons name="sync" size={20} color="#fff" accessibilityLabel="Salvando item" accessibilityHint="Aguarde, item sendo salvo" />
        ) : (
          <Text style={styles.buttonConfirmarText} accessibilityLabel={editandoId ? "Salvar item" : "Adicionar item"} accessibilityHint={editandoId ? "Salva alterações do item" : "Adiciona novo item"}>{editandoId ? "SALVAR" : "ADICIONAR"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default InspectionForm;
