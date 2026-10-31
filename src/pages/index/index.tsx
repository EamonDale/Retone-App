import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useCallback, useMemo, useState } from 'react';
import ProductCard from '../../components/ProductCard';
import CategoryTab from '../../components/CategoryTab';
import StatBar from '../../components/StatBar';
import EmptyState from '../../components/EmptyState';
import type { StatFilter } from '../../components/StatBar';
import { fetchActiveProducts } from '../../services/db';
import { loadCustomCategories } from '../../services/categories';
import { requestSubscribe } from '../../services/notify';
import { daysLeftOfTs, todayStr } from '../../utils/date';
import { GUIDE_STORAGE_KEY } from '../../utils/constants';
import { allTabs } from '../../utils/constants';
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
  const [tabs, setTabs] = useState(allTabs());
  const [searchKeyword, setSearchKeyword] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await fetchActiveProducts();
      // 预计算剩余天数，排序/统计/筛选复用（避免在 sort 比较器里反复调用 date-fns）
      list.sort(
        (a, b) => daysLeftOfTs(a.expiryDate) - daysLeftOfTs(b.expiryDate)
      );
      setProducts(list);
    } catch (e) {
      console.error('[index] 加载失败', e);
      Taro.showToast({ title: '加载失败，请检查云环境', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    // 同步自定义分类；当前选中分类被删除时回退「全部」
    loadCustomCategories().then(() => {
      const nextTabs = allTabs();
      setTabs(nextTabs);
      if (category !== 'all' && !nextTabs.some((c) => c.key === category)) {
        setCategory('all');
      }
    });
    load();
    // 每天温和引导一次订阅（PRD 3.4.2）
    setShowGuide(Taro.getStorageSync(GUIDE_STORAGE_KEY) !== todayStr());
  });

  usePullDownRefresh(() => {
    // 下拉刷新从云端拉最新数据（PRD 3.1 验收）
    load().finally(() => Taro.stopPullDownRefresh());
  });

  // 剩余天数只按产品列表变化计算一次，stats / filtered 共用
  const daysById = useMemo(
    () => new Map(products.map((p) => [p._id, daysLeftOfTs(p.expiryDate)])),
    [products]
  );

  const stats = useMemo(() => {
    let expiring = 0;
    let expired = 0;
    for (const p of products) {
      const d = daysById.get(p._id)!;
      if (d < 0) expired++;
      else if (d <= 10) expiring++;
    }
    return { all: products.length, expiring, expired };
  }, [products, daysById]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const d = daysById.get(p._id)!;
        if (stat === 'expiring' && !(d >= 0 && d <= 10)) return false;
        if (stat === 'expired' && d >= 0) return false;
        if (category !== 'all' && p.category !== category) return false;
        if (searchKeyword && !p.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
          return false;
        }
        return true;
      }),
    [products, daysById, category, stat, searchKeyword]
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
      <View className='top-section'>
        <StatBar {...stats} value={stat} onChange={setStat} />
        <View className='search-bar'>
          <Input
            className='search-input'
            value={searchKeyword}
            placeholder='搜索产品名称'
            placeholderClass='placeholder'
            onInput={(e: any) => setSearchKeyword(e.detail.value)}
          />
        </View>
        <CategoryTab value={category} onChange={setCategory} tabs={tabs} />
      </View>
      <View className='bottom-section'>
        {showGuide && (
          <View className='guide'>
            <Text className='guide-text'>🔔 开启提醒，不错过保质期</Text>
            <View className='guide-btn' onClick={onGuideTap}>开启</View>
            <Text className='guide-close' onClick={dismissGuide}>✕</Text>
          </View>
        )}
        <ScrollView
          className='list-scroll'
          scrollY
          enhanced
          showScrollbar={false}
          scrollWithAnimation
          lowerThreshold={50}
          upperThreshold={50}
        >
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
        </ScrollView>
        <View className='fab' onClick={goAdd}>
          <Text className='fab-plus'>+</Text>
        </View>
      </View>
    </View>
  );
}
