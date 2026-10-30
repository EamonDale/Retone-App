/**
 * 生成 tabBar 图标（81x81 PNG）与小程序 App 图标（512x512 PNG，体现「保质期」主题）
 * 纯 Node 实现，无第三方依赖。用法：npm run icons
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG 编码 ----------
function crc32(buf) {
  if (!crc32.table) {
    crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 形状绘制（2x2 超采样抗锯齿） ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeIcon(size, colorHex, shape) {
  const [r, g, b] = hexToRgb(colorHex);
  const buf = Buffer.alloc(size * size * 4);
  const offsets = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (const [ox, oy] of offsets) {
        if (shape(x + ox, y + oy)) cov += 0.25;
      }
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(cov * 255);
    }
  }
  return buf;
}

// 首页：屋顶三角 + 房身 + 门（镂空）
function homeShape(x, y) {
  const roof = y >= 10 && y <= 40 && Math.abs(x - 40.5) <= (y - 10) * (31 / 30);
  const body = x >= 16 && x <= 65 && y > 40 && y <= 68;
  const door = x >= 34 && x <= 47 && y > 48 && y <= 68;
  return (roof || body) && !door;
}

// 我的：头 + 半圆肩
function profileShape(x, y) {
  const head = Math.hypot(x - 40.5, y - 25) <= 13;
  const shoulder =
    y >= 45 && y <= 69 &&
    ((x - 40.5) / 26) ** 2 + ((y - 69) / 24) ** 2 <= 1;
  return head || shoulder;
}

// ---------- 输出 ----------
const outDir = path.join(__dirname, '..', 'src', 'assets', 'tab');
fs.mkdirSync(outDir, { recursive: true });

const SIZE = 81;
const icons = [
  { file: 'home.png', color: '#9AA0A6', shape: homeShape },
  { file: 'home-active.png', color: '#3D7EFF', shape: homeShape },
  { file: 'profile.png', color: '#9AA0A6', shape: profileShape },
  { file: 'profile-active.png', color: '#3D7EFF', shape: profileShape }
];

for (const { file, color, shape } of icons) {
  const png = encodePNG(SIZE, SIZE, makeIcon(SIZE, color, shape));
  fs.writeFileSync(path.join(outDir, file), png);
  console.log('生成', file, `${png.length} bytes`);
}
console.log('tabBar 图标生成完毕 →', outDir);

// ---------- 小程序 App 图标（保质期：自下而上绿色渐变 + 白色日历 + 时钟） ----------
const SDF = {
  roundRect(px, py, cx, cy, hx, hy, r) {
    const dx = Math.abs(px - cx) - (hx - r);
    const dy = Math.abs(py - cy) - (hy - r);
    return (
      Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r
    );
  },
  seg(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
  }
};

function blend(c1, c2, a) {
  return [c1[0] + (c2[0] - c1[0]) * a, c1[1] + (c2[1] - c1[1]) * a, c1[2] + (c2[2] - c1[2]) * a];
}

function genAppIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const TOP = hexToRgb('#4ADE80'); // 顶部浅绿
  const BOT = hexToRgb('#16A34A'); // 底部深绿（自下而上渐变）
  const WHITE = [255, 255, 255];
  const GREEN = hexToRgb('#15803D'); // 时钟盘面
  const SS = 3; // 3x3 超采样
  const RINGS = [
    { ax: 190, ay: 104, bx: 190, by: 192 },
    { ax: 322, ay: 104, bx: 322, by: 192 }
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 背景：自下而上绿色渐变（顶部浅、底部深）
      const t = y / (size - 1);
      let color = blend(TOP, BOT, t);

      let covCal = 0;
      let covRing = 0;
      let covClock = 0;
      let covHand = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (SDF.roundRect(px, py, 256, 291, 152, 141, 52) <= 0) covCal++;
          for (const r of RINGS) {
            if (SDF.seg(px, py, r.ax, r.ay, r.bx, r.by) <= 15) covRing++;
          }
          const dc = Math.hypot(px - 256, py - 300);
          if (dc <= 86) covClock++;
          if (
            SDF.seg(px, py, 256, 300, 286, 252) <= 8 || // 分针
            SDF.seg(px, py, 256, 300, 222, 296) <= 8 || // 时针
            dc <= 11 // 中心销
          ) {
            covHand++;
          }
        }
      }
      const n = SS * SS;
      color = blend(color, WHITE, covCal / n); // 日历卡
      color = blend(color, WHITE, covRing / n); // 装订环
      color = blend(color, GREEN, covClock / n); // 时钟盘面
      color = blend(color, WHITE, covHand / n); // 指针

      const i = (y * size + x) * 4;
      buf[i] = Math.round(color[0]);
      buf[i + 1] = Math.round(color[1]);
      buf[i + 2] = Math.round(color[2]);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

// ---------- App 图标输出（项目根 assets/，不上传进小程序包） ----------
const appIconDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(appIconDir, { recursive: true });
const appIcon = encodePNG(512, 512, genAppIcon(512));
fs.writeFileSync(path.join(appIconDir, 'app-icon.png'), appIcon);
console.log('生成 app-icon.png', `${appIcon.length} bytes（512x512，上传到 mp.weixin.qq.com → 设置 → 基本设置 → 头像）`);
console.log('小程序图标生成完毕 →', appIconDir);
