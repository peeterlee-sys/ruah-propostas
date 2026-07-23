// Função serverless Vercel para consultar status de assinatura no ZapSign
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const docId = req.query.doc_id;
    const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY;

    if (!docId) {
      return res.status(400).json({ error: 'doc_id não informado' });
    }

    if (!ZAPSIGN_API_KEY) {
      return res.status(500).json({ error: 'API key não configurada' });
    }

    const response = await fetch(`https://api.zapsign.com.br/api/v1/docs/${docId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ZAPSIGN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({
        error: 'ZapSign retornou resposta inválida',
        status_zapsign: response.status,
        corpo: raw.slice(0, 300)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erro ao consultar documento no ZapSign',
        details: data
      });
    }

    return res.status(200).json({
      sucesso: true,
      status: data.status,
      signed_file: data.signed_file || null,
      signers: (data.signers || []).map(s => ({
        nome: s.name,
        status: s.status
      }))
    });

  } catch (error) {
    console.error('Erro ao consultar status ZapSign:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      mensagem: error.message
    });
  }
}
