import { supabase } from '../supabaseClient'

// Copia fotos de itens antigos para novos itens com base em um mapa { oldId: newId }
export async function copyFotosForItems(oldItemIds = [], mapOldToNew = {}) {
  if (!oldItemIds || oldItemIds.length === 0) return
  try {
    const { data: fotosOriginais } = await supabase.from('fotos_vistoria').select('item_id, storage_path, tipo').in('item_id', oldItemIds)
    if (fotosOriginais?.length) {
      const fotosPayload = fotosOriginais
        .filter(f => mapOldToNew[f.item_id])
        .map(f => ({ item_id: mapOldToNew[f.item_id], storage_path: f.storage_path, tipo: f.tipo }))
      if (fotosPayload.length) await supabase.from('fotos_vistoria').insert(fotosPayload)
    }
  } catch (e) {
    console.warn('shared.copyFotosForItems erro', e)
    throw e
  }
}

export async function createVistoria(payload) {
  const { data, error } = await supabase.from('vistorias').insert(payload).select().maybeSingle()
  if (error) throw error
  return data
}

// Prepara e faz upload de fotos (web). Retorna { urls, paths, allUploaded }
export async function prepararFotosParaUpload(uris = [], unidadeId = 'default', itemId = '0', bucket = 'vistoria-fotos') {
  const urls = []
  const paths = []
  let allUploaded = true

  for (let i = 0; i < (uris || []).length; i++) {
    const uri = uris[i]
    if (!uri) continue
    try {
      // se já for URL pública, mantém
      if (typeof uri === 'string' && uri.startsWith('http')) {
        urls.push(uri)
        // tentar extrair path se for do nosso bucket
        const marker = `/${bucket}/`
        const idx = uri.indexOf(marker)
        if (idx > -1) paths.push(uri.slice(idx + marker.length))
        continue
      }

      // obter blob a partir de File/Blob/dataURL/blob:
      let blob = null
      if (typeof File !== 'undefined' && uri instanceof File) {
        blob = uri
      } else if (uri instanceof Blob) {
        blob = uri
      } else if (typeof uri === 'string' && (uri.startsWith('data:') || uri.startsWith('blob:'))) {
        const resp = await fetch(uri)
        blob = await resp.blob()
      } else if (typeof uri === 'string') {
        // talvez seja um caminho local (file://) ou base64
        try {
          const resp = await fetch(uri)
          blob = await resp.blob()
        } catch (e) {
          throw e
        }
      }

      if (!blob) throw new Error('Nenhum blob para upload')

      // determinar extensão
      let ext = 'jpg'
      try {
        if (blob.type) {
          const m = blob.type.split('/').pop()
          if (m) ext = m
        }
      } catch (e) {}

      const path = `${unidadeId}/${itemId}/${Date.now()}_${i}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true })
      if (upErr) {
        console.warn('prepararFotosParaUpload: upload error', upErr)
        allUploaded = false
        urls.push(typeof uri === 'string' ? uri : '')
        continue
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      urls.push(data?.publicUrl || '')
      paths.push(path)
    } catch (e) {
      console.error('prepararFotosParaUpload erro', e)
      allUploaded = false
      urls.push(typeof uri === 'string' ? uri : '')
    }
  }

  return { urls, paths, allUploaded }
}
