import { OAuth2Client } from 'google-auth-library';
import { adminDb } from '../../lib/firebase-admin.js';
import axios from 'axios';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const clienteId = state;

  console.log("[GoogleCallback] Início do processamento.");
  console.log("[GoogleCallback] Query Params:", JSON.stringify(req.query));
  console.log("[GoogleCallback] Headers:", JSON.stringify({
    host: req.headers.host,
    'x-forwarded-proto': req.headers['x-forwarded-proto'],
    'user-agent': req.headers['user-agent']
  }));

  try {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    console.log("[GoogleCallback] BaseURL:", baseUrl);
    console.log("[GoogleCallback] RedirectURI:", redirectUri);

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Configuração do Google Ads (CLIENT_ID/SECRET) ausente no servidor.");
    }

    if (!code) {
      console.error("[GoogleCallback] Código ausente na query");
      return res.status(400).send("Código de autorização ausente.");
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    console.log("[GoogleCallback] Trocando código por tokens...");
    const { tokens } = await client.getToken(code);
    console.log("[GoogleCallback] Tokens obtidos com sucesso.");
    
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    const adAccounts = [];

    // Tenta buscar as contas - Varredura de v15 a v18 para máxima compatibilidade
    try {
      const rawDevToken = process.env.GOOGLE_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      const devToken = rawDevToken ? rawDevToken.trim() : null;
      
      if (devToken) {
        // Varredura de versões
        const versions = ["v15", "v16", "v17", "v18"];
        let customersResponse = null;
        let lastError = null;

        console.log(`[GoogleCallback] Iniciando varredura de versões (v15-v18)...`);

        for (const version of versions) {
          try {
            const listUrl = `https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`;
            console.log(`[GoogleCallback] Testando ${version}...`);
            
            customersResponse = await axios.get(listUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'developer-token': devToken
              },
              timeout: 10000
            });
            
            if (customersResponse) {
              console.log(`[GoogleCallback] Conexão estabelecida com sucesso na versão ${version}`);
              break; 
            }
          } catch (err) {
            lastError = err;
            const status = err.response?.status;
            console.warn(`[GoogleCallback] ${version} falhou (Status: ${status || 'Timeout/Network'})`);
            
            // Se o erro for 401 ou 403, o problema é o token/permissão, não a versão.
            if (status === 401 || status === 403) {
              console.error("[GoogleCallback] Erro de permissão detectado. Parando varredura.");
              break;
            }
          }
        }

        if (customersResponse) {
          const resourceNames = customersResponse.data.resourceNames || [];
          console.log(`[GoogleCallback] ${resourceNames.length} contas encontradas.`);

          for (const resourceName of resourceNames) {
            const customerId = resourceName.split('/')[1];
            try {
              // Usa a versão que funcionou
              const apiVer = customersResponse.config.url.split('/')[3];
              const searchUrl = `https://googleads.googleapis.com/${apiVer}/customers/${customerId}/googleAds:search`;
              
              const queryResponse = await axios.post(
                searchUrl,
                { query: "SELECT customer.descriptive_name, customer.id, customer.currency_code, customer.test_customer FROM customer" },
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'developer-token': devToken,
                    'login-customer-id': customerId
                  }
                }
              );

              const customer = queryResponse.data.results?.[0]?.customer;
              if (customer) {
                const accountData = {
                  id: customer.id,
                  name: customer.descriptive_name || `Conta ${customer.id}`,
                  currency: customer.currency_code,
                  is_test: customer.test_customer || false,
                  platform: 'google',
                  updated_at: new Date().toISOString()
                };
                adAccounts.push(accountData);
                await adminDb.collection("google_ads_accounts").doc(customer.id).set(accountData, { merge: true });
              }
            } catch (err) {
              console.error(`[GoogleCallback] Erro na conta ${customerId}:`, err.response?.data || err.message);
            }
          }
        } else {
          console.error("[GoogleCallback] Nenhuma versão da API (v15-v18) respondeu positivamente.");
          if (lastError?.response?.status === 404) {
            console.error("[GoogleCallback] O erro 404 persistente indica que o endpoint não foi encontrado. Isso é comum em contas criadas nas últimas 24h ou tokens de teste sem um MCC de teste vinculado.");
          }
        }
      } else {
        console.warn("[GoogleCallback] GOOGLE_DEVELOPER_TOKEN não configurado.");
      }
    } catch (fetchError) {
      console.error("[GoogleCallback] Falha crítica na busca de contas:", fetchError.message);
    }

    // Salvar refresh_token para o cliente (se fornecido)
    if (clienteId && clienteId !== "undefined" && refreshToken) {
      try {
        await adminDb.collection("clientes").doc(clienteId).set({
          google_ads_refresh_token: refreshToken,
          google_ads_conectado: true,
          updated_at: new Date().toISOString()
        }, { merge: true });
        console.log("[GoogleCallback] Firestore (clientes) atualizado.");
      } catch (dbError) {
        console.error("[GoogleCallback] Erro ao salvar no Firestore (clientes):", dbError.message);
      }
    }

    // SEMPRE retorna sucesso para fechar a janela, mesmo que a busca de contas tenha falhado internamente
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                platform: 'google',
                adAccounts: ${JSON.stringify(adAccounts)}
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação Google Ads concluída. Fechando janela...</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("[GoogleCallback] Erro fatal:", error.message);
    if (error.response) {
      console.error("[GoogleCallback] Detalhes do erro (API):", JSON.stringify(error.response.data));
    }
    res.status(500).json({ 
      error: "Erro na autenticação com Google Ads", 
      message: error.message,
      details: error.response ? error.response.data : null
    });
  }
}
