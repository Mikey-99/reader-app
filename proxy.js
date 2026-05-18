/**
 * proxy.js - 小说阅读器本地 CORS 代理服务器
 *
 * 用于解决从本地 HTML 文件 fetch 外部链接时的跨域问题。
 * 启动后在浏览器中打开 reader.html，然后通过「导入」粘贴链接即可。
 *
 * 启动: node proxy.js
 * 默认监听: http://localhost:3001
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS headers for local file access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '请提供 ?url= 参数' }));
    return;
  }

  console.log(`[代理] 请求: ${targetUrl}`);

  // Determine http vs https
  fetchUrl(targetUrl, res, 0);

  function fetchUrl(urlToFetch, response, redirectCount) {
    if (redirectCount > 5) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Too many redirects');
      return;
    }
    
    const client = urlToFetch.startsWith('https') ? https : http;
    const options = new URL(urlToFetch);
    
    client.get({
      hostname: options.hostname,
      port: options.port || (urlToFetch.startsWith('https') ? 443 : 80),
      path: options.pathname + options.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      rejectUnauthorized: false
    }, (proxyRes) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode)) {
        const location = proxyRes.headers['location'];
        if (location) {
          const resolved = location.startsWith('http') ? location : new URL(location, urlToFetch).href;
          console.log('[代理] 重定向:', proxyRes.statusCode, '→', resolved.slice(0, 80));
          proxyRes.resume();
          fetchUrl(resolved, response, redirectCount + 1);
          return;
        }
      }
      
      // Forward response
      const contentType = proxyRes.headers['content-type'] || 'text/plain; charset=utf-8';
      response.writeHead(proxyRes.statusCode, { 'Content-Type': contentType });
      
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        let detectedEncoding = 'utf-8';
        const ct = contentType.toLowerCase();
        if (ct.includes('charset=')) {
          const match = ct.match(/charset=([\w-]+)/i);
          if (match) detectedEncoding = match[1];
        }
        
        if (detectedEncoding === 'utf-8' && /[\x80-\xFF]/.test(buffer.slice(0, 100).toString('latin1')) && !isValidUtf8(buffer)) {
          detectedEncoding = 'gbk';
        }

        console.log('[代理] 响应:', proxyRes.statusCode, '| 编码:', detectedEncoding, '| 大小:', buffer.length, '字节');

        try {
          const iconv = require('iconv-lite');
          if (iconv.encodingExists(detectedEncoding)) {
            response.end(iconv.decode(buffer, detectedEncoding));
            return;
          }
        } catch (e) {}
        
        response.end(buffer.toString('utf-8'));
      });
    }).on('error', (e) => {
      console.log('[代理] 错误:', e.message);
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: '代理请求失败: ' + e.message }));
    });
  }
});

// Simple UTF-8 validity check
function isValidUtf8(buf) {
  try {
    const str = buf.toString('utf-8');
    // If the decoded string has replacement characters, probably not valid UTF-8
    return !str.includes('\uFFFD');
  } catch {
    return false;
  }
}

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      📖 小e阅读 · 本地代理服务器        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  地址: http://localhost:${PORT}          ║`);
  console.log('║  用法: 在 reader.html 中粘贴链接导入     ║');
  console.log('║  退出: Ctrl+C                           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('提示: 如需支持 GBK 编码，请先安装 iconv-lite:');
  console.log('  npm install iconv-lite');
  console.log('');
});
