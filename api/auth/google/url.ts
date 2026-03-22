import { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { cliente_id, origin } = req.query;
  const baseUrl = (origin as string) || process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/adwords"],
    prompt: "consent",
    state: cliente_id as string
  });
  res.status(200).json({ url });
}
