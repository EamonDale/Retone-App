# 留响 Retone（Resound App）

> 拍照记录产品保质期，到点通过微信订阅消息提醒。
> 技术栈：Taro 4 + React + TypeScript + 微信云开发（CloudBase），对应 PRD v1.0。

## 一、目录结构

```
Resound App/
├── src/
│   ├── pages/
│   │   ├── splash/         # 首屏加载页（白底 + 保质期图标 + 自下而上绿色渐变）
│   │   ├── index/          # 首页：统计条 + 分类 Tab + 产品列表 + 悬浮 +
│   │   ├── add/            # 添加产品（两种录入模式 + 拍照 OCR，带 id 复用为编辑）
│   │   ├── detail/         # 产品详情：大图预览 + 编辑/标记已用完/删除
│   │   └── profile/        # 我的：提醒设置 + 订阅授权 + 关于 + 清除数据
│   ├── components/
│   │   ├── ProductCard/    # 产品卡片（左侧状态色条/缩略图/剩余天数）
│   │   ├── CategoryTab/    # 分类 Tab（横向滚动）
│   │   ├── StatBar/        # 顶部统计条（点击筛选）
│   │   └── EmptyState/     # 空状态
│   ├── services/
│   │   ├── db.ts           # 云数据库封装（分页取全量/增删改查/设置/上传）
│   │   ├── ocr.ts          # 调云函数 ocrProxy + 正则解析
│   │   └── notify.ts       # 订阅消息授权（允许后额度 +1）
│   ├── utils/
│   │   ├── constants.ts    # 分类/颜色规则/保质期单位（PRD 6.2 色值）
│   │   ├── date.ts         # date-fns：到期日计算、剩余天数
│   │   └── ocrParse.ts     # OCR 文本正则解析（PRD 3.2.3 规则）
│   ├── config/env.ts       # ★ 部署前必改：云环境 ID + 订阅模板 ID
│   ├── app.ts              # 云开发初始化
│   └── app.config.ts       # 页面注册 + tabBar
├── cloudfunctions/
│   ├── ocrProxy/           # OCR 代理：优先微信 OCR，降级百度 OCR
│   └── dailyReminder/      # 每天 09:00 定时扫描 + 发订阅消息 + 额度管理
├── config/                 # Taro 构建配置
├── assets/app-icon.png     # 小程序图标（npm run icons 生成，上传到公众平台）
├── scripts/gen-icons.js    # tabBar/小程序图标生成脚本（npm run icons）
└── project.config.json
```

## 二、快速开始

```bash
cd "Resound App"
npm install
npm run dev:weapp     # 开发模式（watch）
npm run build:weapp   # 生产构建
```

用微信开发者工具「导入项目」，目录选 `Resound App`（根目录，不是 dist），AppID 换成你自己的。`project.config.json` 里 `miniprogramRoot` 已指向 `dist/`，`cloudfunctionRoot` 指向 `cloudfunctions/`。

## 三、部署清单（按顺序做）

### 1. 开通云开发
开发者工具 → 云开发 → 开通，记下**环境 ID**，填到 `src/config/env.ts` 的 `CLOUD_ENV_ID`。

### 2. 创建集合并建索引
云开发控制台 → 数据库 → 新建 3 个集合：

| 集合 | 权限 | 索引 |
|---|---|---|
| `products` | 仅创建者可读写 | ① `expiryDate` 升序 ② `_openid + status` 联合 |
| `subscribeQuota` | 仅创建者可读写 | `_openid` 唯一 |
| `userSettings` | 仅创建者可读写 | 无 |

### 3. 创建订阅消息模板
微信公众平台（mp.weixin.qq.com）→ 订阅消息 → 选用模板，选「产品上架提醒」类或自建，字段：

- 产品名称 `product_name`（thing，≤20 字）
- 剩余天数 `days_left`（number）
- 到期日 `expiry_date`（date）

把**模板 ID** 填到 `src/config/env.ts` 的 `SUBSCRIBE_TEMPLATE_ID`。若你创建的字段 key 不同，改 `cloudfunctions/dailyReminder/index.js` 中 `subscribeMessage.send` 的 `data` 映射。

### 4. 部署云函数
开发者工具里右键 `cloudfunctions/ocrProxy`、`cloudfunctions/dailyReminder` → **上传并部署（云端安装依赖）**。`config.json` 里的定时触发器（每天 09:00，7 段 cron `0 0 9 * * * *`）会随之生效。

### 5. 配置云函数环境变量
云开发控制台 → 云函数 → dailyReminder → 配置：

| 变量 | 说明 |
|---|---|
| `TEMPLATE_ID` | 第 3 步的订阅模板 ID |
| `MINIPROGRAM_STATE` | 可选：formal / trial / developer（默认 formal，调试期建议 trial） |

ocrProxy → 配置（个人主体必配，微信 OCR 插件会自动降级到百度）：

| 变量 | 说明 |
|---|---|
| `BAIDU_OCR_API_KEY` | 百度智能云「通用文字识别」应用 API Key（免费额度 1000 次/天） |
| `BAIDU_OCR_SECRET_KEY` | 对应 Secret Key |

### 6. 验证
- `npm run build:weapp` 后开发者工具预览，添加一个产品，列表立即出现
- 云开发控制台 → 云函数 → dailyReminder → 云端测试，入参 `{}` 跑一次（真发）；`{"dryRun": true}` 只统计不发送
- 手机上点「允许订阅」后触发一次，应收到「产品到期提醒」推送，点击跳详情

## 四、关键设计说明

- **订阅额度（PRD 3.4.2）**：用户每点一次「允许」→ 云函数 `addQuota` 给 `subscribeQuota.quota +1`；发一条 → `-1`。因此添加产品页在「保存」点击时立刻请求授权（真机要求订阅弹窗必须在用户手势栈内调用）。
- **去重**：发送成功后给产品写 `lastRemindDate = 今天`，同一天不重发。
- **兜底（PRD 3.4.4）**：没授权/额度用尽只是发不出消息，首页列表永远展示到期情况。
- **OCR 降级**：ocrProxy 先试微信 `ocr.printedText`（认证主体），抛错自动降级百度；都没配置则返回错误，前端留空手填，不阻塞。
- **首页排序**：按剩余天数升序，已过期（负数）自然排最上；颜色规则 #FF3B30 / #FF9500 / #34C759 / #8E8E93（PRD 6.2）。
- **保质期折算**：数据库存总天数 `shelfLifeDays`（月=30、年=365），同时存展示文案 `shelfLifeLabel`（如「6个月」）。

## 五、常见问题

- **报「无法找到环境」**：`CLOUD_ENV_ID` 没填或没开通云开发。
- **OCR 返回"未配置百度 OCR 密钥"**：个人主体属正常，配百度密钥即可；已认证主体确认 `config.json` 已部署（含 `ocr.printedText` 权限）。
- **收不到订阅消息**：检查模板 ID 两处是否一致（env.ts + 云函数环境变量）、`miniprogramState` 与当前版本是否匹配（体验版用 trial）、额度是否 >0。
- **真机调试/上传报「包体积超限」**：`config/index.js` 已关闭 prebundle 与 source map（dev 模式整包 ~1.2MB），`project.config.json` 已通过 `packOptions.ignore` 排除 `prebundle/` 与 `*.map`、关闭 `uploadWithSourceMap`。若仍超限，先 `rm -rf dist` 重新构建（历史上 dev 模式会在 `dist/prebundle` 生成 1.4MB 调试产物）。
- **小程序图标**：运行 `npm run icons` 生成 `assets/app-icon.png`（512x512，绿色渐变 + 白色日历时钟，呼应首屏页），到 mp.weixin.qq.com → 管理 → 设置 → 基本设置 → 头像处上传。
- **tabBar 图标**：由 `npm run icons` 生成，改色直接改 `scripts/gen-icons.js` 重跑。
