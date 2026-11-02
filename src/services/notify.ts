import Taro from '@tarojs/taro';
import { SUBSCRIBE_TEMPLATE_ID } from '../config/env';

/**
 * 订阅消息（PRD 3.4.2）
 * - 用户每点一次「允许」，给订阅额度 +1
 * - 云函数 dailyReminder 每天定时扫描，有额度就发送消息，发送后额度 -1
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
    console.log('[notify] 开始请求订阅消息，模板ID:', TEMPLATE_ID);

    const res = await Taro.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID]
    } as unknown as Taro.requestSubscribeMessage.Option);

    console.log('[notify] requestSubscribeMessage 返回:', res);
    console.log('[notify] res.errMsg:', res.errMsg);
    console.log('[notify] res[TEMPLATE_ID]:', (res as unknown as Record<string, string>)[TEMPLATE_ID]);

    const accepted =
      res.errMsg === 'requestSubscribeMessage:ok' &&
      (res as unknown as Record<string, string>)[TEMPLATE_ID] === 'accept';

    console.log('[notify] accepted:', accepted);

    if (accepted) {
      try {
        console.log('[notify] 开始调用云函数增加额度');
        await Taro.cloud.callFunction({
          name: 'dailyReminder',
          data: { action: 'addQuota' }
        });
        console.log('[notify] 云函数调用成功');
        return true;
      } catch (e) {
        console.warn('[notify] 记录订阅额度失败', e);
        return false;
      }
    }

    console.log('[notify] 用户未授权或授权被拒绝，errMsg:', res.errMsg);
    return accepted;
  } catch (e) {
    console.warn('[notify] requestSubscribeMessage 失败', e);
    return false;
  }
}

/** 检查用户是否有订阅额度 */
export async function checkQuota(): Promise<number> {
  try {
    const res = await Taro.cloud.callFunction({
      name: 'dailyReminder',
      data: { action: 'checkQuota' }
    });
    return res.result?.quota || 0;
  } catch (e) {
    console.error('[notify] 检查额度失败', e);
    return 0;
  }
}
