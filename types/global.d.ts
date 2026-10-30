/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.scss';
declare module '*.css';

declare function defineAppConfig(config: Record<string, any>): void;
declare function definePageConfig(config: Record<string, any>): void;

/** 微信小程序运行时全局方法：获取插件实例 */
declare function requirePlugin(name: string): any;
