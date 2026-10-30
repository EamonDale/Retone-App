import { addDays, addMonths, addYears, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { ShelfUnitKey } from './constants';

/** 今天，yyyy-MM-dd */
export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** 'yyyy-MM-dd' → 毫秒时间戳（当天 00:00 本地时间）
 *  手动解析：部分 iOS 机型把无时区 ISO 字符串按 UTC 解析（差 8 小时导致日期错位） */
export function dateStrToTs(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/** 毫秒时间戳 → 'yyyy-MM-dd' */
export function tsToDateStr(ts: number): string {
  return format(new Date(ts), 'yyyy-MM-dd');
}

/**
 * 到期日计算（PRD 6.1）
 * 生产日期 + N 天/月/年，addMonths 自动处理大小月
 * 例：2026-10-22 + 6 个月 → 2027-04-22
 */
export function calcExpiry(productionDate: string, amount: number, unit: ShelfUnitKey): string {
  const base = new Date(dateStrToTs(productionDate));
  const d =
    unit === 'day'
      ? addDays(base, amount)
      : unit === 'month'
        ? addMonths(base, amount)
        : addYears(base, amount);
  return format(d, 'yyyy-MM-dd');
}

/** 剩余天数 = 到期日 - 今天（负数表示已过期） */
export function daysLeftOfTs(expiryTs: number): number {
  return differenceInCalendarDays(startOfDay(new Date(expiryTs)), startOfDay(new Date()));
}

/** 剩余天数的展示文案 */
export function describeDays(days: number): string {
  if (days < 0) return `已过期 ${-days} 天`;
  if (days === 0) return '今天到期';
  return `剩 ${days} 天`;
}
