/** 产品记录，对应云数据库 products 集合（PRD 5.1） */
export interface Product {
  _id: string;
  _openid?: string;
  name: string;
  /** 分类 key：内置（food/beauty/...）或自定义（c_xxx，定义见 userSettings 集合） */
  category: string;
  /** 生产日期时间戳（毫秒），模式 B 录入时可能为空 */
  productionDate?: number | null;
  /** 保质期总天数（月按 30 天、年按 365 天折算） */
  shelfLifeDays?: number | null;
  /** 保质期展示文案，如 "6个月" */
  shelfLifeLabel?: string;
  /** 到期日时间戳（毫秒），建索引：升序 */
  expiryDate: number;
  note?: string;
  /** 云存储 fileID，cloud://... */
  photoFileID?: string;
  status: 'active' | 'usedUp';
  createdAt: number;
  /** 最近一次发提醒的日期（yyyy-MM-dd），用于云函数去重 */
  lastRemindDate?: string;
}

/** 用户提醒设置，对应 userSettings 集合（kind: 'settings'） */
export interface UserSettings {
  /** 提前 1 / 3 / 7 天提醒（PRD 3.4.2） */
  advanceDays: 1 | 3 | 7;
  /** 到期当天是否再提醒一次 */
  remindToday: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  advanceDays: 3,
  remindToday: true
};
