const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, fileID } = event;

  if (action === 'recognize') {
    try {
      console.log('[recognizeSpeech] 开始识别，fileID:', fileID);

      // 使用微信云语音识别API
      const result = await cloud.openapi.translate({
        lang: 'zh_CN',
        l: 'zh_CN',
        media_url: fileID
      });

      console.log('[recognizeSpeech] 识别结果:', JSON.stringify(result.result));

      return {
        success: true,
        text: result.result
      };
    } catch (e) {
      console.error('[recognizeSpeech] 识别失败', e);
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
