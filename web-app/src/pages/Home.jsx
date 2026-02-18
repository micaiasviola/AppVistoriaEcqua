import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <h2>Empreendimentos</h2>
      <p>Versão web isolada — não altera mobile.</p>
      <ul>
        <li>
          <Link to="/vistorias">Vistoria de Entrada — Unidade 003</Link>
        </li>
      </ul>
    </div>
  )
}
