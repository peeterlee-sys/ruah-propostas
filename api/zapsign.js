// Função serverless Vercel para integração com ZapSign
// Gera o PDF a partir do HTML real do contrato (renderizado no navegador do usuário),
// usando Chrome headless no servidor, para que o PDF fique idêntico ao "Salvar PDF/Imprimir".
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let browser;

  try {
    const { codigo, cliente_razao, html, css, signatarios } = req.body;
    const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY;

    if (!html || !signatarios) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!ZAPSIGN_API_KEY) {
      return res.status(500).json({ error: 'API key não configurada' });
    }

    const paginaCompleta = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  ${css || ''}
</style>
</head>
<body class="print-contrato">
${html}
</body>
</html>`;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(paginaCompleta, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' }
    });

    await browser.close();
    browser = null;

    const base64_pdf = pdfBuffer.toString('base64');

    // Criar documento no ZapSign
    // base64_pdf e signers ficam no TOPO do payload (não dentro de "files")
    const payload = {
      name: `CONT-${codigo || 'S/N'} - ${cliente_razao || 'Cliente'}`,
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
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    return res.status(500).json({
      error: 'Erro interno do servidor',
      mensagem: error.message
    });
  }
}
