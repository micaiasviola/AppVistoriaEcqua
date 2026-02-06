import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

export default function InspectionScreen({ route, navigation }) {
    const params = route?.params || {};
    const { codigoUnidade, unidadeId, vistoriaId, engenheiroId, modoConstrutora } = params;
    
    const FOTOS_BUCKET = 'vistoria-fotos';
    const TIPO_FOTO_PADRAO = 'defeito';
    const DELETES_KEY = `VISTORIA_DELETES_${unidadeId}`;
    const ENGENHEIRO_PADRAO_ID = 'f8b08af3-9fdd-4b28-b178-dc0773b33131';

    // --- ESTADOS GERAIS ---
    const [fotos, setFotos] = useState([]);
    const [descricao, setDescricao] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [numeroItemSel, setNumeroItemSel] = useState(null);
    
    // Inicializa com ID da rota se existir
    const [vistoriaIdAtual, setVistoriaIdAtual] = useState(vistoriaId || '');
    const [engenheiroIdAtual, setEngenheiroIdAtual] = useState(engenheiroId || ENGENHEIRO_PADRAO_ID);

    const [apontamentos, setApontamentos] = useState([]);
    const [ambientes, setAmbientes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [itensFinais, setItensFinais] = useState([]);

    const [ambienteIdSel, setAmbienteIdSel] = useState('');
    const [ambienteNomeSel, setAmbienteNomeSel] = useState('');
    const [categoriaSel, setCategoriaSel] = useState('');
    const [itemIdSel, setItemIdSel] = useState('');
    const [itemNomeSel, setItemNomeSel] = useState('');

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [online, setOnline] = useState(true);

    // --- ESTADOS DO MODAL DE ENTREGA (Construtora) ---
    const [modalVisible, setModalVisible] = useState(false);
    const [aprovado, setAprovado] = useState(false);
    const [temChaves, setTemChaves] = useState(false);
    const [fotoChaves, setFotoChaves] = useState(null);
    const [obsFinal, setObsFinal] = useState('');

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        carregarMenus();
        
        // Se NÃO veio ID da rota, precisamos buscar ou criar
        if (!vistoriaId) {
            garantirVistoria();
        } else {
            // Se veio, carregamos os dados dessa vistoria específica
            carregarDadosIniciais();
        }

        const unsubscribe = NetInfo.addEventListener(state => {
            setOnline(state.isConnected);
            if (state.isConnected) {
                sincronizarPendencias();
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (vistoriaIdAtual) {
            migrarCacheParaVistoria(vistoriaIdAtual);
            carregarDadosIniciais();
        }
    }, [vistoriaIdAtual]);

    // --- LÓGICA DE VISTORIA ---
    const garantirVistoria = async () => {
        if (vistoriaIdAtual) return;

        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            const idSalvo = await AsyncStorage.getItem(`LAST_VISTORIA_ID_${unidadeId}`);
            if (idSalvo) setVistoriaIdAtual(idSalvo);
            return;
        }

        let engenheiroParaUso = engenheiroIdAtual;
        // Garante Engenheiro
        if (!engenheiroParaUso) {
            const { data } = await supabase.from('engenheiros').select('id').limit(1).maybeSingle();
            if (data) {
                engenheiroParaUso = data.id;
                setEngenheiroIdAtual(data.id);
            } else {
                // Fallback: cria engenheiro padrão se não existir
                const novo = await supabase.from('engenheiros').insert([{ nome: 'Padrão', crea: '000' }]).select().single();
                if (novo.data) {
                    engenheiroParaUso = novo.data.id;
                    setEngenheiroIdAtual(novo.data.id);
                }
            }
        }

        try {
            // Busca vistoria existente MAIS RECENTE para essa unidade
            const { data: existente } = await supabase
                .from('vistorias')
                .select('id')
                .eq('unidade_id', unidadeId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existente) {
                console.log("Usando vistoria existente:", existente.id);
                setVistoriaIdAtual(existente.id);
                await AsyncStorage.setItem(`LAST_VISTORIA_ID_${unidadeId}`, existente.id);
            } else {
                console.log("Criando nova vistoria...");
                const hoje = new Date().toISOString().slice(0, 10);
                const { data: nova } = await supabase
                    .from('vistorias')
                    .insert([{ unidade_id: unidadeId, engenheiro_id: engenheiroParaUso, data_vistoria: hoje }])
                    .select().single();
                
                setVistoriaIdAtual(nova.id);
                await AsyncStorage.setItem(`LAST_VISTORIA_ID_${unidadeId}`, nova.id);
            }
        } catch (err) { console.error("Erro ao garantir vistoria:", err); }
    };

    // --- CARREGAMENTO DE DADOS ---
    const carregarDadosIniciais = async () => {
        if (!vistoriaIdAtual) return;
        setLoading(true);
        const state = await NetInfo.fetch();
        const exclusoes = await carregarExclusoes();

        if (state.isConnected) {
            try {
                const { data, error } = await supabase
                    .from('itens_vistoria')
                    .select('*')
                    .eq('vistoria_id', vistoriaIdAtual)
                    .order('numero_item', { ascending: true });

                if (error) throw error;

                // Carrega auxiliares
                const checklistIds = data.map(i => i.checklist_item_id).filter(Boolean);
                const itemIds = data.map(i => i.id);
                const checklistMap = await carregarChecklistPorIds(checklistIds);
                const fotosMap = await carregarFotosPorItens(itemIds);

                const itensFormatados = data.map(i => ({
                    id: i.id,
                    vistoria_id: i.vistoria_id,
                    checklist_item_id: i.checklist_item_id,
                    ambiente_id: i.ambiente_id,
                    numero_item: i.numero_item,
                    descricao: i.descricao_defeito,
                    observacao_interna: i.observacao_interna,
                    status: i.status,
                    categoria: checklistMap[i.checklist_item_id]?.categoria || '',
                    item: checklistMap[i.checklist_item_id]?.descricao || i.observacao_interna || '',
                    uris: fotosMap[i.id] || [],
                    synced: true
                }));

                const filtrados = exclusoes.length 
                    ? itensFormatados.filter(i => !exclusoes.includes(i.id))
                    : itensFormatados;

                setApontamentos(filtrados);
                await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(filtrados)));

            } catch (err) {
                console.log("Erro ao baixar, usando cache:", err);
                carregarDoCache();
            }
        } else {
            carregarDoCache();
        }
        setLoading(false);
    };

    const carregarDoCache = async () => {
        const cache = await AsyncStorage.getItem(obterCacheKey());
        if (cache) {
            const exclusoes = await carregarExclusoes();
            const dados = JSON.parse(cache);
            const filtrados = exclusoes.length ? dados.filter(i => !exclusoes.includes(i.id)) : dados;
            setApontamentos(filtrados);
        }
    };

    // --- FUNÇÕES AUXILIARES ---
    const carregarMenus = async () => {
        const cache = await AsyncStorage.getItem('CACHE_MENUS');
        if (cache) setAmbientes(JSON.parse(cache).ambientes || []);
        
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            const { data } = await supabase.from('ambientes').select('*').order('nome');
            if (data) {
                setAmbientes(data);
                AsyncStorage.setItem('CACHE_MENUS', JSON.stringify({ ambientes: data }));
            }
        }
    };

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
            const { data: pub } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(foto.storage_path);
            if (!map[foto.item_id]) map[foto.item_id] = [];
            map[foto.item_id].push(pub.publicUrl);
            return map;
        }, {});
    };

    const obterNomeAmbiente = (id) => ambientes.find(a => a.id === id)?.nome || '';
    const obterCacheKey = () => vistoriaIdAtual ? `VISTORIA_${vistoriaIdAtual}` : `VISTORIA_${unidadeId}`;
    const obterDeletesKey = () => `VISTORIA_DELETES_${unidadeId}`;
    
    // --- LÓGICA DE FOTOS ---
    const lidarComFoto = () => {
        Alert.alert("Adicionar Foto", "Escolha:", [
            { text: "Cancelar", style: "cancel" },
            { text: "Câmera", onPress: () => processarImagem(true) },
            { text: "Galeria", onPress: () => processarImagem(false) },
        ]);
    };

    const processarImagem = async (useCamera) => {
        const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, allowsEditing: false };
        let res;
        if (useCamera) {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Erro", "Sem permissão");
            res = await ImagePicker.launchCameraAsync(opts);
        } else {
            res = await ImagePicker.launchImageLibraryAsync(opts);
        }
        
        if (!res.canceled && res.assets[0]) {
            setFotos([...fotos, res.assets[0].uri]);
        }
    };

    const removerFoto = (idx) => {
        const novas = [...fotos];
        novas.splice(idx, 1);
        setFotos(novas);
    };

    // --- UPLOAD E SINCRONIZAÇÃO ---
    const prepararFotosParaUpload = async (uris, itemId) => {
        const urls = [];
        const paths = [];
        let allUploaded = true;

        for (let i = 0; i < uris.length; i++) {
            const uri = uris[i];
            if (uri.startsWith('http')) {
                urls.push(uri);
                // Tenta extrair path se for do nosso bucket
                const marker = `/${FOTOS_BUCKET}/`;
                const idx = uri.indexOf(marker);
                if (idx > -1) paths.push(uri.slice(idx + marker.length));
                continue;
            }

            try {
                const ext = uri.split('.').pop();
                const path = `${unidadeId}/${itemId}/${Date.now()}_${i}.${ext}`;
                const resp = await fetch(uri);
                const blob = await resp.blob();
                
                const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, { upsert: true });
                if (error) throw error;

                const { data } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);
                urls.push(data.publicUrl);
                paths.push(path);
            } catch (e) {
                console.error("Erro upload foto:", e);
                allUploaded = false;
                urls.push(uri); // Mantém local se falhar
            }
        }
        return { urls, paths, allUploaded };
    };

    // --- SALVAR NO BANCO ---
    const confirmarApontamento = async () => {
        if (!ambienteIdSel || !categoriaSel || !itemIdSel) return Alert.alert("Preencha Ambiente, Disciplina e Item.");

        // Calcula numero sequencial se for novo
        let num = numeroItemSel;
        if (!num) {
            const max = apontamentos.reduce((acc, curr) => Math.max(acc, curr.numero_item || 0), 0);
            num = max + 1;
        }

        const checklistId = parseInt(itemIdSel) || null;

        const novoItem = {
            id: editandoId || Date.now().toString(),
            vistoria_id: vistoriaIdAtual,
            checklist_item_id: checklistId,
            ambiente_id: ambienteIdSel,
            numero_item: num,
            categoria: categoriaSel,
            item: itemNomeSel,
            descricao: descricao,
            observacao_interna: itemNomeSel,
            status: 'pendente',
            uris: fotos,
            synced: false,
            ambiente: ambienteNomeSel // Helper visual
        };

        // 1. Atualiza UI e Cache
        let novaLista = editandoId 
            ? apontamentos.map(i => i.id === editandoId ? novoItem : i)
            : [...apontamentos, novoItem];
        
        setApontamentos(novaLista);
        await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

        // Limpa form
        setFotos([]); setDescricao(''); setItemIdSel(''); setItemNomeSel(''); setEditandoId(null); setNumeroItemSel(null);

        // 2. Envia se online
        if (online && vistoriaIdAtual) {
            await salvarNoSupabase(novoItem);
        }
    };

    const salvarNoSupabase = async (item) => {
        try {
            setSyncing(true);
            const { urls, paths, allUploaded } = await prepararFotosParaUpload(item.uris, item.id);

            const payload = {
                vistoria_id: item.vistoria_id,
                checklist_item_id: item.checklist_item_id, // Já tratado como int ou null
                ambiente_id: item.ambiente_id,
                numero_item: item.numero_item || 1, // Fallback
                descricao_defeito: item.descricao,
                observacao_interna: item.observacao_interna,
                status: item.status
            };

            if (typeof item.id === 'string' && item.id.length > 20) payload.id = item.id;

            const { data, error } = await supabase.from('itens_vistoria').upsert(payload).select().single();
            if (error) throw error;

            // Salva tabela de fotos
            if (paths.length > 0) {
                await supabase.from('fotos_vistoria').delete().eq('item_id', data.id);
                const fotosPayload = paths.map(p => ({ item_id: data.id, storage_path: p, tipo: TIPO_FOTO_PADRAO }));
                await supabase.from('fotos_vistoria').insert(fotosPayload);
            }

            // Atualiza local com ID real
            const atualizado = { ...item, id: data.id, synced: allUploaded, uris: urls };
            setApontamentos(prev => prev.map(i => i.id === item.id ? atualizado : i));
            
            // Atualiza cache
            const cache = await AsyncStorage.getItem(obterCacheKey());
            if (cache) {
                const lista = JSON.parse(cache).map(i => i.id === item.id ? atualizado : i);
                AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(lista)));
            }

        } catch (e) {
            console.error("Erro sync:", e);
        } finally {
            setSyncing(false);
        }
    };

    // --- OUTRAS AÇÕES ---
    const editarItem = (item) => {
        setEditandoId(item.id);
        const amb = ambientes.find(a => a.id === item.ambiente_id);
        setAmbienteIdSel(item.ambiente_id);
        setAmbienteNomeSel(amb?.nome || item.ambiente || '');
        setCategoriaSel(item.categoria);
        setItemIdSel(item.checklist_item_id);
        setItemNomeSel(item.item);
        setDescricao(item.descricao);
        setFotos(item.uris || []);
        setNumeroItemSel(item.numero_item);
    };

    const excluirItem = (id) => {
        Alert.alert("Excluir", "Confirmar?", [
            { text: "Não" },
            { text: "Sim", onPress: async () => {
                const novaLista = apontamentos.filter(i => i.id !== id);
                setApontamentos(novaLista);
                AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

                if (typeof id === 'string' && id.length > 20) {
                    if (online) {
                        await supabase.from('itens_vistoria').delete().eq('id', id);
                    } else {
                        const dels = await carregarExclusoes();
                        salvarExclusoes([...dels, id]);
                    }
                }
            }}
        ]);
    };

    // Helpers de Cache/Sync
    const sanitizarListaParaCache = (l) => l.map(i => {
        const uris = Array.isArray(i.uris) ? i.uris : [];
        return { ...i, uris: uris.filter(u => typeof u === 'string' && u.startsWith('http')) };
    });
    const carregarExclusoes = async () => JSON.parse(await AsyncStorage.getItem(DELETES_KEY) || '[]');
    const salvarExclusoes = (l) => AsyncStorage.setItem(DELETES_KEY, JSON.stringify(l));
    const migrarCacheParaVistoria = async (id) => { /* Lógica de migração se necessária */ };
    
    const sincronizarPendencias = async () => {
        if (!vistoriaIdAtual) return;
        const cache = await AsyncStorage.getItem(obterCacheKey());
        if (!cache) return;
        
        // Sync deletes
        const dels = await carregarExclusoes();
        if (dels.length > 0) {
            setSyncing(true);
            for (const id of dels) await supabase.from('itens_vistoria').delete().eq('id', id);
            salvarExclusoes([]);
        }

        // Sync items
        const lista = JSON.parse(cache);
        const pendentes = lista.filter(i => !i.synced);
        if (pendentes.length > 0) {
            setSyncing(true);
            for (const item of pendentes) await salvarNoSupabase(item);
            carregarDadosIniciais();
            setSyncing(false);
        }
    };

    // --- FILTROS DE MENU ---
    useEffect(() => {
        if (!ambienteIdSel) { setCategorias([]); return; }
        const amb = ambientes.find(a => a.id === ambienteIdSel);
        if(amb) setAmbienteNomeSel(amb.nome);
        
        supabase.from('checklist_itens').select('categoria').eq('ambiente_id', ambienteIdSel)
            .then(({data}) => {
                if(data) setCategorias([...new Set(data.map(i => i.categoria))].sort());
            });
    }, [ambienteIdSel]);

    useEffect(() => {
        if(categoriaSel && ambienteIdSel) {
            supabase.from('checklist_itens').select('id, descricao').eq('ambiente_id', ambienteIdSel).eq('categoria', categoriaSel)
                .then(({data}) => {
                    if(data) setItensFinais(data.sort((a,b) => a.descricao.localeCompare(b.descricao)));
                });
        }
    }, [categoriaSel]);


    // --- FINALIZAÇÃO (CONSTRUTORA) ---
    const adicionarFotoChaves = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return Alert.alert("Erro", "Sem permissão");
        const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
        if (!res.canceled) setFotoChaves(res.assets[0].uri);
    };

    const handleBotaoFinalizar = () => {
        if (modoConstrutora) {
            setModalVisible(true);
        } else {
            Alert.alert("Finalizar", "Concluir vistoria?", [{text:"Sim", onPress:() => processarFinalizacao()}]);
        }
    };

    const processarFinalizacao = async (dadosExtras = {}) => {
        setLoading(true);
        try {
            await AsyncStorage.setItem(`VISTORIA_FINALIZADA_${unidadeId}`, new Date().toISOString());
            
            if (modoConstrutora && online && vistoriaIdAtual) {
                let urlFoto = null;
                if (dadosExtras.fotoChaves) {
                    const ext = dadosExtras.fotoChaves.split('.').pop();
                    const path = `${unidadeId}/chaves_${Date.now()}.${ext}`;
                    const resp = await fetch(dadosExtras.fotoChaves);
                    const blob = await resp.blob();
                    const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, { upsert: true });
                    if (!error) {
                        const { data } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);
                        urlFoto = data.publicUrl;
                    }
                }

                await supabase.from('vistorias').update({
                    status_aprovacao: dadosExtras.aprovado ? 'aprovado' : 'reprovado',
                    chaves_entregues: dadosExtras.temChaves,
                    observacao_final: dadosExtras.obsFinal,
                    foto_chaves: urlFoto
                }).eq('id', vistoriaIdAtual);
            }
            
            setModalVisible(false);
            Alert.alert("Sucesso", "Vistoria Finalizada!");
            navigation.goBack();
        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Salvo localmente apenas.");
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    <Text style={{color: '#007AFF', marginLeft: 5}}>Voltar</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{modoConstrutora ? "Vistoria Construtora" : `Unidade ${codigoUnidade}`}</Text>
                <View style={[styles.statusBadge, { backgroundColor: online ? '#d4edda' : '#f8d7da' }]}>
                    {syncing ? <ActivityIndicator size="small" color="#333"/> : (
                        <Text style={{ color: online ? '#155724' : '#721c24', fontSize: 10, fontWeight: 'bold' }}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* FORMULÁRIO */}
                    <View style={[styles.card, editandoId ? styles.cardEditing : null]}>
                        <Text style={styles.cardTitle}>{editandoId ? "EDITANDO" : "NOVO APONTAMENTO"}</Text>
                        
                        <Text style={styles.label}>1. Ambiente:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={ambienteIdSel} onValueChange={setAmbienteIdSel} style={styles.picker}>
                                <Picker.Item label="Selecione..." value="" color="#999"/>
                                {ambientes.map(a => <Picker.Item key={a.id} label={a.nome} value={a.id} />)}
                            </Picker>
                        </View>

                        {ambienteIdSel !== '' && (
                            <>
                                <Text style={styles.label}>2. Disciplina:</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={categoriaSel} onValueChange={setCategoriaSel} style={styles.picker}>
                                        <Picker.Item label="Selecione..." value="" color="#999"/>
                                        {categorias.map((c, idx) => <Picker.Item key={idx} label={c} value={c} />)}
                                    </Picker>
                                </View>
                            </>
                        )}

                        {categoriaSel !== '' && (
                            <>
                                <Text style={styles.label}>3. Item:</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={itemIdSel} onValueChange={(v) => {
                                        setItemIdSel(v);
                                        const sel = itensFinais.find(i => i.id === v);
                                        setItemNomeSel(sel ? sel.descricao : '');
                                    }} style={styles.picker}>
                                        <Picker.Item label="Selecione..." value="" color="#999"/>
                                        {itensFinais.map((i) => <Picker.Item key={i.id} label={i.descricao} value={i.id} />)}
                                    </Picker>
                                </View>
                            </>
                        )}

                        <Text style={styles.label}>4. Fotos ({fotos.length}):</Text>
                        <ScrollView horizontal style={styles.photoScroll}>
                            <TouchableOpacity onPress={lidarComFoto} style={styles.addPhotoButton}>
                                <Ionicons name="camera" size={24} color="#007AFF" />
                            </TouchableOpacity>
                            {fotos.map((uri, index) => (
                                <View key={index} style={styles.photoWrapper}>
                                    <Image source={{ uri }} style={styles.miniPhoto} />
                                    <TouchableOpacity onPress={() => removerFoto(index)} style={styles.deletePhotoIcon}><Text style={{color:'white'}}>X</Text></TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>5. Observação:</Text>
                        <TextInput placeholder="Descreva..." value={descricao} onChangeText={setDescricao} multiline style={styles.input} />

                        <TouchableOpacity onPress={confirmarApontamento} style={styles.buttonConfirmar}>
                            <Text style={styles.buttonConfirmarText}>{editandoId ? "SALVAR" : "ADICIONAR"}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* LISTA */}
                    <Text style={styles.subtitle}>Itens ({apontamentos.length}):</Text>
                    {apontamentos.map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                            {item.uris?.[0] && <Image source={{ uri: item.uris[0] }} style={styles.thumb} />}
                            <View style={styles.historyText}>
                                <Text style={styles.historyCat}>{item.ambiente || obterNomeAmbiente(item.ambiente_id)}</Text>
                                <Text style={styles.historyTitle}>{item.item}</Text>
                                <Text numberOfLines={2} style={styles.historyDesc}>{item.descricao}</Text>
                                {!item.synced && <Text style={{fontSize:9, color:'orange'}}>PENDENTE</Text>}
                            </View>
                            <View>
                                <TouchableOpacity onPress={() => editarItem(item)}><Ionicons name="create-outline" size={24} color="#666" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => excluirItem(item.id)}><Ionicons name="trash-outline" size={24} color="red" /></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    
                    <View style={{height: 100}} />
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity onPress={handleBotaoFinalizar} style={styles.buttonFinalizar}>
                    <Text style={styles.buttonFinalizarText}>{modoConstrutora ? "AVANÇAR PARA ENTREGA" : "FINALIZAR VISTORIA"}</Text>
                </TouchableOpacity>
            </View>

            {/* MODAL CONSTRUTORA */}
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Conclusão Construtora</Text>
                        
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Aprovado?</Text>
                            <Switch value={aprovado} onValueChange={setAprovado} />
                        </View>
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Chaves Entregues?</Text>
                            <Switch value={temChaves} onValueChange={setTemChaves} />
                        </View>

                        {temChaves && (
                            <TouchableOpacity style={styles.keyPhotoBox} onPress={adicionarFotoChaves}>
                                {fotoChaves ? <Image source={{ uri: fotoChaves }} style={{ width: '100%', height: '100%' }} /> : <Text style={{color:'#007AFF'}}>Foto Chaves</Text>}
                            </TouchableOpacity>
                        )}

                        <TextInput style={styles.input} placeholder="Obs Final..." value={obsFinal} onChangeText={setObsFinal} />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}><Text>Voltar</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => processarFinalizacao({ aprovado, temChaves, fotoChaves, obsFinal })} style={styles.modalBtnConfirm}><Text style={{color:'#fff'}}>CONCLUIR</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e5ea' },
    backButton: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    statusBadge: { padding: 5, borderRadius: 4 },
    scrollContent: { padding: 15 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
    cardEditing: { borderColor: '#ffc107', borderWidth: 2 },
    cardTitle: { fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    label: { marginTop: 10, fontWeight: '600' },
    pickerContainer: { backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    picker: { height: 50 },
    input: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#eee', minHeight: 60, marginTop: 5 },
    photoScroll: { flexDirection: 'row', marginTop: 10 },
    addPhotoButton: { width: 60, height: 60, backgroundColor: '#eef6ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    photoWrapper: { marginRight: 10 },
    miniPhoto: { width: 60, height: 60, borderRadius: 8 },
    deletePhotoIcon: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    buttonConfirmar: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 8 },
    buttonConfirmarText: { color: '#fff', fontWeight: 'bold' },
    subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    historyItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
    thumb: { width: 50, height: 50, borderRadius: 6, marginRight: 10 },
    historyText: { flex: 1 },
    historyTitle: { fontWeight: 'bold' },
    historyDesc: { fontSize: 12, color: '#555' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
    buttonFinalizar: { padding: 15, alignItems: 'center', backgroundColor: '#34C759', borderRadius: 8 },
    buttonFinalizarText: { color: '#fff', fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    switchLabel: { fontSize: 16 },
    keyPhotoBox: { height: 100, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderRadius: 8 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    modalBtnCancel: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#f0f0f0', marginRight: 10, borderRadius: 8 },
    modalBtnConfirm: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 8 }
});