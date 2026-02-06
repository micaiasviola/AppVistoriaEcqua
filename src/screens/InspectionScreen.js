import { Ionicons } from '@expo/vector-icons'; // Certifique-se de instalar: npx expo install @expo/vector-icons
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
    Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

export default function InspectionScreen({ route, navigation }) {
    const { codigoUnidade, unidadeId, vistoriaId, engenheiroId } = route.params;
    const FOTOS_BUCKET = 'vistoria-fotos';
    const TIPO_FOTO_PADRAO = 'defeito';
    const DELETES_KEY = `VISTORIA_DELETES_${unidadeId}`;
    const ENGENHEIRO_PADRAO_ID = 'f8b08af3-9fdd-4b28-b178-dc0773b33131';

    // --- ESTADOS ---
    const [fotos, setFotos] = useState([]);
    const [descricao, setDescricao] = useState('');
    const [editandoId, setEditandoId] = useState(null); // ID local ou UUID do Supabase
    const [numeroItemSel, setNumeroItemSel] = useState(null);
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

    // --- 1. INICIALIZAÇÃO E SINCRONIZAÇÃO ---
    useEffect(() => {
        carregarMenus();
        garantirVistoria();

        // Monitorar conexão para sincronizar automaticamente quando voltar online
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

    const garantirVistoria = async () => {
        // 1. Se já temos o ID na memória, carrega os dados e para.
        if (vistoriaIdAtual) {
            carregarDadosIniciais();
            return;
        }

        const state = await NetInfo.fetch();
        
        // 2. Se estiver OFFLINE, tentamos recuperar o último ID usado no cache local
        if (!state.isConnected) {
            const idSalvoOffline = await AsyncStorage.getItem(`LAST_VISTORIA_ID_${unidadeId}`);
            if (idSalvoOffline) {
                setVistoriaIdAtual(idSalvoOffline);
                // O useEffect do vistoriaIdAtual vai disparar o carregarDadosIniciais
            } else {
                Alert.alert("Offline", "Sem conexão para criar ou buscar vistorias.");
            }
            return;
        }

        // 3. ONLINE: Busca ou Cria Vistoria e Engenheiro
        let engenheiroParaUso = engenheiroIdAtual;
        
        // A) Garante Engenheiro
        if (!engenheiroParaUso) {
            const { data, error } = await supabase
                .from('engenheiros')
                .select('id')
                .limit(1)
                .maybeSingle(); // Usa maybeSingle para não dar erro se não tiver
            
            if (data) {
                engenheiroParaUso = data.id;
                setEngenheiroIdAtual(data.id);
            } else {
                // Se não tem engenheiro, cria um padrão (Opcional, mas evita travar)
                // Você pode remover isso se preferir obrigar o cadastro prévio
                const novoEng = await supabase.from('engenheiros').insert([{ nome: 'Engenheiro Padrão', crea: '000000' }]).select().single();
                if (novoEng.data) {
                    engenheiroParaUso = novoEng.data.id;
                    setEngenheiroIdAtual(novoEng.data.id);
                } else {
                    Alert.alert("Erro", "Nenhum engenheiro cadastrado no sistema.");
                    return;
                }
            }
        }

        try {
            // B) CORREÇÃO PRINCIPAL: Busca vistoria existente antes de criar!
            const { data: existente, error: erroBusca } = await supabase
                .from('vistorias')
                .select('id')
                .eq('unidade_id', unidadeId)
                .order('created_at', { ascending: false }) // Pega a mais recente
                .limit(1)
                .maybeSingle();

            if (existente) {
                // SE JÁ EXISTE, USA ELA!
                console.log("Vistoria existente encontrada:", existente.id);
                setVistoriaIdAtual(existente.id);
                await AsyncStorage.setItem(`LAST_VISTORIA_ID_${unidadeId}`, existente.id);
            } else {
                // SE NÃO EXISTE, CRIA UMA NOVA
                const hoje = new Date().toISOString().slice(0, 10);
                const { data: nova, error: erroCriacao } = await supabase
                    .from('vistorias')
                    .insert([{ 
                        unidade_id: unidadeId, 
                        engenheiro_id: engenheiroParaUso, 
                        data_vistoria: hoje 
                    }])
                    .select()
                    .single();

                if (erroCriacao) throw erroCriacao;
                
                console.log("Nova vistoria criada:", nova.id);
                setVistoriaIdAtual(nova.id);
                await AsyncStorage.setItem(`LAST_VISTORIA_ID_${unidadeId}`, nova.id);
            }
        } catch (err) {
            console.error("Erro ao gerenciar vistoria:", err);
            Alert.alert("Erro", "Falha ao conectar com a vistoria.");
        }
    };

    // Carrega dados (Tenta Supabase -> Falha -> Tenta Cache Local)
    const carregarDadosIniciais = async () => {
        setLoading(true);
        const state = await NetInfo.fetch();
        const exclusoes = await carregarExclusoes();

        if (!vistoriaIdAtual) {
            await carregarDoCache();
            setLoading(false);
            return;
        }

        if (state.isConnected) {
            try {
                const { data, error } = await supabase
                    .from('itens_vistoria')
                    .select('*')
                    .eq('vistoria_id', vistoriaIdAtual)
                    .order('numero_item', { ascending: true });

                if (error) throw error;

                const itemIds = data.map(i => i.id);
                const checklistIds = data.map(i => i.checklist_item_id).filter(Boolean);

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
                console.log("Erro ao baixar dados, usando cache:", err);
                carregarDoCache();
            }
        } else {
            carregarDoCache();
        }
        setLoading(false);
    };

    const carregarDoCache = async () => {
        let cache = await AsyncStorage.getItem(obterCacheKey());
        if (!cache && vistoriaIdAtual) {
            cache = await AsyncStorage.getItem(obterCacheKeyUnidade());
        }
        if (!cache) return;
        const exclusoes = await carregarExclusoes();
        const dados = JSON.parse(cache);
        const filtrados = exclusoes.length
            ? dados.filter(i => !exclusoes.includes(i.id))
            : dados;
        setApontamentos(filtrados);
    };

    const carregarMenus = async () => {
        // Tenta pegar do cache primeiro para ser rápido
        const cache = await AsyncStorage.getItem('CACHE_MENUS');
        if (cache) {
            const { ambientes } = JSON.parse(cache);
            setAmbientes(ambientes || []);
        }

        // Se tiver net, atualiza o cache de menus em segundo plano
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
        if (!ids || ids.length === 0) return {};

        const idsNormalizados = ids.map(id => {
            const numero = Number(id);
            return Number.isNaN(numero) ? id : numero;
        });

        const { data, error } = await supabase
            .from('checklist_itens')
            .select('id, descricao, categoria')
            .in('id', idsNormalizados);

        if (error || !data) return {};

        return data.reduce((mapa, item) => {
            mapa[item.id] = { descricao: item.descricao, categoria: item.categoria };
            return mapa;
        }, {});
    };

    const carregarFotosPorItens = async (itemIds) => {
        if (!itemIds || itemIds.length === 0) return {};

        const { data, error } = await supabase
            .from('fotos_vistoria')
            .select('item_id, storage_path')
            .in('item_id', itemIds);

        if (error || !data) return {};

        return data.reduce((mapa, foto) => {
            const publicUrl = supabase
                .storage
                .from(FOTOS_BUCKET)
                .getPublicUrl(foto.storage_path)
                .data.publicUrl;

            if (!mapa[foto.item_id]) mapa[foto.item_id] = [];
            mapa[foto.item_id].push(publicUrl);
            return mapa;
        }, {});
    };

    const obterNomeAmbiente = (ambienteId) => {
        const ambiente = ambientes.find(a => a.id === ambienteId);
        return ambiente ? ambiente.nome : '';
    };

    const obterCacheKey = () => (vistoriaIdAtual ? `VISTORIA_${vistoriaIdAtual}` : `VISTORIA_${unidadeId}`);
    const obterCacheKeyUnidade = () => `VISTORIA_${unidadeId}`;
    const obterDeletesKey = () => (vistoriaIdAtual ? `VISTORIA_DELETES_${vistoriaIdAtual}` : DELETES_KEY);

    const sanitizarItemParaCache = (item) => {
        if (Platform.OS !== 'web') return item;
        const uris = Array.isArray(item.uris) ? item.uris : [];
        const urlsRemotas = uris.filter(uri => uriEhRemota(uri));
        return { ...item, uris: urlsRemotas };
    };

    const sanitizarListaParaCache = (lista) => lista.map(sanitizarItemParaCache);

    const migrarCacheParaVistoria = async (novoVistoriaId) => {
        if (!novoVistoriaId) return;
        const chaveAntiga = obterCacheKeyUnidade();
        const chaveNova = `VISTORIA_${novoVistoriaId}`;
        if (chaveAntiga === chaveNova) return;

        const cacheAntigo = await AsyncStorage.getItem(chaveAntiga);
        if (!cacheAntigo) return;

        const cacheNovo = await AsyncStorage.getItem(chaveNova);
        const listaAntiga = JSON.parse(cacheAntigo);
        const listaNova = cacheNovo ? JSON.parse(cacheNovo) : [];

        const existente = new Set(listaNova.map(item => item.id));
        const migrados = listaAntiga
            .filter(item => !existente.has(item.id))
            .map(item => ({ ...item, vistoria_id: item.vistoria_id || novoVistoriaId }));

        const combinado = [...listaNova, ...migrados];
        setApontamentos(combinado);
        await AsyncStorage.setItem(chaveNova, JSON.stringify(sanitizarListaParaCache(combinado)));
        await AsyncStorage.removeItem(chaveAntiga);
    };

    // Sobe itens que foram criados offline
    const sincronizarPendencias = async () => {
        if (!vistoriaIdAtual) return;
        const cache = await AsyncStorage.getItem(obterCacheKey());
        if (!cache) return;

        await sincronizarExclusoes();

        const itensLocais = JSON.parse(cache);
        const pendentes = itensLocais.filter(i => !i.synced);

        if (pendentes.length > 0) {
            setSyncing(true);
            console.log(`Sincronizando ${pendentes.length} itens...`);

            for (const item of pendentes) {
                await salvarNoSupabase(item);
            }

            // Recarrega tudo limpo do banco
            carregarDadosIniciais();
            setSyncing(false);
        }
    };

    const carregarExclusoes = async () => {
        const raw = await AsyncStorage.getItem(obterDeletesKey());
        return raw ? JSON.parse(raw) : [];
    };

    const salvarExclusoes = async (ids) => {
        await AsyncStorage.setItem(obterDeletesKey(), JSON.stringify(ids));
    };

    const sincronizarExclusoes = async () => {
        if (!online) return;
        const pendentes = await carregarExclusoes();
        if (pendentes.length === 0) return;

        setSyncing(true);
        const restantes = [];
        for (const id of pendentes) {
            try {
                const { error } = await supabase.from('itens_vistoria').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                restantes.push(id);
            }
        }
        await salvarExclusoes(restantes);
        setSyncing(false);
    };

    const uriEhRemota = (uri) => /^https?:\/\//i.test(uri);

    const extrairStoragePath = (url) => {
        const marcador = `/${FOTOS_BUCKET}/`;
        const idx = url.indexOf(marcador);
        if (idx === -1) return null;
        return url.slice(idx + marcador.length);
    };

    const obterExtensao = (uri) => {
        if (uri.startsWith('data:image/')) {
            const tipo = uri.slice('data:image/'.length).split(';')[0];
            return tipo || 'jpg';
        }
        const base = uri.split('?')[0];
        const match = base.match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : 'jpg';
    };

    const enviarFotoParaStorage = async (uri, itemId, index) => {
        if (uriEhRemota(uri)) {
            return { url: uri, path: extrairStoragePath(uri), uploaded: true };
        }

        const ext = obterExtensao(uri);
        const response = await fetch(uri);
        const blob = await response.blob();
        const caminho = `${unidadeId}/${itemId}/${Date.now()}_${index}.${ext}`;

        const { error } = await supabase
            .storage
            .from(FOTOS_BUCKET)
            .upload(caminho, blob, {
                contentType: blob.type || `image/${ext}`,
                upsert: true
            });

        if (error) throw error;

        const { data: publicData } = supabase
            .storage
            .from(FOTOS_BUCKET)
            .getPublicUrl(caminho);

        return { url: publicData.publicUrl, path: caminho, uploaded: true };
    };

    const prepararFotosParaUpload = async (uris, itemId) => {
        if (!uris || uris.length === 0) return { urls: [], paths: [], allUploaded: true };

        const urls = [];
        const paths = [];
        let allUploaded = true;

        for (let i = 0; i < uris.length; i += 1) {
            const uri = uris[i];
            try {
                if (uriEhRemota(uri)) {
                    urls.push(uri);
                    paths.push(extrairStoragePath(uri));
                    continue;
                }
                const resultado = await enviarFotoParaStorage(uri, itemId, i);
                urls.push(resultado.url);
                paths.push(resultado.path);
            } catch (err) {
                allUploaded = false;
                urls.push(uri);
                paths.push(null);
            }
        }

        return { urls, paths, allUploaded };
    };

    // --- LÓGICA DE MENUS (Filtros em Cascata) ---
    // (Mesma lógica robusta do passo anterior, mantida para funcionar offline)
    useEffect(() => {
        async function filtrarItens() {
            if (!ambienteIdSel) { setCategorias([]); return; }

            const amb = ambientes.find(a => a.id === ambienteIdSel);
            if (amb) setAmbienteNomeSel(amb.nome);

            // Busca itens do banco (ou cache se precisar melhorar offline futuramente)
            const { data } = await supabase
                .from('checklist_itens')
                .select('*')
                .eq('ambiente_id', ambienteIdSel);

            if (data) {
                const cats = [...new Set(data.map(i => i.categoria))].sort();
                setCategorias(cats);
            }
        }
        if (ambienteIdSel) filtrarItens();
    }, [ambienteIdSel]);

    useEffect(() => {
        if (categoriaSel && ambienteIdSel) {
            async function fetchItems() {
                const { data } = await supabase
                    .from('checklist_itens')
                    .select('id, descricao')
                    .eq('ambiente_id', ambienteIdSel)
                    .eq('categoria', categoriaSel);
                if (data) {
                    const ordenados = data
                        .map(i => ({ id: i.id, descricao: i.descricao }))
                        .sort((a, b) => a.descricao.localeCompare(b.descricao));
                    setItensFinais(ordenados);
                }
            }
            fetchItems();
        }
    }, [categoriaSel]);


    // --- 2. NOVA LÓGICA DE FOTOS (Câmera ou Galeria) ---
    const lidarComFoto = () => {
        if (Platform.OS === 'web') {
            const escolherCamera = typeof globalThis !== 'undefined' && typeof globalThis.confirm === 'function'
                ? globalThis.confirm('Usar camera? (Cancelar abre a galeria)')
                : false;
            if (escolherCamera) {
                abrirCamera();
            } else {
                abrirGaleria();
            }
            return;
        }

        Alert.alert(
            "Adicionar Foto",
            "Escolha a origem da imagem:",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "📸 Câmera", onPress: () => abrirCamera() },
                { text: "🖼️ Galeria", onPress: () => abrirGaleria() },
            ]
        );
    };

    const abrirCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return Alert.alert("Erro", "Sem permissão de câmera");

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5, // Qualidade menor para upload mais rápido
            allowsEditing: false,
            base64: Platform.OS === 'web'
        });
        processarFoto(result);
    };

    const abrirGaleria = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert("Erro", "Sem permissão para acessar a galeria");

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            allowsEditing: false,
            base64: Platform.OS === 'web'
        });
        processarFoto(result);
    };

    const processarFoto = (result) => {
        if (!result.canceled && result.assets && result.assets[0]?.uri) {
            const asset = result.assets[0];
            if (Platform.OS === 'web' && asset.base64) {
                const mime = asset.mimeType || 'image/jpeg';
                const dataUrl = `data:${mime};base64,${asset.base64}`;
                setFotos(prev => [...prev, dataUrl]);
                return;
            }
            setFotos(prev => [...prev, asset.uri]);
        }
    };

    const removerFoto = (index) => {
        const novas = [...fotos]; novas.splice(index, 1); setFotos(novas);
    };

    // --- 3. SALVAR E SINCRONIZAR ---
    const confirmarApontamento = async () => {
        const podeSincronizar = Boolean(vistoriaIdAtual);

        if (!ambienteIdSel || !categoriaSel || !itemIdSel) {
            return Alert.alert("Campos obrigatórios", "Selecione Ambiente, Disciplina e Item.");
        }

        const maiorNumero = apontamentos.reduce((acc, atual) => {
            const numero = Number(atual.numero_item || 0);
            return numero > acc ? numero : acc;
        }, 0);

        const checklistId = (() => {
            const numero = Number(itemIdSel);
            return Number.isNaN(numero) ? itemIdSel : numero;
        })();

        const novoItem = {
            id: editandoId || Date.now().toString(), // ID temporário se for novo
            vistoria_id: vistoriaIdAtual || null,
            checklist_item_id: checklistId,
            ambiente_id: ambienteIdSel,
            numero_item: numeroItemSel || (maiorNumero + 1),
            categoria: categoriaSel,
            item: itemNomeSel,
            descricao: descricao,
            observacao_interna: itemNomeSel,
            status: 'pendente',
            uris: fotos,
            synced: false
        };

        // 1. Atualiza Lista Local (UI Instantânea)
        let novaLista;
        if (editandoId) {
            novaLista = apontamentos.map(i => i.id === editandoId ? novoItem : i);
            setEditandoId(null);
        } else {
            novaLista = [...apontamentos, novoItem];
        }
        setApontamentos(novaLista);

        // 2. Salva no Cache Local (Segurança)
        await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

        // 3. Limpa Formulário
        setFotos([]); setDescricao(''); setItemIdSel(''); setItemNomeSel(''); setNumeroItemSel(null);

        // 4. Tenta enviar para Nuvem se tiver internet
        if (online && podeSincronizar) {
            await salvarNoSupabase(novoItem);
        } else {
            Alert.alert("Salvo localmente", "O item foi salvo no celular. A sincronizacao ocorrera quando a vistoria estiver ativa e houver internet.");
        }
    };

    // Função que faz o upload real
    // Função que faz o upload real
    const salvarNoSupabase = async (item) => {
        try {
            if (!item.vistoria_id) return;
            setSyncing(true);

            // 1. Upload das fotos
            const { urls, paths, allUploaded } = await prepararFotosParaUpload(item.uris || [], item.id);

            // 2. Tratamento do ID do Checklist (Sanitização)
            const checklistId = (() => {
                if (!item.checklist_item_id) return null;
                const numero = parseInt(item.checklist_item_id, 10);
                return (Number.isNaN(numero) || numero === 0) ? null : numero;
            })();

            // 3. Montagem do Payload (Com proteção para numero_item)
            const payload = {
                vistoria_id: item.vistoria_id,
                checklist_item_id: checklistId,
                ambiente_id: item.ambiente_id,
                // CORREÇÃO: Se numero_item não existir, usa 1 como fallback para não quebrar o banco
                numero_item: item.numero_item || 1,
                descricao_defeito: item.descricao || '',
                observacao_interna: item.observacao_interna || item.item || '',
                status: item.status || 'pendente'
            };

            // Se for edição de item já sincronizado (tem UUID), mantém o ID
            if (typeof item.id === 'string' && item.id.length > 20) {
                payload.id = item.id;
            }

            console.log("Enviando Payload:", payload);

            // 4. Envio para o Banco
            let { data, error } = await supabase
                .from('itens_vistoria')
                .upsert(payload)
                .select()
                .single();

            if (error) {
                console.error("Erro Supabase:", error);
                throw error;
            }

            // 5. Salvar referência das fotos no banco (Tabela fotos_vistoria)
            const storagePaths = paths.filter(Boolean);
            if (storagePaths.length > 0) {
                try {
                    // Limpa anteriores para evitar duplicatas na relação
                    await supabase.from('fotos_vistoria').delete().eq('item_id', data.id);

                    const payloadFotos = storagePaths.map(path => ({
                        item_id: data.id,
                        storage_path: path,
                        tipo: TIPO_FOTO_PADRAO
                    }));

                    const { error: fotosError } = await supabase.from('fotos_vistoria').insert(payloadFotos);
                    if (fotosError) console.error('Erro ao salvar tabela de fotos:', fotosError);
                } catch (err) {
                    console.error('Erro lógica fotos:', err);
                }
            }

            // 6. Atualiza estado local e cache
            const itemAtualizado = { ...item, id: data.id, synced: allUploaded, uris: urls };

            setApontamentos(current => current.map(i => i.id === item.id ? itemAtualizado : i));

            const cacheAtual = await AsyncStorage.getItem(obterCacheKey());
            if (cacheAtual) {
                const listaCache = JSON.parse(cacheAtual);
                const listaAtualizada = listaCache.map(i => i.id === item.id ? itemAtualizado : i);
                await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(listaAtualizada)));
            }

        } catch (err) {
            console.error("Erro ao sincronizar item:", err);
            // Não exibimos alerta aqui para não interromper o loop de sincronização em massa
        } finally {
            setSyncing(false);
        }
    };
    const editarItem = (item) => {
        setEditandoId(item.id);
        const ambiente = ambientes.find(a => a.id === item.ambiente_id);
        setAmbienteIdSel(item.ambiente_id || (ambiente ? ambiente.id : ''));
        setAmbienteNomeSel(item.ambiente || item.ambiente_nome || '');
        setCategoriaSel(item.categoria || '');
        setItemIdSel(item.checklist_item_id || '');
        setItemNomeSel(item.item || item.observacao_interna || '');
        setDescricao(item.descricao || '');
        setFotos(item.uris || []);
        setNumeroItemSel(item.numero_item || null);
    };

    const excluirItem = (id) => {
        Alert.alert("Excluir", "Apagar este item?", [
            { text: "Não" },
            {
                text: "Sim", onPress: async () => {
                    // Remove local
                    const novaLista = apontamentos.filter(i => i.id !== id);
                    setApontamentos(novaLista);
                    await AsyncStorage.setItem(obterCacheKey(), JSON.stringify(sanitizarListaParaCache(novaLista)));

                    // Se já estava no banco, remove do banco
                    if (typeof id === 'string' && id.length > 20) {
                        if (online) {
                            const { error } = await supabase.from('itens_vistoria').delete().eq('id', id);
                            if (error) {
                                const pendentes = await carregarExclusoes();
                                await salvarExclusoes([...pendentes, id]);
                            }
                        } else {
                            const pendentes = await carregarExclusoes();
                            await salvarExclusoes([...pendentes, id]);
                        }
                    }
                }
            }
        ]);
    };

    const finalizarVistoria = async () => {
        Alert.alert("Finalizar Vistoria", "Tem certeza que deseja finalizar a vistoria?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Finalizar", onPress: async () => {
                    await AsyncStorage.setItem(`VISTORIA_FINALIZADA_${unidadeId}`, new Date().toISOString());
                    Alert.alert("Vistoria finalizada", "A vistoria foi finalizada com sucesso.");
                    navigation.goBack();
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>

            {/* 1. CABEÇALHO PERSONALIZADO COM VOLTAR */}
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    <Text style={{ color: '#007AFF', marginLeft: 5 }}>Voltar</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Unidade {codigoUnidade}</Text>

                <View style={[styles.statusBadge, { backgroundColor: online ? '#d4edda' : '#f8d7da' }]}>
                    {syncing ? <ActivityIndicator size="small" color="#333" /> : (
                        <Text style={{ color: online ? '#155724' : '#721c24', fontSize: 10, fontWeight: 'bold' }}>
                            {online ? 'ONLINE' : 'OFFLINE'}
                        </Text>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* CARD DO FORMULÁRIO */}
                    <View style={[styles.card, editandoId ? styles.cardEditing : null]}>
                        <Text style={styles.cardTitle}>
                            {editandoId ? "EDITANDO APONTAMENTO" : "NOVO APONTAMENTO"}
                        </Text>

                        {/* SELETORES */}
                        <Text style={styles.label}>1. Ambiente:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={ambienteIdSel} onValueChange={setAmbienteIdSel} style={styles.picker}>
                                <Picker.Item label="Selecione..." value="" color="#999" />
                                {ambientes.map(a => <Picker.Item key={a.id} label={a.nome} value={a.id} />)}
                            </Picker>
                        </View>

                        {ambienteIdSel !== '' && (
                            <>
                                <Text style={styles.label}>2. Disciplina:</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={categoriaSel} onValueChange={setCategoriaSel} style={styles.picker}>
                                        <Picker.Item label="Selecione..." value="" color="#999" />
                                        {categorias.map((c, idx) => <Picker.Item key={idx} label={c} value={c} />)}
                                    </Picker>
                                </View>
                            </>
                        )}

                        {categoriaSel !== '' && (
                            <>
                                <Text style={styles.label}>3. Item:</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={itemIdSel}
                                        onValueChange={(value) => {
                                            setItemIdSel(value);
                                            const selecionado = itensFinais.find(i => i.id === value);
                                            setItemNomeSel(selecionado ? selecionado.descricao : '');
                                        }}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Selecione..." value="" color="#999" />
                                        {itensFinais.map((i) => (
                                            <Picker.Item key={i.id} label={i.descricao} value={i.id} />
                                        ))}
                                    </Picker>
                                </View>
                            </>
                        )}

                        {/* FOTOS */}
                        <Text style={styles.label}>4. Fotos ({fotos.length}):</Text>
                        <ScrollView horizontal style={styles.photoScroll} showsHorizontalScrollIndicator={false}>
                            <TouchableOpacity onPress={lidarComFoto} style={styles.addPhotoButton}>
                                <Ionicons name="camera" size={24} color="#007AFF" />
                                <Text style={{ fontSize: 10, color: '#007AFF', marginTop: 2 }}>Adicionar</Text>
                            </TouchableOpacity>
                            {fotos.map((uri, index) => (
                                <View key={index} style={styles.photoWrapper}>
                                    <Image source={{ uri }} style={styles.miniPhoto} />
                                    <TouchableOpacity onPress={() => removerFoto(index)} style={styles.deletePhotoIcon}>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>X</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        {/* OBSERVAÇÃO */}
                        <Text style={styles.label}>5. Observação:</Text>
                        <TextInput
                            placeholder="Descreva o problema..."
                            value={descricao} onChangeText={setDescricao}
                            multiline style={styles.input}
                        />

                        {/* BOTÃO SALVAR ITEM */}
                        <TouchableOpacity onPress={confirmarApontamento} style={styles.buttonConfirmar}>
                            <Text style={styles.buttonConfirmarText}>
                                {editandoId ? "ATUALIZAR REGISTRO" : "ADICIONAR À LISTA"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* LISTA DE REGISTROS */}
                    <Text style={styles.subtitle}>Itens ({apontamentos.length}):</Text>
                    {apontamentos.length === 0 && <Text style={{ color: '#999', textAlign: 'center', marginTop: 20 }}>Nenhum apontamento nesta vistoria.</Text>}

                    {apontamentos.map((item) => (
                        <View key={item.id} style={styles.historyItem}>
                            {item.uris && item.uris[0] && (
                                <Image source={{ uri: item.uris[0] }} style={styles.thumb} />
                            )}
                            <View style={styles.historyText}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={styles.historyCat}>
                                        {item.ambiente || obterNomeAmbiente(item.ambiente_id) || 'Ambiente'}
                                    </Text>
                                    {!item.synced && <Text style={{ fontSize: 9, color: 'orange' }}>PENDENTE</Text>}
                                </View>
                                <Text style={styles.historyTitle}>{item.item || 'Item'}</Text>
                                <Text numberOfLines={2} style={styles.historyDesc}>{item.descricao}</Text>
                            </View>
                            <View>
                                <TouchableOpacity onPress={() => editarItem(item)} style={{ padding: 5 }}>
                                    <Ionicons name="create-outline" size={20} color="#666" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => excluirItem(item.id)} style={{ padding: 5 }}>
                                    <Ionicons name="trash-outline" size={20} color="red" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity onPress={finalizarVistoria} style={styles.buttonFinalizar}>
                        <Text style={styles.buttonFinalizarText}>FINALIZAR VISTORIA</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e5ea' },
    backButton: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, minWidth: 60, alignItems: 'center' },

    scrollContent: { padding: 15, paddingBottom: 50 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 20 },
    cardEditing: { borderColor: '#ffc107', borderWidth: 2 },
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 10, textAlign: 'center', letterSpacing: 1 },

    label: { marginTop: 12, fontWeight: '600', color: '#333', fontSize: 14, marginBottom: 5 },
    pickerContainer: { backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#e1e1e1', overflow: 'hidden' },
    picker: { height: 50 },
    input: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e1e1e1', minHeight: 70, textAlignVertical: 'top' },

    photoScroll: { flexDirection: 'row', marginTop: 5, marginBottom: 10 },
    addPhotoButton: { width: 70, height: 70, backgroundColor: '#eef6ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#007AFF', borderStyle: 'dashed', marginRight: 10 },
    photoWrapper: { marginRight: 10 },
    miniPhoto: { width: 70, height: 70, borderRadius: 8 },
    deletePhotoIcon: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    buttonConfirmar: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#007AFF', borderRadius: 8 },
    buttonConfirmarText: { color: '#fff', fontWeight: 'bold' },
    buttonFinalizar: { marginTop: 10, padding: 14, alignItems: 'center', backgroundColor: '#34C759', borderRadius: 8 },
    buttonFinalizarText: { color: '#fff', fontWeight: 'bold', letterSpacing: 0.5 },

    subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333', marginTop: 10 },
    historyItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center', elevation: 1, borderBottomWidth: 1, borderColor: '#eee' },
    thumb: { width: 50, height: 50, borderRadius: 6, marginRight: 15, backgroundColor: '#eee' },
    historyText: { flex: 1, marginRight: 10 },
    historyCat: { fontSize: 10, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
    historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    historyDesc: { fontSize: 12, color: '#555' },
});