import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const TIPOS = [
  { key: 'all', label: 'Todas' },
  { key: 'construtora', label: 'Construtora' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'revistoria', label: 'Revistoria' },
  { key: 'entrega', label: 'Entrega' },
]

export default function VistoriasByUnit() {
  const { unitId } = useParams()
  const navigate = useNavigate()
  const [vistorias, setVistorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('all')
  const [unitCode, setUnitCode] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const query = supabase.from('vistorias').select('id, observacoes, data_vistoria, tipo_vistoria, status_aprovacao').eq('unidade_id', unitId)
        if (tipo !== 'all') query.eq('tipo_vistoria', tipo)
        const { data, error } = await query.order('data_vistoria', { ascending: false })
        if (error) throw error
        if (mounted) setVistorias((data || []).map(d => ({ id: d.id, titulo: d.observacoes ? (d.observacoes.length > 60 ? d.observacoes.slice(0,60) + '…' : d.observacoes) : (d.tipo_vistoria || 'Vistoria'), tipo: d.tipo_vistoria, status: d.status_aprovacao, data: d.data_vistoria })))
      } catch (err) {
        console.error('Erro carregando vistorias da unidade', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
      ;(async () => {
        try {
          const { data } = await supabase.from('unidades').select('codigo').eq('id', unitId).maybeSingle()
          if (data && data.codigo) setUnitCode(data.codigo)
        } catch (e) {
          // ignore
        }
      })()
    return () => { mounted = false }
  }, [unitId, tipo])

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2>Vistorias — Unidade {unitCode || unitId.slice(0,8)}</h2>
          <p className="muted">Filtrar por tipo</p>
        </div>
        <div>
          <button onClick={() => navigate(-1)}>Voltar</button>
        </div>
      </div>

      <div className="filters">
        {TIPOS.map(t => (
          <button key={t.key} onClick={() => setTipo(t.key)} className={tipo === t.key ? 'btn-primary' : 'filter-btn'}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div>Carregando vistorias...</div> : (
        vistorias.length === 0 ? <div>Nenhuma vistoria encontrada.</div> : (
          <div className="cards-grid">
            {vistorias.map(v => (
              <div key={v.id} className="card" style={{ padding: 20, borderRadius: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.06)', marginBottom: 16 }}>
                <div className="card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="card-content" style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/vistorias/${v.id}`)}>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{v.titulo || `Vistoria ${v.id}`}</h3>
                    <p style={{ margin: '8px 0 4px', color: '#6b7280', fontWeight: 600 }}>{v.tipo ? (String(v.tipo).charAt(0).toUpperCase() + String(v.tipo).slice(1)) : '—'}</p>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>{v.data ? `Aberta em: ${new Date(v.data).toLocaleDateString()}` : ''}</p>
                  </div>
                  <div className="card-actions" style={{ marginLeft: 16 }}>
                    <button onClick={() => navigate(`/vistorias/${v.id}`)} className="icon-btn" style={{ padding: '8px 12px' }}>Abrir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
