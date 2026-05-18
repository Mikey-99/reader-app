/**
 * Vercel Serverless Proxy - 鐢ㄤ簬灏忚闃呰鍣ㄧ殑 CORS 浠ｇ悊
 * 
 * 閮ㄧ讲: 灏嗘鏂囦欢鏀惧湪 api/ 鐩綍涓嬶紝Vercel 鑷姩璇嗗埆
 * 鐢ㄦ硶: /api/proxy?url=https://example.com
 */

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.status(400).json({ error: '璇锋彁渚??url= 鍙傛暟' });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    
    const text = await response.text();
    res.status(200).send(text);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
};
