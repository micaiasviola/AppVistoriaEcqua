// InspectionScreen.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';

const { width, height } = Dimensions.get('window');

export default function InspectionScreen({ route, navigation }) {
    const { codigoUnidade, unidadeId } = route.params;

    // --- ESTADOS ---
    const [fotos, setFotos] = useState([]);
    const [descricao, setDescricao] = useState('');
    const [editandoId, setEditandoId] = useState(null);

    const [apontamentos, setApontamentos] = useState([]);
    const [ambientes, setAmbientes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [itensFinais, setItensFinais] = useState([]);

    const [ambienteIdSel, setAmbienteIdSel] = useState('');
    const [ambienteNomeSel, setAmbienteNomeSel] = useState('');
    const [categoriaSel, setCategoriaSel] = useState('');
    const [itemNomeSel, setItemNomeSel] = useState('');

    const [loading, setLoading] = useState(false);
    const [online, setOnline] = useState(true);
    const [initializing, setInitializing] = useState(true);

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        const initialize = async () => {
            setInitializing(true);
            await verificarConexao();
            await carregarMenusDoCache();
            await carregarVistoriaSalva();
            setInitializing(false);
        };
        initialize();
    }, []);

    const verificarConexao = async () => {
        try {
            const state = await NetInfo.fetch();
            setOnline(state.isConnected);
            if (state.isConnected) {
                await atualizarMenusOnline();
            }
        } catch (error) {
            console.error('Erro ao verificar conexão:', error);
        }
    };

    const carregarMenusDoCache = async () => {
        try {
            const menusCached = await AsyncStorage.getItem('CACHE_MENUS');
            if (menusCached) {
                const parsed = JSON.parse(menusCached);
                setAmbientes(parsed.ambientes || []);
            }
        } catch (e) { 
            console.log('Erro ao carregar cache:', e); 
        }
    };

    const atualizarMenusOnline = async () => {
        try {
            const { data: ambData } = await supabase.from('ambientes').select('*').order('nome');
            if (ambData) {
                setAmbientes(ambData);
                await AsyncStorage.setItem('CACHE_MENUS', JSON.stringify({ ambientes: ambData }));
            }
        } catch (e) { 
            console.log('Erro ao atualizar menus:', e); 
        }
    };

    const carregarVistoriaSalva = async () => {
        try {
            const salvo = await AsyncStorage.getItem(`VISTORIA_${codigoUnidade}`);
            if (salvo) {
                setApontamentos(JSON.parse(salvo));
            }
        } catch (error) {
            console.error('Erro ao carregar vistoria:', error);
        }
    };

    // --- LÓGICA DE MENUS ---
    useEffect(() => {
        async function filtrarItens() {
            if (!ambienteIdSel) {
                setCategorias([]); 
                setItensFinais([]);
                return;
            }
            
            const amb = ambientes.find(a => a.id === ambienteIdSel);
            if (amb) {
                setAmbienteNomeSel(amb.nome);
            }

            try {
                // Buscar itens do ambiente selecionado
                const { data: itensData } = await supabase
                    .from('checklist_itens')
                    .select('*')
                    .eq('ambiente_id', ambienteIdSel);
                
                if (itensData) {
                    // Extrair categorias únicas
                    const cats = [...new Set(itensData.map(i => i.categoria))].sort();
                    setCategorias(cats);
                    
                    // Filtrar itens pela categoria se já houver uma selecionada
                    if (categoriaSel) {
                        const filtrados = itensData
                            .filter(i => i.categoria === categoriaSel)
                            .map(i => i.descricao)
                            .sort();
                        setItensFinais(filtrados);
                    }
                }
            } catch (error) {
                console.error('Erro ao filtrar itens:', error);
            }
        }
        
        if (ambienteIdSel) {
            filtrarItens();
        }
    }, [ambienteIdSel]);

    useEffect(() => {
        if (categoriaSel && ambienteIdSel) {
            async function carregarItensPorCategoria() {
                try {
                    const { data: itensData } = await supabase
                        .from('checklist_itens')
                        .select('*')
                        .eq('ambiente_id', ambienteIdSel)
                        .eq('categoria', categoriaSel);
                    
                    if (itensData) {
                        const filtrados = itensData
                            .map(i => i.descricao)
                            .sort();
                        setItensFinais(filtrados);
                    }
                } catch (error) {
                    console.error('Erro ao carregar itens por categoria:', error);
                }
            }
            carregarItensPorCategoria();
        } else {
            setItensFinais([]);
        }
    }, [categoriaSel]);

    // --- FOTOS E AÇÕES ---
    const adicionarFoto = async () => {
        // No web, usar galeria em vez de câmera por padrão
        let result;
        
        if (Platform.OS === 'web') {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: false,
                aspect: [4, 3]
            });
        } else {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Erro", "Permissão negada para acessar a câmera");
                return;
            }
            result = await ImagePicker.launchCameraAsync({ 
                mediaTypes: ImagePicker.MediaTypeOptions.Images, 
                quality: 0.7,
                allowsEditing: false,
                aspect: [4, 3]
            });
        }
        
        if (!result.canceled && result.assets && result.assets[0]) {
            setFotos([...fotos, result.assets[0].uri]);
        }
    };

    const removerFoto = (index) => {
        const novasFotos = [...fotos]; 
        novasFotos.splice(index, 1); 
        setFotos(novasFotos);
    };

    const confirmarApontamento = async () => {
        if (fotos.length === 0 || !ambienteIdSel || !categoriaSel || !itemNomeSel) {
            Alert.alert("Faltam dados", "Preencha todos os campos e adicione pelo menos uma foto.");
            return;
        }

        const itemObj = {
            id: editandoId || Date.now(),
            ambiente: ambienteNomeSel, 
            ambienteId: ambienteIdSel,
            categoria: categoriaSel, 
            item: itemNomeSel,
            descricao: descricao || "", 
            uris: [...fotos],
            dataCriacao: new Date().toISOString()
        };

        let novaLista = editandoId
            ? apontamentos.map(ap => ap.id === editandoId ? itemObj : ap)
            : [...apontamentos, itemObj];

        setApontamentos(novaLista);
        setEditandoId(null);
        
        try {
            await AsyncStorage.setItem(`VISTORIA_${codigoUnidade}`, JSON.stringify(novaLista));
        } catch (error) {
            console.error('Erro ao salvar vistoria:', error);
            Alert.alert("Erro", "Não foi possível salvar o item.");
            return;
        }

        // Limpar formulário
        setFotos([]); 
        setDescricao('');
        setItemNomeSel('');
    };

    const editarItem = (item) => {
        setEditandoId(item.id); 
        setAmbienteIdSel(item.ambienteId);
        setCategoriaSel(item.categoria);
        setItemNomeSel(item.item);
        setDescricao(item.descricao); 
        setFotos(item.uris || []);
        
        // Rolar para o topo do formulário
        setTimeout(() => {
            Alert.alert("Editando", "Item carregado para edição. Faça as alterações necessárias.");
        }, 100);
    };

    const excluirItem = async (id) => {
        Alert.alert("Excluir", "Deseja realmente excluir este item?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Excluir", 
                style: "destructive",
                onPress: async () => {
                    const novaLista = apontamentos.filter(i => i.id !== id);
                    setApontamentos(novaLista);
                    try {
                        await AsyncStorage.setItem(`VISTORIA_${codigoUnidade}`, JSON.stringify(novaLista));
                    } catch (error) {
                        Alert.alert("Erro", "Não foi possível excluir o item.");
                    }
                    if (editandoId === id) {
                        limparFormulario();
                    }
                }
            }
        ]);
    };

    const limparFormulario = () => {
        setEditandoId(null); 
        setFotos([]); 
        setDescricao(''); 
        setItemNomeSel(''); 
        setCategoriaSel('');
        setAmbienteIdSel('');
    };

    const finalizarVistoria = async () => {
        if (apontamentos.length === 0) {
            Alert.alert("Vistoria vazia", "Adicione pelo menos um item antes de finalizar.");
            return;
        }

        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            Alert.alert(
                "Offline", 
                "Vistoria salva localmente. Conecte-se à internet para enviar ao servidor.",
                [{ text: "OK" }]
            );
            return;
        }

        Alert.alert(
            "Finalizar Vistoria", 
            `Deseja enviar ${apontamentos.length} item(ns) para o servidor?`,
            [
                { text: "Cancelar", style: "cancel" }, 
                { 
                    text: "Enviar", 
                    onPress: uploadParaSupabase,
                    style: 'default'
                }
            ]
        );
    };

    const uploadParaSupabase = async () => {
        setLoading(true);
        try {
            // Aqui você implementaria o upload real para o Supabase
            // Por enquanto, apenas simular o envio
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await AsyncStorage.removeItem(`VISTORIA_${codigoUnidade}`);
            Alert.alert(
                "Sucesso", 
                "Vistoria enviada com sucesso!",
                [{ 
                    text: "OK", 
                    onPress: () => navigation.goBack() 
                }]
            );
        } catch (error) { 
            console.error("Erro no upload:", error);
            Alert.alert("Erro", "Falha ao enviar vistoria. Tente novamente."); 
        } finally { 
            setLoading(false); 
        }
    };

    if (initializing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ marginTop: 10 }}>Carregando...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* CABEÇALHO */}
            <View style={styles.header}>
                <Text style={styles.title}>Vistoria da unidade</Text>
                <Text style={styles.subtitle}>Vistoria {codigoUnidade}</Text>
                <View style={[styles.statusBadge, { backgroundColor: online ? '#d4edda' : '#f8d7da' }]}>
                    <Text style={styles.statusText}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                </View>
            </View>

            {/* CONTEÚDO COM SCROLL */}
            <KeyboardAvoidingView 
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView 
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {/* FORMULÁRIO */}
                    <View style={[styles.card, editandoId && styles.cardEditing]}>
                        {editandoId && (
                            <View style={styles.editingHeader}>
                                <Text style={styles.editingLabel}>EDITANDO ITEM</Text>
                                <TouchableOpacity onPress={limparFormulario}>
                                    <Text style={styles.cancelButton}>CANCELAR</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Text style={styles.label}>1. Ambiente:</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={ambienteIdSel}
                                onValueChange={setAmbienteIdSel}
                                style={styles.picker}
                            >
                                <Picker.Item label="Selecione..." value="" />
                                {ambientes.map((item) => (
                                    <Picker.Item 
                                        key={item.id} 
                                        label={item.nome} 
                                        value={item.id} 
                                    />
                                ))}
                            </Picker>
                        </View>

                        {ambienteIdSel !== '' && (
                            <>
                                <Text style={styles.label}>2. Disciplina:</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={categoriaSel}
                                        onValueChange={setCategoriaSel}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Selecione..." value="" />
                                        {categorias.map((cat, index) => (
                                            <Picker.Item 
                                                key={index} 
                                                label={cat} 
                                                value={cat} 
                                            />
                                        ))}
                                    </Picker>
                                </View>
                            </>
                        )}

                        {categoriaSel !== '' && (
                            <>
                                <Text style={styles.label}>3. Item:</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={itemNomeSel}
                                        onValueChange={setItemNomeSel}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Selecione..." value="" />
                                        {itensFinais.map((item, index) => (
                                            <Picker.Item 
                                                key={index} 
                                                label={item} 
                                                value={item} 
                                            />
                                        ))}
                                    </Picker>
                                </View>
                            </>
                        )}

                        <Text style={styles.label}>4. Fotos ({fotos.length}):</Text>
                        <View style={styles.photosContainer}>
                            <TouchableOpacity 
                                style={styles.addPhotoButton}
                                onPress={adicionarFoto}
                            >
                                <Text style={styles.plusIcon}>+</Text>
                                <Text style={styles.addPhotoText}>
                                    {Platform.OS === 'web' ? 'Escolher foto' : 'Adicionar'}
                                </Text>
                            </TouchableOpacity>
                            
                            <ScrollView 
                                horizontal 
                                style={styles.photosScroll}
                                showsHorizontalScrollIndicator={false}
                            >
                                {fotos.map((uri, index) => (
                                    <View key={index} style={styles.photoItem}>
                                        <Image 
                                            source={{ uri }} 
                                            style={styles.photoImage} 
                                        />
                                        <TouchableOpacity 
                                            style={styles.deletePhotoButton}
                                            onPress={() => removerFoto(index)}
                                        >
                                            <Text style={styles.deleteIcon}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        <Text style={styles.label}>5. Observação:</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Descreva o problema..."
                            placeholderTextColor="#999"
                            value={descricao}
                            onChangeText={setDescricao}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                editandoId && styles.submitButtonEditing
                            ]}
                            onPress={confirmarApontamento}
                            disabled={fotos.length === 0}
                        >
                            <Text style={[
                                styles.submitButtonText,
                                editandoId && styles.submitButtonTextEditing
                            ]}>
                                {editandoId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR ITEM'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* LISTA DE ITENS */}
                    <Text style={styles.sectionTitle}>Itens ({apontamentos.length}):</Text>
                    
                    {apontamentos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Nenhum item registrado ainda.</Text>
                            <Text style={styles.emptySubtext}>
                                Adicione o primeiro item usando o formulário acima.
                            </Text>
                        </View>
                    ) : (
                        apontamentos.map((item) => (
                            <View key={item.id} style={styles.itemCard}>
                                {item.uris && item.uris.length > 0 && (
                                    <Image 
                                        source={{ uri: item.uris[0] }} 
                                        style={styles.itemImage} 
                                    />
                                )}
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemCategory}>
                                        {item.ambiente} • {item.categoria}
                                    </Text>
                                    <Text style={styles.itemTitle}>{item.item}</Text>
                                    <Text style={styles.itemDescription} numberOfLines={2}>
                                        {item.descricao || "Sem descrição"}
                                    </Text>
                                </View>
                                <View style={styles.itemActions}>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => editarItem(item)}
                                    >
                                        <Text style={styles.editButtonText}>Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => excluirItem(item.id)}
                                    >
                                        <Text style={styles.deleteButtonText}>Excluir</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                    
                    {/* Espaço extra para garantir que o conteúdo não fique escondido */}
                    <View style={styles.bottomSpacer} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* RODAPÉ */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.finishButton,
                        (loading || apontamentos.length === 0) && styles.finishButtonDisabled
                    ]}
                    onPress={finalizarVistoria}
                    disabled={loading || apontamentos.length === 0}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.finishButtonText}>FINALIZAR VISTORIA</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#fff',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100, // Espaço para o botão fixo
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardEditing: {
        borderWidth: 2,
        borderColor: '#ffc107',
    },
    editingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    editingLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffc107',
    },
    cancelButton: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#dc3545',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginTop: 15,
        marginBottom: 8,
    },
    pickerWrapper: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dee2e6',
        marginBottom: 5,
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        color: '#333',
    },
    photosContainer: {
        marginBottom: 15,
    },
    addPhotoButton: {
        width: 80,
        height: 80,
        backgroundColor: '#e8f4ff',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        marginBottom: 10,
    },
    plusIcon: {
        fontSize: 24,
        color: '#007AFF',
        fontWeight: 'bold',
    },
    addPhotoText: {
        fontSize: 10,
        color: '#007AFF',
        marginTop: 4,
        textAlign: 'center',
    },
    photosScroll: {
        flexDirection: 'row',
    },
    photoItem: {
        marginRight: 10,
        position: 'relative',
    },
    photoImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    deletePhotoButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#dc3545',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteIcon: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    textInput: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dee2e6',
        padding: 12,
        minHeight: 100,
        fontSize: 14,
        color: '#333',
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonEditing: {
        backgroundColor: '#ffc107',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButtonTextEditing: {
        color: '#333',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    emptyState: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 30,
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 6,
        marginRight: 15,
    },
    itemContent: {
        flex: 1,
    },
    itemCategory: {
        fontSize: 11,
        color: '#666',
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 18,
    },
    itemActions: {
        marginLeft: 10,
    },
    editButton: {
        backgroundColor: '#6c757d',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 5,
    },
    editButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: '#dc3545',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 60,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    finishButton: {
        backgroundColor: '#28a745',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    finishButtonDisabled: {
        backgroundColor: '#6c757d',
        opacity: 0.7,
    },
    finishButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});