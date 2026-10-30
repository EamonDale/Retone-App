import { View, Text, Image, Input, Textarea, Picker, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';
import { addProduct, getProduct, updateProduct, uploadPhoto } from '../../services/db';
import { requestSubscribe } from '../../services/notify';
import { recognizeProductInfo } from '../../services/ocr';
import { calcExpiry, dateStrToTs, daysLeftOfTs, todayStr, tsToDateStr } from '../../utils/date';
import { CATEGORIES, SHELF_UNITS } from '../../utils/constants';
import type { CategoryKey, ShelfUnitKey } from '../../utils/constants';
import './index.scss';

const toast = (title: string) => Taro.showToast({ title, icon: 'none' });

/**
 * 添加产品（PRD 3.2），带 id 参数时复用为编辑模式（详情页「编辑」跳入）
 * - 分段控件：自动计算（生产日期 + 保质期）/ 直接录入（到期日）
 * - 拍照识别：chooseMedia → 上传云存储 → 云函数 OCR → 正则提取 → 黄色高亮待核对
 */
export default function Add() {
  const router = useRouter();
  const editId = router.params.id || '';

  const [mode, setMode] = useState<'auto' | 'direct'>('auto');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryKey>('food');
  const [productionDate, setProductionDate] = useState('');
  const [shelfAmount, setShelfAmount] = useState('');
  const [shelfUnit, setShelfUnit] = useState<ShelfUnitKey>('month');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [photoTemp, setPhotoTemp] = useState('');
  const [photoFileID, setPhotoFileID] = useState('');
  const [ocrHighlight, setOcrHighlight] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑模式：回填表单
  useEffect(() => {
    if (!editId) return;
    Taro.showLoading({ title: '加载中', mask: true });
    getProduct(editId)
      .then((p) => {
        setName(p.name);
        setCategory(p.category);
        if (p.productionDate) setProductionDate(tsToDateStr(p.productionDate));
        const labelMatch = p.shelfLifeLabel && p.shelfLifeLabel.match(/^(\d+)(天|个月|年)$/);
        if (labelMatch) {
          setShelfAmount(labelMatch[1]);
          setShelfUnit(labelMatch[2] === '天' ? 'day' : labelMatch[2] === '年' ? 'year' : 'month');
        } else if (p.shelfLifeDays) {
          setShelfAmount(String(p.shelfLifeDays));
          setShelfUnit('day');
        }
        setExpiryDate(tsToDateStr(p.expiryDate));
        setNote(p.note || '');
        if (p.photoFileID) setPhotoFileID(p.photoFileID);
        setMode(p.productionDate && p.shelfLifeDays ? 'auto' : 'direct');
      })
      .catch(() => {
        toast('产品加载失败');
      })
      .finally(() => Taro.hideLoading());
  }, [editId]);

  /** 拍完/选完图：先上传云存储，再调云函数 OCR（PRD 3.2.3） */
  const doOcr = async (tempPath: string) => {
    Taro.showLoading({ title: '识别中…', mask: true });
    try {
      const fileID = await uploadPhoto(tempPath);
      setPhotoFileID(fileID);
      const parsed = await recognizeProductInfo(fileID);
      let filled = false;
      if (parsed.shelfLife) {
        setShelfAmount(String(parsed.shelfLife.amount));
        setShelfUnit(parsed.shelfLife.unit);
        setMode('auto');
        filled = true;
      }
      if (parsed.productionDate) {
        setProductionDate(parsed.productionDate);
        setMode('auto');
        filled = true;
      }
      if (!parsed.productionDate && parsed.expiryDate) {
        setExpiryDate(parsed.expiryDate);
        setMode('direct');
        filled = true;
      }
      setOcrHighlight(filled);
      if (filled) toast('识别完成，请核对黄色字段');
      else toast('未识别到日期，请手动填写');
    } catch (e) {
      console.error('[add] OCR 失败', e);
      // 识别失败不阻塞：留空让用户手填（PRD 3.2.3 验收）
      toast('识别失败，请手动填写');
    } finally {
      Taro.hideLoading();
    }
  };

  const chooseImage = async (sourceType: 'camera' | 'album') => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [sourceType],
        sizeType: ['compressed']
      });
      const temp = res.tempFiles?.[0]?.tempFilePath;
      if (!temp) return;
      setPhotoTemp(temp);
      setPhotoFileID('');
      doOcr(temp);
    } catch {
      // 用户取消
    }
  };

  const previewPhoto = () => {
    const url = photoFileID || photoTemp;
    if (url) Taro.previewImage({ urls: [url] });
  };

  const amount = parseInt(shelfAmount, 10);
  const unit = useMemo(
    () => SHELF_UNITS.find((u) => u.key === shelfUnit) || SHELF_UNITS[0],
    [shelfUnit]
  );
  const expiryPreview =
    mode === 'auto' && productionDate && amount > 0 ? calcExpiry(productionDate, amount, shelfUnit) : '';

  const onSave = async () => {
    if (saving) return;
    const nameTrim = name.trim();
    if (!nameTrim) return toast('请填写产品名称');
    if (nameTrim.length > 30) return toast('产品名称最长 30 字');

    let expiry = '';
    if (mode === 'auto') {
      if (!productionDate) return toast('请选择生产日期');
      if (!amount || amount <= 0) return toast('请填写保质期');
      expiry = calcExpiry(productionDate, amount, shelfUnit);
    } else {
      if (!expiryDate) return toast('请选择到期日');
      expiry = expiryDate;
    }

    // 新增时趁用户点击手势栈内先请求订阅授权（真机要求在点击行为中调用）
    // 用户点允许 = 攒 1 条推送额度（PRD 3.4.2）
    if (!editId) {
      await requestSubscribe();
    }

    // 保存时若到期日早于今天，弹确认（PRD 3.2.3 验收）
    if (daysLeftOfTs(dateStrToTs(expiry)) < 0) {
      const r = await Taro.showModal({
        title: '已过期',
        content: '该产品的到期日早于今天，仍要保存吗？',
        confirmText: '仍保存'
      });
      if (!r.confirm) return;
    }

    setSaving(true);
    try {
      let fileID = photoFileID;
      if (!fileID && photoTemp) fileID = await uploadPhoto(photoTemp);
      const data = {
        name: nameTrim,
        category,
        productionDate: productionDate ? dateStrToTs(productionDate) : null,
        shelfLifeDays: mode === 'auto' && amount > 0 ? amount * unit.factor : null,
        shelfLifeLabel: mode === 'auto' && amount > 0 ? `${amount}${unit.label}` : '',
        expiryDate: dateStrToTs(expiry),
        note: note.trim(),
        photoFileID: fileID || ''
      };
      if (editId) {
        await updateProduct(editId, data);
        Taro.showToast({ title: '已保存', icon: 'success' });
      } else {
        await addProduct(data);
        Taro.showToast({ title: '已添加', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 700);
    } catch (e) {
      console.error('[add] 保存失败', e);
      toast('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const unitLabels = SHELF_UNITS.map((u) => u.label);

  return (
    <View className='page add-page'>
      {/* 分段控件：两种录入模式（PRD 3.2.1） */}
      <View className='seg'>
        <View
          className={`seg-item${mode === 'auto' ? ' active' : ''}`}
          onClick={() => setMode('auto')}
        >
          自动计算
        </View>
        <View
          className={`seg-item${mode === 'direct' ? ' active' : ''}`}
          onClick={() => setMode('direct')}
        >
          直接录入
        </View>
      </View>

      {/* 拍照识别 / 相册选图（PRD 3.2.3） */}
      <View className='photo-row'>
        <View className='photo-btn' onClick={() => chooseImage('camera')}>
          <Text className='photo-btn-ico'>📷</Text>
          <Text className='photo-btn-tit'>拍照识别</Text>
          <Text className='photo-btn-sub'>拍摄标签自动录入</Text>
        </View>
        <View className='photo-btn' onClick={() => chooseImage('album')}>
          <Text className='photo-btn-ico'>🖼️</Text>
          <Text className='photo-btn-tit'>相册选图</Text>
          <Text className='photo-btn-sub'>从相册选取照片</Text>
        </View>
      </View>
      {(photoTemp || photoFileID) && (
        <View className='photo-wrap'>
          <Image
            className='photo-preview'
            src={photoFileID || photoTemp}
            mode='aspectFill'
            onClick={previewPhoto}
          />
          <View className='photo-tip'>点击图片可预览大图</View>
        </View>
      )}

      <View className='card'>
        <View className='card-title'>基本信息</View>
        <View className='field'>
          <Text className='label'>产品名称<Text className='req'>*</Text></Text>
          <Input
            className='input'
            value={name}
            maxlength={30}
            placeholder='如：纯牛奶'
            placeholderClass='placeholder'
            onInput={(e) => setName(e.detail.value)}
          />
        </View>

        <View className='field'>
          <Text className='label'>分类<Text className='req'>*</Text></Text>
          <View className='chips'>
            {CATEGORIES.map((c) => (
              <View
                key={c.key}
                className={`chip${category === c.key ? ' active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                {c.icon} {c.label}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className='card'>
        <View className='card-title'>日期信息</View>
        {mode === 'auto' && (
          <>
            <View className='field'>
              <Text className='label'>生产日期<Text className='req'>*</Text></Text>
              <Picker
                mode='date'
                value={productionDate || todayStr()}
                end={todayStr()}
                onChange={(e) => setProductionDate(e.detail.value)}
              >
                <View
                  className={`input picker input-box${productionDate ? '' : ' placeholder'}${
                    ocrHighlight ? ' hl' : ''
                  }`}
                >
                  {productionDate || '选择生产日期'}
                </View>
              </Picker>
            </View>
            <View className='field'>
              <Text className='label'>保质期<Text className='req'>*</Text></Text>
              <View className='shelf-row'>
                <Input
                  className='input shelf-amount input-box'
                  type='number'
                  value={shelfAmount}
                  placeholder='如：6'
                  placeholderClass='placeholder'
                  onInput={(e) => setShelfAmount(e.detail.value)}
                />
                <Picker
                  mode='selector'
                  range={unitLabels}
                  onChange={(e) => setShelfUnit(SHELF_UNITS[Number(e.detail.value)].key)}
                >
                  <View className={`input picker unit input-box${ocrHighlight ? ' hl' : ''}`}>
                    {unit.label} ▾
                  </View>
                </Picker>
              </View>
            </View>
            {expiryPreview && (
              <View className='preview-line'>
                到期日 <Text className='preview-strong'>{expiryPreview}</Text>
                <Text className='preview-tag'>自动计算</Text>
              </View>
            )}
          </>
        )}

        {mode === 'direct' && (
          <View className='field'>
            <Text className='label'>到期日<Text className='req'>*</Text></Text>
            <Picker
              mode='date'
              value={expiryDate || todayStr()}
              onChange={(e) => setExpiryDate(e.detail.value)}
            >
              <View
                className={`input picker input-box${expiryDate ? '' : ' placeholder'}${
                  ocrHighlight ? ' hl' : ''
                }`}
              >
                {expiryDate || '选择到期日'}
              </View>
            </Picker>
          </View>
        )}
      </View>

      <View className='card'>
        <View className='card-title'>备注</View>
        <View className='field'>
          <Textarea
            className='textarea'
            value={note}
            maxlength={100}
            placeholder='如：冰箱门第二层（选填）'
            placeholderClass='placeholder'
            onInput={(e) => setNote(e.detail.value)}
          />
        </View>
      </View>

      {/* 底部固定保存栏 */}
      <View className='save-bar'>
        <Button
          className='save-btn'
          loading={saving}
          disabled={saving}
          onClick={onSave}
        >
          {editId ? '保存修改' : '添加产品'}
        </Button>
      </View>
    </View>
  );
}
