import Taro from '@tarojs/taro';
import { parseExpiryText } from '../utils/ocrParse';
import type { OcrParseResult } from '../utils/ocrParse';

/**
 * OCR 调用（PRD 3.2.3）
 * 客户端只负责：传入云存储 fileID → 拿到识别文本 → 正则提取日期/保质期
 * 云函数 ocrProxy 内部：优先微信 OCR 插件，失败降级百度 OCR
 *
 * 失败时抛出带「可操作指引」的错误信息，由页面决定 toast 或弹窗展示
 */
export async function recognizeProductInfo(fileID: string): Promise<OcrParseResult> {
  let res: Taro.cloud.CallFunctionResult;
  try {
    res = await Taro.cloud.callFunction({
      name: 'ocrProxy',
      data: { fileID }
    });
  } catch (e) {
    const msg = String((e as { errMsg?: string; message?: string })?.errMsg ||
      (e as { message?: string })?.message || '');
    if (/not\s*found|-404011|FUNCTIONNOTFOUND/i.test(msg)) {
      throw new Error('云函数 ocrProxy 未部署：请在开发者工具 cloudfunctions/ocrProxy 右键「上传并部署」');
    }
    if (/env|ENV_|环境/i.test(msg)) {
      throw new Error('云环境未就绪：请检查 src/config/env.ts 的 CLOUD_ENV_ID 与云开发控制台');
    }
    throw new Error('识别服务调用失败，请稍后重试');
  }
  const result = res.result as { ok?: boolean; text?: string; message?: string };
  if (!result || !result.ok || !result.text) {
    throw new Error(result?.message || 'OCR_FAILED');
  }
  return parseExpiryText(result.text);
}
