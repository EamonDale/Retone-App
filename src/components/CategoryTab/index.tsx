import { ScrollView, View, Text } from '@tarojs/components';
import type { CategoryDef } from '../../utils/constants';
import { allTabs } from '../../utils/constants';
import './index.scss';

interface Props {
  value: string;
  onChange: (key: string) => void;
  /** Tab 列表，默认内置分类；自定义分类加载后由父组件传入 */
  tabs?: CategoryDef[];
}

/** 分类 Tab：横向滚动（PRD 3.1），默认「全部」 */
export default function CategoryTab({ value, onChange, tabs = allTabs() }: Props) {
  return (
    <ScrollView className='cate-scroll' scrollX enhanced showScrollbar={false}>
      <View className='cate-row'>
        {tabs.map((c) => (
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
