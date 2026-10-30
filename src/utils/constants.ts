/** 分类定义（PRD 3.1 分类 Tab / 3.2.2 表单字段） */
export const CATEGORIES = [
  { key: 'food', label: '食品', icon: '🥛' },
  { key: 'beauty', label: '美妆', icon: '💄' },
  { key: 'medicine', label: '药品', icon: '💊' },
  { key: 'daily', label: '日用品', icon: '🧴' },
  { key: 'other', label: '其他', icon: '📦' }
] as const;

export type CategoryKey = typeof CATEGORIES[number]['key'];

/** 首页分类 Tab（含「全部」） */
export const ALL_TABS = [
  { key: 'all' as const, label: '全部', icon: '🗂' },
  ...CATEGORIES
];

export function categoryInfo(key: string) {
  return ALL_TABS.find((c) => c.key === key) || ALL_TABS[ALL_TABS.length - 1];
}

/** 颜色规则（PRD 6.2） */
export const COLORS = {
  urgent: '#FF3B30', // 紧急 0 ≤ 剩余 ≤ 3
  near: '#FF9500',   // 临近 4 ≤ 剩余 ≤ 10
  safe: '#34C759',   // 安全 剩余 > 10
  expired: '#8E8E93' // 已过期 剩余 < 0
} as const;

export type UrgencyLevel = keyof typeof COLORS;

/** 保质期单位（PRD 3.2.1 模式 A） */
export const SHELF_UNITS = [
  { key: 'day' as const, label: '天', factor: 1 },
  { key: 'month' as const, label: '个月', factor: 30 },
  { key: 'year' as const, label: '年', factor: 365 }
];

export type ShelfUnitKey = typeof SHELF_UNITS[number]['key'];

/** 订阅消息引导的本地存储 key（一天只温和引导一次） */
export const GUIDE_STORAGE_KEY = 'resound_guide_date';
