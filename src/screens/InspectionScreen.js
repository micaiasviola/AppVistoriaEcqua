import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CommonActions } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
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
    Switch,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderContextual from '../../components/HeaderContextual';
import * as theme from '../../constants/theme';
import InspectionForm from '../components/InspectionForm';
import { supabase, supabaseAnonKey, supabaseUrl } from '../services/supabase';
import {
    carregarExclusoes,
    obterCacheKey,
    obterNomeAmbiente,
    ordenarApontamentos,
    salvarExclusoes,
    sanitizarListaParaCache
} from '../utils/inspectionUtils';

export default function InspectionScreen({ route, navigation }) {
    const params = route?.params || {};
    const { codigoUnidade, unidadeId, vistoriaId, engenheiroId, modoConstrutora, tipoVistoria, empreendimentoNome, clienteNome } = params;
    
    // Constantes derivadas
    const FOTOS_BUCKET = 'vistoria-fotos';
    const TIPO_FOTO_PADRAO = 'defeito';
    const vistoriaTipo = tipoVistoria || (modoConstrutora ? 'construtora' : 'entrada');
    const DELETES_KEY = `VISTORIA_DELETES_${unidadeId}_${vistoriaTipo}`;
    const ENGENHEIRO_PADRAO_ID = 'f8b08af3-9fdd-4b28-b178-dc0773b33131';
    
    // Validação de parâmetros obrigatórios
    const parametrosEssenciais = [unidadeId, codigoUnidade];
    const algumParametroFaltando = parametrosEssenciais.some(p => !p || p === 'undefined');

    // --- ESTADOS GERAIS ---
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [vistoriaIdAtual, setVistoriaIdAtual] = useState(vistoriaId || null);
    const [engenheiroIdAtual, setEngenheiroIdAtual] = useState(engenheiroId || ENGENHEIRO_PADRAO_ID);

    // Estados do formulário
    const [ambientes, setAmbientes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [itensFinais, setItensFinais] = useState([]);
    const [ambienteIdSel, setAmbienteIdSel] = useState('');
    const [ambienteNomeSel, setAmbienteNomeSel] = useState('');
    const [categoriaSel, setCategoriaSel] = useState('');
    const [itemIdSel, setItemIdSel] = useState('');
    const [itemNomeSel, setItemNomeSel] = useState('');
    const [descricao, setDescricao] = useState('');
    const [fotos, setFotos] = useState([]);
    const [numeroItemSel, setNumeroItemSel] = useState(null);
    const [statusSel, setStatusSel] = useState('pendente');
    const [resolucaoObs, setResolucaoObs] = useState('');

    // Estados de edição
    const [editandoId, setEditandoId] = useState(null);
    const [apontamentos, setApontamentos] = useState([]);

    // Estados de modais
    const [fotoMenuVisible, setFotoMenuVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [agendaVisible, setAgendaVisible] = useState(false);

    // Estados para finalização construtora
    const [aprovado, setAprovado] = useState(false);
    const [temChaves, setTemChaves] = useState(false);
    const [fotoChaves, setFotoChaves] = useState(null);
    const [obsFinal, setObsFinal] = useState('');

    // Estados para agendamento
    const [agendaData, setAgendaData] = useState('');
    const [agendaDateObj, setAgendaDateObj] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // --- TODOS OS EFEITOS DEVEM VIR ANTES DE QUALQUER RETURN ---
    // Inicialização
    useEffect(() => {
        if (algumParametroFaltando) {
            setTimeout(() => {
                Alert.alert('Erro de navegação', 'Informações da unidade não encontradas. Retornando à tela inicial.');
                navigation.navigate('UnidadesTab', { screen: 'Home' });
            }, 500);
            return;
        }
        carregarDadosIniciais();
    }, []);

    // Carrega categorias quando ambiente muda
    useEffect(() => {
        if (!ambienteIdSel) { setCategorias([]); return; }
        const amb = ambientes.find(a => a.id === ambienteIdSel);
        if(amb) setAmbienteNomeSel(amb.nome);
        
        supabase.from('checklist_itens').select('categoria').eq('ambiente_id', ambienteIdSel)
            .then(({data}) => {
                if(data) setCategorias([...new Set(data.map(i => i.categoria))].sort());
            });
    }, [ambienteIdSel, ambientes]);

    // Carrega itens quando categoria muda
    useEffect(() => {
        if(categoriaSel && ambienteIdSel) {
            supabase.from('checklist_itens').select('id, descricao').eq('ambiente_id', ambienteIdSel).eq('categoria', categoriaSel)
                .then(({data}) => {
                    if(data) setItensFinais(data.sort((a,b) => a.descricao.localeCompare(b.descricao)));
                });
        }
    }, [categoriaSel, ambienteIdSel]);

    // --- VALIDAÇÃO RETORNA APÓS HOOKS ---
    if (algumParametroFaltando) {
        return null;
    }

    // Função global para resetar para a lista de vistorias
    const resetToList = () => {
        if (!algumParametroFaltando) {
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{
                        name: 'VistoriaList',
                        params: { unidadeId, codigoUnidade, modoConstrutora: !!modoConstrutora, tipoVistoria: vistoriaTipo }
                    }]
                })
            );
        } else {
            Alert.alert('Erro de navegação', 'Informações da unidade não encontradas. Retornando à tela inicial.');
            navigation.navigate('UnidadesTab', { screen: 'Home' });
        }
    };

    const carregarDadosIniciais = async () => {
        setLoading(true);
        try {
            // Carrega ambientes
            const { data: ambData } = await supabase.from('ambientes').select('id, nome').order('nome');
            if (ambData) setAmbientes(ambData);

            // Verifica se já existe vistoria ou cria uma nova
            let vId = vistoriaIdAtual;
            if (!vId) {
                const { data: existe } = await supabase
                    .from('vistorias')
                    .select('id')
                    .eq('unidade_id', unidadeId)
                    .eq('tipo_vistoria', vistoriaTipo)
                    .maybeSingle();

                if (existe?.id) {
                    vId = existe.id;
                } else {
                    // Cria nova vistoria (garante todos os campos obrigatórios)
                    const payload = {
                        unidade_id: unidadeId,
                        engenheiro_id: engenheiroIdAtual,
                        tipo_vistoria: vistoriaTipo,
                        data_vistoria: new Date().toISOString().split('T')[0],
                        status: 'pendente', // Valor válido conforme enum status_vistoria
                        data_agendada: new Date().toISOString().split('T')[0]
                    };
                    const { data: nova, error: novaError } = await supabase
                        .from('vistorias')
                        .insert([payload])
                        .select()
                        .single();
                    if (novaError) {
                        console.error('Erro ao criar vistoria:', novaError);
                        Alert.alert('Erro', 'Não foi possível criar a vistoria.');
                        return;
                    }
                    vId = nova?.id;
                }
                setVistoriaIdAtual(vId);
            }

            // Carrega itens salvos (cache ou banco)
            const cacheKey = obterCacheKey(vId, unidadeId, vistoriaTipo);
            const cache = await AsyncStorage.getItem(cacheKey);
            
            let localLista = [];
            if (cache) {
                localLista = JSON.parse(cache);
            }
            let remoteLista = [];
            if (vId) {
                // Carrega do banco
                const { data: itens } = await supabase
                    .from('itens_vistoria')
                    .select('*')
                    .eq('vistoria_id', vId);

                if (itens && itens.length > 0) {
                    // Carrega fotos de cada item
                    const ids = itens.map(i => i.id);
                    const { data: fotos } = await supabase
                        .from('fotos_vistoria')
                        .select('*')
                        .in('item_id', ids);

                    const fotosPorItem = {};
                    if (fotos) {
                        fotos.forEach(f => {
                            if (!fotosPorItem[f.item_id]) fotosPorItem[f.item_id] = [];
                            const url = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(f.storage_path).data.publicUrl;
                            fotosPorItem[f.item_id].push(url);
                        });
                    }

                    remoteLista = itens.map(i => ({
                        id: i.id,
                        vistoria_id: i.vistoria_id,
                        checklist_item_id: i.checklist_item_id,
                        ambiente_id: i.ambiente_id,
                        numero_item: i.numero_item,
                        categoria: null, // será buscado do checklist se necessário
                        item: i.observacao_interna || '',
                        descricao: i.descricao_defeito,
                        observacao_interna: i.observacao_interna,
                        resolucao_obs: i.resolucao_obs,
                        status: i.status,
                        uris: fotosPorItem[i.id] || [],
                        synced: true
                    }));
                }
            }
            // Mescla itens locais pendentes (id não UUID) com remotos
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const pendentesLocais = localLista.filter(i => !uuidRegex.test(String(i.id)));
            const finalLista = [...remoteLista, ...pendentesLocais];
            setApontamentos(finalLista);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(sanitizarListaParaCache(finalLista)));
        } catch (e) {
            console.error('Erro ao carregar dados iniciais:', e);
            Alert.alert('Erro', 'Não foi possível carregar os dados. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    // Loader overlay para loading/syncing
    const showOverlay = loading || syncing;
    // Mensagem de feedback
    const [feedbackMsg, setFeedbackMsg] = useState(null);

    if (loading) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f2f7' }}>
            <ActivityIndicator size="large" color={theme.colors?.primary || '#007AFF'} />
            <Text style={{ marginTop: 16, color: '#666' }}>Carregando dados...</Text>
        </View>
    );
    
    // --- FUNÇÕES AUXILIARES ---
    // carregarMenus já está importada de inspectionUtils.js

    // carregarChecklistPorIds já está importada de inspectionUtils.js

    // carregarFotosPorItens já está importada de inspectionUtils.js

    // obterNomeAmbiente já está importada de inspectionUtils.js
    // obterCacheKey já está importada de inspectionUtils.js
    // obterDeletesKey já está importada de inspectionUtils.js
    // obterLastVistoriaKey já está importada de inspectionUtils.js
    // ordenarApontamentos já está importada de inspectionUtils.js
    
    // --- LÓGICA DE FOTOS ---
    const lidarComFoto = () => {
        setFotoMenuVisible(true);
    };

    const abrirCamera = () => {
        setFotoMenuVisible(false);
        setTimeout(() => {
            processarImagem(true);
        }, 250);
    };

    const abrirGaleria = () => {
        setFotoMenuVisible(false);
        setTimeout(() => {
            processarImagem(false);
        }, 250);
    };

    const processarImagem = async (useCamera) => {
        const opts = { quality: 0.5, allowsEditing: false };
        // adiciona mediaTypes se disponível (nem sempre presente no web impl)
        try {
            if (ImagePicker && ImagePicker.MediaType && ImagePicker.MediaType.Images) {
                opts.mediaTypes = ImagePicker.MediaType.Images;
            }
        } catch (e) {}
        let res;
        try {
            if (useCamera) {
                if (Platform.OS === 'web') {
                    Alert.alert("Indisponível", "A câmera não é suportada no web.");
                    return;
                }
                const { status, canAskAgain } = await ImagePicker.getCameraPermissionsAsync();
                if (status !== 'granted') {
                    const req = await ImagePicker.requestCameraPermissionsAsync();
                    if (req.status !== 'granted') {
                        const msg = canAskAgain
                            ? "Permissão de câmera negada."
                            : "Permissão de câmera bloqueada. Ative nas configurações do Android.";
                        Alert.alert("Erro", msg);
                        return;
                    }
                }
                try {
                    res = await ImagePicker.launchCameraAsync(opts);
                } catch (e) {
                    console.error('Erro launchCameraAsync:', e);
                    Alert.alert('Erro', 'Não foi possível abrir a câmera: ' + (e?.message || String(e)));
                    return;
                }
            } else {
                if (Platform.OS !== 'web') {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') return Alert.alert("Erro", "Sem permissão");
                }
                // no web, fallback para input file se a API lançar erro
                if (Platform.OS === 'web') {
                    try {
                        if (ImagePicker.launchImageLibraryAsync) {
                            res = await ImagePicker.launchImageLibraryAsync(opts);
                        } else {
                            throw new Error('launchImageLibraryAsync nao disponivel');
                        }
                    } catch (e) {
                        // fallback: criar input file e ler como dataURL
                        try {
                            res = await new Promise((resolve, reject) => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = async () => {
                                    const file = input.files && input.files[0];
                                    if (!file) return resolve({ canceled: true });
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        resolve({ canceled: false, assets: [{ uri: reader.result }] });
                                    };
                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                };
                                input.click();
                            });
                        } catch (fb) {
                            console.error('Fallback file input error:', fb);
                            Alert.alert('Erro', 'Não foi possível abrir a galeria no navegador.');
                            return;
                        }
                    }
                } else {
                    try {
                        res = await ImagePicker.launchImageLibraryAsync(opts);
                    } catch (e) {
                        console.error('Erro launchImageLibraryAsync:', e);
                        Alert.alert('Erro', 'Não foi possível abrir a galeria: ' + (e?.message || String(e)));
                        return;
                    }
                }
            }
        } catch (e) {
            console.error("Erro ao abrir imagem:", e);
            Alert.alert("Erro", "Não foi possível abrir a câmera/galeria.");
            return;
        }

        if (!res) {
            Alert.alert("Erro", "A câmera não abriu. Verifique permissões e reinicie o app.");
            return;
        }

        if (!res?.canceled && res?.assets?.[0]) {
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

            let uploadSuccess = false;
            let lastError = null;
            try {
                const ext = uri.split('.').pop();
                const path = `${unidadeId}/${itemId}/${Date.now()}_${i}.${ext}`;

                // Tenta fetch -> blob (funciona na maior parte dos casos)
                let blob;
                try {
                    const resp = await fetch(uri);
                    blob = await resp.blob();
                } catch (fetchErr) {
                    // Fallback: tenta ler arquivo local como base64 e converter
                    try {
                        if (uri.startsWith('file://') || uri.startsWith('content://')) {
                            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                            const base64ToBlob = async (b64, contentType = 'image/jpeg') => {
                                // Prefer browser atob -> Uint8Array -> Blob
                                if (typeof atob === 'function') {
                                    const binary = atob(b64);
                                    const len = binary.length;
                                    const bytes = new Uint8Array(len);
                                    for (let j = 0; j < len; j++) bytes[j] = binary.charCodeAt(j);
                                    return new Blob([bytes], { type: contentType });
                                }
                                // Fallback: use data URL + fetch to obtain a Blob (works in web workers/environments with fetch)
                                try {
                                    const dataUrl = `data:${contentType};base64,${b64}`;
                                    const res = await fetch(dataUrl);
                                    const b = await res.blob();
                                    return b;
                                } catch (e) {
                                    throw new Error('No base64 -> blob available');
                                }
                            };
                            blob = await base64ToBlob(base64);
                        } else {
                            throw fetchErr;
                        }
                    } catch (fallbackErr) {
                        lastError = fallbackErr;
                        throw fallbackErr;
                    }
                }

                // normaliza blob se for Buffer (node) para Blob
                try {
                    if (
                      typeof window === 'undefined' &&
                      typeof Buffer !== 'undefined' &&
                      typeof blob !== 'undefined' &&
                      blob &&
                      blob.constructor &&
                      blob.constructor.name === 'Buffer'
                    ) {
                        const maybe = new Blob([blob], { type: 'image/jpeg' });
                        blob = maybe;
                    }
                } catch (normErr) {
                    console.warn('Erro ao normalizar blob:', normErr);
                }

                // Upload com retry/exponential backoff
                const uploadWithRetry = async (maxAttempts = 3) => {
                    let attempt = 0;
                    while (attempt < maxAttempts) {
                        attempt += 1;
                        try {
                            console.log('Uploading', path, {
                                blobType: typeof blob,
                                blobCtor: blob?.constructor?.name,
                                blobSize: blob?.size || blob?.length || 'unknown',
                                blobMime: blob?.type || null
                            });
                            const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, { upsert: true });
                            if (error) {
                                console.warn(`Supabase upload error attempt ${attempt} for ${path}:`, error);
                                throw error;
                            }
                            return true;
                        } catch (upErr) {
                            lastError = upErr;
                            console.warn(`Upload attempt ${attempt} failed for ${path}:`, upErr?.message || upErr);
                            if (attempt >= maxAttempts) {
                                console.error('Upload final failure for', path, upErr);
                                return false;
                            }
                            const delay = 1000 * Math.pow(2, attempt - 1);
                            await new Promise(r => setTimeout(r, delay));
                        }
                    }
                    return false;
                };

                // fallback via PUT direto para o endpoint de storage (usa anon key)
                const directPutUpload = async () => {
                    const url = `${supabaseUrl}/storage/v1/object/${FOTOS_BUCKET}/${path}`;
                    try {
                        console.log('Attempting direct PUT to storage for', path);
                        const resp = await fetch(url, {
                            method: 'PUT',
                            headers: {
                                Authorization: `Bearer ${supabaseAnonKey}`,
                                apikey: supabaseAnonKey,
                                'Content-Type': blob?.type || 'application/octet-stream'
                            },
                            body: blob
                        });
                        if (!resp.ok) {
                            const text = await resp.text().catch(() => null);
                            throw new Error(`Direct PUT failed: ${resp.status} ${resp.statusText} ${text || ''}`);
                        }
                        console.log('Direct PUT succeeded for', path);
                        return true;
                    } catch (err) {
                        lastError = err;
                        console.error('Direct PUT failed for', path, err);
                        // Android fallback: XMLHttpRequest
                        if (Platform.OS === 'android' && typeof XMLHttpRequest !== 'undefined') {
                            try {
                                await new Promise((resolve, reject) => {
                                    const xhr = new XMLHttpRequest();
                                    xhr.open('PUT', url);
                                    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
                                    xhr.setRequestHeader('apikey', supabaseAnonKey);
                                    xhr.setRequestHeader('Content-Type', blob?.type || 'application/octet-stream');
                                    xhr.onload = () => {
                                        if (xhr.status >= 200 && xhr.status < 300) {
                                            console.log('Direct PUT via XHR succeeded for', path);
                                            resolve();
                                        } else {
                                            reject(new Error(`XHR PUT failed: ${xhr.status} ${xhr.responseText}`));
                                        }
                                    };
                                    xhr.onerror = () => reject(new Error('XHR network error'));
                                    xhr.send(blob);
                                });
                                return true;
                            } catch (xhrErr) {
                                lastError = xhrErr;
                                return false;
                            }
                        }
                        return false;
                    }
                };

                // Tenta upload com todos os fallbacks
                let uploaded = await uploadWithRetry(3);
                if (!uploaded) {
                    console.warn('uploadWithRetry failed, trying direct PUT for', path);
                    uploaded = await directPutUpload();
                }

                if (uploaded) {
                    const { data } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);
                    urls.push(data.publicUrl);
                    paths.push(path);
                    uploadSuccess = true;
                } else {
                    throw lastError || new Error('Falha no upload da foto');
                }
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
        if (!ambienteIdSel || !categoriaSel || !itemIdSel) {
            setFeedbackMsg("Preencha Ambiente, Disciplina e Item.");
            setTimeout(() => setFeedbackMsg(null), 2500);
            return;
        }

        // Calcula numero sequencial se for novo
        let num = numeroItemSel;
        if (!num) {
            const max = apontamentos.reduce((acc, curr) => Math.max(acc, curr.numero_item || 0), 0);
            num = max + 1;
        }

        const checklistId = parseInt(itemIdSel) || null;

        const novoItem = {
            id: editandoId || Date.now().toString(),
            vistoria_id: vistoriaIdAtual || vistoriaId,
            checklist_item_id: checklistId,
            ambiente_id: ambienteIdSel,
            numero_item: num,
            categoria: categoriaSel,
            item: itemNomeSel,
            descricao: descricao,
            observacao_interna: itemNomeSel,
            resolucao_obs: statusSel === 'resolvido' ? resolucaoObs : null,
            status: statusSel,
            uris: fotos,
            synced: false,
            ambiente: ambienteNomeSel // Helper visual
        };

        // 1. Atualiza UI e Cache
        let novaLista = editandoId 
            ? apontamentos.map(i => i.id === editandoId ? novoItem : i)
            : [...apontamentos, novoItem];
        
        setApontamentos(novaLista);
        await AsyncStorage.setItem(obterCacheKey(vistoriaIdAtual, unidadeId, vistoriaTipo), JSON.stringify(sanitizarListaParaCache(novaLista)));

        // Limpa form
        setFotos([]); setDescricao(''); setItemIdSel(''); setItemNomeSel(''); setEditandoId(null); setNumeroItemSel(null); setStatusSel('pendente'); setResolucaoObs('');

        // 2. Envia se online
        if (online && vistoriaIdAtual) {
            await salvarNoSupabase(novoItem);
        }
    };

    const salvarNoSupabase = async (item) => {
        try {
            setSyncing(true);
            setFeedbackMsg("Sincronizando item...");
            const { urls, paths, allUploaded } = await prepararFotosParaUpload(item.uris, item.id);

            const payload = {
                vistoria_id: item.vistoria_id,
                checklist_item_id: item.checklist_item_id, // Já tratado como int ou null
                ambiente_id: item.ambiente_id,
                numero_item: item.numero_item || 1, // Fallback
                descricao_defeito: item.descricao,
                observacao_interna: item.observacao_interna,
                resolucao_obs: item.resolucao_obs || null,
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
            const cache = await AsyncStorage.getItem(obterCacheKey(vistoriaIdAtual, unidadeId, vistoriaTipo));
            if (cache) {
                const lista = JSON.parse(cache).map(i => i.id === item.id ? atualizado : i);
                AsyncStorage.setItem(obterCacheKey(vistoriaIdAtual, unidadeId, vistoriaTipo), JSON.stringify(sanitizarListaParaCache(lista)));
            }

        } catch (e) {
            console.error("Erro sync:", e);
        } finally {
            setSyncing(false);
        }
    };

    // --- OUTRAS AÇÕES ---
    const editarItem = (item) => {
        // Validação extra: se algum parâmetro essencial estiver faltando, redireciona para Home
        // Permite editar itens locais pendentes mesmo sem vistoriaIdAtual
        if (!unidadeId || unidadeId === 'undefined' || (!vistoriaIdAtual && !item.vistoria_id) || (vistoriaIdAtual === 'undefined' && !item.vistoria_id)) {
            Alert.alert('Erro de navegação', 'Informações da unidade ou vistoria não encontradas. Retornando à tela inicial.');
            navigation.navigate('UnidadesTab', { screen: 'Home' });
            return;
        }
        setEditandoId(item.id);
        const amb = ambientes.find(a => a.id === item.ambiente_id);
        setAmbienteIdSel(item.ambiente_id);
        setAmbienteNomeSel(amb?.nome || item.ambiente || '');
        setCategoriaSel(item.categoria || '');
        setItemIdSel(item.checklist_item_id || '');
        setItemNomeSel(item.item || '');
        setDescricao(item.descricao || '');
        setFotos(item.uris && Array.isArray(item.uris) ? item.uris : []);
        setNumeroItemSel(item.numero_item || null);
        setStatusSel(item.status || 'pendente');
        setResolucaoObs(item.resolucao_obs || '');
    };

    const excluirItem = (item) => {
        const itemId = item?.id;
        Alert.alert("Excluir", "Confirmar?", [
            { text: "Não" },
            { text: "Sim", onPress: async () => {
                setFeedbackMsg("Excluindo item...");
                const novaLista = apontamentos.filter(i => String(i.id) !== String(itemId));
                setApontamentos(novaLista);
                AsyncStorage.setItem(obterCacheKey(vistoriaIdAtual, unidadeId, vistoriaTipo), JSON.stringify(sanitizarListaParaCache(novaLista)));

                if (!itemId) return;

                if (item.synced && online) {
                    // Exclui itens filhos (revistoria) antes de excluir o item original
                    await supabase.from('itens_vistoria').delete().eq('item_origem_id', itemId);
                    const { error } = await supabase.from('itens_vistoria').delete().eq('id', itemId);
                    if (error) console.error('Erro ao excluir:', error);
                    return;
                }

                if (!online) {
                    const dels = await carregarExclusoes(DELETES_KEY);
                    salvarExclusoes(DELETES_KEY, [...dels, itemId]);
                }
            }}
        ]);
    };

    // Helpers de Cache/Sync
    // sanitizarListaParaCache já está importada de inspectionUtils.js
    // carregarExclusoes já está importada de inspectionUtils.js
    // salvarExclusoes já está importada de inspectionUtils.js
    const migrarCacheParaVistoria = async (id) => { /* Lógica de migração se necessária */ };
    
    const sincronizarPendencias = async () => {
        if (!vistoriaIdAtual) return;
        const cache = await AsyncStorage.getItem(obterCacheKey(vistoriaIdAtual, unidadeId, vistoriaTipo));
        if (!cache) return;
        
        // Sync deletes
        const dels = await carregarExclusoes(DELETES_KEY);
        if (dels.length > 0) {
            setSyncing(true);
            for (const id of dels) await supabase.from('itens_vistoria').delete().eq('id', id);
            salvarExclusoes(DELETES_KEY, []);
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

    // --- FINALIZAÇÃO (CONSTRUTORA) ---
    const adicionarFotoChaves = async () => {
        if (Platform.OS === 'web') {
            Alert.alert('Indisponivel', 'A camera nao e suportada no web.');
            return;
        }
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return Alert.alert("Erro", "Sem permissão");
        const res = await ImagePicker.launchCameraAsync({ quality: 0.5, mediaTypes: ImagePicker.MediaType.Images });
        if (!res.canceled) setFotoChaves(res.assets[0].uri);
    };

    const criarRevistoriaAgendada = async () => {
        // Considera todos itens pendentes, incluindo locais (id não UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const pendentes = apontamentos.filter((i) => i.status !== 'resolvido');
        if (!pendentes.length) {
            Alert.alert('Info', 'Nao ha itens pendentes.');
            return;
        }
        // Sincroniza itens locais antes de criar revistoria
        const locaisPendentes = pendentes.filter(i => !uuidRegex.test(String(i.id)));
        if (locaisPendentes.length > 0) {
            setSyncing(true);
            for (const item of locaisPendentes) await salvarNoSupabase(item);
            setSyncing(false);
            // Recarrega apontamentos após sync
            await carregarDadosIniciais();
            // Atualiza pendentes após sync
            const atualizados = apontamentos.filter((i) => i.status !== 'resolvido' && uuidRegex.test(String(i.id)));
            if (!atualizados.length) {
                Alert.alert('Info', 'Nao ha itens pendentes.');
                return;
            }
            // Segue com os itens sincronizados
            return await criarRevistoriaAgendada();
        }

        const dataAgendada = agendaData.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendada)) {
            Alert.alert('Erro', 'Informe a data no formato YYYY-MM-DD.');
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

        const { data: nova, error: novaError } = await supabase
            .from('vistorias')
            .insert([{
                unidade_id: unidadeId,
                engenheiro_id: engenheiroIdAtual,
                data_vistoria: dataAgendada,
                data_agendada: dataAgendada,
                tipo_vistoria: 'revistoria',
                revisao_num: revisaoNum,
                vistoria_pai_id: vistoriaIdAtual,
                status: 'agendada'
            }])
            .select()
            .single();

        if (novaError || !nova?.id) {
            console.error('Erro ao criar revistoria:', novaError);
            Alert.alert('Erro', 'Nao foi possivel criar a revistoria.');
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
                    name: 'VistoriaList',
                    params: { unidadeId, codigoUnidade, modoConstrutora: false, tipoVistoria: 'revistoria' }
                }]
            })
        );
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
            await AsyncStorage.setItem(`VISTORIA_FINALIZADA_${unidadeId}_${vistoriaTipo}`, new Date().toISOString());
            
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

                const payload = {
                    status_aprovacao: dadosExtras.aprovado ? 'aprovado' : 'reprovado',
                    chaves_entregues: dadosExtras.temChaves,
                    observacao_final: dadosExtras.obsFinal,
                    foto_chaves: urlFoto
                };
                await supabase.from('vistorias').update(payload).eq('id', vistoriaIdAtual);
            }

            setModalVisible(false);



            if (modoConstrutora) {
                Alert.alert("Vistoria finalizada", "Deseja agendar revistoria?", [
                    {
                        text: 'Nao',
                        onPress: resetToList
                    },
                    { text: 'Agendar', onPress: () => setAgendaVisible(true) }
                ]);
                return;
            }

            Alert.alert("Vistoria Finalizada", "A vistoria foi salva.", [
                {
                    text: 'OK',
                    onPress: resetToList
                }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Não foi possível salvar no servidor. Os dados foram salvos localmente. Você pode tentar sincronizar depois.", [
                {
                    text: 'OK',
                    onPress: () => {
                        if (navigation.canGoBack && navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.navigate('UnidadesTab', { screen: 'Home' });
                        }
                    }
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
            {/* Overlay loader global */}
            {showOverlay && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors?.primary || '#007AFF'} />
                    <Text style={{ marginTop: 16, color: '#666' }}>{loading ? 'Carregando...' : 'Sincronizando...'}</Text>
                </View>
            )}
            {/* Mensagem de feedback */}
            {feedbackMsg && (
                <View style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 100, alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                        <Text style={{ color: '#007AFF', fontWeight: '600' }}>{feedbackMsg}</Text>
                    </View>
                </View>
            )}
            <HeaderContextual
                title={
                    vistoriaTipo === 'construtora' ? 'Vistoria com a construtora'
                    : vistoriaTipo === 'entrada' ? 'Vistoria de entrada'
                    : vistoriaTipo === 'revistoria' ? 'Revistoria'
                    : `Unidade ${codigoUnidade}`
                }
                empreendimento={empreendimentoNome || null}
                cliente={clienteNome || null}
                unidade={codigoUnidade || null}
                leftButton={
                    <TouchableOpacity
                        onPress={async () => {
                            if (loading || syncing) return;
                            // Navegação robusta: volta para lista ou home
                            if (navigation.canGoBack && navigation.canGoBack()) {
                                navigation.goBack();
                            } else if (unidadeId && codigoUnidade) {
                                navigation.dispatch(
                                    CommonActions.reset({
                                        index: 0,
                                        routes: [{
                                            name: 'VistoriaList',
                                            params: { unidadeId, codigoUnidade, modoConstrutora: !!modoConstrutora, tipoVistoria: vistoriaTipo }
                                        }]
                                    })
                                );
                            } else {
                                navigation.navigate('UnidadesTab', { screen: 'Home' });
                            }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', opacity: (loading || syncing) ? 0.5 : 1 }}
                        disabled={loading || syncing}
                    >
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                        <Text style={{color: '#007AFF', marginLeft: 5}}>Voltar</Text>
                    </TouchableOpacity>
                }
                rightContent={
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* ...existing code... */}
                    </View>
                }
            />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View>
                        <InspectionForm
                            ambientes={ambientes}
                            categorias={categorias}
                            itensFinais={itensFinais}
                            ambienteIdSel={ambienteIdSel}
                            setAmbienteIdSel={setAmbienteIdSel}
                            ambienteNomeSel={ambienteNomeSel}
                            setAmbienteNomeSel={setAmbienteNomeSel}
                            categoriaSel={categoriaSel}
                            setCategoriaSel={setCategoriaSel}
                            itemIdSel={itemIdSel}
                            setItemIdSel={setItemIdSel}
                            itemNomeSel={itemNomeSel}
                            setItemNomeSel={setItemNomeSel}
                            descricao={descricao}
                            setDescricao={setDescricao}
                            fotos={fotos}
                            setFotos={setFotos}
                            numeroItemSel={numeroItemSel}
                            setNumeroItemSel={setNumeroItemSel}
                            statusSel={statusSel}
                            setStatusSel={setStatusSel}
                            resolucaoObs={resolucaoObs}
                            setResolucaoObs={setResolucaoObs}
                            vistoriaTipo={vistoriaTipo}
                            editandoId={editandoId}
                            confirmarApontamento={confirmarApontamento}
                            lidarComFoto={lidarComFoto}
                            removerFoto={removerFoto}
                            styles={styles}
                            syncing={syncing}
                        />
                        {/* LISTA */}
                        <Text style={styles.subtitle}>Itens ({apontamentos.length}):</Text>
                        {ordenarApontamentos(apontamentos).map((item) => (
                            <View key={item.id} style={styles.historyItem}>
                                {item.uris?.[0] && <Image source={{ uri: item.uris[0] }} style={styles.thumb} />}
                                <View style={styles.historyText}>
                                    <Text style={styles.historyCat}>{item.ambiente || obterNomeAmbiente(item.ambiente_id, ambientes)}</Text>
                                    <Text style={styles.historyTitle}>{item.item}</Text>
                                    <Text numberOfLines={2} style={styles.historyDesc}>{item.descricao}</Text>
                                    {item.status === 'resolvido' && (
                                        <Text style={{fontSize:9, color:'green'}}>RESOLVIDO</Text>
                                    )}
                                    {!item.synced && <Text style={{fontSize:9, color:'orange'}}>PENDENTE</Text>}
                                </View>
                                <View>
                                    <TouchableOpacity onPress={() => editarItem(item)}><Ionicons name="create-outline" size={24} color="#666" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => excluirItem(item)}><Ionicons name="trash-outline" size={24} color="red" /></TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        <View style={{height: 24}} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <View style={styles.footerActions}>
                <TouchableOpacity
                    onPress={resetToList}
                    style={styles.buttonSecondary}
                >
                    <Text style={styles.buttonSecondaryText}>VER VISTORIAS</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBotaoFinalizar} style={styles.buttonFinalizar}>
                    <Text style={styles.buttonFinalizarText}>{modoConstrutora ? "AVANÇAR PARA ENTREGA" : "FINALIZAR VISTORIA"}</Text>
                </TouchableOpacity>
            </View>

            {/* MODAL FOTO (ESCOLHA) */}
            <Modal animationType="fade" transparent={true} visible={fotoMenuVisible} onRequestClose={() => setFotoMenuVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.photoModalContent}>
                        <Text style={styles.modalTitle}>Adicionar Foto</Text>
                        {Platform.OS !== 'web' && (
                            <TouchableOpacity style={styles.photoActionBtn} onPress={abrirCamera}>
                                <Text style={styles.photoActionText} accessibilityLabel="Abrir câmera" accessibilityHint="Tirar foto para adicionar à vistoria">Câmera</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.photoActionBtn} onPress={abrirGaleria}>
                            <Text style={styles.photoActionText} accessibilityLabel="Abrir galeria" accessibilityHint="Selecionar foto da galeria para adicionar à vistoria">Galeria</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.photoActionCancel}
                            onPress={() => setFotoMenuVisible(false)}
                            accessibilityLabel="Cancelar"
                            accessibilityHint="Fecha o menu de fotos"
                        >
                            <Text style={styles.photoCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL AGENDAR REVISTORIA */}
            <Modal animationType="fade" transparent={true} visible={agendaVisible} onRequestClose={() => setAgendaVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.agendaModalContent}>
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
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setAgendaVisible(false)} style={styles.modalBtnCancel}><Text>Voltar</Text></TouchableOpacity>
                                                        <TouchableOpacity onPress={() => setAgendaVisible(false)} style={styles.modalBtnCancel} accessibilityLabel="Voltar" accessibilityHint="Fecha o modal de agendamento"><Text>Voltar</Text></TouchableOpacity>
                            <TouchableOpacity onPress={criarRevistoriaAgendada} style={styles.modalBtnConfirm}><Text style={{color:'#fff'}}>AGENDAR</Text></TouchableOpacity>
                                                    <TouchableOpacity onPress={criarRevistoriaAgendada} style={styles.modalBtnConfirm} accessibilityLabel="Agendar revistoria" accessibilityHint="Confirma o agendamento da revistoria"><Text style={{color:'#fff'}}>AGENDAR</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                                                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel} accessibilityLabel="Voltar" accessibilityHint="Fecha o modal de conclusão"><Text>Voltar</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => processarFinalizacao({ aprovado, temChaves, fotoChaves, obsFinal })} style={styles.modalBtnConfirm}><Text style={{color:'#fff'}}>CONCLUIR</Text></TouchableOpacity>
                                                    <TouchableOpacity onPress={() => processarFinalizacao({ aprovado, temChaves, fotoChaves, obsFinal })} style={styles.modalBtnConfirm} accessibilityLabel="Concluir vistoria" accessibilityHint="Finaliza a vistoria com os dados informados"><Text style={{color:'#fff'}}>CONCLUIR</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = {
    scrollContent: {
        padding: theme.spacing?.md || 16
    },
    label: {
        fontSize: theme.fontSizes?.md || 14,
        fontWeight: '600',
        marginTop: theme.spacing?.md || 16,
        marginBottom: theme.spacing?.sm || 8,
        color: theme.colors?.text || '#333'
    },
    pickerContainer: {
        backgroundColor: theme.colors?.surface || '#fff',
        borderWidth: 1,
        borderColor: theme.colors?.border || '#ddd',
        borderRadius: theme.borderRadius?.md || 8,
        overflow: 'hidden'
    },
    picker: {
        height: 44
    },
    photosRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing?.sm || 8,
        marginTop: theme.spacing?.sm || 8
    },
    photoBox: {
        width: 100,
        height: 100,
        position: 'relative'
    },
    photoImage: {
        width: '100%',
        height: '100%',
        borderRadius: theme.borderRadius?.md || 8
    },
    photoRemove: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: theme.colors?.surface || '#fff',
        borderRadius: theme.borderRadius?.md || 8
    },
    photoAddBox: {
        width: 100,
        height: 100,
        backgroundColor: theme.colors?.background || '#f2f2f7',
        borderWidth: 1,
        borderColor: theme.colors?.border || '#ddd',
        borderRadius: theme.borderRadius?.md || 8,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center'
    },
    photoAddText: {
        fontSize: theme.fontSizes?.sm || 12,
        color: theme.colors?.primary || '#007AFF',
        marginTop: theme.spacing?.xs || 4
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        minHeight: 44
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginTop: 8
    },
    switchLabel: {
        fontSize: 14,
        color: '#333'
    },
    buttonConfirmar: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20
    },
    buttonConfirmarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 12,
        color: '#333'
    },
    historyItem: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0'
    },
    thumb: {
        width: 60,
        height: 60,
        borderRadius: 6,
        marginRight: 12
    },
    historyText: {
        flex: 1
    },
    historyCat: {
        fontSize: 10,
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    historyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2
    },
    historyDesc: {
        fontSize: 12,
        color: '#666'
    },
    footerActions: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 12
    },
    buttonSecondary: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonSecondaryText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600'
    },
    buttonFinalizar: {
        flex: 1,
        backgroundColor: '#34C759',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonFinalizarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    photoModalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        maxWidth: 300
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400
    },
    agendaModalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center',
        color: '#333'
    },
    modalHint: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8
    },
    modalInput: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16
    },
    photoActionBtn: {
        backgroundColor: '#f0f0f0',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        alignItems: 'center'
    },
    photoActionText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500'
    },
    photoActionCancel: {
        padding: 12,
        alignItems: 'center'
    },
    photoCancelText: {
        fontSize: 14,
        color: '#666'
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16
    },
    modalBtnCancel: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center'
    },
    modalBtnConfirm: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center'
    },
    keyPhotoBox: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 12
    }
};
