import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function VistoriaList() {
  const [vistorias, setVistorias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        if (!import.meta.env.VITE_SUPABASE_URL) {
          // no env configured — show sample
          if (mounted) setVistorias([{
            id: '1',
            titulo: 'Vistoria de Entrada',
            data: '2026-02-06',
            status: 'Pendente'
          }])
          return
        }

        const { data, error } = await supabase
          .from('vistorias')
          .select('id, observacoes, data_vistoria, tipo_vistoria, status_aprovacao')

        if (error) throw error
        if (mounted) {
          setVistorias(data.map(d => ({ id: d.id, titulo: d.observacoes ? (d.observacoes.length > 60 ? d.observacoes.slice(0, 60) + '…' : d.observacoes) : (d.tipo_vistoria || 'Vistoria'), data: d.data_vistoria || '—', status: d.status_aprovacao || '—' })))
        }
      } catch (err) {
        try {
          console.error('Erro carregando vistorias', err, JSON.stringify(err, Object.getOwnPropertyNames(err)))
        } catch (e) {
          console.error('Erro carregando vistorias', err)
        }
        if (mounted) setVistorias([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  if (loading) return <div>Carregando vistorias...</div>
  if (!vistorias || vistorias.length === 0) return <div>Nenhuma vistoria encontrada.</div>

  return (
    <div>
      {vistorias.map(v => (
        <div key={v.id} className="card">
          <div className="card-row">
            <div className="card-content">
              <h3>{v.titulo}</h3>
              <p>Data: {v.data}</p>
              <p>Status: {v.status}</p>
            </div>
            <div className="card-actions">
              <Link to={`/vistorias/${v.id}`} className="icon-btn">✎</Link>
              <button className="icon-btn danger">🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
