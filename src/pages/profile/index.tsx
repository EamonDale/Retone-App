import { View, Text, Picker, Button, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { clearAllProducts, getSettings, saveSettings, fetchAllProducts } from '../../services/db';
import { requestSubscribe, checkQuota, TEMPLATE_ID } from '../../services/notify';
import { DEFAULT_SETTINGS } from '../../types';
import type { UserSettings } from '../../types';
import './index.scss';

const ADVANCE_OPTIONS: (1 | 3 | 7 | 15 | 30)[] = [1, 3, 7, 15, 30];

/**
 * 我的（PRD 信息架构）
 * 提醒设置（提前几天 / 当天再提醒）、订阅消息授权引导、关于、清除数据
 */
export default function Profile() {
  const [advanceDays, setAdvanceDays] = useState<1 | 3 | 7>(DEFAULT_SETTINGS.advanceDays);
  const [remindToday, setRemindToday] = useState(DEFAULT_SETTINGS.remindToday);
  const [clearing, setClearing] = useState(false);
  const [quota, setQuota] = useState(0);

  useDidShow(() => {
    getSettings().then((s) => {
      setAdvanceDays(s.advanceDays);
      setRemindToday(s.remindToday);
    });
    loadQuota();
  });

  useEffect(() => {}, []);

  const loadQuota = async () => {
    try {
      const quota = await checkQuota();
      setQuota(quota);
    } catch (e) {
      console.error('[profile] 查询额度失败', e);
    }
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
    try {
      const res = await Taro.cloud.callFunction({
        name: 'dailyReminder',
        data: { action: 'checkQuota' }
      });

      const currentQuota = res.result?.quota || 0;

      Taro.showModal({
        title: '订阅消息授权',
        content: `当前订阅额度：${currentQuota} 条\n\n点击「允许」可获得 1 条推送额度，用于接收产品到期提醒。点击「取消」不会影响其他功能。`,
        confirmText: '立即授权',
        cancelText: '取消',
        success: async (modalRes) => {
          if (modalRes.confirm) {
            const ok = await requestSubscribe();
            if (ok) {
              const newQuota = await checkQuota();
              setQuota(newQuota);
              Taro.showToast({
                title: '授权成功！已获得 1 条推送额度',
                icon: 'success',
                duration: 3000
              });
            } else {
              Taro.showToast({
                title: '授权失败，请稍后再试',
                icon: 'none'
              });
            }
          }
        }
      });
    } catch (e) {
      console.error('[profile] 查询额度失败', e);
      Taro.showToast({
        title: '查询额度失败',
        icon: 'none'
      });
    }
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
            <Text className='p-desc'>
              当前额度：{quota} 条 · 每次点「允许」获得 1 条
            </Text>
          </View>
          <Text className='p-arrow'>›</Text>
        </View>
      </View>

      <View className='p-card'>
        <View className='p-row'>
          <View className='p-left'>
            <Text className='p-title'>关于留响</Text>
            <Text className='p-desc'>v1.0.0 · 记录产品保质期，临近保质期微信提醒</Text>
          </View>
        </View>
      </View>
      <Button className='clear-all-btn' loading={clearing} disabled={clearing} onClick={onClear}>
        清除所有数据
      </Button>

      <Text className='foot'>数据保存在云端，仅本人可见</Text>
    </View>
  );
}
