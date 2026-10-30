import { ScrollView, View, Text } from '@tarojs/components';
import { ALL_TABS } from '../../utils/constants';
import './index.scss';

interface Props {
  value: string;
  onChange: (key: string) => void;
}

/** 分类 Tab：横向滚动（PRD 3.1），默认「全部」 */
export default function CategoryTab({ value, onChange }: Props) {
  return (
    <ScrollView className='cate-scroll' scrollX enhanced showScrollbar={false}>
      <View className='cate-row'>
        {ALL_TABS.map((c) => (
          <View
            key={c.key}
            className={`cate-item${value === c.key ? ' active' : ''}`}
            onClick={() => onChange(c.key)}
          >
            <Text className='cate-icon'>{c.icon}</Text>
            <Text className='cate-label'>{c.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
