const config = {
  projectName: 'resound-app',
  date: '2026-10-30',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  // 关闭 source map 产出（dev 模式下 .map 约占 700KB+），配合项目
  // packOptions.ignore / uploadWithSourceMap:false 控制整包体积
  enableSourceMap: false,
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  // webpack5 + 关闭依赖预打包：prebundle 会在 dist/prebundle 生成 1MB+ 的
  // 调试产物导致整包超限无法真机调试，关闭后仅损失少量启动编译速度
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  mini: {
    // 强制关闭 source map 产出（dev 模式下 .map 约占 700KB+），控制整包体积
    webpackChain(chain) {
      chain.devtool(false);
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module_[classname]',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  h5: {}
};

module.exports = config;
