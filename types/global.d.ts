/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.scss';
declare module '*.css';

declare function defineAppConfig(config: Record<string, any>): void;
declare function definePageConfig(config: Record<string, any>): void;
