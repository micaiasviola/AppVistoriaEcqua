// Este componente só está disponível no web. Para evitar que Metro tente resolver
// a biblioteca react-pdf/renderer durante o bundle mobile, os imports são feitos
// dinamicamente em tempo de execução somente quando `window.document` está presente.

let VistoriaPDF = () => null;

if (typeof window !== 'undefined' && window.document) {
  const pkg = '@' + 'react-pdf' + '/renderer';
  const { Document, Font, Image, Link, Page, StyleSheet, Text, View } = require(pkg);

  // Tenta registrar fontes remotas, mas tolera falha (evita erro em web quando o host bloqueia)
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
    page: { padding: 32, fontFamily: 'Helvetica', fontSize: 12 },
    logo: { width: 80, margin: '0 auto', marginBottom: 12 },
    title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
    address: { textAlign: 'center', marginBottom: 8 },
    rodape: { position: 'absolute', bottom: 24, right: 32, fontSize: 10, color: '#222' },
    rodapeLink: { color: '#007AFF', textDecoration: 'underline' },
    cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cabecalhoTable: { flexGrow: 1 },
    cabecalhoRow: { flexDirection: 'row', marginBottom: 2 },
    cabecalhoLabel: { width: 80, fontWeight: 'bold' },
    cabecalhoValue: { flexGrow: 1 },
    cabecalhoLogo: { width: 60, height: 60, marginLeft: 12 },
    bloco: { flexDirection: 'row', marginBottom: 18, borderBottom: '1px solid #eee', paddingBottom: 8 },
    blocoFotos: { width: 120, marginRight: 16, flexDirection: 'column', gap: 4 },
    blocoFoto: { width: 110, height: 80, objectFit: 'cover', marginBottom: 4, border: '1px solid #ccc' },
    blocoTexto: { flex: 1 },
    blocoTitulo: { fontWeight: 'bold', textDecoration: 'underline', marginBottom: 2 },
    blocoBullet: { marginLeft: 8, marginBottom: 2 },
    blocoObs: { color: 'red', fontSize: 11, marginBottom: 2 },
    blocoStatus: { color: 'green', fontWeight: 'bold', fontSize: 11, marginTop: 2 },
  });

  VistoriaPDF = function VistoriaPDF({ dados }) {
    return (
      <Document>
        {/* CAPA */}
        <Page size="A4" style={styles.page}>
          <Image src={dados.logo} style={styles.logo} />
          <Text style={styles.title}>RELATÓRIO DE VISTORIA</Text>
          <Text style={styles.subtitle}>{dados.imovel}</Text>
          <Text style={styles.address}>{dados.endereco}</Text>
          <Text style={styles.rodape}>{dados.dataEmissao}</Text>
        </Page>
        {/* PÁGINA DE ITENS */}
        <Page size="A4" style={styles.page}>
          {/* Cabeçalho */}
          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoTable}>
              <View style={styles.cabecalhoRow}><Text style={styles.cabecalhoLabel}>Cliente:</Text><Text style={styles.cabecalhoValue}>{dados.cliente}</Text></View>
              <View style={styles.cabecalhoRow}><Text style={styles.cabecalhoLabel}>Referência:</Text><Text style={styles.cabecalhoValue}>{dados.referencia}</Text></View>
              <View style={styles.cabecalhoRow}><Text style={styles.cabecalhoLabel}>Emitido por:</Text><Text style={styles.cabecalhoValue}>{dados.emitidoPor}</Text></View>
              <View style={styles.cabecalhoRow}><Text style={styles.cabecalhoLabel}>Registro:</Text><Text style={styles.cabecalhoValue}>{dados.registro}</Text></View>
              <View style={styles.cabecalhoRow}><Text style={styles.cabecalhoLabel}>Data:</Text><Text style={styles.cabecalhoValue}>{dados.data}</Text></View>
            </View>
            <Image src={dados.logo} style={styles.cabecalhoLogo} />
          </View>
          {/* Blocos de itens */}
          {dados.itens.map((item, idx) => (
            <View style={styles.bloco} key={idx}>
              <View style={styles.blocoFotos}>
                {item.fotos.map((foto, i) => (
                  <Image key={i} src={foto} style={styles.blocoFoto} />
                ))}
              </View>
              <View style={styles.blocoTexto}>
                <Text style={styles.blocoTitulo}>{item.local}</Text>
                <Text style={styles.blocoBullet}>• {item.descricao}</Text>
                {item.obs && <Text style={styles.blocoObs}>{item.obs}</Text>}
                {item.status && <Text style={styles.blocoStatus}>{item.dataStatus ? `${item.dataStatus} - ` : ''}{item.status}</Text>}
              </View>
            </View>
          ))}
          <View style={styles.rodape} fixed>
            <Text>Desenvolvido por ECQUA Engenharia </Text>
            <Link src="mailto:contato@ecqua.com.br" style={styles.rodapeLink}>contato@ecqua.com.br</Link>
          </View>
        </Page>
      </Document>
    );
  };
}

export { VistoriaPDF };

