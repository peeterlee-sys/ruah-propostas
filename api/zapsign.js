// Função serverless Vercel para integração com ZapSign
// O PDF já vem pronto (gerado no navegador do cliente via html2pdf.js),
// esta função só encaminha para o ZapSign e devolve os links de assinatura.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { base64_pdf, nome_documento, signatarios } = req.body;
    const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY;

    if (!base64_pdf || !nome_documento || !signatarios) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!ZAPSIGN_API_KEY) {
      return res.status(500).json({ error: 'API key não configurada' });
    }

    // base64_pdf e signers ficam no TOPO do payload (não dentro de "files")
    const payload = {
      name: nome_documento,
      base64_pdf: base64_pdf,
      signers: signatarios.map(sig => {
        const s = {
          name: sig.nome,
          email: sig.email,
          auth_mode: 'assinaturaTela',
          send_automatic_email: true
        };
        if (sig.telefone) {
          s.phone_country = '55';
          s.phone_number = String(sig.telefone).replace(/\D/g, '');
        }
        return s;
      })
    };

    // Endpoint correto: api.zapsign.com.br/api/v1/docs/ (não app.zapsign.com.br)
    const response = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAPSIGN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({
        error: 'ZapSign retornou resposta inválida (não-JSON)',
        status_zapsign: response.status,
        corpo: raw.slice(0, 500)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erro ao criar documento no ZapSign',
        details: data
      });
    }

    // Link de assinatura: cada signatário tem seu próprio sign_url
    const signers = data.signers || [];
    const linkCliente = signers[0] ? signers[0].sign_url : null;

    return res.status(200).json({
      sucesso: true,
      documento_id: data.token,
      link_assinatura: linkCliente,
      links_todos: signers.map(s => ({ nome: s.name, sign_url: s.sign_url })),
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
