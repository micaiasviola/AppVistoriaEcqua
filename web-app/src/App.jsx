import { Link, Route, Routes } from 'react-router-dom'
import logo from './components/logo.png'
import EmpreendimentoEdit from './pages/EmpreendimentoEdit'
import Empreendimentos from './pages/Empreendimentos'
import EmpreendimentoUnits from './pages/EmpreendimentoUnits'
import VistoriaDetail from './pages/VistoriaDetail'
import VistoriaList from './pages/VistoriaList'
import VistoriasByUnit from './pages/VistoriasByUnit'
import './styles.css'

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Link to="/" className="brand-link" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src={logo} alt="ECQUA" style={{ height: 36, marginRight: 10 }} />
            <span style={{ fontWeight: '700', fontSize: 18, letterSpacing: 1 }}>VISTORIAS</span>
          </Link>
        </div>
        <nav>
          <Link to="/">Empreendimentos</Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Empreendimentos />} />
          <Route path="/vistorias" element={<VistoriaList />} />
          <Route path="/vistorias/:id" element={<VistoriaDetail />} />
          <Route path="/empreendimentos" element={<Empreendimentos />} />
          <Route path="/empreendimentos/:id" element={<EmpreendimentoUnits />} />
          <Route path="/unidades/:unitId/vistorias" element={<VistoriasByUnit />} />
          <Route path="/empreendimentos/:id/editar" element={<EmpreendimentoEdit />} />
        </Routes>
      </main>
    </div>
  )
}
