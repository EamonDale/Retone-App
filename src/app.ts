import Taro, { useLaunch } from '@tarojs/taro';
import { CLOUD_ENV_ID } from './config/env';
import { loadCustomCategories } from './services/categories';
import './app.scss';

function App({ children }: { children?: React.ReactNode }) {
  useLaunch(() => {
    // 微信云开发初始化（PRD 4.1：CloudBase，免服务器）
    if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
      Taro.cloud.init({
        env: CLOUD_ENV_ID || undefined,
        traceUser: true
      });

      // 预加载自定义分类，供卡片/详情等同步展示场景查询（失败静默走本地缓存）
      loadCustomCategories().catch(() => {});

      // 初始化用户设置（首次使用时）
      initUserSettings().catch(() => {});
    }
  });

  return children;
}

async function initUserSettings() {
  try {
    const { OPENID } = Taro.cloud.getWXContext();

    // 检查用户设置是否存在
    const res = await Taro.cloud.callFunction({
      name: 'initUser',
      data: {
        action: 'initUser'
      }
    });

    console.log('[app] 用户初始化:', res.result);
  } catch (e) {
    console.error('[app] 用户初始化失败', e);
  }
}

export default App;
