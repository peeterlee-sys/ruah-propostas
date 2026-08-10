// Função serverless Vercel: só devolve os dados financeiros (faturamento, despesas,
// ranking dos pontos, ocupação) se a senha bater. Os números NÃO ficam neste
// repositório (ele é público) — ficam no repositório privado ruah-midia/dashboard-paineis-ruah,
// já mantido pelo conector local. Esta função busca o arquivo lá via API do GitHub,
// autenticada com um token de leitura, e só repassa para o navegador depois de
// conferir a senha.
const REPO = 'ruah-midia/dashboard-paineis-ruah';
const CAMINHO_ARQUIVO = 'data/dashboard-data.json';
const SENHA_PADRAO = 'RuahPaineis2026';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const senhaEsperada = process.env.PAINEL_SENHA || SENHA_PADRAO;
    const { senha } = req.body || {};

    if (!senha || senha !== senhaEsperada) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = process.env.GITHUB_TOKEN_PAINEL;
    if (!token) {
      return res.status(500).json({ error: 'GITHUB_TOKEN_PAINEL não configurado na Vercel' });
    }

    const url = 'https://api.github.com/repos/' + REPO + '/contents/' + CAMINHO_ARQUIVO + '?ref=main';
    const resposta = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'ruah-propostas-painel-data'
      }
    });

    if (!resposta.ok) {
      return res.status(502).json({ error: 'Falha ao buscar dados no GitHub', status: resposta.status });
    }

    const dados = await resposta.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(dados);
  } catch (erro) {
    return res.status(500).json({ error: 'Falha ao carregar dados', detalhe: String(erro) });
  }
}
