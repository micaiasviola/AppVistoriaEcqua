const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatItemNumber = (n) => String(n || '').padStart(2, '0');

export const buildReportHtml = ({
  header,
  itens,
  dataVistoria,
  tipoVistoria
}) => {
  const headerRows = [
    { label: 'CLIENTE', value: header.cliente },
    { label: 'REFERENCIA', value: header.referencia },
    { label: 'EMITIDO POR', value: header.emitidoPor },
    { label: 'REGISTRO', value: header.crea },
    { label: 'DATA', value: header.data }
  ];

  const logoHtml = header?.logoUrl
    ? `<img class="logo-img" src="${escapeHtml(header.logoUrl)}" />`
    : `<div class="logo">ecqua<small>ENGENHARIA</small></div>`;

  const itensOrdenados = [...(itens || [])].sort((a, b) => {
    const na = Number(a?.numero_item) || 0;
    const nb = Number(b?.numero_item) || 0;
    return na - nb;
  });

  const itensHtml = itensOrdenados.map((item) => {
    const fotosHtml = (item.uris || []).map((uri) => (
      `<img class="foto" src="${escapeHtml(uri)}" />`
    )).join('');

    const bullets = [
      `<li>${escapeHtml(item.descricao || '')}</li>`
    ];

    const resolucaoObs = item.resolucao_obs || item.resolucaoObs || '';

    if (tipoVistoria === 'revistoria' && item.status === 'resolvido') {
      bullets.push(
        `<li class="revistoria">${escapeHtml(dataVistoria)} - REVISTORIA: RESOLVIDO E APROVADO.</li>`
      );
      if (resolucaoObs) {
        bullets.push(`<li class="resolucao">OBS: ${escapeHtml(resolucaoObs)}</li>`);
      }
    }

    return `
      <div class="item">
        <div class="photos">${fotosHtml}</div>
        <div class="details">
          <div class="item-title">${formatItemNumber(item.numero_item)}. ${escapeHtml(item.item)}:</div>
          <ul class="item-list">
            ${bullets.join('')}
          </ul>
        </div>
      </div>
    `;
  }).join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .header-left { font-size: 12px; line-height: 1.4; }
        .row { display: flex; gap: 8px; }
        .label { font-weight: bold; width: 92px; }
        .divider { height: 3px; background: #222; margin: 10px 0 18px; }
        .logo { font-weight: bold; font-size: 20px; text-align: right; }
        .logo small { display: block; font-size: 10px; font-weight: normal; letter-spacing: 1px; }
        .logo-img { width: 120px; height: auto; display: block; }
        .item { display: flex; border: 1px solid #333; margin-bottom: 16px; }
        .photos { width: 40%; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
        .details { width: 60%; padding: 10px; }
        .foto { width: 100%; border: 1px solid #ccc; }
        .item-title { font-weight: bold; margin-bottom: 6px; }
        .item-list { margin: 0; padding-left: 16px; font-size: 12px; }
        .item-list li { margin-bottom: 6px; }
        .revistoria { color: #2e7d32; font-weight: bold; list-style-type: disc; }
        .resolucao { color: #2e7d32; list-style-type: disc; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          ${headerRows.map((r) => (
            `<div class="row"><div class="label">${r.label}:</div><div>${escapeHtml(r.value)}</div></div>`
          )).join('')}
        </div>
        ${logoHtml}
      </div>
      <div class="divider"></div>
      ${itensHtml}
    </body>
  </html>
  `;
};
