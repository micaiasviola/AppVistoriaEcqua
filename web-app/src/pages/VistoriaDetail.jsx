import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { VistoriaPDFWebButton } from '../components/VistoriaPDFWebButton'
import { supabase } from '../lib/supabaseClient'
import { createRevistoriaNow, scheduleRevistoria } from '../lib/vistorias/revistoria'
import { prepararFotosParaUpload } from '../lib/vistorias/shared'

export default function VistoriaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState(null)
  const [items, setItems] = useState([])
  const [photos, setPhotos] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({ descricao: '', observacao_interna: '', status: '' })
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalItem, setModalItem] = useState(null)
  const [modalText, setModalText] = useState('')
  const [unitCode, setUnitCode] = useState(null)
  const [engenheiro, setEngenheiro] = useState(null)
  const [clienteNome, setClienteNome] = useState('')
  const [empreendimentoNome, setEmpreendimentoNome] = useState('')
  const [agendaVisible, setAgendaVisible] = useState(false)
  const [agendaDate, setAgendaDate] = useState('')
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoModalItem, setPhotoModalItem] = useState(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ descricao: '', observacao_interna: '', numero_item: '' })
  const [newItemFiles, setNewItemFiles] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [checklistOptions, setChecklistOptions] = useState([])
  const [selAmbiente, setSelAmbiente] = useState('')
  const [selCategoria, setSelCategoria] = useState('')
  const [selChecklistItem, setSelChecklistItem] = useState('')

  useEffect(() => {
    // carregar menus (ambientes) para o modal de adicionar
    let mounted = true
    let mounted2 = true

    async function loadMenus() {
      try {
        const { data: amb } = await supabase.from('ambientes').select('id, nome').order('nome')
        if (mounted2 && amb) setAmbientes(amb)
      } catch (e) { console.warn('Erro carregando ambientes', e) }
    }

    async function load() {
      setLoading(true)
      try {
        const { data: v } = await supabase.from('vistorias').select('*').eq('id', id).maybeSingle()
        if (!v) {
          if (mounted) setVistoria(null)
          return
        }
        if (mounted) setVistoria(v)

        // buscar engenheiro para mostrar nome/crea no PDF
        try {
          if (v?.engenheiro_id) {
            const { data: eng } = await supabase.from('engenheiros').select('nome, crea').eq('id', v.engenheiro_id).maybeSingle()
            if (mounted && eng) setEngenheiro(eng)
          }
        } catch (e) { console.warn('Erro buscando engenheiro', e) }

        // fetch unidade codigo + empreendimento
        try {
          const { data: un } = await supabase.from('unidades').select('codigo, empreendimento_id').eq('id', v.unidade_id).maybeSingle()
          if (un && un.codigo) setUnitCode(un.codigo)
          if (un && un.empreendimento_id) {
            try {
              const { data: emp } = await supabase.from('empreendimentos').select('cliente, nome').eq('id', un.empreendimento_id).maybeSingle()
              if (emp) {
                setClienteNome(emp.cliente || emp.nome || '')
                setEmpreendimentoNome(emp.nome || '')
              }
            } catch (e) { console.warn('Erro buscando empreendimento', e) }
          }
        } catch (e) {
          // ignore
        }

        // itens
        const { data: its } = await supabase.from('itens_vistoria').select('*').eq('vistoria_id', id).order('numero_item', { ascending: true })
        const itemList = its || []

        // carregar checklist descriptions
        const checklistIds = itemList.map(i => i.checklist_item_id).filter(Boolean)
        let checklistMap = {}
        if (checklistIds.length > 0) {
          const { data: cl } = await supabase.from('checklist_itens').select('id, descricao, categoria').in('id', checklistIds)
          checklistMap = (cl || []).reduce((m, c) => { m[c.id] = c; return m }, {})
        }

        // fotos
        const itemIds = itemList.map(i => i.id)
        const map = {}
        if (itemIds.length > 0) {
          const { data: pf } = await supabase.from('fotos_vistoria').select('id, item_id, storage_path, tipo').in('item_id', itemIds)
          for (const f of (pf || [])) {
            try {
              const res = supabase.storage.from('vistoria-fotos').getPublicUrl(f.storage_path)
              const url = (res && (res.data?.publicUrl || res.publicURL || res.data?.publicURL)) || ''
              map[f.item_id] = map[f.item_id] || []
              map[f.item_id].push({ id: f.id, storage_path: f.storage_path, tipo: f.tipo, url })
            } catch (e) { console.warn('Erro obtendo publicUrl', e) }
          }
        }

        // Se for revistoria, buscar itens da vistoria pai para permitir histórico
        let parentItemsMap = {}
        if (v?.vistoria_pai_id) {
          try {
            const { data: parentItems } = await supabase.from('itens_vistoria').select('id, descricao_defeito, observacao_interna, numero_item').eq('vistoria_id', v.vistoria_pai_id)
            if (parentItems && Array.isArray(parentItems)) parentItemsMap = (parentItems || []).reduce((m, it) => { m[it.id] = it; return m }, {})
          } catch (e) { console.warn('Erro buscando itens da vistoria pai', e) }
        }

        const itensFormatados = itemList.map(i => ({
          id: i.id,
          numero_item: i.numero_item,
          checklist_item_id: i.checklist_item_id || null,
          ambiente_id: i.ambiente_id || null,
          item: checklistMap[i.checklist_item_id]?.descricao || '',
          descricao_defeito: i.descricao_defeito || i.descricao || '',
          descricao: i.descricao_defeito || i.descricao || '',
          observacao_interna: i.observacao_interna || '',
          status: i.status,
          uris: map[i.id] || [],
          item_origem_id: i.item_origem_id || null,
          item_origem_data: (i.item_origem_id && parentItemsMap[i.item_origem_id]) ? parentItemsMap[i.item_origem_id] : null
        }))

        if (mounted) {
          setItems(itensFormatados)
          setPhotos(map)
        }
      } catch (err) {
        console.error('Erro carregando vistoria', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    // executar carregamentos
    loadMenus()
    load()

    return () => { mounted2 = false; mounted = false }
  }, [id])

      // quando ambiente selecionado, buscar categorias (disciplinas)
      useEffect(() => {
        let mounted = true
        async function loadCategorias() {
          if (!selAmbiente) { setCategorias([]); return }
          try {
            const { data } = await supabase.from('checklist_itens').select('categoria').eq('ambiente_id', selAmbiente)
            if (!data) { setCategorias([]); return }
            const uniques = Array.from(new Set(data.map(d => d.categoria).filter(Boolean)))
            if (mounted) setCategorias(uniques)
          } catch (e) { console.error('Erro carregando categorias', e) }
        }
        loadCategorias()
        return () => { mounted = false }
      }, [selAmbiente])

      // quando categoria selecionada, buscar checklist items
      useEffect(() => {
        let mounted = true
        async function loadChecklist() {
          if (!selAmbiente || !selCategoria) { setChecklistOptions([]); return }
          try {
            const { data } = await supabase.from('checklist_itens').select('id, descricao').eq('ambiente_id', selAmbiente).eq('categoria', selCategoria).order('descricao', { ascending: true })
            if (mounted) setChecklistOptions(data || [])
          } catch (e) { console.error('Erro carregando checklist', e) }
        }
        loadChecklist()
        return () => { mounted = false }
      }, [selAmbiente, selCategoria])

    // quando item do checklist selecionado, popular descrição do novo item (se vazio)
    useEffect(() => {
      if (!selChecklistItem) return
      const found = checklistOptions.find(c => String(c.id) === String(selChecklistItem))
      if (found && (!newItemForm.descricao || newItemForm.descricao.trim() === '')) {
        setNewItemForm(prev => ({ ...prev, descricao: found.descricao }))
      }
    }, [selChecklistItem])

  function startEdit(item) {
    setEditingItem(item)
    setForm({ descricao: item.descricao || '', observacao_interna: item.observacao_interna || '', status: item.status || '' })
    setEditModalOpen(true)
  }

  async function saveItem(e) {
    e.preventDefault()
    try {
      if (!editingItem) return
      const payload = { descricao_defeito: form.descricao, observacao_interna: form.observacao_interna }
      // only include status when it's a non-empty value to avoid sending invalid empty strings
      if (form.status && String(form.status).trim() !== '') payload.status = form.status

      const { data, error } = await supabase.from('itens_vistoria').update(payload).eq('id', editingItem.id).select().maybeSingle()
      if (error) throw error
      setItems(prev => prev.map(p => p.id === editingItem.id ? { ...p, descricao: payload.descricao_defeito || p.descricao, descricao_defeito: payload.descricao_defeito || p.descricao_defeito, observacao_interna: payload.observacao_interna, status: payload.status || p.status } : p))
      setEditingItem(null)
    } catch (err) {
      console.error('Erro salvando item', err)
      try { console.error('Detalhes erro:', JSON.stringify(err)) } catch(e) {}
      alert('Erro ao salvar item')
    }
  }

  async function toggleStatus(item, newStatus) {
    try {
      const { error } = await supabase.from('itens_vistoria').update({ status: newStatus }).eq('id', item.id)
      if (error) throw error
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus } : p))
    } catch (err) {
      console.error('Erro atualizando status', err)
      alert('Erro ao atualizar status')
    }
  }

  async function criarRevistoria() {
    const ok = window.confirm('Criar revistoria copiando apenas itens reprovados?')
    if (!ok) return
    try {
      const newV = await createRevistoriaNow(id)
      alert('Revistoria criada com sucesso')
      navigate(`/vistorias/${newV.id}`)
    } catch (err) {
      console.error('Erro criando revistoria', err)
      alert('Erro ao criar revistoria')
    }
  }

  async function excluirVistoria() {
    const ok = window.confirm('Excluir esta vistoria e dados relacionados?')
    if (!ok) return
    try {
      // buscar itens
      const { data: its } = await supabase.from('itens_vistoria').select('id').eq('vistoria_id', id)
      const itemIds = (its || []).map(i => i.id)
      if (itemIds.length > 0) await supabase.from('fotos_vistoria').delete().in('item_id', itemIds)
      if (itemIds.length > 0) await supabase.from('itens_vistoria').delete().in('id', itemIds)
      const { error } = await supabase.from('vistorias').delete().eq('id', id)
      if (error) throw error
      alert('Vistoria excluída')
      navigate('/vistorias')
    } catch (err) {
      console.error('Erro excluindo vistoria', err)
      alert('Erro ao excluir vistoria')
    }
  }

  async function agendarRevistoria() {
    try {
      const nova = await scheduleRevistoria(id, agendaDate)
      setAgendaVisible(false)
      setAgendaDate('')
      navigate(`/vistorias/${nova.id}`)
    } catch (err) {
      console.error('Erro agendando revistoria', err)
      alert(err?.message || 'Erro ao agendar revistoria')
    }
  }

  if (loading) return <div>Carregando...</div>
  if (!vistoria) return <div>Vistoria não encontrada.</div>

  const readableTitle = vistoria.observacoes && vistoria.observacoes.length > 0
    ? (vistoria.observacoes.length > 80 ? vistoria.observacoes.slice(0, 80) + '…' : vistoria.observacoes)
    : (vistoria.tipo_vistoria ? vistoria.tipo_vistoria : `Vistoria`)

  function tipoLabel(t) {
    if (t === 'construtora') return 'Vistoria Construtora'
    if (t === 'entrada') return 'Vistoria de Entrada'
    if (t === 'revistoria') return 'Revistoria'
    if (t === 'entrega') return 'Vistoria de Entrega'
    return 'Vistoria'
  }

  async function generatePDF() {
    try {
      const htmlItems = items.map(it => {
        const title = it.item || it.descricao_defeito || it.descricao || ''
        const obs = it.observacao_interna || it.descricao || ''
        const status = it.status || ''
        const images = (photos[it.id] || []).map(u => `<img src="${u}" style="max-width:200px;margin:6px 0;display:block"/>`).join('')
        return `<div style="margin-bottom:18px"><h3 style="margin:0 0 6px">${title}</h3><div>Status: ${status}</div><div>Observação: ${obs}</div>${images}</div>`
      }).join('\n')

      const win = window.open('', '_blank')
      const html = `<!doctype html><html><head><title>Relatório - ${readableTitle}</title><meta charset="utf-8"><style>body{font-family:Inter,Arial;margin:24px;color:#111}h1{font-size:20px}h3{font-size:16px;margin-bottom:4px}</style></head><body><h1>Relatório: ${readableTitle}</h1><p>Unidade: ${unitCode || vistoria.unidade_id} — Tipo: ${vistoria.tipo_vistoria || ''} — Data: ${vistoria.data_vistoria || ''}</p><hr/>${htmlItems}</body></html>`
      win.document.open()
      win.document.write(html)
      win.document.close()
      // give browser a moment to load images then print
      setTimeout(() => { try { win.print() } catch (e) { console.warn(e) } }, 600)
    } catch (err) {
      console.error('Erro gerando PDF', err)
      alert('Erro ao gerar PDF')
    }
  }

  function montarDadosPDF() {
    const enderecoParts = [vistoria.endereco, vistoria.bairro, vistoria.cidade, vistoria.estado, vistoria.cep].filter(Boolean)
    const enderecoFinal = enderecoParts.length ? enderecoParts.join(', ') : (vistoria.endereco || '')

    function normalizePhoto(p) {
      try {
        if (!p) return null
        let url = null
        if (typeof p === 'string') url = p
        else if (p.url && typeof p.url === 'string') url = p.url
        else if (p.storage_path && typeof p.storage_path === 'string') {
          try {
            const res = supabase.storage.from('vistoria-fotos').getPublicUrl(p.storage_path)
            url = (res && (res.data?.publicUrl || res.publicURL || res.data?.publicURL)) || null
          } catch (e) { /* ignore */ }
        }
        if (!url) return null
        // alguns urls vêm concatenados com '.blob:http://...' ou '0.blob:http://...'
        // extrair a parte http(s) se existir
        const blobMarker = url.indexOf('blob:')
        if (blobMarker !== -1) {
          const httpIdx = url.indexOf('http', blobMarker)
          if (httpIdx !== -1) url = url.slice(httpIdx)
        }
        const blobDot = url.indexOf('.blob:')
        if (blobDot !== -1) {
          const httpIdx2 = url.indexOf('http', blobDot)
          if (httpIdx2 !== -1) url = url.slice(httpIdx2)
        }
        const cleaned = (typeof url === 'string' ? url.trim() : null) || null
        if (!cleaned) return null
        if (cleaned.includes('localhost') || cleaned.startsWith('file:')) return null
        return cleaned
      } catch (e) { return null }
    }

    const extOk = (u) => !!(u && (u.match(/\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i) || u.startsWith('data:image')) )

    const dados = {
      logo: '/assets/images/logo.png',
      imovel: empreendimentoNome || clienteNome || readableTitle,
      endereco: enderecoFinal,
      tipo_vistoria: vistoria.tipo_vistoria || '',
      dataEmissao: new Date().toLocaleDateString(),
      cliente: clienteNome || vistoria.cliente || vistoria.empreendimento || '',
      referencia: unitCode || vistoria.unidade_id || (vistoria.unidade && vistoria.unidade.codigo) || '',
      emitidoPor: engenheiro?.nome || vistoria.engenheiro_id || '',
      registro: engenheiro?.crea || '',
      data: vistoria.data_vistoria || '' ,
      local: vistoria.localidade || vistoria.cidade || '',
      itens: items.map(it => ({
        numero_item: it.numero_item || null,
        fotos: (photos[it.id] || []).map(normalizePhoto).filter(u => !!u && extOk(u)),
        local: it.item || it.local || '',
        // original (da vistoria pai) quando aplicável
        descricao_original: it.item_origem_data ? (it.item_origem_data.descricao_defeito || '') : '',
        obs_original: it.item_origem_data ? (it.item_origem_data.observacao_interna || '') : '',
        // dados da vistoria atual (revistoria)
        data_revistoria: vistoria.data_vistoria || '',
        descricao_revistoria: it.descricao || it.descricao_defeito || '',
        obs_revistoria: it.observacao_interna || it.obs || '',
        status: it.status || '',
        dataStatus: it.data_status || ''
      }))
    }

    try {
      console.log('montarDadosPDF: fonteVars', JSON.stringify({ vistoria: vistoria || {}, unitCode: unitCode || '', clienteNome: clienteNome || '', engenheiro: engenheiro || {}, itemsLength: items.length }))
      try {
        const sample = Object.keys(photos).slice(0,5).reduce((acc,k)=>{acc[k]= (photos[k]||[]).slice(0,3).map(p=> (typeof p === 'string' ? p : (p.url || p.storage_path || null))); return acc},{})
        console.log('montarDadosPDF: photos sample', JSON.stringify(sample))
      } catch(e) { console.warn('montarDadosPDF: erro montando sample photos', e) }
      console.log('montarDadosPDF: dados gerados', JSON.stringify(dados))
    } catch(e) { console.warn('montarDadosPDF: erro no log', e) }
    return dados
  }

  return (
    <div>
      <div className="toolbar">
          <button className="link back-btn" onClick={() => navigate(-1)}>← Voltar</button>
          <div>
            <h2 style={{ margin: 0 }}>{tipoLabel(vistoria.tipo_vistoria)}</h2>
            <p className="muted">Unidade: {unitCode || (vistoria.unidade_id || '').slice(0,8)} • Tipo: {vistoria.tipo_vistoria || '—'} • Data: {vistoria.data_vistoria || '—'}</p>
          </div>
        </div>
        <div>
          <button className="btn-primary" onClick={() => setAddModalOpen(true)}>Adicionar Apontamento</button>
          <button className="btn-primary" style={{ marginLeft: 8 }} onClick={() => setAgendaVisible(true)}>Agendar Revistoria</button>
          <button className="btn-primary" style={{ marginLeft: 8 }} onClick={criarRevistoria}>Criar Revistoria</button>
          <div style={{ display: 'inline-block', marginLeft: 8 }}>
            <VistoriaPDFWebButton dadosPDF={montarDadosPDF()} />
          </div>
          <button style={{ marginLeft: 8 }} onClick={excluirVistoria} className="icon-btn danger">Excluir</button>
        </div>

      <div style={{ marginBottom: 12 }}>
        <h3>Itens</h3>
        {items.length === 0 ? <div>Nenhum item</div> : (
          <div className="cards-grid">
            {items.map(it => (
              <div key={it.id} className="card">
                <div className="card-row">
                  <div className="card-content">
                    <h3 style={{ marginBottom: 6 }}>{(it.numero_item ? (it.numero_item + '. ') : '') + (it.item || '—')}</h3>
                    <p style={{ margin: '6px 0', color: '#374151' }}>{it.observacao_interna ? (it.observacao_interna.length > 140 ? it.observacao_interna.slice(0,140)+'…' : it.observacao_interna) : (it.descricao ? (it.descricao.length > 140 ? it.descricao.slice(0,140)+'…' : it.descricao) : '—')}</p>
                    <p style={{ margin: '6px 0' }}>Status: {it.status || 'pendente'}</p>
                    <p style={{ margin: '6px 0', color: '#2563eb', cursor: 'pointer' }} onClick={() => {
                      setModalItem(it)
                      setModalText(it.observacao_interna || '')
                      setModalOpen(true)
                    }}>Observação: {it.observacao_interna ? (it.observacao_interna.length > 80 ? it.observacao_interna.slice(0,80)+'…' : it.observacao_interna) : '(adicionar)'} (editar)</p>
                    <div style={{ marginTop: 8 }}>
                        {photos[it.id] && photos[it.id].map((u, idx) => <img key={u.id || idx} src={u.url} alt="foto" className="item-photo" />)}
                    </div>
                  </div>
                  <div className="card-actions">
                    <button onClick={() => startEdit(it)} className="icon-btn">✎</button>
                      <button onClick={() => { setPhotoModalItem(it); setPhotoModalOpen(true) }} className="icon-btn">🖼️</button>
                    <button onClick={() => toggleStatus(it, 'aprovado')} className="icon-btn">✅</button>
                    <button onClick={() => toggleStatus(it, 'reprovado')} className="icon-btn danger">❌</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editModalOpen && editingItem && (
        <div className="modal-overlay" onClick={() => { setEditModalOpen(false); setEditingItem(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, width: '95%', padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Editar Item</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  <label style={{ fontSize: 13, color: '#374151' }}>Descrição (opcional)</label>
                  <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e6eef6', fontSize: 14 }} />

                  <label style={{ fontSize: 13, color: '#374151' }}>Observação</label>
                  <textarea rows={5} value={form.observacao_interna} onChange={e => setForm({ ...form, observacao_interna: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e6eef6', resize: 'vertical', fontSize: 14 }} />

              <label style={{ fontSize: 13, color: '#374151' }}>Status</label>
              <div>
                <select value={form.status || 'pendente'} onChange={e => setForm({ ...form, status: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6eef6' }}>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                <button className="btn-primary" onClick={async (e) => { e.preventDefault(); await saveItem(e); setEditModalOpen(false); setEditingItem(null); }}>Salvar</button>
                <button className="btn-secondary" onClick={(e) => { e.preventDefault(); setEditModalOpen(false); setEditingItem(null) }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="modal-overlay" onClick={() => { setAddModalOpen(false); setNewItemForm({ descricao: '', observacao_interna: '', numero_item: '' }) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, width: '95%', padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Adicionar Apontamento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <label style={{ fontSize: 13, color: '#374151' }}>Ambiente</label>
                    <select value={selAmbiente} onChange={e => { setSelAmbiente(e.target.value); setSelCategoria(''); setChecklistOptions([]); setSelChecklistItem('') }} style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef6' }}>
                      <option value="">Selecione ambiente</option>
                      {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>

                    <label style={{ fontSize: 13, color: '#374151' }}>Disciplina</label>
                    <select value={selCategoria} onChange={e => setSelCategoria(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef6' }}>
                      <option value="">Selecione disciplina</option>
                      {categorias.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                    </select>

                    <label style={{ fontSize: 13, color: '#374151' }}>Item (checklist)</label>
                    <select value={selChecklistItem} onChange={e => setSelChecklistItem(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef6' }}>
                      <option value="">Selecione item</option>
                      {checklistOptions.map(it => <option key={it.id} value={it.id}>{it.descricao}</option>)}
                    </select>

                    <label style={{ fontSize: 13, color: '#374151' }}>Descrição</label>
                    <input value={newItemForm.descricao} onChange={e => setNewItemForm({ ...newItemForm, descricao: e.target.value })} placeholder="Descrição do apontamento (ex.: Fissura, Revestimento)" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e6eef6', fontSize: 14 }} />

                    <label style={{ fontSize: 13, color: '#374151' }}>Observação</label>
                    <textarea rows={4} value={newItemForm.observacao_interna} onChange={e => setNewItemForm({ ...newItemForm, observacao_interna: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e6eef6', resize: 'vertical', fontSize: 14 }} />

                    <label style={{ fontSize: 13, color: '#374151' }}>Fotos (opcional)</label>
                    <input type="file" multiple accept="image/*" onChange={e => setNewItemFiles(Array.from(e.target.files || []))} />

              <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                <button className="btn-primary" onClick={async (e) => {
                  e.preventDefault()
                  try {
                    // calcular próximo número automaticamente
                    const maxNum = items.reduce((acc, it) => {
                      const n = Number(it.numero_item) || 0
                      return n > acc ? n : acc
                    }, 0)
                    const nextNum = maxNum + 1

                    const payload = {
                      vistoria_id: id,
                      checklist_item_id: selChecklistItem ? Number(selChecklistItem) : null,
                      ambiente_id: selAmbiente ? Number(selAmbiente) : null,
                      descricao_defeito: newItemForm.descricao ? newItemForm.descricao : (checklistDesc || null),
                      observacao_interna: newItemForm.observacao_interna || null,
                      numero_item: nextNum,
                      status: 'pendente'
                    }

                    const { data: created, error } = await supabase.from('itens_vistoria').insert([payload]).select().maybeSingle()
                    if (error || !created) throw error || new Error('Erro criando item')

                    // upload de fotos (se houver)
                    const uploaded = []
                    if (newItemFiles && newItemFiles.length) {
                      try {
                        const { urls, paths } = await prepararFotosParaUpload(newItemFiles, String(vistoria.unidade_id || ''), String(created.id))
                        if (paths && paths.length) {
                          // inserir registros de foto no banco
                          const fotosPayload = paths.map(p => ({ item_id: created.id, storage_path: p, tipo: 'defeito' }))
                          const { data: insList, error: insErr } = await supabase.from('fotos_vistoria').insert(fotosPayload).select()
                          if (insErr) console.error('Insert foto records', insErr)
                          const resUrls = urls || []
                          for (let idx = 0; idx < (insList || []).length; idx++) {
                            const ins = insList[idx]
                            uploaded.push({ id: ins.id, storage_path: ins.storage_path, tipo: ins.tipo, url: resUrls[idx] || '' })
                          }
                        }
                      } catch (e) { console.error('Erro upload fotos (shared)', e) }
                    }

                    const checklistDesc = checklistOptions.find(c => String(c.id) === String(selChecklistItem))?.descricao || null
                    const itemObj = {
                      id: created.id,
                      numero_item: created.numero_item || payload.numero_item,
                      checklist_item_id: created.checklist_item_id || payload.checklist_item_id || null,
                      ambiente_id: created.ambiente_id || payload.ambiente_id || null,
                      item: checklistDesc || created.item || '',
                      descricao: created.descricao_defeito || newItemForm.descricao || checklistDesc || '',
                      descricao_defeito: created.descricao_defeito || newItemForm.descricao || checklistDesc || '',
                      observacao_interna: created.observacao_interna || newItemForm.observacao_interna || '',
                      status: created.status || 'pendente',
                      uris: uploaded.map(u => ({ id: u.id, storage_path: u.storage_path, tipo: u.tipo, url: u.url }))
                    }

                    setItems(prev => [...prev, itemObj].sort((a,b)=> (Number(a.numero_item)||0)-(Number(b.numero_item)||0)))
                    if (uploaded.length) setPhotos(prev => ({ ...prev, [created.id]: [...(prev[created.id]||[]), ...uploaded] }))

                    setAddModalOpen(false)
                    setNewItemForm({ descricao: '', observacao_interna: '', numero_item: '' })
                    setSelAmbiente('')
                    setSelCategoria('')
                    setSelChecklistItem('')
                    setNewItemFiles([])
                  } catch (err) {
                    console.error('Erro criando item', err)
                    alert('Erro ao criar apontamento')
                  }
                }}>Salvar</button>
                <button className="btn-secondary" onClick={(e) => { e.preventDefault(); setAddModalOpen(false); setNewItemForm({ descricao: '', observacao_interna: '', numero_item: '' }) }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && modalItem && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar observação</h3>
            <p className="muted">Item: {modalItem.item || modalItem.descricao_defeito || modalItem.descricao || modalItem.id}</p>
            <textarea value={modalText} onChange={e => setModalText(e.target.value)} rows={6} />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={async (ev) => {
                ev.preventDefault()
                try {
                  const { error } = await supabase.from('itens_vistoria').update({ observacao_interna: modalText }).eq('id', modalItem.id)
                  if (error) throw error
                  setItems(prev => prev.map(p => p.id === modalItem.id ? { ...p, observacao_interna: modalText } : p))
                  setModalOpen(false)
                  setModalItem(null)
                } catch (err) {
                  console.error('Erro salvando observação', err)
                  alert('Erro ao salvar observação')
                }
              }}>Salvar</button>
              <button className="btn-secondary" onClick={(e) => { e.preventDefault(); setModalOpen(false); setModalItem(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {agendaVisible && (
        <div className="modal-overlay" onClick={() => setAgendaVisible(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Agendar Revistoria</h3>
            <p className="muted">Informe a data</p>
            <input type="date" value={agendaDate} onChange={e => setAgendaDate(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e6eef6', width: '100%' }} />
            {agendaDate ? <div style={{ marginTop: 8, color: '#444' }}>Data selecionada: {new Date(agendaDate).toLocaleDateString('pt-BR')}</div> : null}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={async (e) => { e.preventDefault(); await agendarRevistoria() }}>Agendar</button>
              <button className="btn-secondary" onClick={(e) => { e.preventDefault(); setAgendaVisible(false) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {photoModalOpen && photoModalItem && (
        <div className="modal-overlay" onClick={() => { setPhotoModalOpen(false); setPhotoModalItem(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 820, width: '96%' }}>
            <h3 style={{ marginTop: 0 }}>Fotos — Item {photoModalItem.numero_item ? (photoModalItem.numero_item + '. ') : ''}{photoModalItem.item || photoModalItem.descricao}</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {(photos[photoModalItem.id] || []).map((p) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <img src={p.url} alt="foto" style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #eef3f7' }} />
                  <button style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }} onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm('Excluir foto?')) return
                    try {
                      // remove record
                      const { error } = await supabase.from('fotos_vistoria').delete().eq('id', p.id)
                      if (error) throw error
                      // remove storage file
                      try { await supabase.storage.from('vistoria-fotos').remove([p.storage_path]) } catch (e) { console.warn('Erro removendo storage', e) }
                      setPhotos(prev => ({ ...prev, [photoModalItem.id]: (prev[photoModalItem.id] || []).filter(x => x.id !== p.id) }))
                    } catch (err) { console.error('Erro excluindo foto', err); alert('Erro ao excluir foto') }
                  }}>Excluir</button>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Adicionar fotos</label>
              <input type="file" multiple accept="image/*" onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                setUploadingPhotos(true)
                try {
                  const { urls, paths } = await prepararFotosParaUpload(files, String(vistoria.unidade_id || ''), String(photoModalItem.id))
                  if (paths && paths.length) {
                    const fotosPayload = paths.map(p => ({ item_id: photoModalItem.id, storage_path: p, tipo: 'defeito' }))
                    const { data: insList, error: insErr } = await supabase.from('fotos_vistoria').insert(fotosPayload).select()
                    if (insErr) console.error('Insert foto records', insErr)
                    const resUrls = urls || []
                    const toAdd = []
                    for (let idx = 0; idx < (insList || []).length; idx++) {
                      const ins = insList[idx]
                      toAdd.push({ id: ins.id, storage_path: ins.storage_path, tipo: ins.tipo, url: resUrls[idx] || '' })
                    }
                    if (toAdd.length) setPhotos(prev => ({ ...prev, [photoModalItem.id]: [...(prev[photoModalItem.id] || []), ...toAdd] }))
                  }
                } catch (e) { console.error('Erro upload fotos (shared)', e) }
                finally { setUploadingPhotos(false); e.target.value = '' }
              }} />
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => { setPhotoModalOpen(false); setPhotoModalItem(null) }}>{uploadingPhotos ? 'Enviando...' : 'Fechar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
