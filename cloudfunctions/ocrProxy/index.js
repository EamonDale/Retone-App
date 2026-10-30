/**
 * OCR 代理云函数（PRD 3.2.3）
 *
 * 优先级：
 *  1. 微信 OCR 插件 cloud.openapi.ocr.printedText（需小程序认证）
 *  2. 降级：百度 OCR 通用文字识别 standard（免费额度每天 1000 次，个人主体可用）
 *
 * 需要配置的环境变量（云开发控制台 → 云函数 → 配置 → 环境变量）：
 *  - BAIDU_OCR_API_KEY     百度智能云 API Key
 *  - BAIDU_OCR_SECRET_KEY  百度智能云 Secret Key
 *
 * 入参：{ fileID: 'cloud://...' }
 * 返回：{ ok: boolean, text?: string, provider?: 'wechat' | 'baidu', message?: string }
 */
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 百度 access_token 缓存（温启动复用）
const tokenCache = { token: '', expireAt: 0 };

function httpPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('响应解析失败: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('请求超时')));
    if (body) req.write(body);
    req.end();
  });
}

async function getBaiduToken() {
  if (tokenCache.token && Date.now() < tokenCache.expireAt) {
    return tokenCache.token;
  }
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
  if (!apiKey || !secretKey) return null;

  const qs =
    'grant_type=client_credentials' +
    `&client_id=${encodeURIComponent(apiKey)}` +
    `&client_secret=${encodeURIComponent(secretKey)}`;
  const res = await httpPost({
    hostname: 'aip.baidubce.com',
    path: `/oauth/2.0/token?${qs}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': 0 }
  });
  if (!res || !res.access_token) return null;
  tokenCache.token = res.access_token;
  tokenCache.expireAt = Date.now() + ((res.expires_in || 2592000) - 600) * 1000;
  return tokenCache.token;
}

async function tryWechatOcr(base64) {
  try {
    const res = await cloud.openapi.ocr.printedText({
      img: { contentType: 'image/jpeg', value: Buffer.from(base64, 'base64') }
    });
    if (res && res.errCode === 0 && Array.isArray(res.items)) {
      return res.items.map((i) => i.text).join('\n');
    }
    return null;
  } catch (e) {
    // 未认证 / 个人主体会走这里，降级百度 OCR
    console.log('[ocrProxy] 微信 OCR 不可用，降级百度 OCR：', e.errCode || e.message);
    return null;
  }
}

async function baiduOcr(base64) {
  const token = await getBaiduToken();
  if (!token) {
    throw new Error(
      '微信 OCR 不可用，且未配置百度 OCR 密钥（BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY）'
    );
  }
  const body = 'image=' + encodeURIComponent(base64);
  const res = await httpPost(
    {
      hostname: 'aip.baidubce.com',
      path: `/rest/2.0/ocr/v1/general_basic?access_token=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    },
    body
  );
  if (res && res.error_code) {
    throw new Error(`百度 OCR 错误 ${res.error_code}: ${res.error_msg}`);
  }
  return ((res && res.words_result) || []).map((w) => w.words).join('\n');
}

exports.main = async (event) => {
  const { fileID } = event || {};
  if (!fileID) return { ok: false, message: '缺少 fileID' };

  try {
    // 1. 从云存储下载图片
    const dl = await cloud.downloadFile({ fileID });
    const base64 = dl.fileContent.toString('base64');

    // 2. 优先微信 OCR
    const wxText = await tryWechatOcr(base64);
    if (wxText) return { ok: true, provider: 'wechat', text: wxText };

    // 3. 降级百度 OCR
    const text = await baiduOcr(base64);
    return { ok: true, provider: 'baidu', text };
  } catch (err) {
    console.error('[ocrProxy] 失败', err);
    return { ok: false, message: (err && err.message) || 'OCR 失败' };
  }
};
