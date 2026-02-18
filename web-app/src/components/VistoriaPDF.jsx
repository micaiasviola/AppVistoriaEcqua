// Exporta uma função assíncrona que constrói o elemento Document do react-pdf em runtime.
async function buildVistoriaPDF(React, dados) {
  const pkg = await import('@react-pdf/renderer');
  const { Document, Page, Image, Link, StyleSheet, Text, View, Font } = pkg;

  try {
    if (Font && typeof Font.register === 'function') {
      Font.register({ family: 'Roboto', fonts: [
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff2' },
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9AMX6lJBP.woff2', fontWeight: 700 }
      ] });
    }
  } catch (e) {
    console.warn('VistoriaPDF: não foi possível registrar fontes remotas, usando fonte padrão', e);
  }

  const styles = StyleSheet.create({
    page: { padding: 24, fontFamily: 'Helvetica', fontSize: 12 },
    logo: { width: 200, height: 120, marginTop: 20, marginBottom: 8, alignSelf: 'center', objectFit: 'contain' },
    title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4, letterSpacing: 0.8 },
    subtitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 2, textTransform: 'uppercase' },
    unit: { fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' },
    address: { textAlign: 'center', fontSize: 10, marginBottom: 6, maxWidth: 480, lineHeight: 1.3, color: '#444' },
    topBar: { height: 8, backgroundColor: '#6b6b6b', marginBottom: 4 },
    midBar: { height: 6, backgroundColor: '#6b6b6b', marginTop: 4, marginBottom: 4 },
    rodape: { position: 'absolute', bottom: 24, right: 32, fontSize: 10, color: '#222' },
    capaDate: { position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    rodapeLink: { color: '#007AFF', textDecoration: 'underline' },
    cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    cabecalhoTable: { flexGrow: 1 },
    cabecalhoRow: { flexDirection: 'row', marginBottom: 2 },
    cabecalhoLabel: { width: 100, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },
    cabecalhoValue: { flexGrow: 1, fontSize: 11 },
    cabecalhoLogo: { width: 120, height: 90, marginLeft: 12, objectFit: 'contain' },
    bloco: { flexDirection: 'row', marginBottom: 12, gap: 12 },
    itemWrapper: { flexDirection: 'row', borderWidth: 2, borderColor: '#000', padding: 8, marginBottom: 18 },
    photoBox: { width: 160, borderWidth: 1, borderColor: '#000', padding: 6, justifyContent: 'flex-start', alignItems: 'center', marginRight: 12, backgroundColor: '#fff' },
    blocoFotos: { width: 160, flexDirection: 'column', gap: 8, alignItems: 'center' },
    blocoFoto: { width: 140, height: 100, objectFit: 'cover', marginBottom: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
    blocoTexto: { flex: 1 },
    textBox: { flex: 1, padding: 8 },
    blocoTitulo: { fontWeight: '700', textDecoration: 'underline', marginBottom: 6, fontSize: 14, letterSpacing: 0.5 },
    blocoBullet: { marginLeft: 6, marginBottom: 6, fontSize: 12 },
    blocoOriginal: { marginLeft: 6, marginBottom: 4, fontSize: 11, color: '#444' },
    blocoObs: { color: 'red', fontSize: 12, marginBottom: 6, fontWeight: '600' },
    blocoStatus: { color: 'green', fontWeight: '700', fontSize: 12, marginTop: 6 },
    blocoNumero: { fontWeight: '700', marginBottom: 6, fontSize: 12 },
  });

  // altura fixa reservada para o cabeçalho (ajuste aqui para padronizar)
  // reduzido para diminuir o espaço em branco entre cabeçalho e itens
  const HEADER_HEIGHT = 44

  // Constrói o Document usando createElement para evitar dependência de JSX transform
  const docChildren = [];

  // Preparar textos da capa
  const capaImovel = datosOrEmpty(dados.imovel).toString();
  const capaUnidade = datosOrEmpty(dados.referencia || dados.unidade).toString();
  const capaEndereco = datosOrEmpty(dados.endereco);
  const capaCliente = datosOrEmpty(dados.cliente);
  const capaLocal = datosOrEmpty(dados.local);
  const capaDataEmissao = datosOrEmpty(dados.dataEmissao);

  try { console.log('VistoriaPDF: capa vars', { capaImovel, capaUnidade, capaEndereco, capaLocal, capaDataEmissao, logo: datosOrEmpty(dados.logo) }) } catch (e) {}

  function logoCandidate(inputDados) {
    let s = datosOrEmpty(inputDados && inputDados.logo) || null;
    if (s) return s;
    try { return new URL('./logo.png', import.meta.url).href } catch (e) {}
    if (typeof window !== 'undefined') return `${window.location.origin}/assets/images/logo.png`;
    return null;
  }

  // Capa (primeira página) — grande logo centralizado, título, empreendimento, unidade, endereço e cliente
  // formatar data em pt-BR — dia + mês + ano (ex: 12 DE NOVEMBRO DE 2025)
  let capaDataFormatada = ''
  try {
    if (capaDataEmissao) {
      const d = new Date(capaDataEmissao)
      if (!isNaN(d.getTime())) {
        const opts = { day: '2-digit', month: 'long', year: 'numeric' }
        capaDataFormatada = d.toLocaleDateString('pt-BR', opts).toUpperCase()
      }
    }
  } catch (e) { capaDataFormatada = '' }

  docChildren.push(
    React.createElement(Page, { size: 'A4', style: styles.page, key: 'capa' },
      React.createElement(View, { style: { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' } },
        React.createElement(Image, { src: datosOrEmpty(dados.logo) || logoCandidate(dados), style: styles.logo }),
        React.createElement(Text, { style: styles.title }, 'RELATÓRIO DE VISTORIA'),
        capaImovel ? React.createElement(Text, { style: styles.subtitle }, capaImovel.toUpperCase()) : null,
        capaUnidade ? React.createElement(Text, { style: styles.unit }, String(capaUnidade).toUpperCase()) : null,
        capaEndereco ? React.createElement(Text, { style: styles.address }, capaEndereco) : null
      ),
      // rodapé da capa: cidade (fallback SÃO PAULO - SP) + mês e ano quando disponível
      React.createElement(Text, { style: styles.capaDate }, `${(capaLocal || 'SÃO PAULO - SP').toString().toUpperCase()}${capaDataFormatada ? ', ' + capaDataFormatada : ''}`)
    )
  );

  // Página de itens
  let itensChildren = [];
  try { console.log('VistoriaPDF: iniciando itensChildren', typeof itensChildren, Array.isArray(itensChildren)) } catch(e) {}

  // Se por algum motivo push não existir, substitui por array limpo (defensivo)
  if (!Array.isArray(itensChildren) || typeof itensChildren.push !== 'function') {
    try { console.warn('VistoriaPDF: itensChildren inválido — recriando como Array', itensChildren) } catch (e) {}
    itensChildren = [];
  }

  // Construir header fixo (será repetido em todas as páginas)
  // escolher logo: usar `dados.logo` se fornecido; senão tentar resolver a logo local
  let logoSrc = datosOrEmpty(dados.logo) || null
  if (!logoSrc) {
    try {
      // resolve logo colocada ao lado deste arquivo (VistoriaPDF.jsx)
      // bundlers modernos (Vite) transformarão isso para uma URL pública
      logoSrc = new URL('./logo.png', import.meta.url).href
    } catch (e) {
      // ignore
    }
  }
  if (!logoSrc && typeof window !== 'undefined') {
    logoSrc = `${window.location.origin}/assets/images/logo.png`
  }

  const headerFixed = [
    React.createElement(View, { style: styles.topBar, key: 'topbar', fixed: true }),
    React.createElement(View, { style: styles.cabecalho, key: 'cabecalho', fixed: true },
      React.createElement(View, { style: styles.cabecalhoTable },
        React.createElement(View, { style: styles.cabecalhoRow }, React.createElement(Text, { style: styles.cabecalhoLabel }, 'Cliente:'), React.createElement(Text, { style: styles.cabecalhoValue }, datosOrEmpty(dados.cliente))),
        React.createElement(View, { style: styles.cabecalhoRow }, React.createElement(Text, { style: styles.cabecalhoLabel }, 'Referência:'), React.createElement(Text, { style: styles.cabecalhoValue }, datosOrEmpty(dados.referencia))),
        React.createElement(View, { style: styles.cabecalhoRow }, React.createElement(Text, { style: styles.cabecalhoLabel }, 'Emitido por:'), React.createElement(Text, { style: styles.cabecalhoValue }, datosOrEmpty(dados.emitidoPor))),
        React.createElement(View, { style: styles.cabecalhoRow }, React.createElement(Text, { style: styles.cabecalhoLabel }, 'Registro:'), React.createElement(Text, { style: styles.cabecalhoValue }, datosOrEmpty(dados.registro))),
        React.createElement(View, { style: styles.cabecalhoRow }, React.createElement(Text, { style: styles.cabecalhoLabel }, 'Data:'), React.createElement(Text, { style: styles.cabecalhoValue }, datosOrEmpty(dados.data)))
      ),
      logoSrc ? React.createElement(Image, { src: logoSrc, style: styles.cabecalhoLogo }) : null
    ),
    React.createElement(View, { style: styles.midBar, key: 'midbar', fixed: true })
  ];

  // Itens — cada apontamento em seu container; incluir número
  (dados.itens || []).forEach((item, idx) => {
    const num = (item.numero_item || item.numero || (idx + 1));
    const numLabel = String(num).padStart(2, '0') + '.';
    itensChildren = Array.prototype.concat.call([], itensChildren,
      React.createElement(View, { style: styles.itemWrapper, key: `item-${idx}` },
        React.createElement(View, { style: styles.photoBox },
          (item.fotos && item.fotos.length) ? React.createElement(View, { style: styles.blocoFotos },
            ...(item.fotos || []).map((f, i) => React.createElement(Image, { key: `f-${i}`, src: f, style: styles.blocoFoto }))
          ) : React.createElement(View, { style: { width: 140, height: 100 } })
        ),
        React.createElement(View, { style: styles.textBox },
          React.createElement(Text, { style: styles.blocoNumero }, `${numLabel}`),
          React.createElement(Text, { style: styles.blocoTitulo }, `${(item.local || '').toUpperCase()}:`),
          // original (vistoria pai)
          item.descricao_original ? React.createElement(Text, { style: styles.blocoOriginal }, `• ${item.descricao_original}`) : null,
          item.obs_original ? React.createElement(Text, { style: styles.blocoOriginal }, `• ${item.obs_original}`) : null,
          // separar com data da revistoria + novos comentários
          (dados && String(dados.tipo_vistoria).toLowerCase() === 'revistoria' && item.data_revistoria)
            ? React.createElement(Text, { style: { fontSize: 10, marginTop: 4, marginBottom: 4, fontWeight: '700' } }, `REVISTORIA: ${item.data_revistoria}`)
            : null,
          item.descricao_revistoria ? React.createElement(Text, { style: styles.blocoBullet }, `• ${item.descricao_revistoria}`) : null,
          item.obs_revistoria ? React.createElement(Text, { style: styles.blocoObs }, `• ${item.obs_revistoria}`) : null,
          item.status ? React.createElement(Text, { style: styles.blocoStatus }, (item.dataStatus ? `${item.dataStatus} - ` : '') + item.status) : null
        )
      )
    );
  });

  // Colocar tudo em uma única página que permitirá overflow para múltiplas páginas,
  // com o cabeçalho fixo repetido em cada página.
  const bodyContainerStyle = { marginTop: HEADER_HEIGHT } // espaço reservado para o header fixo

  docChildren.push(
    React.createElement(Page, { size: 'A4', style: styles.page, key: 'itens' },
      // header fixo (repetido em todas as páginas)
      ...headerFixed,
      // corpo que flui entre páginas
      React.createElement(View, { style: bodyContainerStyle }, ...itensChildren),
      // rodapé fixo
      React.createElement(View, { style: styles.rodape, fixed: true }, React.createElement(Text, null, 'Desenvolvido por ECQUA Engenharia '), React.createElement(Link, { src: 'mailto:contato@ecqua.com.br', style: styles.rodapeLink }, 'contato@ecqua.com.br'))
    )
  );

  return React.createElement(Document, null, ...docChildren);
}

function datosOrEmpty(v) {
  try { return v || '' } catch(e) { return '' }
}

export { buildVistoriaPDF };

