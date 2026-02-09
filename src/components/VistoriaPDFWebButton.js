
// Exporta o botão apenas no web, e null no mobile

let VistoriaPDFWebButton = () => null;

if (typeof window !== 'undefined' && window.document) {
  const React = require('react');
  VistoriaPDFWebButton = function VistoriaPDFWebButton({ dadosPDF }) {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handleDownload = async () => {
      setLoading(true);
      setError(null);
      try {
        const pkg = '@' + 'react-pdf' + '/renderer';
        const { pdf } = require(pkg);
        const VistoriaPDF = require('./VistoriaPDF').VistoriaPDF;
        const blob = await pdf(<VistoriaPDF dados={dadosPDF} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_Vistoria_${dadosPDF.imovel || 'vistoria'}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (e) {
        setError('Erro ao gerar PDF');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={handleDownload}
          style={{ padding: 12, background: loading ? '#aaa' : '#007AFF', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading ? 'Gerando PDF...' : 'Gerar PDF'}
        </button>
        {error && <div style={{ color: 'red', marginTop: 6, fontSize: 12 }}>{error}</div>}
      </div>
    );
  };
}

export { VistoriaPDFWebButton };

