/** 分类定义（PRD 3.1 分类 Tab / 3.2.2 表单字段） */
export const CATEGORIES = [
  { key: 'food', label: '食品', icon: '🥛' },
  { key: 'beauty', label: '美妆', icon: '💄' },
  { key: 'medicine', label: '药品', icon: '💊' },
  { key: 'daily', label: '日用品', icon: '🧴' },
  { key: 'other', label: '其他', icon: '📦' }
] as const;

export type CategoryKey = typeof CATEGORIES[number]['key'];

/** 分类条目（内置 + 自定义统一结构） */
export interface CategoryDef {
  key: string;
  label: string;
  icon: string;
  /** 是否用户自建分类 */
  custom?: boolean;
}

/**
 * 图标库：分组 emoji，附中文关键词用于搜索与按名称推荐
 * （覆盖常见品类，无需引入图标资源文件）
 */
export interface EmojiItem {
  /** emoji 字符 */
  c: string;
  /** 空格分隔的中文关键词 */
  kw: string;
}

export interface EmojiGroup {
  name: string;
  items: EmojiItem[];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: '食物',
    items: [
      { c: '🍎', kw: '苹果 水果' }, { c: '🍌', kw: '香蕉 水果' }, { c: '🍇', kw: '葡萄 水果' },
      { c: '🍓', kw: '草莓 水果' }, { c: '🍑', kw: '桃 水果' }, { c: '🍉', kw: '西瓜 水果' },
      { c: '🥕', kw: '胡萝卜 蔬菜' }, { c: '🥦', kw: '西兰花 蔬菜' }, { c: '🌽', kw: '玉米 蔬菜' },
      { c: '🍅', kw: '番茄 蔬菜' }, { c: '🥔', kw: '土豆 蔬菜' }, { c: '🥩', kw: '肉 生鲜 牛排' },
      { c: '🍗', kw: '鸡肉 肉' }, { c: '🐟', kw: '鱼 水产 海鲜' }, { c: '🦐', kw: '虾 海鲜 水产' },
      { c: '🥟', kw: '饺子 速食 冷冻' }, { c: '🍜', kw: '面条 主食 泡面' }, { c: '🍞', kw: '面包 烘焙 早餐' },
      { c: '🍰', kw: '蛋糕 甜品 烘焙' }, { c: '🍪', kw: '饼干 零食' }, { c: '🍫', kw: '巧克力 零食 糖果' },
      { c: '🍬', kw: '糖果 零食' }, { c: '🥫', kw: '罐头 储备 宠物粮' }, { c: '🧀', kw: '奶酪 奶制品' }
    ]
  },
  {
    name: '饮品',
    items: [
      { c: '🥛', kw: '牛奶 鲜奶 奶' }, { c: '☕', kw: '咖啡 咖啡豆' }, { c: '🍵', kw: '茶 茶叶' },
      { c: '🧃', kw: '果汁 饮料' }, { c: '🥤', kw: '奶茶 可乐 汽水' }, { c: '🧋', kw: '奶茶 珍珠' },
      { c: '🍺', kw: '啤酒 酒' }, { c: '🍷', kw: '红酒 葡萄酒 酒' }, { c: '🍶', kw: '清酒 黄酒 调味 料酒' },
      { c: '🍯', kw: '蜂蜜 调味' }, { c: '🧊', kw: '冰块 冰袋 冰品' }
    ]
  },
  {
    name: '美妆个护',
    items: [
      { c: '💄', kw: '口红 美妆 化妆品' }, { c: '🧴', kw: '乳液 护肤 洗发水 瓶装' }, { c: '🧼', kw: '香皂 洗护 手工皂' },
      { c: '🪥', kw: '牙刷 口腔 牙膏' }, { c: '🧻', kw: '纸巾 卷纸 抽纸' }, { c: '💅', kw: '指甲油 美甲' },
      { c: '🩹', kw: '创可贴 医药 敷料' }
    ]
  },
  {
    name: '清洁家居',
    items: [
      { c: '🧹', kw: '扫把 清洁 打扫' }, { c: '🧺', kw: '洗衣 洗衣液 篮' }, { c: '🧽', kw: '百洁布 海绵 清洁' },
      { c: '🪣', kw: '水桶 清洁 拖把' }, { c: '🕯️', kw: '蜡烛 香薰' }, { c: '🧯', kw: '灭火器 安全' },
      { c: '🪑', kw: '椅子 家具' }
    ]
  },
  {
    name: '药品健康',
    items: [
      { c: '💊', kw: '药 药品 胶囊 保健' }, { c: '🩺', kw: '体检 保健 医疗' }, { c: '😷', kw: '口罩 防护' },
      { c: '🌡️', kw: '体温计 医疗 保健' }
    ]
  },
  {
    name: '数码电器',
    items: [
      { c: '🔌', kw: '插线板 充电 数据线' }, { c: '🔋', kw: '电池 充电' }, { c: '💡', kw: '灯泡 灯 照明' },
      { c: '🔦', kw: '手电 照明' }, { c: '🖥️', kw: '电脑 显示器 数码' }, { c: '📱', kw: '手机 数码' },
      { c: '🎧', kw: '耳机 数码' }, { c: '📷', kw: '相机 数码' }, { c: '🎮', kw: '游戏机 手柄 数码' },
      { c: '🖨️', kw: '打印机 办公' }
    ]
  },
  {
    name: '母婴宠物',
    items: [
      { c: '🍼', kw: '奶瓶 婴儿 母婴' }, { c: '👶', kw: '婴儿 母婴' }, { c: '🧸', kw: '玩具 娃娃 母婴' },
      { c: '🪀', kw: '玩具 球' }, { c: '🐶', kw: '狗 宠物 狗粮' }, { c: '🐱', kw: '猫 宠物 猫粮' },
      { c: '🐾', kw: '宠物 爪印' }
    ]
  },
  {
    name: '文具书籍',
    items: [
      { c: '📚', kw: '书 书籍 阅读' }, { c: '✏️', kw: '铅笔 文具' }, { c: '🖊️', kw: '笔 文具 签字笔' },
      { c: '📐', kw: '尺子 文具' }, { c: '✂️', kw: '剪刀 文具' }, { c: '📎', kw: '回形针 文具 夹子' },
      { c: '🗂️', kw: '文件夹 收纳' }
    ]
  },
  {
    name: '衣物鞋帽',
    items: [
      { c: '👕', kw: '衣服 上衣 T恤' }, { c: '👖', kw: '裤子 牛仔裤' }, { c: '👗', kw: '裙子 连衣裙' },
      { c: '🧦', kw: '袜子' }, { c: '🧤', kw: '手套' }, { c: '🧣', kw: '围巾' },
      { c: '👟', kw: '鞋 运动鞋 球鞋' }, { c: '👜', kw: '包 箱包' }, { c: '🕶️', kw: '墨镜 太阳镜' },
      { c: '🧢', kw: '帽子 鸭舌帽' }
    ]
  },
  {
    name: '运动户外',
    items: [
      { c: '⚽', kw: '足球 运动 球' }, { c: '🏀', kw: '篮球 运动 球' }, { c: '🎾', kw: '网球 运动' },
      { c: '🏸️', kw: '羽毛球 运动' }, { c: '🏊', kw: '游泳 泳装 运动' }, { c: '⛺', kw: '帐篷 露营 户外' },
      { c: '🚲', kw: '自行车 骑行 户外' }, { c: '🎣', kw: '钓鱼 户外' }
    ]
  },
  {
    name: '工具五金',
    items: [
      { c: '🔧', kw: '扳手 工具 五金' }, { c: '🔨', kw: '锤子 工具 五金' }, { c: '🪛', kw: '螺丝刀 工具 五金' },
      { c: '🔩', kw: '螺丝 五金' }, { c: '🧰', kw: '工具箱 五金' }, { c: '🪜', kw: '梯子 工具' },
      { c: '📏', kw: '卷尺 尺子 工具' }
    ]
  },
  {
    name: '其他',
    items: [
      { c: '📦', kw: '箱子 包裹 储物' }, { c: '🎁', kw: '礼物 礼品' }, { c: '🌱', kw: '植物 绿植' },
      { c: '🪴', kw: '盆栽 植物 绿植' }, { c: '🖼️', kw: '相框 装饰' }, { c: '🗝️', kw: '钥匙' },
      { c: '⏰', kw: '闹钟 计时' }, { c: '🧾', kw: '票据 单据' }, { c: '🎨', kw: '颜料 画画 文具' }
    ]
  }
];

/** 按关键词或分组名搜索图标（空查询返回全部分组） */
export function searchEmojiGroups(query: string): EmojiGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return EMOJI_GROUPS;
  return EMOJI_GROUPS.map((g) => ({
    name: g.name,
    items: g.items.filter((i) => i.kw.includes(q) || g.name.includes(q))
  })).filter((g) => g.items.length);
}

/** 根据分类名称推荐图标（首个关键词命中），无命中返回空串 */
export function suggestEmoji(name: string): string {
  const n = name.trim();
  if (!n) return '';
  for (const g of EMOJI_GROUPS) {
    for (const i of g.items) {
      if (i.kw.split(' ').some((k) => k && n.includes(k))) return i.c;
    }
  }
  return '';
}

/**
 * 自定义分类注册表：云端的用户分类异步加载后写入这里，
 * 供 ProductCard / 详情页等同步展示场景即时查询
 */
let customCategories: CategoryDef[] = [];

export function setCustomCategories(list: CategoryDef[]) {
  customCategories = Array.isArray(list) ? list : [];
}

export function getCustomCategories(): CategoryDef[] {
  return customCategories;
}

/** 内置 + 自定义全部分类 */
export function allCategories(): CategoryDef[] {
  return [...CATEGORIES, ...customCategories];
}

/** 首页分类 Tab（含「全部」） */
export function allTabs(): CategoryDef[] {
  return [{ key: 'all', label: '全部', icon: '🗂' }, ...allCategories()];
}

/** 按 key 查分类，未命中（含已删除）回退「其他」 */
export function categoryInfo(key: string): CategoryDef {
  return allTabs().find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
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
