import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useRef, useState } from 'react';
import type { CategoryDef } from '../../utils/constants';
import { allCategories, searchEmojiGroups, suggestEmoji } from '../../utils/constants';
import {
  addCustomCategory,
  deleteCustomCategory,
  isCategoryNameTaken,
  loadCustomCategories,
  MAX_CATEGORY_NAME_LEN,
  MAX_CUSTOM_CATEGORIES,
  renameCustomCategory
} from '../../services/categories';
import './index.scss';

const toast = (title: string) => Taro.showToast({ title, icon: 'none' });
const FALLBACK_ICON = '📦';

/**
 * 分类管理：自定义分类支持新增（名称 + 图标库选择）、改名、删除
 * - 图标库按分组展示、可搜索，并按名称关键词自动推荐
 * - 内置分类只读（标「默认」），保证筛选项稳定
 * - 删除分类时其下产品自动移入「其他」
 */
export default function Categories() {
  const [list, setList] = useState<CategoryDef[]>(allCategories());
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [editingName, setEditingName] = useState('');
  /** 手动选过图标后，本次填写不再自动推荐 */
  const iconManual = useRef(false);

  const reload = () => {
    loadCustomCategories().then(() => setList(allCategories()));
  };

  useDidShow(reload);

  const customs = list.filter((c) => c.custom);
  const builtins = list.filter((c) => !c.custom);
  const iconGroups = searchEmojiGroups(query);

  const onNameInput = (e) => {
    const v = e.detail.value;
    setName(v);
    if (!iconManual.current) {
      const s = suggestEmoji(v);
      if (s) setIcon(s);
    }
  };

  const pickIcon = (c: string) => {
    setIcon(c);
    iconManual.current = true;
    setPickerOpen(false);
  };

  const onAdd = async () => {
    if (adding) return;
    const label = name.trim();
    if (!label) return toast('请输入分类名称');
    if (label.length > MAX_CATEGORY_NAME_LEN) return toast(`名称最长 ${MAX_CATEGORY_NAME_LEN} 字`);
    if (isCategoryNameTaken(label)) return toast('该分类已存在');
    if (customs.length >= MAX_CUSTOM_CATEGORIES) {
      return toast(`最多 ${MAX_CUSTOM_CATEGORIES} 个自定义分类`);
    }
    setAdding(true);
    try {
      await addCustomCategory(label, icon || suggestEmoji(label) || FALLBACK_ICON);
      setName('');
      setIcon('');
      iconManual.current = false;
      reload();
      toast('已添加');
    } catch (e) {
      console.error('[categories] 新增失败', e);
      toast('添加失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c: CategoryDef) => {
    setEditingKey(c.key);
    setEditingName(c.label);
  };

  const confirmEdit = async () => {
    const label = editingName.trim();
    if (!label) return toast('名称不能为空');
    if (label.length > MAX_CATEGORY_NAME_LEN) return toast(`名称最长 ${MAX_CATEGORY_NAME_LEN} 字`);
    if (list.some((c) => c.key !== editingKey && c.label.toLowerCase() === label.toLowerCase())) {
      return toast('该分类已存在');
    }
    try {
      await renameCustomCategory(editingKey, label);
      setEditingKey('');
      reload();
      toast('已修改');
    } catch (e) {
      console.error('[categories] 改名失败', e);
      toast('修改失败，请重试');
    }
  };

  const onDelete = async (c: CategoryDef) => {
    const r = await Taro.showModal({
      title: '删除分类',
      content: `删除「${c.label}」后，该分类下的产品将移动到「其他」。确定删除吗？`,
      confirmText: '删除',
      confirmColor: '#FF3B30'
    });
    if (!r.confirm) return;
    try {
      const { moved } = await deleteCustomCategory(c.key);
      reload();
      toast(moved > 0 ? `已删除，${moved} 个产品移入「其他」` : '已删除');
    } catch (e) {
      console.error('[categories] 删除失败', e);
      toast('删除失败，请重试');
    }
  };

  return (
    <View className='page cate-page'>
      {/* 添加卡 */}
      <View className='card add-card'>
        <View className='card-title'>添加分类</View>
        <View className='add-row'>
          <View className='icon-preview' onClick={() => setPickerOpen(true)}>
            <Text className='icon-preview-emoji'>{icon || FALLBACK_ICON}</Text>
            <Text className='icon-preview-tip'>点击选图标</Text>
          </View>
          <Input
            className='input add-input'
            value={name}
            maxlength={MAX_CATEGORY_NAME_LEN}
            placeholder={`分类名称（≤${MAX_CATEGORY_NAME_LEN} 字）`}
            placeholderClass='placeholder'
            onInput={onNameInput}
          />
        </View>
        <View className='add-hint'>输入名称会自动推荐图标，也可点击左侧图标手动选择</View>
        <View className='add-btn' onClick={onAdd}>
          {adding ? '添加中…' : '＋ 添加分类'}
        </View>
      </View>

      {/* 自定义分类 */}
      <View className='card'>
        <View className='card-title'>
          我的分类
          <Text className='count-tip'>{customs.length}/{MAX_CUSTOM_CATEGORIES}</Text>
        </View>
        {customs.length === 0 && (
          <View className='empty-tip'>还没有自定义分类，用上面的表单添加一个吧</View>
        )}
        {customs.map((c) => (
          <View className='row' key={c.key}>
            <View className='row-icon-wrap'><Text>{c.icon}</Text></View>
            {editingKey === c.key ? (
              <View className='row-edit'>
                <Input
                  className='input edit-input'
                  value={editingName}
                  maxlength={MAX_CATEGORY_NAME_LEN}
                  focus
                  onInput={(e) => setEditingName(e.detail.value)}
                />
                <Text className='op-btn primary' onClick={confirmEdit}>保存</Text>
                <Text className='op-btn' onClick={() => setEditingKey('')}>取消</Text>
              </View>
            ) : (
              <>
                <View className='row-main'>
                  <Text className='row-label'>{c.label}</Text>
                </View>
                <View className='row-ops'>
                  <Text className='op-btn' onClick={() => startEdit(c)}>改名</Text>
                  <Text className='op-btn danger' onClick={() => onDelete(c)}>删除</Text>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      {/* 内置分类 */}
      <View className='card'>
        <View className='card-title'>
          内置分类
          <Text className='count-tip'>不可修改</Text>
        </View>
        {builtins.map((c) => (
          <View className='row' key={c.key}>
            <View className='row-icon-wrap'><Text>{c.icon}</Text></View>
            <View className='row-main'>
              <Text className='row-label'>{c.label}</Text>
              <Text className='row-tag'>默认</Text>
            </View>
          </View>
        ))}
      </View>

      <Text className='foot-tip'>产品按分类关联：改名自动生效，删除后产品移入「其他」</Text>

      {/* 图标选择半屏弹层 */}
      {pickerOpen && (
        <View className='picker-mask' catchMove onClick={() => setPickerOpen(false)}>
          <View className='picker-panel' onClick={(e) => e.stopPropagation()}>
            <View className='picker-bar' />
            <View className='picker-head'>
              <Text className='picker-title'>选择图标</Text>
              <Text className='picker-close' onClick={() => setPickerOpen(false)}>✕</Text>
            </View>
            <Input
              className='input picker-search'
              value={query}
              placeholder='搜索图标，如：牛奶、清洁、运动'
              placeholderClass='placeholder'
              onInput={(e) => setQuery(e.detail.value)}
            />
            <ScrollView className='emoji-scroll' scrollY enhanced showScrollbar={false}>
              {iconGroups.map((g) => (
                <View key={g.name}>
                  <Text className='group-name'>{g.name}</Text>
                  <View className='emoji-grid'>
                    {g.items.map((it) => (
                      <View
                        key={it.c}
                        className={`emoji-cell${icon === it.c ? ' active' : ''}`}
                        onClick={() => pickIcon(it.c)}
                      >
                        {it.c}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {iconGroups.length === 0 && (
                <View className='empty-tip'>没有匹配的图标，换个关键词试试</View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
