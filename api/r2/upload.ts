import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let r2: S3Client | null = null;
function getR2() {
  if (r2) return r2;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return r2;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const client = getR2();
    if (!client) return res.status(500).json({ error: 'R2 not configured' });

    const bucket = process.env.R2_UPLOAD_IMAGE_BUCKET_NAME;
    if (!bucket) return res.status(500).json({ error: 'R2 bucket not configured' });

    const { base64, key, contentType = 'image/png' } = req.body || {};
    if (!base64 || !key) return res.status(400).json({ error: 'Missing base64 or key' });
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const body = Buffer.from(data, 'base64');

    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    const url = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;
    res.json({ url });
  } catch (e: any) {
    console.error('R2 upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
}

