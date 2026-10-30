import Taro from '@tarojs/taro';
import type { CategoryDef } from '../utils/constants';
import { allCategories, getCustomCategories, setCustomCategories } from '../utils/constants';
import { countProductsInCategory, reassignCategory } from './db';

/**
 * 自定义分类服务
 * 存储：userSettings 集合中 kind: 'categories' 的文档（每用户一份）
 * 兜底：云不可用时读写本地缓存（Storage），保证功能可用
 */
const COLLECTION = 'userSettings';
const CACHE_KEY = 'resound_custom_categories';
/** 自定义分类数量上限 */
export const MAX_CUSTOM_CATEGORIES = 10;
/** 分类名称长度上限（chip 展示友好） */
export const MAX_CATEGORY_NAME_LEN = 6;

type Db = ReturnType<typeof Taro.cloud.database>;
type Col = ReturnType<Db['collection']>;

function col(): Col {
  return Taro.cloud.database().collection(COLLECTION);
}

/** 拉取用户自定义分类并写入注册表 + 本地缓存，云失败时回退缓存 */
export async function loadCustomCategories(): Promise<CategoryDef[]> {
  let items: CategoryDef[] = [];
  try {
    const res = await col().where({ kind: 'categories' }).limit(1).get();
    items = ((res.data[0] as { items?: CategoryDef[] })?.items || []).filter(
      (c) => c && c.key && c.label
    );
  } catch {
    items = Taro.getStorageSync(CACHE_KEY) || [];
  }
  setCustomCategories(items);
  Taro.setStorageSync(CACHE_KEY, items);
  return items;
}

/** 写入云端 + 本地缓存 + 注册表；返回云端是否成功（失败=仅本机生效） */
async function persist(items: CategoryDef[]): Promise<boolean> {
  setCustomCategories(items);
  Taro.setStorageSync(CACHE_KEY, items);
  try {
    const res = await col().where({ kind: 'categories' }).limit(1).get();
    if (res.data.length) {
      const id = (res.data[0] as { _id: string })._id;
      await col().doc(id).update({ data: { items } });
    } else {
      await col().add({ data: { kind: 'categories', items } });
    }
    return true;
  } catch (e) {
    console.warn('[categories] 云端保存失败，已缓存到本机', e);
    return false;
  }
}

/** 新增自定义分类，返回新的完整列表 */
export async function addCustomCategory(label: string, icon: string): Promise<CategoryDef[]> {
  const item: CategoryDef = {
    key: `c_${Date.now().toString(36)}`,
    label,
    icon,
    custom: true
  };
  const items = [...getCustomCategories(), item];
  const cloudOk = await persist(items);
  if (!cloudOk) Taro.showToast({ title: '云端不可用，分类仅本机生效', icon: 'none' });
  return items;
}

/** 重命名自定义分类（产品按 key 引用，改名后自动跟随显示） */
export async function renameCustomCategory(key: string, label: string): Promise<CategoryDef[]> {
  const items = getCustomCategories().map((c) => (c.key === key ? { ...c, label } : c));
  const cloudOk = await persist(items);
  if (!cloudOk) Taro.showToast({ title: '云端不可用，改名仅本机生效', icon: 'none' });
  return items;
}

/** 删除自定义分类：先移除分类，再把该分类下的产品批量移入「其他」 */
export async function deleteCustomCategory(key: string): Promise<{ moved: number }> {
  const items = getCustomCategories().filter((c) => c.key !== key);
  const cloudOk = await persist(items);
  if (!cloudOk) Taro.showToast({ title: '云端不可用，删除仅本机生效', icon: 'none' });
  let moved = 0;
  try {
    moved = await countProductsInCategory(key);
    if (moved > 0) await reassignCategory(key, 'other');
  } catch (e) {
    console.warn('[categories] 产品迁移失败', e);
    Taro.showToast({ title: '产品迁移失败，可稍后重试', icon: 'none' });
  }
  return { moved };
}

/** 重名校验（与内置分类及已有自定义分类比对，忽略大小写） */
export function isCategoryNameTaken(label: string): boolean {
  const lower = label.toLowerCase();
  return allCategories().some((c) => c.label.toLowerCase() === lower);
}
