// Utilitários para InspectionScreen
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';

export const obterNomeAmbiente = (id, ambientes) => ambientes.find(a => a.id === id)?.nome || '';
export const obterCacheKey = (vistoriaIdAtual, unidadeId, vistoriaTipo) => vistoriaIdAtual ? `VISTORIA_${vistoriaIdAtual}` : `VISTORIA_${unidadeId}_${vistoriaTipo}`;
export const obterDeletesKey = (unidadeId, vistoriaTipo) => `VISTORIA_DELETES_${unidadeId}_${vistoriaTipo}`;
export const obterLastVistoriaKey = (unidadeId, vistoriaTipo) => `LAST_VISTORIA_ID_${unidadeId}_${vistoriaTipo}`;
export const ordenarApontamentos = (lista) => [...(lista || [])].sort((a, b) => {
    const na = Number(a?.numero_item) || 0;
    const nb = Number(b?.numero_item) || 0;
    return na - nb;
});

export const carregarMenus = async (setAmbientes) => {
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

export const carregarChecklistPorIds = async (ids) => {
    if (!ids?.length) return {};
    const { data } = await supabase.from('checklist_itens').select('id, descricao, categoria').in('id', ids);
    if (!data) return {};
    return data.reduce((map, item) => {
        map[item.id] = { descricao: item.descricao, categoria: item.categoria };
        return map;
    }, {});
};

export const carregarFotosPorItens = async (itemIds) => {
    if (!itemIds?.length) return {};
    const { data } = await supabase.from('fotos_vistoria').select('item_id, storage_path').in('item_id', itemIds);
    if (!data) return {};
    return data.reduce((map, foto) => {
        const { data: pub } = supabase.storage.from('vistoria-fotos').getPublicUrl(foto.storage_path);
        if (!map[foto.item_id]) map[foto.item_id] = [];
        map[foto.item_id].push(pub.publicUrl);
        return map;
    }, {});
};

export const carregarExclusoes = async (DELETES_KEY) => JSON.parse(await AsyncStorage.getItem(DELETES_KEY) || '[]');
export const salvarExclusoes = (DELETES_KEY, l) => AsyncStorage.setItem(DELETES_KEY, JSON.stringify(l));
export const sanitizarListaParaCache = (l) => l.map(i => {
    const uris = Array.isArray(i.uris) ? i.uris : [];
    return { ...i, uris: uris.filter(u => typeof u === 'string' && u.startsWith('http')) };
});
