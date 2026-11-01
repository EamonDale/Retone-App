const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (event.action === 'initUser') {
    // 初始化用户设置和订阅额度
    try {
      // 保存用户设置
      await db.collection('userSettings').add({
        data: {
          kind: 'settings',
          advanceDays: 3,
          remindToday: true,
          _openid: OPENID,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      // 初始化订阅额度
      await db.collection('subscribeQuota').add({
        data: {
          _openid: OPENID,
          quota: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      return { success: true, message: '用户初始化成功' };
    } catch (e) {
      console.error('[initUser] 初始化失败', e);
      return { success: false, error: e.message };
    }
  }

  return {
    success: false,
    error: '未知操作'
  };
};
