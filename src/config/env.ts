/**
 * 全局环境配置 —— 部署前需要修改这里
 *
 * 1. CLOUD_ENV_ID：微信云开发环境 ID。
 *    打开微信开发者工具 → 云开发控制台 → 环境，复制环境 ID 填到这里。
 *    留空则使用「默认环境」。
 *
 * 2. SUBSCRIBE_TEMPLATE_ID：订阅消息模板 ID。
 *    微信公众平台 → 订阅消息 → 选用模板，创建后把模板 ID 填到这里。
 *    模板字段建议（与云函数 dailyReminder 的发送数据一一对应）：
 *      - 产品名称 product_name （类型：thing）
 *      - 剩余天数 days_left    （类型：number）
 *      - 到期日   expiry_date  （类型：date）
 */
export const CLOUD_ENV_ID = 'cloud1-d4gpvhlk6ea2ca068';

export const SUBSCRIBE_TEMPLATE_ID = 'HN2z4dFjnnv-aysNg4_noG25DG663RFnyqfFU-2Ld4A';