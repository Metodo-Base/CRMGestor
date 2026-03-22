import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { cliente_id, origin } = req.query;
  const appId = process.env.META_APP_ID;
  const baseUrl = (origin as string) || process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = process.env.META_REDIRECT_URI || `${baseUrl}/api/auth/facebook/callback`;
  const scopes = ["ads_read", "business_management"].join(",");
  
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${cliente_id}`;
  res.status(200).json({ url });
}
