const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  console.log('[testReminder] 开始测试发送');
  console.log('[testReminder] OPENID:', OPENID);
  console.log('[testReminder] TEMPLATE_ID:', process.env.TEMPLATE_ID);
  console.log('[testReminder] event:', JSON.stringify(event));

  if (event.action === 'testReminder') {
    // 测试发送一条订阅消息
    try {
      console.log('[testReminder] 开始测试发送');

      // 1. 获取今天的日期
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 3);

      // 2. 发送订阅消息
      const templateId = process.env.TEMPLATE_ID || 'HN2z4dFjnnv-aysNg4_noG25DG663RFnyqfFU-2Ld4A';
      console.log('[testReminder] 发送订阅消息，模板ID:', templateId);

      const result = await cloud.openapi.subscribeMessage.send({
        touser: OPENID,
        templateId: templateId,
        page: `pages/detail/index`,
        miniprogramState: 'formal',
        data: {
          time1: {
            value: tomorrow.toLocaleDateString('zh-CN')
          },
          number2: {
            value: 3
          },
          thing3: {
            value: '测试备注'
          },
          thing17: {
            value: '测试位置'
          }
        }
      });

      console.log('[testReminder] 发送结果:', JSON.stringify(result));

      if (result.errCode === 0) {
        return { success: true, message: '测试消息已发送，请查看微信消息' };
      } else {
        return {
          success: false,
          error: `发送失败，错误码: ${result.errCode}, 错误信息: ${result.errMsg}`
        };
      }
    } catch (e) {
      console.error('[testReminder] 发送失败', e);
      return {
        success: false,
        error: e.message,
        errorDetail: JSON.stringify(e)
      };
    }
  }

  return {
    success: false,
    error: '未知操作'
  };
};
