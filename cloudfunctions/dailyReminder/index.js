/**
 * 每日到期提醒云函数（PRD 3.4）
 *
 * 触发器：每天 09:00（见 config.json triggers，7 段 cron：秒 分 时 日 月 周 年）
 * 逻辑：
 *  1. 查所有 status=active 且到期日在未来 7 天内的产品
 *  2. 按 openid 分组，按用户设置 advanceDays（1/3/7）过滤
 *  3. 对有订阅额度（subscribeQuota.quota > 0）的用户发订阅消息
 *  4. 发送成功后 quota -1、记录 lastRemindDate，避免重复发
 *
 * 支持的动作（通过 event.action）：
 *  - 无 / 'run'     执行每日扫描发送
 *  - 'addQuota'     用户点「允许订阅」后额度 +1（客户端 notify.ts 调用）
 *  - 'run' + dryRun 只统计不发送，用于联调
 *
 * 需要配置的环境变量：
 *  - TEMPLATE_ID          订阅消息模板 ID
 *  - MINIPROGRAM_STATE    可选，formal(正式)/trial(体验)/developer(开发)，默认 formal
 *
 * 模板字段（与 src/config/env.ts 说明一致）：
 *  product_name(thing) / days_left(number) / expiry_date(date)
 *  若你在公众平台创建的模板字段 key 不同，改 sendMessage 里的 data 映射即可。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_ADVANCE = 30; // 设置里最大提前 30 天，扫描窗口按 30 天算
const CN_TZ_OFFSET = 8 * 3600 * 1000;

/** 北京时区的今天，yyyy-MM-dd（云函数跑在 UTC，需 +8 修正） */
function beijingTodayStr() {
  return new Date(Date.now() + CN_TZ_OFFSET).toISOString().slice(0, 10);
}

/** 北京时区某天 00:00 的时间戳 */
function beijingDayStartTs(dateStr) {
  return Date.parse(`${dateStr}T00:00:00+08:00`);
}

function fmtDate(ts) {
  const d = new Date(ts + CN_TZ_OFFSET);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) : s;
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  if (event.action === 'addQuota') {
    return addQuota();
  }
  if (event.action === 'checkQuota') {
    return checkQuota();
  }
  // 默认执行每日提醒（定时触发器与手动测试都走这里）
  return runDailyReminder(event.dryRun === true);
};

/** 用户点「允许订阅」→ 额度 +1（PRD 5.2 subscribeQuota） */
async function addQuota() {
  try {
    const col = db.collection('subscribeQuota');
    const res = await col.where({ _openid: OPENID }).get();
    if (res.data.length) {
      await col.doc(res.data[0]._id).update({
        data: { quota: _.inc(1), updatedAt: Date.now() }
      });
      console.log('[dailyReminder] 用户额度已更新', OPENID, res.data[0].quota + 1);
    } else {
      await col.add({ data: { _openid: OPENID, quota: 1, updatedAt: Date.now() } });
      console.log('[dailyReminder] 新用户额度已创建', OPENID);
    }
    return { ok: true };
  } catch (e) {
    console.error('[dailyReminder] 更新额度失败', e);
    throw e;
  }
}

/** 检查用户订阅额度 */
async function checkQuota() {
  try {
    const col = db.collection('subscribeQuota');
    const res = await col.where({ _openid: OPENID }).get();
    const quota = res.data.length > 0 ? res.data[0].quota : 0;
    console.log('[dailyReminder] 查询额度', OPENID, quota);
    return { ok: true, quota };
  } catch (e) {
    console.error('[dailyReminder] 查询额度失败', e);
    return { ok: false, quota: 0 };
  }
}

async function runDailyReminder(dryRun) {
  const todayStr = beijingTodayStr();
  const startTs = beijingDayStartTs(todayStr);
  const endTs = startTs + (MAX_ADVANCE + 1) * 86400000;

  if (!dryRun && !process.env.TEMPLATE_ID) {
    return { ok: false, message: '未配置环境变量 TEMPLATE_ID，见 dailyReminder/index.js 头部说明' };
  }

  console.log('[dailyReminder] 开始执行，日期:', todayStr, '扫描范围:', startTs, '-', endTs);

  // 1. 查 7 天内到期、未用完的产品（含今天到期，不含已过期）
  const res = await db
    .collection('products')
    .where({
      status: 'active',
      expiryDate: _.gte(startTs).and(_.lt(endTs))
    })
    .limit(1000)
    .get();

  if (!res.data || res.data.length === 0) {
    console.log('[dailyReminder] 没有需要提醒的产品');
    return { ok: true, today: todayStr, matched: 0, users: 0, sent: 0, skipped: {}, errors: [] };
  }

  console.log('[dailyReminder] 找到', res.data.length, '个产品需要提醒');

  // 2. 按 openid 分组
  const byUser = {};
  for (const p of res.data) {
    const left = Math.floor((p.expiryDate - startTs) / 86400000);
    if (left < 0 || left > MAX_ADVANCE) continue;
    (byUser[p._openid] = byUser[p._openid] || []).push({ product: p, left });
  }

  let sent = 0;
  const skipped = { noQuota: 0, reminded: 0, remindTodayOff: 0, beyondAdvance: 0 };
  const errors = [];

  for (const openid of Object.keys(byUser)) {
    const list = byUser[openid];
    console.log('[dailyReminder] 处理用户', openid, '有', list.length, '个产品');

    // 用户提醒设置（默认提前 3 天、当天提醒）
    let advanceDays = 3;
    let remindToday = true;
    try {
      const s = await db
        .collection('userSettings')
        .where({ _openid: openid, kind: 'settings' })
        .limit(1)
        .get();
      if (s.data.length) {
        advanceDays = [1, 3, 7].includes(s.data[0].advanceDays) ? s.data[0].advanceDays : 3;
        remindToday = s.data[0].remindToday !== false;
        console.log('[dailyReminder] 用户设置', openid, 'advanceDays:', advanceDays, 'remindToday:', remindToday);
      }
    } catch (e) {
      console.warn('[dailyReminder] 读取设置失败，使用默认', openid, e.message);
    }

    // 3. 订阅额度检查
    let quotaDoc = null;
    if (!dryRun) {
      try {
        const q = await db.collection('subscribeQuota').where({ _openid: openid }).get();
        if (!q.data.length || q.data[0].quota <= 0) {
          console.log('[dailyReminder] 用户', openid, '没有订阅额度，跳过');
          skipped.noQuota += list.length;
          continue;
        }
        quotaDoc = q.data[0];
        console.log('[dailyReminder] 用户', openid, '订阅额度:', quotaDoc.quota);
      } catch (e) {
        console.error('[dailyReminder] 查询额度失败', e);
        skipped.noQuota += list.length;
        continue;
      }
    }

    for (const { product: p, left } of list) {
      if (left < 0 || left > advanceDays) {
        skipped.beyondAdvance++;
        continue;
      }
      if (left === 0 && !remindToday) {
        skipped.remindTodayOff++;
        continue;
      }
      if (p.lastRemindDate === todayStr) {
        skipped.reminded++;
        continue;
      }

      if (dryRun) {
        sent++;
        console.log('[dailyReminder dryRun] 将发送给', openid, '产品:', p._id, '剩余天数:', left);
        continue;
      }

      // 4. 发订阅消息，点消息跳到产品详情（PRD 3.4.1）
      try {
        const result = await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: process.env.TEMPLATE_ID,
          page: `pages/detail/index?id=${p._id}`,
          miniprogramState: process.env.MINIPROGRAM_STATE || 'formal',
          data: {
            thing1: {
              value: truncate(p.name || '未命名产品', 20)
            },
            number2: {
              value: left
            },
            date3: {
              value: new Date(p.expiryDate + CN_TZ_OFFSET).toISOString().slice(0, 10)
            }
          }
        });

        console.log('[dailyReminder] 发送成功', openid, '产品:', p._id, '结果:', result);

        if (result.errCode === 0) {
          sent++;

          // 额度 -1 + 记录已发送，避免重复发（PRD 3.4.3）
          try {
            await db.collection('subscribeQuota').doc(quotaDoc._id).update({
              data: { quota: _.inc(-1), updatedAt: Date.now() }
            });
            await db.collection('products').doc(p._id).update({
              data: { lastRemindDate: todayStr }
            });
            console.log('[dailyReminder] 额度已扣减，已记录提醒日期', openid, p._id);
          } catch (e) {
            console.error('[dailyReminder] 更新状态失败', e);
          }
        } else {
          console.error('[dailyReminder] 发送失败', openid, p._id, result);
          errors.push({
            openid,
            productId: p._id,
            errCode: result.errCode,
            errMsg: result.errMsg
          });
          // 43101 = 用户未订阅 / 无额度，后续发送也会失败，跳出该用户
          if (result.errCode === 43101) {
            console.log('[dailyReminder] 用户未授权，停止发送给该用户', openid);
            break;
          }
        }
      } catch (e) {
        console.error('[dailyReminder] 发送异常', openid, p._id, e);
        errors.push({
          openid,
          productId: p._id,
          errCode: e.errCode,
          errMsg: e.errMsg || e.message
        });
        // 43101 = 用户未订阅 / 无额度，后续发送也会失败，跳出该用户
        if (e.errCode === 43101) {
          console.log('[dailyReminder] 用户未授权，停止发送给该用户', openid);
          break;
        }
      }
    }
  }

  const summary = { ok: true, today: todayStr, matched: res.data.length, users: Object.keys(byUser).length, sent, skipped, errors };
  console.log('[dailyReminder] 执行完成', JSON.stringify(summary));
  return summary;
}
