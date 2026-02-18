import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function EmpreendimentoEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nome: '', endereco: '', cliente: '' })

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('empreendimentos').select('id, nome, endereco, cliente').eq('id', id).maybeSingle()
        if (error) throw error
        if (mounted && data) setForm({ nome: data.nome || '', endereco: data.endereco || '', cliente: data.cliente || '' })
      } catch (err) {
        console.error('Erro carregando empreendimento', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  async function handleSave(e) {
    e.preventDefault()
    try {
      const { error } = await supabase.from('empreendimentos').update(form).eq('id', id)
      if (error) throw error
      alert('Atualizado com sucesso')
      navigate('/empreendimentos')
    } catch (err) {
      console.error('Erro salvando', err)
      alert('Erro ao salvar. Veja console para detalhes.')
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 600 }}>
      <div>
        <label>Nome</label>
        <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
      </div>
      <div>
        <label>Endereço</label>
        <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
      </div>
      <div>
        <label>Cliente</label>
        <input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button type="submit">Salvar</button>
        <button type="button" onClick={() => navigate('/empreendimentos')} style={{ marginLeft: 8 }}>Cancelar</button>
      </div>
    </form>
  )
}
