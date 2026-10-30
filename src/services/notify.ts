import Taro from '@tarojs/taro';
import { SUBSCRIBE_TEMPLATE_ID } from '../config/env';

/**
 * 订阅消息（PRD 3.4.2）
 * - 用户每点一次「允许」，只能发一条 → 云函数 subscribeQuota.quota +1
 * - 云函数 dailyReminder 每天定时扫描后发送，quota -1
 *
 * 注意：requestSubscribeMessage 必须发生在用户点击行为中，
 * 因此在「保存」按钮的点击处理函数里最先调用（见 add 页 onSave）。
 */
export const TEMPLATE_ID = SUBSCRIBE_TEMPLATE_ID;

/** 弹出订阅授权；返回用户是否点允许。允许后调用云函数给额度 +1 */
export async function requestSubscribe(): Promise<boolean> {
  if (!TEMPLATE_ID) {
    console.warn('[notify] 未配置订阅消息模板 ID，见 src/config/env.ts');
    return false;
  }
  try {
    const res = await Taro.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID]
    } as unknown as Taro.requestSubscribeMessage.Option);
    const accepted =
      res.errMsg === 'requestSubscribeMessage:ok' &&
      (res as unknown as Record<string, string>)[TEMPLATE_ID] === 'accept';
    if (accepted) {
      try {
        await Taro.cloud.callFunction({
          name: 'dailyReminder',
          data: { action: 'addQuota' }
        });
      } catch (e) {
        console.warn('[notify] 记录订阅额度失败', e);
      }
    }
    return accepted;
  } catch (e) {
    console.warn('[notify] requestSubscribeMessage 失败', e);
    return false;
  }
}
