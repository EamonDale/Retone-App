import { View, Text } from '@tarojs/components';
import './index.scss';

interface Props {
  text?: string;
  hint?: string;
}

/** 空状态（PRD 3.1：插画 + 点 + 添加第一个产品） */
export default function EmptyState({ text = '还没有产品', hint = '点右下角 + 添加第一个产品' }: Props) {
  return (
    <View className='empty'>
      <Text className='empty-emoji'>📦</Text>
      <Text className='empty-text'>{text}</Text>
      <Text className='empty-hint'>{hint}</Text>
    </View>
  );
}
