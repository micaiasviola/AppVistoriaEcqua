import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Empreendimentos() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('empreendimentos')
          .select('id, nome, endereco, cliente')
          .order('nome', { ascending: true })

        if (error) throw error
        if (mounted) setItems(data || [])
      } catch (err) {
        console.error('Erro carregando empreendimentos', err)
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  async function handleDelete(id) {
    const ok = window.confirm('Confirma excluir este empreendimento e todos os dados relacionados?')
    if (!ok) return

    try {
      // buscar unidades
      const { data: units } = await supabase.from('unidades').select('id').eq('empreendimento_id', id)
      const unitIds = (units || []).map(u => u.id)

      // buscar vistorias dessas unidades
      let vistIds = []
      if (unitIds.length > 0) {
        const { data: vists } = await supabase.from('vistorias').select('id').in('unidade_id', unitIds)
        vistIds = (vists || []).map(v => v.id)
      }

      // buscar itens das vistorias
      let itemIds = []
      if (vistIds.length > 0) {
        const { data: itens } = await supabase.from('itens_vistoria').select('id').in('vistoria_id', vistIds)
        itemIds = (itens || []).map(i => i.id)
      }

      // deletar fotos por item
      if (itemIds.length > 0) {
        await supabase.from('fotos_vistoria').delete().in('item_id', itemIds)
      }

      // deletar itens
      if (vistIds.length > 0) {
        await supabase.from('itens_vistoria').delete().in('vistoria_id', vistIds)
      }

      // deletar vistorias
      if (vistIds.length > 0) {
        await supabase.from('vistorias').delete().in('id', vistIds)
      }

      // deletar unidades
      if (unitIds.length > 0) {
        await supabase.from('unidades').delete().in('id', unitIds)
      }

      // deletar empreendimento
      const { error } = await supabase.from('empreendimentos').delete().eq('id', id)
      if (error) throw error

      // atualizar lista local
      setItems(prev => prev.filter(p => p.id !== id))
      alert('Empreendimento excluído com sucesso.')
    } catch (err) {
      console.error('Erro excluindo empreendimento', err)
      alert('Erro ao excluir. Veja console para detalhes.')
    }
  }

  const filtered = items.filter(i => (i.nome || '').toLowerCase().includes(query.toLowerCase()) || (i.cliente || '').toLowerCase().includes(query.toLowerCase()))

  if (loading) return <div>Carregando empreendimentos...</div>
  if (!items || items.length === 0) return <div>Nenhum empreendimento encontrado.</div>

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Empreendimentos</h2>
          <p className="muted">Lista de empreendimentos — gerencie, edite e exclua</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Buscar por nome ou cliente" value={query} onChange={e => setQuery(e.target.value)} />
          <button onClick={() => navigate('/empreendimentos/novo')} className="btn-primary">Novo</button>
        </div>
      </div>

      <div className="cards-grid">
        {filtered.map(e => (
          <div key={e.id} className="card">
            <div className="card-row">
              <div className="card-content" onClick={() => navigate(`/empreendimentos/${e.id}`)} style={{ cursor: 'pointer' }}>
                <h3>{e.nome}</h3>
                <p>{e.endereco}</p>
                <p>Cliente: {e.cliente}</p>
              </div>
              <div className="card-actions">
                <button title="Editar" onClick={() => navigate(`/empreendimentos/${e.id}/editar`)} className="icon-btn">✎</button>
                <button title="Excluir" onClick={() => handleDelete(e.id)} className="icon-btn danger">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
