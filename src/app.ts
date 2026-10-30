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
    }
  });

  return children;
}

export default App;
