export default {
  pages: [
    'pages/splash/index',
    'pages/index/index',
    'pages/add/index',
    'pages/detail/index',
    'pages/categories/index',
    'pages/profile/index'
  ],
  window: {
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '留响',
    backgroundColor: '#F6F7FB',
    backgroundTextStyle: 'dark'
  },
  tabBar: {
    color: '#9AA0A6',
    selectedColor: '#3D7EFF',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png'
      }
    ]
  },
  cloud: true
};
