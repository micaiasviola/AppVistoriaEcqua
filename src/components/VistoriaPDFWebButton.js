
// Exporta o botão apenas no web, e null no mobile

let VistoriaPDFWebButton = () => null;

if (typeof window !== 'undefined' && window.document) {
  VistoriaPDFWebButton = function VistoriaPDFWebButton({ dadosPDF }) {
    const handleDownload = async () => {
      // evita análise estática do bundler
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
    };

    return (
      <button onClick={handleDownload} style={{ padding: 12, background: '#007AFF', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12 }}>
        Gerar PDF
      </button>
    );
  };
}

export { VistoriaPDFWebButton };

