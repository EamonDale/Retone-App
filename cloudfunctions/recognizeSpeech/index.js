const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, fileID } = event;

  if (action === 'recognize') {
    try {
      console.log('[recognizeSpeech] 开始识别，fileID:', fileID);

      const result = await cloud.openapi.speech.recognize({
        fileID: fileID,
        format: 'mp3',
        rate: 16000
      });

      console.log('[recognizeSpeech] 识别结果:', JSON.stringify(result));

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
