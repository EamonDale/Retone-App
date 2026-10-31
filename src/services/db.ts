import Taro from '@tarojs/taro';
import type { Product, UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

/**
 * 云数据库封装（PRD 四.2 / 五）
 * 客户端查询会自动带上 openid 条件，数据天然按用户隔离
 *
 * 注意：database() 必须在 cloud.init()（app.ts useLaunch）之后调用，
 * 这里惰性获取，避免模块顶层求值抛错导致整页模块加载失败（真机偶发）。
 */
type Db = ReturnType<typeof Taro.cloud.database>;
let _db: Db | null = null;
function db(): Db {
  if (!_db) _db = Taro.cloud.database();
  return _db;
}

const productsCol = () => db().collection('products');
const settingsCol = () => db().collection('userSettings');
const MAX_LIMIT = 20; // 单次查询上限，分页取全量

// Taro 对 doc().get()/remove() 的类型定义带必填参数，实际可无参调用，这里放宽
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docRef = (col: any, id: string): any => col.doc(id);

/** 分页取全量，绕过单次 20 条限制 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryAll<T>(query: any): Promise<T[]> {
  const { total } = await query.count();
  const batches = Math.ceil(total / MAX_LIMIT);
  const tasks: Promise<{ data: T[] }>[] = [];
  for (let i = 0; i < batches; i++) {
    tasks.push(
      query.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get() as unknown as Promise<{ data: T[] }>
    );
  }
  const results = await Promise.all(tasks);
  return results.reduce<T[]>((acc, r) => acc.concat(r.data || []), []);
}

/** 在售产品（首页列表用） */
export function fetchActiveProducts(): Promise<Product[]> {
  return queryAll<Product>(productsCol().where({ status: 'active' }));
}

/** 全部产品（清除数据用） */
export function fetchAllProducts(): Promise<Product[]> {
  return queryAll<Product>(
    productsCol().where({ status: db().command.in(['active', 'usedUp']) })
  );
}

export function getProduct(id: string): Promise<Product> {
  return docRef(productsCol(), id).get().then((r: any) => r.data as Product);
}

export type NewProductData = Pick<
  Product,
  'name' | 'category' | 'expiryDate' | 'productionDate' | 'shelfLifeDays' | 'shelfLifeLabel' | 'note' | 'photoFileID' | 'stockQuantity' | 'efficacy' | 'dosage' | 'location'
>;

export async function addProduct(data: NewProductData): Promise<string> {
  const res = await productsCol().add({
    data: { ...data, status: 'active', createdAt: Date.now() } as Record<string, unknown>
  });
  return res._id as string;
}

export function updateProduct(id: string, data: Partial<NewProductData>): Promise<unknown> {
  return docRef(productsCol(), id).update({ data });
}

export function removeProduct(id: string): Promise<unknown> {
  return docRef(productsCol(), id).remove();
}

export function markUsedUp(id: string): Promise<unknown> {
  return docRef(productsCol(), id).update({ data: { status: 'usedUp' } });
}

/** 清除数据：删除当前用户的所有产品记录，返回条数（并发删除） */
export async function clearAllProducts(): Promise<number> {
  const all = await fetchAllProducts();
  await Promise.all(all.map((p) => removeProduct(p._id)));
  return all.length;
}

/** 某分类下的产品数（删除自定义分类前确认 / 迁移判断用） */
export async function countProductsInCategory(key: string): Promise<number> {
  const res = await productsCol().where({ category: key }).count();
  return res.total;
}

/** 批量把 from 分类下的产品改到 to 分类（客户端批量 update 仅作用于本人数据） */
// Taro 的 Query 类型未声明批量 update，运行时可用，这里放宽
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reassignCategory(from: string, to: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (productsCol().where({ category: from }) as any).update({ data: { category: to } });
}

/** 上传包装照片到云存储，返回 fileID */
export async function uploadPhoto(filePath: string): Promise<string> {
  const ext = /\.png$/i.test(filePath) ? 'png' : 'jpg';
  const res = await Taro.cloud.uploadFile({
    cloudPath: `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    filePath
  });
  return res.fileID;
}

/** 读取提醒设置（PRD 3.4.2：提前 1/3/7 天、当天再提醒） */
export async function getSettings(): Promise<UserSettings> {
  try {
    const res = await settingsCol().where({ kind: 'settings' }).limit(1).get();
    if (res.data.length) {
      const d = res.data[0] as Record<string, unknown>;
      const advance = d.advanceDays as UserSettings['advanceDays'];
      return {
        advanceDays: [1, 3, 7].includes(advance as number) ? advance : DEFAULT_SETTINGS.advanceDays,
        remindToday: typeof d.remindToday === 'boolean' ? d.remindToday : DEFAULT_SETTINGS.remindToday
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** 保存提醒设置（不存在则创建） */
export async function saveSettings(settings: UserSettings): Promise<void> {
  const res = await settingsCol().where({ kind: 'settings' }).get();
  if (res.data.length) {
    await docRef(settingsCol(), (res.data[0] as { _id: string })._id).update({ data: { ...settings } });
  } else {
    await settingsCol().add({ data: { kind: 'settings', ...settings } });
  }
}
