// Função serverless Vercel para integração com ZapSign
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { contrato, signatarios } = req.body;
    const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY;

    if (!contrato || !signatarios) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!ZAPSIGN_API_KEY) {
      return res.status(500).json({ error: 'API key não configurada' });
    }

    // Gerar HTML do contrato (simplificado)
    const htmlContrato = gerarHtmlContrato(contrato);

    // Converter HTML para PDF usando uma API externa (já que Vercel tem limitações)
    // Usando a biblioteca html-pdf do npm
    const pdf = require('html-pdf');

    // Gerar PDF em buffer
    const pdfBuffer = await new Promise((resolve, reject) => {
      pdf.create(htmlContrato, { format: 'A4' }).toBuffer(function(err, buffer) {
        if (err) reject(err);
        else resolve(buffer);
      });
    });

    // Converter buffer para base64
    const base64_pdf = pdfBuffer.toString('base64');

    // Criar documento no ZapSign
    const payload = {
      name: `CONT-${contrato.codigo} - ${contrato.cliente.razao}`,
      signers: signatarios.map(sig => ({
        name: sig.nome,
        email: sig.email,
        phone_number: sig.telefone || undefined
      })),
      files: [
        {
          name: `CONT-${contrato.codigo}.pdf`,
          base64_pdf: base64_pdf
        }
      ]
    };

    const response = await fetch('https://app.zapsign.com.br/api/v1/documents/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAPSIGN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erro ao criar documento no ZapSign',
        details: data
      });
    }

    // Retornar dados de sucesso
    return res.status(200).json({
      sucesso: true,
      documento_id: data.uuid,
      link_assinatura: data.link,
      status: data.status,
      criado_em: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na integração ZapSign:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      mensagem: error.message
    });
  }
}

function gerarHtmlContrato(contrato) {
  // Template simplificado do contrato em HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrato ${contrato.codigo}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .section { margin-bottom: 20px; }
        .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CONTRATO DE VEICULAÇÃO DE PUBLICIDADE</h1>
        <p><strong>Código:</strong> ${contrato.codigo}</p>
      </div>

      <div class="section">
        <h3>Dados do Cliente</h3>
        <p><strong>Razão Social:</strong> ${contrato.cliente.razao}</p>
        <p><strong>CNPJ/CPF:</strong> ${contrato.cliente.doc}</p>
        <p><strong>Contato:</strong> ${contrato.cliente.representante}</p>
        <p><strong>Email:</strong> ${contrato.cliente.email}</p>
        <p><strong>Telefone:</strong> ${contrato.cliente.telefone}</p>
      </div>

      <div class="section">
        <h3>Dados do Contrato</h3>
        <p><strong>Período:</strong> ${contrato.meses} meses</p>
        <p><strong>Valor Mensal:</strong> R$ ${(contrato.mensal || 0).toFixed(2)}</p>
        <p><strong>Valor Total:</strong> R$ ${(contrato.total || 0).toFixed(2)}</p>
        <p><strong>Início:</strong> ${contrato.inicio}</p>
        <p><strong>Término:</strong> ${contrato.fim}</p>
      </div>

      <div class="section">
        <h3>Itens Contratados</h3>
        <table>
          <tr>
            <th>Painel</th>
            <th>Tipo</th>
            <th>Valor</th>
          </tr>
          ${contrato.itens.map(item => `
            <tr>
              <td>${item.nome}</td>
              <td>${item.tipo}</td>
              <td>R$ ${(item.valor || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="section" style="margin-top: 60px;">
        <p><strong>Assinado digitalmente via ZapSign</strong></p>
        <p><em>Este contrato foi assinado digitalmente e tem validade legal.</em></p>
      </div>
    </body>
    </html>
  `;
}
