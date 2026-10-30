import { View, Text } from '@tarojs/components';
import './index.scss';

export type StatFilter = 'all' | 'expiring' | 'expired';

interface Props {
  all: number;
  expiring: number;
  expired: number;
  value: StatFilter;
  onChange: (v: StatFilter) => void;
}

const ITEMS: { key: StatFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'expiring', label: '即将过期' },
  { key: 'expired', label: '已过期' }
];

/** 顶部统计条（PRD 3.1）：三个数字并排，点击直接筛选 */
export default function StatBar({ all, expiring, expired, value, onChange }: Props) {
  const counts: Record<StatFilter, number> = { all, expiring, expired };
  return (
    <View className='stat'>
      {ITEMS.map((it) => (
        <View
          key={it.key}
          className={`stat-item${value === it.key ? ' active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          <Text className={`stat-num${it.key === 'expired' ? ' danger' : ''}`}>{counts[it.key]}</Text>
          <Text className='stat-label'>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
