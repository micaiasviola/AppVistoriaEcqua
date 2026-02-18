import { supabase } from '../supabaseClient'
import { copyFotosForItems, createVistoria } from './shared'

// Cria uma revistoria imediatamente copiando apenas itens reprovados
export async function createRevistoriaNow(vistoriaId) {
  // busca vistoria
  const { data: v, error: vErr } = await supabase.from('vistorias').select('*').eq('id', vistoriaId).maybeSingle()
  if (vErr || !v) throw vErr || new Error('Vistoria não encontrada')

  // itens reprovados
  const { data: itens } = await supabase.from('itens_vistoria').select('*').eq('vistoria_id', vistoriaId).eq('status', 'reprovado')
  const reprovados = itens || []
  if (reprovados.length === 0) throw new Error('Sem itens reprovados')

  const payload = { unidade_id: v.unidade_id, vistoria_pai_id: vistoriaId, tipo_vistoria: 'revistoria', data_vistoria: new Date().toISOString(), status_aprovacao: 'pendente' }
  const newV = await createVistoria(payload)
  if (!newV || !newV.id) throw new Error('Erro criando revistoria')

  const itensPayload = reprovados.map(r => ({ vistoria_id: newV.id, checklist_item_id: r.checklist_item_id, ambiente_id: r.ambiente_id, numero_item: r.numero_item, descricao_defeito: r.descricao_defeito || r.descricao || '', observacao_interna: r.observacao_interna || '', status: 'pendente', item_origem_id: r.id }))
  const { error: ipErr, data: novosItens } = await supabase.from('itens_vistoria').insert(itensPayload).select('id, item_origem_id')
  if (ipErr) throw ipErr

  const mapaItens = (novosItens || []).reduce((acc, it) => { acc[it.item_origem_id] = it.id; return acc }, {})
  const oldIds = reprovados.map(r => r.id)
  await copyFotosForItems(oldIds, mapaItens)

  return newV
}

// Agenda uma revistoria para uma data específica (copia itens reprovados)
export async function scheduleRevistoria(vistoriaId, dataAgendada) {
  // valida data YYYY-MM-DD
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dataAgendada)) throw new Error('Data inválida')
  const { data: v, error: vErr } = await supabase.from('vistorias').select('*').eq('id', vistoriaId).maybeSingle()
  if (vErr || !v) throw vErr || new Error('Vistoria não encontrada')

  const { data: itens } = await supabase.from('itens_vistoria').select('*').eq('vistoria_id', vistoriaId).eq('status', 'reprovado')
  const pendentes = itens || []
  if (pendentes.length === 0) throw new Error('Não há itens reprovados.')

  const { data: nova, error: novaError } = await supabase.from('vistorias').insert([{ unidade_id: v.unidade_id, engenheiro_id: v.engenheiro_id || null, data_vistoria: dataAgendada, data_agendada: dataAgendada, tipo_vistoria: 'revistoria', revisao_num: (v.revisao_num || 0) + 1, vistoria_pai_id: vistoriaId, status: 'agendada' }]).select().maybeSingle()
  if (novaError || !nova?.id) throw novaError || new Error('Erro criando revistoria')

  const itensPayload = pendentes.map(i => ({ vistoria_id: nova.id, checklist_item_id: i.checklist_item_id, ambiente_id: i.ambiente_id, numero_item: i.numero_item, descricao_defeito: i.descricao_defeito || i.descricao || '', observacao_interna: i.observacao_interna || '', status: 'pendente', item_origem_id: i.id }))
  const { data: novosItens, error: itensError } = await supabase.from('itens_vistoria').insert(itensPayload).select('id, item_origem_id')
  if (itensError) throw itensError

  const mapaItens = (novosItens || []).reduce((acc, it) => { acc[it.item_origem_id] = it.id; return acc }, {})
  const oldIds = pendentes.map(p => p.id)
  await copyFotosForItems(oldIds, mapaItens)

  return nova
}

export default { createRevistoriaNow, scheduleRevistoria }
