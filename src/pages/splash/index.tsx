import { View, Text } from '@tarojs/components';
import Taro, { useReady } from '@tarojs/taro';
import { useEffect, useRef } from 'react';
import './index.scss';

/**
 * 首屏加载页（冷启动入口）
 * 白底 + 居中「保质期」图标（日历 + 时钟）+ 自下而上绿色渐变
 * 动画结束后 switchTab 进入首页
 */
export default function Splash() {
  const leaving = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useReady(() => {
    // onReady = 页面初次渲染完成，此后才允许发起路由跳转。
    // 真机（尤其真机调试）首屏路由耗时可能超过固定延时，
    // 过早 switchTab 会触发 routeDone webviewId 报错。
    timerRef.current = setTimeout(() => {
      if (leaving.current) return;
      leaving.current = true;
      Taro.switchTab({ url: '/pages/index/index' }).catch(() => {
        Taro.reLaunch({ url: '/pages/index/index' });
      });
    }, 2000);
  });

  return (
    <View className='splash'>
      {/* 自下而上的绿色渐变 */}
      <View className='splash-glow' />

      {/* 保质期图标：绿色渐变圆角方块 + 白色日历 + 时钟 */}
      <View className='splash-icon'>
        <View className='ring ring-l' />
        <View className='ring ring-r' />
        <View className='cal'>
          <View className='clock'>
            <View className='hand minute' />
            <View className='hand hour' />
            <View className='pin' />
          </View>
        </View>
      </View>

      <Text className='splash-name'>留响 Retone</Text>
      <Text className='splash-slogan'>记录保质期 · 到期自动提醒</Text>
      <View className='splash-loading'>
        <View className='dot d1' />
        <View className='dot d2' />
        <View className='dot d3' />
      </View>
    </View>
  );
}
