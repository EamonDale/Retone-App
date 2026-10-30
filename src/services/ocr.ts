import Taro from '@tarojs/taro';
import { parseExpiryText } from '../utils/ocrParse';
import type { OcrParseResult } from '../utils/ocrParse';

/**
 * OCR 调用（PRD 3.2.3）
 * 客户端只负责：传入云存储 fileID → 拿到识别文本 → 正则提取日期/保质期
 * 云函数 ocrProxy 内部：优先微信 OCR 插件，失败降级百度 OCR
 */
export async function recognizeProductInfo(fileID: string): Promise<OcrParseResult> {
  const res = await Taro.cloud.callFunction({
    name: 'ocrProxy',
    data: { fileID }
  });
  const result = res.result as { ok?: boolean; text?: string; message?: string };
  if (!result || !result.ok || !result.text) {
    throw new Error(result?.message || 'OCR_FAILED');
  }
  return parseExpiryText(result.text);
}
