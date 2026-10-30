/**
 * OCR 文本解析（PRD 3.2.3 正则规则）
 *
 * 日期：2026.01.01 / 2026-01-01 / 2026/01/01 / 20260101 / 26/01/01
 * 保质期：保质期：6个月 / 保质期 180天 / shelf life: 12M
 */
export interface ShelfLife {
  amount: number;
  unit: 'day' | 'month' | 'year';
}

export interface OcrParseResult {
  productionDate?: string;
  expiryDate?: string;
  shelfLife?: ShelfLife;
}

const DAY_WORDS = ['天', '日', 'd', 'day', 'days'];
const YEAR_WORDS = ['年', 'y', 'year', 'years'];

function normalizeDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 从文本中提取所有合法日期，升序返回 */
export function extractDates(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;

  // 2026.01.01 / 2026-01-01 / 2026/01/01 / 2026年1月1日（含全角点）
  const re1 = /(\d{4})\s*[.．\/\-年]\s*(\d{1,2})\s*[.．\/\-月]\s*(\d{1,2})日?/g;
  while ((m = re1.exec(text))) {
    const s = normalizeDate(+m[1], +m[2], +m[3]);
    if (s) out.add(s);
  }

  // 20260101
  const re2 = /\b(20\d{2})(\d{2})(\d{2})\b/g;
  while ((m = re2.exec(text))) {
    const s = normalizeDate(+m[1], +m[2], +m[3]);
    if (s) out.add(s);
  }

  // 26/01/01 两位年
  const re3 = /\b(\d{2})[.\/\-](\d{1,2})[.\/\-](\d{1,2})\b/g;
  while ((m = re3.exec(text))) {
    const s = normalizeDate(+m[1], +m[2], +m[3]);
    if (s) out.add(s);
  }

  return Array.from(out).sort();
}

/** 提取保质期：数字 + 单位，无单位时默认按「月」 */
export function extractShelfLife(text: string): ShelfLife | undefined {
  const re = /(?:保质期|shelf\s*life)\s*[：:]?\s*(\d{1,4})\s*(天|日|个月|月|年|days?|months?|years?|[DMY])?/i;
  const m = re.exec(text);
  if (!m) return undefined;
  const amount = parseInt(m[1], 10);
  if (!amount || amount <= 0) return undefined;
  const raw = (m[2] || '').toLowerCase();
  let unit: ShelfLife['unit'] = 'month';
  if (DAY_WORDS.includes(raw)) unit = 'day';
  else if (YEAR_WORDS.includes(raw)) unit = 'year';
  return { amount, unit };
}

/**
 * 主解析函数：
 * - 有「生产日期」标签 → 取其后第一个日期
 * - 有「保质期至 / 有效期至 / EXP」标签 → 取其后最后一个日期
 * - 否则兜底：最早日期 = 生产日期，最晚日期 = 到期日
 */
export function parseExpiryText(raw: string): OcrParseResult {
  const text = (raw || '').replace(/\s+/g, ' ');
  if (!text) return {};

  const result: OcrParseResult = {};
  const allDates = extractDates(text);
  const shelfLife = extractShelfLife(text);
  if (shelfLife) result.shelfLife = shelfLife;

  const prodIdx = text.search(/生产日期|生产\s*DATE|MFG|MANUFACTUR/i);
  const expIdx = text.search(/保质期至|有效期至|到期日|EXP|USE\s*BY/i);

  if (prodIdx >= 0) {
    const after = extractDates(text.slice(prodIdx));
    if (after.length) result.productionDate = after[0];
  }
  if (expIdx >= 0) {
    const after = extractDates(text.slice(expIdx));
    if (after.length) result.expiryDate = after[after.length - 1];
  }

  if (!result.productionDate && allDates.length) result.productionDate = allDates[0];
  if (!result.expiryDate && allDates.length > 1) result.expiryDate = allDates[allDates.length - 1];

  // 同一天 / 倒置修正
  if (result.productionDate && result.productionDate === result.expiryDate) {
    delete result.expiryDate;
  }
  if (
    result.productionDate &&
    result.expiryDate &&
    result.expiryDate < result.productionDate
  ) {
    const tmp = result.productionDate;
    result.productionDate = result.expiryDate;
    result.expiryDate = tmp;
  }

  return result;
}
