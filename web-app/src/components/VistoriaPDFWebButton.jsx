import React, { useState } from 'react'

export function VistoriaPDFWebButton({ dadosPDF }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      // tentar descobrir uma URL válida para a logo local antes de gerar o PDF
      async function testImage(url) {
        return new Promise((res) => {
          if (!url) return res(false)
          const img = new Image()
          try { img.crossOrigin = 'anonymous' } catch (e) { /* ignore */ }
          img.onload = () => res(true)
          img.onerror = () => res(false)
          img.src = url
        })
      }

      // incluir candidato resolvido via import.meta.url (logo na mesma pasta deste componente)
      const localCandidates = []
      try { localCandidates.push(new URL('./logo.png', import.meta.url).href) } catch (e) { /* ignore */ }
      const candidates = [dadosPDF.logo, ...localCandidates, '/assets/images/logo.png', '/logo.png', '/assets/logo.png']
      let found = null
      for (const c of candidates) {
        try {
          if (!c) continue
          // normalize relative leading slashes
          const url = c.startsWith('http') ? c : (c.startsWith('/') ? window.location.origin + c : window.location.origin + '/' + c)
          // testar carregamento da imagem
          // eslint-disable-next-line no-await-in-loop
          const ok = await testImage(url)
          if (ok) { found = url; break }
        } catch (e) {
          /* ignore */
        }
      }
      // normalizar / mapear campos candidatos caso o objeto recebido use nomes diferentes
      const enderecoParts = [dadosPDF.endereco, dadosPDF.bairro, dadosPDF.cidade, dadosPDF.estado, dadosPDF.cep].filter(Boolean)
      const mapped = {
        imovel: dadosPDF.imovel || dadosPDF.cliente || dadosPDF.empreendimento || dadosPDF.referencia || 'RELATÓRIO DE VISTORIA',
        unidade: dadosPDF.unidade || dadosPDF.numero || dadosPDF.unidade_num || '',
        endereco: enderecoParts.length ? enderecoParts.join(', ') : (dadosPDF.endereco_completo || ''),
        local: dadosPDF.local || (dadosPDF.cidade ? `${dadosPDF.cidade}${dadosPDF.estado ? ' - ' + dadosPDF.estado : ''}` : ''),
        dataEmissao: dadosPDF.dataEmissao || new Date().toLocaleDateString('pt-BR'),
        itens: dadosPDF.itens || []
      }

      let finalDados = { ...mapped, ...dadosPDF, logo: found || (dadosPDF && dadosPDF.logo) || null }
      // garantir que `unidade` use `referencia` quando não houver campo `unidade`
      try { finalDados.unidade = finalDados.unidade || finalDados.referencia || '' } catch (e) {}
      // debug: mostrar os campos principais que o PDF vai receber (como string para evitar referências circulares)
      try { console.log('VistoriaPDFWebButton: finalDados para PDF', JSON.stringify({ imovel: finalDados.imovel, unidade: finalDados.unidade, endereco: finalDados.endereco, local: finalDados.local, dataEmissao: finalDados.dataEmissao, logo: finalDados.logo, itensLength: (finalDados.itens || []).length })) } catch (e) { console.log('VistoriaPDFWebButton: finalDados para PDF (stringify falhou)') }

      // garantir polyfill do Buffer no ambiente do navegador (necessário para fetchImage do @react-pdf/renderer)
      try {
        // Import dinâmico do pacote 'buffer' (instalado) e expõe em `window.Buffer`
        const buf = await import('buffer')
        // eslint-disable-next-line no-undef
        if (typeof window !== 'undefined' && !window.Buffer) window.Buffer = buf.Buffer
      } catch (e) {
        console.warn('VistoriaPDFWebButton: não conseguiu aplicar polyfill de Buffer, imagens podem falhar', e)
      }

      // tentar normalizar/baixar imagens que não possuam extensão válida e convertê-las em data URLs
      try {
        const hasExt = (u) => !!(u && (u.match(/\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i) || u.startsWith('data:image')))
        async function toDataUrl(url) {
          try {
            const res = await fetch(url, { mode: 'cors' })
            const blob = await res.blob()
            return await new Promise((res2) => { const r = new FileReader(); r.onloadend = () => res2(r.result); r.readAsDataURL(blob) })
          } catch (e) { console.warn('VistoriaPDFWebButton: falha convertendo URL para dataURL', url, e); return null }
        }
        if (finalDados.itens && Array.isArray(finalDados.itens)) {
          for (let it of finalDados.itens) {
            if (!it.fotos || !Array.isArray(it.fotos)) continue
            const normalized = []
            for (const f of it.fotos) {
              if (!f) continue
              if (hasExt(f)) { normalized.push(f); continue }
              // tentar baixar e converter para data url
              try {
                // eslint-disable-next-line no-await-in-loop
                const data = await toDataUrl(f)
                if (data) normalized.push(data)
              } catch (e) { /* ignore */ }
            }
            it.fotos = normalized
          }
        }
      } catch (e) {
        console.warn('VistoriaPDFWebButton: erro normalizando imagens', e)
      }

      const { pdf } = await import('@react-pdf/renderer')
      const mod = await import('./VistoriaPDF.jsx')
      const docEl = await mod.buildVistoriaPDF(React, finalDados)
      const blob = await pdf(docEl).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Relatorio_Vistoria_${(dadosPDF.imovel || 'vistoria').replace(/\s+/g,'_')}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 150)
    } catch (e) {
      console.error('Erro ao gerar PDF', e)
      setError('Erro ao gerar PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <button onClick={handleDownload} style={{ padding: 10, background: loading ? '#aaa' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }} disabled={loading}>
        {loading ? 'Gerando PDF...' : 'Gerar PDF'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 6, fontSize: 12 }}>{error}</div>}
    </div>
  )
}

export default VistoriaPDFWebButton
