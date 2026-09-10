export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'VocabClash API',
    uptime: process.uptime ? process.uptime() : undefined,
  });
}
