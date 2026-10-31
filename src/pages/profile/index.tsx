import { View, Text, Picker, Button, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { clearAllProducts, getSettings, saveSettings } from '../../services/db';
import { requestSubscribe, TEMPLATE_ID } from '../../services/notify';
import { DEFAULT_SETTINGS } from '../../types';
import type { UserSettings } from '../../types';
import './index.scss';

const ADVANCE_OPTIONS: (1 | 3 | 7)[] = [1, 3, 7];

/**
 * 我的（PRD 信息架构）
 * 提醒设置（提前几天 / 当天再提醒）、订阅消息授权引导、关于、清除数据
 */
export default function Profile() {
  const [advanceDays, setAdvanceDays] = useState<1 | 3 | 7>(DEFAULT_SETTINGS.advanceDays);
  const [remindToday, setRemindToday] = useState(DEFAULT_SETTINGS.remindToday);
  const [clearing, setClearing] = useState(false);

  useDidShow(() => {
    getSettings().then((s) => {
      setAdvanceDays(s.advanceDays);
      setRemindToday(s.remindToday);
    });
  });

  const persist = (next: UserSettings) => {
    saveSettings(next).catch((e) => console.warn('[profile] 设置保存失败', e));
  };

  const onAdvanceChange = (e: any) => {
    const v = ADVANCE_OPTIONS[Number(e.detail.value)];
    setAdvanceDays(v);
    persist({ advanceDays: v, remindToday });
  };

  const onRemindTodayChange = (e: any) => {
    const v = !!e.detail.value;
    setRemindToday(v);
    persist({ advanceDays, remindToday: v });
  };

  const onSubscribe = async () => {
    const ok = await requestSubscribe();
    Taro.showToast({
      title: ok ? '已开启提醒' : TEMPLATE_ID ? '未授权，可稍后再试' : '请先配置模板 ID（见 README）',
      icon: 'none'
    });
  };

  const onClear = async () => {
    const r = await Taro.showModal({
      title: '清除数据',
      content: '将删除你所有的产品记录，且不可恢复。确定继续吗？',
      confirmText: '清除',
      confirmColor: '#FF3B30'
    });
    if (!r.confirm) return;
    setClearing(true);
    try {
      const n = await clearAllProducts();
      Taro.showToast({ title: `已清除 ${n} 条记录`, icon: 'none' });
    } catch (e) {
      console.error('[profile] 清除失败', e);
      Taro.showToast({ title: '清除失败', icon: 'none' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <View className='page profile-page'>
      <View className='p-card'>
        <View className='p-row'>
          <View className='p-left'>
            <Text className='p-title'>提前提醒</Text>
            <Text className='p-desc'>到期前 {advanceDays} 天开始提醒</Text>
          </View>
          <Picker
            mode='selector'
            range={ADVANCE_OPTIONS.map((d) => `${d} 天`)}
            onChange={onAdvanceChange}
          >
            <View className='p-picker'>{advanceDays} 天 ▾</View>
          </Picker>
        </View>

        <View className='p-row'>
          <View className='p-left'>
            <Text className='p-title'>到期当天再提醒</Text>
            <Text className='p-desc'>当天会再发一次订阅消息</Text>
          </View>
          <Switch checked={remindToday} color='#3D7EFF' onChange={onRemindTodayChange} />
        </View>
      </View>

      <View className='p-card'>
        <View className='p-row tap' onClick={() => Taro.navigateTo({ url: '/pages/categories/index' })}>
          <View className='p-left'>
            <Text className='p-title'>分类管理</Text>
            <Text className='p-desc'>添加自定义分类，支持改名与删除</Text>
          </View>
          <Text className='p-arrow'>›</Text>
        </View>
        <View className='p-row tap' onClick={onSubscribe}>
          <View className='p-left'>
            <Text className='p-title'>订阅消息授权</Text>
            <Text className='p-desc'>每次点「允许」可攒 1 条推送额度</Text>
          </View>
          <Text className='p-arrow'>›</Text>
        </View>
      </View>

      <View className='p-card'>
        <View className='p-row'>
          <View className='p-left'>
            <Text className='p-title'>关于留响</Text>
            <Text className='p-desc'>v1.0.0 · 拍照记录保质期，到点微信提醒</Text>
          </View>
        </View>
      </View>

      <Button className='clear-btn' loading={clearing} disabled={clearing} onClick={onClear}>
        清除数据
      </Button>

      <Text className='foot'>数据仅保存在你自己的微信云端</Text>
    </View>
  );
}
