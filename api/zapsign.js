// Função serverless Vercel para integração com ZapSign
import PDFDocument from 'pdfkit';

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

    // Gerar PDF usando PDFKit
    const pdfBuffer = await gerarPdfContrato(contrato);

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

function gerarPdfContrato(contrato) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument();

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Cabeçalho
    doc.fontSize(18).font('Helvetica-Bold').text('CONTRATO DE VEICULAÇÃO', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('DE PUBLICIDADE EM PAINEL ELETRÔNICO DE LED', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Código: ${contrato.codigo}`, { align: 'center' });
    doc.moveDown();

    // Seção Cliente
    doc.fontSize(12).font('Helvetica-Bold').text('DADOS DO CLIENTE');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Razão Social: ${contrato.cliente.razao || 'N/A'}`);
    doc.text(`CNPJ/CPF: ${contrato.cliente.doc || 'N/A'}`);
    doc.text(`Contato: ${contrato.cliente.representante || 'N/A'}`);
    doc.text(`Email: ${contrato.cliente.email || 'N/A'}`);
    doc.text(`Telefone: ${contrato.cliente.telefone || 'N/A'}`);
    doc.moveDown();

    // Seção Contrato
    doc.fontSize(12).font('Helvetica-Bold').text('DADOS DO CONTRATO');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Período: ${contrato.meses} meses`);
    doc.text(`Valor Mensal: R$ ${(contrato.mensal || 0).toFixed(2)}`);
    doc.text(`Valor Total: R$ ${(contrato.total || 0).toFixed(2)}`);
    doc.text(`Início: ${contrato.inicio || 'N/A'}`);
    doc.text(`Término: ${contrato.fim || 'N/A'}`);
    doc.moveDown();

    // Seção Itens
    doc.fontSize(12).font('Helvetica-Bold').text('ITENS CONTRATADOS');
    doc.fontSize(9).font('Helvetica');
    if (contrato.itens && contrato.itens.length > 0) {
      contrato.itens.forEach(item => {
        doc.text(`• ${item.nome || 'N/A'} - R$ ${(item.valor || 0).toFixed(2)}`);
      });
    } else {
      doc.text('Nenhum item contratado');
    }
    doc.moveDown(2);

    // Rodapé
    doc.fontSize(10).font('Helvetica-Oblique').text('Assinado digitalmente via ZapSign', { align: 'center' });
    doc.text('Este contrato foi assinado digitalmente e tem validade legal.', { align: 'center' });

    doc.end();
  });
}
