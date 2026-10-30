import { View, Text, Image, Button } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { getProduct, markUsedUp, removeProduct } from '../../services/db';
import { daysLeftOfTs, describeDays, tsToDateStr } from '../../utils/date';
import { COLORS, categoryInfo } from '../../utils/constants';
import type { UrgencyLevel } from '../../utils/constants';
import type { Product } from '../../types';
import './index.scss';

/**
 * 产品详情（PRD 3.3）
 * 包装大图（点开全屏预览）+ 基本信息 + 底部：编辑 / 标记已用完 / 删除（二次确认）
 */
export default function Detail() {
  const router = useRouter();
  const id = router.params.id || '';
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);

  useDidShow(() => {
    // 从编辑页返回时自动刷新
    if (!id) return;
    getProduct(id)
      .then(setProduct)
      .catch(() => Taro.showToast({ title: '产品不存在或已删除', icon: 'none' }))
      .finally(() => setLoaded(true));
  });

  if (!product) {
    return (
      <View className='page detail-page'>
        {loaded && <Text className='missing'>产品不存在或已删除</Text>}
      </View>
    );
  }

  const days = daysLeftOfTs(product.expiryDate);
  const level: UrgencyLevel =
    days < 0 ? 'expired' : days <= 3 ? 'urgent' : days <= 10 ? 'near' : 'safe';
  const color = COLORS[level];
  const cat = categoryInfo(product.category);

  const previewImage = () => {
    if (product.photoFileID) Taro.previewImage({ urls: [product.photoFileID] });
  };
  const onEdit = () => Taro.navigateTo({ url: `/pages/add/index?id=${id}` });
  const onUsedUp = async () => {
    try {
      await markUsedUp(id);
      Taro.showToast({ title: '已标记用完', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  };
  const onDelete = async () => {
    const r = await Taro.showModal({
      title: '删除产品',
      content: `确定删除「${product.name}」吗？删除后不再提醒。`,
      confirmText: '删除',
      confirmColor: '#FF3B30'
    });
    if (!r.confirm) return;
    try {
      await removeProduct(id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  return (
    <View className='page detail-page'>
      <View className='hero' onClick={previewImage}>
        {product.photoFileID ? (
          <>
            <Image className='hero-img' src={product.photoFileID} mode='aspectFill' />
            <Text className='hero-zoom'>点击查看大图</Text>
          </>
        ) : (
          <View className='hero-empty'>
            <Text className='hero-emoji'>{cat.icon}</Text>
            <Text className='hero-tip'>暂无包装照片</Text>
          </View>
        )}
      </View>

      <View className='detail-card'>
        <View className='name-row'>
          <Text className='p-name'>{product.name}</Text>
          <Text className='p-cat'>{cat.icon} {cat.label}</Text>
        </View>

        <View className='days-block' style={{ color }}>
          <Text className='days-text'>{describeDays(days)}</Text>
          {product.status === 'usedUp' && <Text className='used-badge'>已用完</Text>}
        </View>

        <View className='rows'>
          <View className='row'>
            <Text className='row-label'>到期日</Text>
            <Text className='row-value' style={{ color }}>{tsToDateStr(product.expiryDate)}</Text>
          </View>
          {product.productionDate ? (
            <View className='row'>
              <Text className='row-label'>生产日期</Text>
              <Text className='row-value'>{tsToDateStr(product.productionDate)}</Text>
            </View>
          ) : null}
          {product.shelfLifeLabel || product.shelfLifeDays ? (
            <View className='row'>
              <Text className='row-label'>保质期</Text>
              <Text className='row-value'>{product.shelfLifeLabel || `${product.shelfLifeDays} 天`}</Text>
            </View>
          ) : null}
          {product.note ? (
            <View className='row'>
              <Text className='row-label'>备注</Text>
              <Text className='row-value'>{product.note}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className='actions'>
        <Button className='action-btn edit' onClick={onEdit}>编辑</Button>
        {product.status === 'active' && (
          <Button className='action-btn use' onClick={onUsedUp}>标记已用完</Button>
        )}
        <Button className='action-btn del' onClick={onDelete}>删除</Button>
      </View>
    </View>
  );
}
