import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useCallback, useMemo, useState } from 'react';
import ProductCard from '../../components/ProductCard';
import CategoryTab from '../../components/CategoryTab';
import StatBar from '../../components/StatBar';
import EmptyState from '../../components/EmptyState';
import type { StatFilter } from '../../components/StatBar';
import { fetchActiveProducts } from '../../services/db';
import { requestSubscribe } from '../../services/notify';
import { daysLeftOfTs, todayStr } from '../../utils/date';
import { GUIDE_STORAGE_KEY } from '../../utils/constants';
import type { Product } from '../../types';
import './index.scss';

/**
 * 首页（PRD 3.1）
 * 顶部统计条 + 分类 Tab + 产品卡片列表（剩余天数升序、已过期排最上）+ 悬浮 + 按钮
 */
export default function Index() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState('all');
  const [stat, setStat] = useState<StatFilter>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await fetchActiveProducts();
      list.sort((a, b) => daysLeftOfTs(a.expiryDate) - daysLeftOfTs(b.expiryDate));
      setProducts(list);
    } catch (e) {
      console.error('[index] 加载失败', e);
      Taro.showToast({ title: '加载失败，请检查云环境', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    load();
    // 每天温和引导一次订阅（PRD 3.4.2）
    setShowGuide(Taro.getStorageSync(GUIDE_STORAGE_KEY) !== todayStr());
  });

  usePullDownRefresh(() => {
    // 下拉刷新从云端拉最新数据（PRD 3.1 验收）
    load().finally(() => Taro.stopPullDownRefresh());
  });

  const stats = useMemo(() => {
    let expiring = 0;
    let expired = 0;
    for (const p of products) {
      const d = daysLeftOfTs(p.expiryDate);
      if (d < 0) expired++;
      else if (d <= 10) expiring++;
    }
    return { all: products.length, expiring, expired };
  }, [products]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const d = daysLeftOfTs(p.expiryDate);
        if (stat === 'expiring' && !(d >= 0 && d <= 10)) return false;
        if (stat === 'expired' && d >= 0) return false;
        return category === 'all' || p.category === category;
      }),
    [products, category, stat]
  );

  const goDetail = (p: Product) => Taro.navigateTo({ url: `/pages/detail/index?id=${p._id}` });
  const goAdd = () => Taro.navigateTo({ url: '/pages/add/index' });

  const dismissGuide = () => {
    Taro.setStorageSync(GUIDE_STORAGE_KEY, todayStr());
    setShowGuide(false);
  };
  const onGuideTap = async () => {
    await requestSubscribe();
    dismissGuide();
  };

  return (
    <View className='page index-page'>
      <StatBar {...stats} value={stat} onChange={setStat} />
      <CategoryTab value={category} onChange={setCategory} />

      {showGuide && (
        <View className='guide'>
          <Text className='guide-text'>🔔 开启提醒，不错过保质期</Text>
          <View className='guide-btn' onClick={onGuideTap}>开启</View>
          <Text className='guide-close' onClick={dismissGuide}>✕</Text>
        </View>
      )}

      <View className='list'>
        {filtered.map((p) => (
          <ProductCard key={p._id} product={p} onClick={goDetail} />
        ))}
        {!filtered.length && !loading && (
          <EmptyState
            text={products.length ? '该筛选下暂无产品' : '还没有产品'}
            hint={products.length ? '换个分类或筛选看看' : '点右下角 + 添加第一个产品'}
          />
        )}
      </View>

      <View className='fab' onClick={goAdd}>
        <Text className='fab-plus'>+</Text>
      </View>
    </View>
  );
}
