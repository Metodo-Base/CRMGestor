import axios from 'axios';

/**
 * Vercel Serverless Function for Meta Ads OAuth Callback
 * Path: /api/auth/facebook/callback.ts
 */
export default async function handler(req: any, res: any) {
  // 1. Capturar o parâmetro "code" da query string
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Código de autorização ausente." });
  }

  try {
    // Variáveis de ambiente
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const baseUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const redirectUri = process.env.META_REDIRECT_URI || `${baseUrl}/api/auth/facebook/callback`;

    if (!appId || !appSecret) {
      return res.status(500).json({ error: "Configuração incompleta: META_APP_ID ou META_APP_SECRET não definidos." });
    }

    // 2. Fazer a troca do code por access_token (short-lived)
    const tokenResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code: code
      }
    });

    let accessToken = tokenResponse.data.access_token;
    let expiresIn = tokenResponse.data.expires_in;

    // 3. Trocar por long-lived token (estável por ~60 dias)
    try {
      const longLivedResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: accessToken
        }
      });
      
      if (longLivedResponse.data.access_token) {
        accessToken = longLivedResponse.data.access_token;
        expiresIn = longLivedResponse.data.expires_in;
      }
    } catch (e) {
      console.error("Erro ao obter long-lived token, mantendo token curto:", e);
    }

    // 4. Buscar contas de anúncio
    const adAccountsResponse = await axios.get("https://graph.facebook.com/v19.0/me/adaccounts", {
      params: {
        access_token: accessToken,
        fields: "name,account_id,currency,timezone_name"
      }
    });

    const adAccounts = adAccountsResponse.data.data;

    // 5. Retornar HTML com script para fechar popup e enviar dados para a janela pai
    const responseData = { 
      access_token: accessToken, 
      expires_in: expiresIn || 0, 
      ad_accounts: adAccounts 
    };

    res.status(200).send(`
      <html>
        <head>
          <title>Autenticação Meta Ads</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
            h1 { color: #4f46e5; margin-bottom: 0.5rem; }
            pre { text-align: left; background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; font-size: 10px; overflow: auto; max-height: 200px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Conectado!</h1>
            <p>Autenticação com Meta Ads concluída com sucesso.</p>
            <p>Esta janela fechará automaticamente.</p>
            <details>
              <summary style="cursor:pointer; font-size: 12px; color: #64748b;">Ver dados brutos (JSON)</summary>
              <pre>${JSON.stringify(responseData, null, 2)}</pre>
            </details>
          </div>
          <script>
            const data = ${JSON.stringify(responseData)};
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                platform: 'meta',
                accessToken: data.access_token,
                expiresIn: data.expires_in,
                adAccounts: data.ad_accounts
              }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              // Se não houver opener, apenas mostra o JSON
              document.body.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            }
          </script>
        </body>
      </html>
    `);

  } catch (error: any) {
    const errorData = error?.response?.data || error.message;
    console.error("Erro no callback Facebook Serverless:", errorData);
    res.status(500).json({ error: "Erro na autenticação com Meta Ads", details: errorData });
  }
}
