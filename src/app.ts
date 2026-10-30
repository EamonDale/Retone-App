import Taro, { useLaunch } from '@tarojs/taro';
import { CLOUD_ENV_ID } from './config/env';
import './app.scss';

function App({ children }: { children?: React.ReactNode }) {
  useLaunch(() => {
    // 微信云开发初始化（PRD 4.1：CloudBase，免服务器）
    if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
      Taro.cloud.init({
        env: CLOUD_ENV_ID || undefined,
        traceUser: true
      });
    }
  });

  return children;
}

export default App;
