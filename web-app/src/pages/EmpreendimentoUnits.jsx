import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function EmpreendimentoUnits() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ codigo: '', andar: '' })

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('unidades').select('id, codigo, andar').eq('empreendimento_id', id).order('codigo', { ascending: true })
        if (error) throw error
        if (mounted) setUnits(data || [])
      } catch (err) {
        console.error('Erro carregando unidades', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  function openNew() {
    setEditing(null)
    setForm({ codigo: '', andar: '' })
    setShowForm(true)
  }

  function openEdit(u) {
    setEditing(u)
    setForm({ codigo: u.codigo || '', andar: u.andar || '' })
    setShowForm(true)
  }

  async function save(e) {
    e.preventDefault()
    try {
      if (editing) {
        const { error } = await supabase.from('unidades').update({ codigo: form.codigo, andar: form.andar }).eq('id', editing.id)
        if (error) throw error
        setUnits(prev => prev.map(p => p.id === editing.id ? { ...p, codigo: form.codigo, andar: form.andar } : p))
      } else {
        const payload = { codigo: form.codigo, andar: form.andar, empreendimento_id: id }
        const { data, error } = await supabase.from('unidades').insert(payload).select().single()
        if (error) throw error
        setUnits(prev => [data, ...prev])
      }
      setShowForm(false)
    } catch (err) {
      console.error('Erro salvando unidade', err)
      alert('Erro ao salvar unidade')
    }
  }

  async function handleDelete(unitId) {
    const ok = window.confirm('Confirma excluir esta unidade e todas as vistorias relacionadas?')
    if (!ok) return
    try {
      // deletar vistorias relacionadas cascade
      const { data: vists } = await supabase.from('vistorias').select('id').eq('unidade_id', unitId)
      const vistIds = (vists || []).map(v => v.id)
      if (vistIds.length > 0) {
        // delete fotos, itens, vistorias
        const { data: itens } = await supabase.from('itens_vistoria').select('id').in('vistoria_id', vistIds)
        const itemIds = (itens || []).map(i => i.id)
        if (itemIds.length > 0) await supabase.from('fotos_vistoria').delete().in('item_id', itemIds)
        if (vistIds.length > 0) await supabase.from('itens_vistoria').delete().in('vistoria_id', vistIds)
        await supabase.from('vistorias').delete().in('id', vistIds)
      }
      const { error } = await supabase.from('unidades').delete().eq('id', unitId)
      if (error) throw error
      setUnits(prev => prev.filter(u => u.id !== unitId))
    } catch (err) {
      console.error('Erro excluindo unidade', err)
      alert('Erro ao excluir unidade')
    }
  }

  if (loading) return <div>Carregando unidades...</div>

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Unidades</h2>
          <p className="muted">Unidades do empreendimento</p>
        </div>
        <div>
          <button className="btn-primary" onClick={openNew}>Nova Unidade</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/empreendimentos')}>Voltar</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} style={{ marginBottom: 12 }}>
          <label>Código</label>
          <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
          <label>Andar</label>
          <input value={form.andar} onChange={e => setForm({ ...form, andar: e.target.value })} />
          <div style={{ marginTop: 8 }}>
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: 8 }}>Cancelar</button>
          </div>
        </form>
      )}

      {units.length === 0 ? <div>Nenhuma unidade encontrada.</div> : (
        <div className="cards-grid">
          {units.map(u => (
            <div key={u.id} className="card">
              <div className="card-row">
                <div className="card-content" style={{ cursor: 'pointer' }} onClick={() => navigate(`/unidades/${u.id}/vistorias`)} title="Abrir vistorias">
                  <h3>{u.codigo || '—'}</h3>
                  <p>Andar: {u.andar || '—'}</p>
                </div>
                <div className="card-actions">
                  <button title="Editar" onClick={() => openEdit(u)} className="icon-btn">✎</button>
                  <button title="Excluir" onClick={() => handleDelete(u.id)} className="icon-btn danger">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
