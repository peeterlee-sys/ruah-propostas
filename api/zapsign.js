// Função serverless Vercel para integração com ZapSign
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

    // Criar documento no ZapSign
    const payload = {
      name: nome_documento,
      signers: signatarios.map(sig => ({
        name: sig.nome,
        email: sig.email,
        phone_number: sig.telefone || undefined
      })),
      files: [
        {
          name: nome_documento,
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
