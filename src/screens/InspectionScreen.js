import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
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
    StyleSheet,
    Switch,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, supabaseAnonKey, supabaseUrl } from '../services/supabase';

export default function InspectionScreen({ route, navigation }) {
    const params = route?.params || {};
    const { codigoUnidade, unidadeId, vistoriaId, engenheiroId, modoConstrutora, tipoVistoria } = params;
    
    const FOTOS_BUCKET = 'vistoria-fotos';
    const TIPO_FOTO_PADRAO = 'defeito';
    const vistoriaTipo = tipoVistoria || (modoConstrutora ? 'construtora' : 'entrada');
    const DELETES_KEY = `VISTORIA_DELETES_${unidadeId}_${vistoriaTipo}`;
    const ENGENHEIRO_PADRAO_ID = 'f8b08af3-9fdd-4b28-b178-dc0773b33131';

    // --- ESTADOS GERAIS ---
    const [fotos, setFotos] = useState([]);
    const [descricao, setDescricao] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [numeroItemSel, setNumeroItemSel] = useState(null);
    const [statusSel, setStatusSel] = useState('pendente');
    const [resolucaoObs, setResolucaoObs] = useState('');
    
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
    const [fotoMenuVisible, setFotoMenuVisible] = useState(false);
    const [agendaVisible, setAgendaVisible] = useState(false);
    const [agendaData, setAgendaData] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [agendaDateObj, setAgendaDateObj] = useState(new Date());
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
            const idSalvo = await AsyncStorage.getItem(obterLastVistoriaKey());
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
                .eq('tipo_vistoria', vistoriaTipo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existente) {
                console.log("Usando vistoria existente:", existente.id);
                setVistoriaIdAtual(existente.id);
                await AsyncStorage.setItem(obterLastVistoriaKey(), existente.id);
            } else {
                console.log("Criando nova vistoria...");
                const hoje = new Date().toISOString().slice(0, 10);
                const { data: nova } = await supabase
                    .from('vistorias')
                    .insert([{ unidade_id: unidadeId, engenheiro_id: engenheiroParaUso, data_vistoria: hoje, tipo_vistoria: vistoriaTipo }])
                    .select().single();
                
                setVistoriaIdAtual(nova.id);
                await AsyncStorage.setItem(obterLastVistoriaKey(), nova.id);
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
                    resolucao_obs: i.resolucao_obs,
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
    const obterCacheKey = () => vistoriaIdAtual ? `VISTORIA_${vistoriaIdAtual}` : `VISTORIA_${unidadeId}_${vistoriaTipo}`;
    const obterDeletesKey = () => `VISTORIA_DELETES_${unidadeId}_${vistoriaTipo}`;
    const obterLastVistoriaKey = () => `LAST_VISTORIA_ID_${unidadeId}_${vistoriaTipo}`;

    const ordenarApontamentos = (lista) => [...(lista || [])].sort((a, b) => {
        const na = Number(a?.numero_item) || 0;
        const nb = Number(b?.numero_item) || 0;
        return na - nb;
    });
    
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
                    if (typeof Buffer !== 'undefined' && typeof blob !== 'undefined' && blob && blob.constructor && blob.constructor.name === 'Buffer') {
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
        await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

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
        setStatusSel(item.status || 'pendente');
        setResolucaoObs(item.resolucao_obs || '');
    };

    const excluirItem = (item) => {
        const itemId = item?.id;
        Alert.alert("Excluir", "Confirmar?", [
            { text: "Não" },
            { text: "Sim", onPress: async () => {
                const novaLista = apontamentos.filter(i => String(i.id) !== String(itemId));
                setApontamentos(novaLista);
                AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

                if (!itemId) return;

                if (item.synced && online) {
                    const { error } = await supabase.from('itens_vistoria').delete().eq('id', itemId);
                    if (error) console.error('Erro ao excluir:', error);
                    return;
                }

                if (!online) {
                    const dels = await carregarExclusoes();
                    salvarExclusoes([...dels, itemId]);
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
        const pendentes = apontamentos.filter((i) => i.status !== 'resolvido');
        if (!pendentes.length) {
            Alert.alert('Info', 'Nao ha itens pendentes.');
            return;
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

            const resetToList = () => navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{
                        name: 'VistoriaList',
                        params: { unidadeId, codigoUnidade, modoConstrutora: !!modoConstrutora, tipoVistoria: vistoriaTipo }
                    }]
                })
            );

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
            Alert.alert("Erro", "Salvo localmente apenas.");
            if (navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('UnidadesTab', { screen: 'Home' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => { if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UnidadesTab', { screen: 'Home' }); }} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    <Text style={{color: '#007AFF', marginLeft: 5}}>Voltar</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{modoConstrutora ? "Vistoria Construtora" : `Unidade ${codigoUnidade}`}</Text>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: online ? '#d4edda' : '#f8d7da' }]}>
                        {syncing ? <ActivityIndicator size="small" color="#333"/> : (
                            <Text style={{ color: online ? '#155724' : '#721c24', fontSize: 10, fontWeight: 'bold' }}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                        )}
                    </View>
                    {apontamentos.filter(a => !a.synced).length > 0 && (
                        <View style={styles.unsyncedBadge}>
                            <Text style={styles.unsyncedText}>{apontamentos.filter(a => !a.synced).length} não sync</Text>
                        </View>
                    )}
                </View>
            </View>
            <View style={styles.breadcrumbRow}>
                <Text style={styles.breadcrumbText}>Unidade {codigoUnidade} • {vistoriaTipo}</Text>
                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={() => navigation.navigate('UnidadesTab', { screen: 'Home' })}
                >
                    <Ionicons name="home-outline" size={16} color="#111" style={styles.homeIcon} />
                    <Text style={styles.homeText}>Inicio</Text>
                </TouchableOpacity>
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

                        {vistoriaTipo === 'revistoria' && (
                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Resolvido?</Text>
                                <Switch
                                    value={statusSel === 'resolvido'}
                                    onValueChange={(v) => setStatusSel(v ? 'resolvido' : 'pendente')}
                                />
                            </View>
                        )}

                        {vistoriaTipo === 'revistoria' && statusSel === 'resolvido' && (
                            <>
                                <Text style={styles.label}>6. Observacao da resolucao:</Text>
                                <TextInput
                                    placeholder="Descreva a resolucao..."
                                    value={resolucaoObs}
                                    onChangeText={setResolucaoObs}
                                    multiline
                                    style={styles.input}
                                />
                            </>
                        )}

                        <TouchableOpacity onPress={confirmarApontamento} style={styles.buttonConfirmar}>
                            <Text style={styles.buttonConfirmarText}>{editandoId ? "SALVAR" : "ADICIONAR"}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* LISTA */}
                    <Text style={styles.subtitle}>Itens ({apontamentos.length}):</Text>
                    {ordenarApontamentos(apontamentos).map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                            {item.uris?.[0] && <Image source={{ uri: item.uris[0] }} style={styles.thumb} />}
                            <View style={styles.historyText}>
                                <Text style={styles.historyCat}>{item.ambiente || obterNomeAmbiente(item.ambiente_id)}</Text>
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
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footerActions}>
                <TouchableOpacity
                    onPress={() => navigation.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{
                                name: 'VistoriaList',
                                params: { unidadeId, codigoUnidade, modoConstrutora: !!modoConstrutora, tipoVistoria: vistoriaTipo }
                            }]
                        })
                    )}
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
                                <Text style={styles.photoActionText}>Câmera</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.photoActionBtn} onPress={abrirGaleria}>
                            <Text style={styles.photoActionText}>Galeria</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.photoActionCancel}
                            onPress={() => setFotoMenuVisible(false)}
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
                            <TouchableOpacity onPress={criarRevistoriaAgendada} style={styles.modalBtnConfirm}><Text style={{color:'#fff'}}>AGENDAR</Text></TouchableOpacity>
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
                            <TouchableOpacity onPress={() => processarFinalizacao({ aprovado, temChaves, fotoChaves, obsFinal })} style={styles.modalBtnConfirm}><Text style={{color:'#fff'}}>CONCLUIR</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eef0f3' },
    backButton: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
    statusBadge: { padding: 5, borderRadius: 4 },
    syncBadge: { 
        backgroundColor: '#ff9500', 
        borderRadius: 10, 
        minWidth: 20, 
        height: 20, 
        alignItems: 'center', 
        justifyContent: 'center',
        marginLeft: 8
    },
    syncBadgeText: { 
        color: '#fff', 
        fontSize: 12, 
        fontWeight: '600' 
    },
    breadcrumbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f6f7f9', borderBottomWidth: 1, borderColor: '#eef0f3' },
    breadcrumbText: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
    homeButton: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
    homeIcon: { marginRight: 6 },
    homeText: { fontSize: 12, fontWeight: '600', color: '#111' },
    scrollContent: { padding: 16, paddingBottom: 12 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#eef0f3' },
    cardEditing: { borderColor: '#ffc107', borderWidth: 2 },
    cardTitle: { fontWeight: '700', textAlign: 'left', marginBottom: 8, color: '#111' },
    label: { marginTop: 10, fontWeight: '600', color: '#374151' },
    pickerContainer: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#eef0f3' },
    picker: { height: 50 },
    input: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#eef0f3', minHeight: 60, marginTop: 5 },
    photoScroll: { flexDirection: 'row', marginTop: 10 },
    addPhotoButton: { width: 60, height: 60, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    photoWrapper: { marginRight: 10 },
    miniPhoto: { width: 60, height: 60, borderRadius: 8 },
    deletePhotoIcon: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    buttonConfirmar: { marginTop: 18, padding: 14, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 10 },
    buttonConfirmarText: { color: '#fff', fontWeight: 'bold' },
    subtitle: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 10, color: '#111' },
    historyItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#eef0f3' },
    thumb: { width: 50, height: 50, borderRadius: 6, marginRight: 10 },
    historyText: { flex: 1 },
    historyTitle: { fontWeight: '600', color: '#111' },
    historyDesc: { fontSize: 12, color: '#6b7280' },
    footerActions: { padding: 16, backgroundColor: '#f6f7f9', borderTopWidth: 1, borderColor: '#eef0f3' },
    buttonSecondary: { padding: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
    buttonSecondaryText: { color: '#111', fontWeight: '700' },
    buttonFinalizar: { padding: 14, alignItems: 'center', backgroundColor: '#16a34a', borderRadius: 10 },
    buttonFinalizarText: { color: '#fff', fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    photoModalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, margin: 20 },
    agendaModalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, margin: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    modalHint: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
    modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, marginBottom: 12, backgroundColor: '#fff' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    switchLabel: { fontSize: 16 },
    keyPhotoBox: { height: 100, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderRadius: 8 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    modalBtnCancel: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#f0f0f0', marginRight: 10, borderRadius: 8 },
    modalBtnConfirm: { padding: 15, flex: 1, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 8 },
    photoActionBtn: { padding: 14, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 8, marginBottom: 10 },
    photoActionText: { color: '#fff', fontWeight: 'bold' },
    photoActionCancel: { padding: 14, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8 },
    photoCancelText: { color: '#333', fontWeight: '600' }
});