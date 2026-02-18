import { supabase } from '../supabaseClient'

// Finaliza vistoria no modo construtora: atualiza status_aprovacao com base nos itens
// fotoChaves: File | string (url) | null
export async function finalizeConstrutora(vistoriaId, { fotoChaves = null, temChaves = false, obsFinal = null } = {}) {
  try {
    const { data: itens } = await supabase.from('itens_vistoria').select('id, status').eq('vistoria_id', vistoriaId)
    const totalItens = (itens || []).length
    const reprovadosCount = (itens || []).filter(i => i.status === 'reprovado').length
    const todosAprovados = totalItens === 0 ? true : (reprovadosCount === 0)

    let urlFoto = null
    if (fotoChaves) {
      if (typeof fotoChaves === 'string' && fotoChaves.startsWith('http')) {
        urlFoto = fotoChaves
      } else {
        // assume File/Blob, upload
        try {
          const ext = (fotoChaves.name || 'jpg').split('.').pop()
          const path = `${vistoriaId}/chaves_${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('vistoria-fotos').upload(path, fotoChaves)
          if (!upErr) {
            const { data } = supabase.storage.from('vistoria-fotos').getPublicUrl(path)
            urlFoto = data?.publicUrl || null
          }
        } catch (e) { console.warn('finalizeConstrutora: upload fotoChaves falhou', e) }
      }
    }

    const payload = {
      status_aprovacao: todosAprovados ? 'aprovado' : 'reprovado',
      chaves_entregues: !!temChaves,
      observacao_final: obsFinal || null,
      foto_chaves: urlFoto
    }

    const { data: updatedV, error: updatedErr } = await supabase.from('vistorias').update(payload).eq('id', vistoriaId).select().maybeSingle()
    if (updatedErr) throw updatedErr

    // Se for revistoria, sincroniza resultado com a vistoria pai
    try {
      const { data: thisV } = await supabase.from('vistorias').select('vistoria_pai_id').eq('id', vistoriaId).maybeSingle()
      const parentId = thisV?.vistoria_pai_id
      if (parentId) {
        const { data: revItens } = await supabase.from('itens_vistoria').select('id, status').eq('vistoria_id', vistoriaId)
        const anyReprovado = (revItens || []).some(i => i.status === 'reprovado')
        if (!anyReprovado) {
          await supabase.from('vistorias').update({ status_aprovacao: 'aprovado' }).eq('id', parentId)
        } else {
          await supabase.from('vistorias').update({ status_aprovacao: 'reprovado' }).eq('id', parentId)
        }
      }
    } catch (e) { console.warn('finalizeConstrutora: erro sincronizando com vistoria pai', e) }

    return updatedV
  } catch (e) {
    console.error('finalizeConstrutora erro', e)
    throw e
  }
}

export default { finalizeConstrutora }
