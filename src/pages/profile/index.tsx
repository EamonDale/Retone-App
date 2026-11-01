import { View, Text, Picker, Button, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { clearAllProducts, clearUsedUpProducts, getSettings, saveSettings, fetchAllProducts } from '../../services/db';
import { requestSubscribe, TEMPLATE_ID } from '../../services/notify';
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
  const [clearingUsedUp, setClearingUsedUp] = useState(false);
  const [usedUpCount, setUsedUpCount] = useState(0);
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0, remaining: 0 });

  useDidShow(() => {
    getSettings().then((s) => {
      setAdvanceDays(s.advanceDays);
      setRemindToday(s.remindToday);
    });
    loadStorageInfo();
    loadUsedUpCount();
  });

  useEffect(() => {
    loadStorageInfo();
    loadUsedUpCount();
  }, []);

  const loadStorageInfo = async () => {
    try {
      // 使用微信云API获取云存储信息
      const res = await Taro.cloud.getCloudStorageInfo();
      console.log('[profile] 云存储信息:', res);
      setStorageInfo({
        used: res.used || 0,
        total: res.limit || 0,
        remaining: (res.limit || 0) - (res.used || 0)
      });
    } catch (e) {
      console.error('[profile] 获取存储信息失败', e);
      // 如果API失败，尝试使用其他方式
      try {
        const allProducts = await fetchAllProducts();
        // 估算存储使用量：每个产品约 1KB
        const estimatedUsed = allProducts.length * 1024;
        setStorageInfo({
          used: estimatedUsed,
          total: 1024 * 1024 * 1024, // 假设10GB
          remaining: (1024 * 1024 * 1024) - estimatedUsed
        });
      } catch (e2) {
        console.error('[profile] 估算存储信息失败', e2);
      }
    }
  };

  const loadUsedUpCount = async () => {
    try {
      const allProducts = await fetchAllProducts();
      const usedUpCount = allProducts.filter(p => p.status === 'usedUp').length;
      setUsedUpCount(usedUpCount);
    } catch (e) {
      console.error('[profile] 获取已用完产品数量失败', e);
    }
  };

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
      loadUsedUpCount();
      loadStorageInfo();
    } catch (e) {
      console.error('[profile] 清除失败', e);
      Taro.showToast({ title: '清除失败', icon: 'none' });
    } finally {
      setClearing(false);
    }
  };

  const onClearUsedUp = async () => {
    if (usedUpCount === 0) {
      Taro.showToast({ title: '没有已用完的产品', icon: 'none' });
      return;
    }

    const r = await Taro.showModal({
      title: '清除已用完数据',
      content: `将删除 ${usedUpCount} 条已用完的产品记录，且不可恢复。确定继续吗？`,
      confirmText: '清除',
      confirmColor: '#FF3B30'
    });

    if (!r.confirm) return;

    setClearingUsedUp(true);
    try {
      const n = await clearUsedUpProducts();
      Taro.showToast({ title: `已清除 ${n} 条记录`, icon: 'none' });
      loadUsedUpCount();
      loadStorageInfo();
    } catch (e) {
      console.error('[profile] 清除已用完数据失败', e);
      Taro.showToast({ title: '清除失败', icon: 'none' });
    } finally {
      setClearingUsedUp(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const onTestReminder = async () => {
    try {
      Taro.showLoading({ title: '发送测试中...', mask: true });

      const res = await Taro.cloud.callFunction({
        name: 'testReminder',
        data: {
          action: 'testReminder'
        }
      });

      Taro.hideLoading();

      if (res.result && res.result.success) {
        Taro.showToast({
          title: '测试消息已发送',
          icon: 'success'
        });
      } else {
        Taro.showToast({
          title: res.result?.error || '发送失败',
          icon: 'none'
        });
      }
    } catch (e) {
      Taro.hideLoading();
      console.error('[profile] 测试提醒失败', e);
      Taro.showToast({
        title: '发送失败',
        icon: 'none'
      });
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
        <View className='p-row tap' onClick={onTestReminder}>
          <View className='p-left'>
            <Text className='p-title'>测试订阅提醒</Text>
            <Text className='p-desc'>发送一条测试消息验证功能</Text>
          </View>
          <Text className='p-arrow'>›</Text>
        </View>
      </View>

      <View className='p-card'>
        <View className='p-row'>
          <Text className='p-title'>已用完产品：{usedUpCount}</Text>
          {usedUpCount > 0 && (
            <Button
              className='clear-btn clear-used-up-btn'
              loading={clearingUsedUp}
              disabled={clearingUsedUp}
              onClick={onClearUsedUp}
            >
              清除
            </Button>
          )}
        </View>
        <View className='p-desc-row'>
          <Text className='p-desc'>
            云存储空间：已用 {formatBytes(storageInfo.used)} / 总计 {formatBytes(storageInfo.total)}
            {storageInfo.remaining > 0 && <Text className='p-desc-highlight'>，剩余 {formatBytes(storageInfo.remaining)}</Text>}
          </Text>
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
      <Button className='clear-all-btn' loading={clearing} disabled={clearing} onClick={onClear}>
        清除所有数据
      </Button>

      <Text className='foot'>数据仅保存在你自己的微信云端</Text>
    </View>
  );
}
