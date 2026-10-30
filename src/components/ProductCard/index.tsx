import { View, Text, Image } from '@tarojs/components';
import type { Product } from '../../types';
import { daysLeftOfTs, tsToDateStr, describeDays } from '../../utils/date';
import { COLORS, categoryInfo } from '../../utils/constants';
import type { UrgencyLevel } from '../../utils/constants';
import './index.scss';

interface Props {
  product: Product;
  onClick?: (p: Product) => void;
}

/**
 * 产品卡片（PRD 3.1）
 * 左侧色条：红=紧急 / 橙=临近 / 绿=安全 / 灰=已过期
 * 有包装照片显示小缩略图；按剩余天数升序、已过期排最上（由列表排序保证）
 */
export function urgencyOf(expiryTs: number): UrgencyLevel {
  const days = daysLeftOfTs(expiryTs);
  if (days < 0) return 'expired';
  if (days <= 3) return 'urgent';
  if (days <= 10) return 'near';
  return 'safe';
}

export default function ProductCard({ product, onClick }: Props) {
  const days = daysLeftOfTs(product.expiryDate);
  const level = urgencyOf(product.expiryDate);
  const color = COLORS[level];
  const cat = categoryInfo(product.category);

  return (
    <View className='card' onClick={() => onClick?.(product)}>
      <View className='card-bar' style={{ background: color }} />
      {product.photoFileID ? (
        <Image
          className='card-thumb'
          src={product.photoFileID}
          mode='aspectFill'
          lazyLoad
        />
      ) : (
        <View className='card-thumb card-thumb-empty'>
          <Text className='card-thumb-icon'>{cat.icon}</Text>
        </View>
      )}
      <View className='card-main'>
        <Text className='card-cat'>{cat.icon} {cat.label}</Text>
        <Text className='card-name'>{product.name}</Text>
      </View>
      <View className='card-right'>
        <View className='card-stock'>
          <Text className='card-stock-label'>数量</Text>
          <Text className='card-stock-value'>{product.stockQuantity || 1}</Text>
        </View>
        <Text className='card-days' style={{ color }}>{describeDays(days)}</Text>
        <Text className='card-date'>{tsToDateStr(product.expiryDate)} 到期</Text>
      </View>
    </View>
  );
}
