import { supabase } from '../supabaseClient'

// Cria uma vistoria de entrada com payload básico
export async function createEntrada(payload) {
  const base = { tipo_vistoria: 'entrada', status_aprovacao: 'pendente', ...payload }
  const { data, error } = await supabase.from('vistorias').insert(base).select().maybeSingle()
  if (error) throw error
  return data
}

// Função auxiliar para regras específicas de entrada (placeholder)
export async function finalizeEntrada(vistoriaId, opts = {}) {
  // Implementar regras específicas de vistoria de entrada, se necessário
  const { data, error } = await supabase.from('vistorias').select().eq('id', vistoriaId).maybeSingle()
  if (error) throw error
  return data
}

export default { createEntrada, finalizeEntrada }
