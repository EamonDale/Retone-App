import { View, Text, Image, Input, Textarea, Picker, Button } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';
import { addProduct, getProduct, updateProduct, uploadPhoto } from '../../services/db';
import { loadCustomCategories } from '../../services/categories';
import { requestSubscribe } from '../../services/notify';
import { recognizeProductInfo } from '../../services/ocr';
import { calcExpiry, dateStrToTs, daysLeftOfTs, todayStr, tsToDateStr } from '../../utils/date';
import { allCategories, SHELF_UNITS } from '../../utils/constants';
import type { ShelfUnitKey } from '../../utils/constants';
import type { OcrParseResult } from '../../utils/ocrParse';
import './index.scss';

const toast = (title: string) => Taro.showToast({ title, icon: 'none' });

/**
 * 添加产品（PRD 3.2），带 id 参数时复用为编辑模式（详情页「编辑」跳入）
 *
 * 日期填写不区分模式：到期日可直接选择，也可由「生产日期 + 保质期」自动计算，
 * 手动选择的到期日优先，随时可覆盖。
 * 识别自动填：拍照/相册 OCR（云函数 ocrProxy），识别失败给出可操作提示，
 * 用户直接手动填写即可。
 */
export default function Add() {
  const router = useRouter();
  const editId = router.params.id || '';

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [cats, setCats] = useState(allCategories());
  const [productionDate, setProductionDate] = useState('');
  const [shelfAmount, setShelfAmount] = useState('');
  const [shelfUnit, setShelfUnit] = useState<ShelfUnitKey>('month');
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryAuto, setExpiryAuto] = useState(false);
  const [note, setNote] = useState('');
  const [photoTemp, setPhotoTemp] = useState('');
  const [photoFileID, setPhotoFileID] = useState('');
  const [hl, setHl] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑模式：回填表单（先同步分类注册表，避免「产品挂在已删分类」时误判）
  useEffect(() => {
    if (!editId) return;
    Taro.showLoading({ title: '加载中', mask: true });
    Promise.all([loadCustomCategories(), getProduct(editId)])
      .then(([, p]) => {
        setName(p.name);
        const catsNow = allCategories();
        setCategory(catsNow.some((c) => c.key === p.category) ? p.category : 'other');
        setCats(catsNow);
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
        setExpiryAuto(false);
        setNote(p.note || '');
        if (p.photoFileID) setPhotoFileID(p.photoFileID);
      })
      .catch(() => {
        toast('产品加载失败');
      })
      .finally(() => Taro.hideLoading());
  }, [editId]);

  // 从分类管理页返回后刷新分类 chips
  useDidShow(() => {
    loadCustomCategories().then(() => setCats(allCategories()));
  });

  /** 生产日期 + 保质期齐全时自动算出到期日（手动选的到期日会被覆盖，可再改） */
  const amount = parseInt(shelfAmount, 10);
  useEffect(() => {
    if (productionDate && amount > 0) {
      setExpiryDate(calcExpiry(productionDate, amount, shelfUnit));
      setExpiryAuto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionDate, shelfAmount, shelfUnit]);

  const unit = useMemo(
    () => SHELF_UNITS.find((u) => u.key === shelfUnit) || SHELF_UNITS[0],
    [shelfUnit]
  );

  /** 识别结果统一回填：保质期 / 生产日期 / 到期日 */
  const applyParsed = (parsed: OcrParseResult) => {
    let filled = false;
    if (parsed.shelfLife) {
      setShelfAmount(String(parsed.shelfLife.amount));
      setShelfUnit(parsed.shelfLife.unit);
      filled = true;
    }
    if (parsed.productionDate) {
      setProductionDate(parsed.productionDate);
      filled = true;
    }
    if (parsed.expiryDate) {
      setExpiryDate(parsed.expiryDate);
      setExpiryAuto(false);
      filled = true;
    }
    setHl(filled);
    if (filled) toast('识别完成，请核对高亮字段');
    else toast('未识别到日期，请手动填写');
  };

  /** OCR / 云环境问题 → 可操作的提示；其他失败 → 轻提示后手填 */
  const handleOcrError = (e: unknown) => {
    console.error('[add] 识别失败', e);
    const msg = (e as { message?: string })?.message || '';
    if (/部署|环境|密钥|插件/.test(msg)) {
      Taro.showModal({ title: '识别功能不可用', content: msg, showCancel: false });
    } else {
      toast('识别失败，请手动填写');
    }
  };

  /** 拍完/选完图：先上传云存储，再调云函数 OCR（PRD 3.2.3） */
  const doOcr = async (tempPath: string) => {
    Taro.showLoading({ title: '识别中…', mask: true });
    try {
      const fileID = await uploadPhoto(tempPath);
      setPhotoFileID(fileID);
      applyParsed(await recognizeProductInfo(fileID));
    } catch (e) {
      handleOcrError(e);
    } finally {
      Taro.hideLoading();
    }
  };

  /** 对已选照片重新识别（优先复用已上传的 fileID） */
  const reOcr = async () => {
    Taro.showLoading({ title: '识别中…', mask: true });
    try {
      let fileID = photoFileID;
      if (!fileID && photoTemp) {
        fileID = await uploadPhoto(photoTemp);
        setPhotoFileID(fileID);
      }
      if (!fileID) return;
      applyParsed(await recognizeProductInfo(fileID));
    } catch (e) {
      handleOcrError(e);
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

  const onSave = async () => {
    if (saving) return;
    const nameTrim = name.trim();
    if (!nameTrim) return toast('请填写产品名称');
    if (nameTrim.length > 30) return toast('产品名称最长 30 字');
    if (!expiryDate) return toast('请选择到期日，或填生产日期 + 保质期自动计算');

    // 新增时趁用户点击手势栈内先请求订阅授权（真机要求在点击行为中调用）
    // 用户点允许 = 攒 1 条推送额度（PRD 3.4.2）
    if (!editId) {
      await requestSubscribe();
    }

    // 保存时若到期日早于今天，弹确认（PRD 3.2.3 验收）
    if (daysLeftOfTs(dateStrToTs(expiryDate)) < 0) {
      const r = await Taro.showModal({
        title: '已过期',
        content: '该产品的到期日早于今天，仍要保存吗？',
        confirmText: '仍保存'
      });
      if (!r.confirm) return;
    }

    setSaving(true);
    try {
      // 照片上传失败不阻塞保存（云存储不可用时丢弃照片，其余信息照存）
      let fileID = photoFileID;
      if (!fileID && photoTemp) {
        try {
          fileID = await uploadPhoto(photoTemp);
        } catch (e) {
          console.warn('[add] 照片上传失败', e);
          Taro.showToast({ title: '照片上传失败，已保存其他信息', icon: 'none' });
        }
      }
      const data = {
        name: nameTrim,
        // 表单填写期间分类被删除时兜底到「其他」
        category: cats.some((c) => c.key === category) ? category : 'other',
        productionDate: productionDate ? dateStrToTs(productionDate) : null,
        shelfLifeDays: amount > 0 ? amount * unit.factor : null,
        shelfLifeLabel: amount > 0 ? `${amount}${unit.label}` : '',
        expiryDate: dateStrToTs(expiryDate),
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

  return (
    <View className='page add-page'>
      {/* 识别入口：拍照 OCR / 相册 OCR */}
      <View className='photo-row'>
        <View className='photo-btn' onClick={() => chooseImage('camera')}>
          <Text className='photo-btn-ico'>📷</Text>
          <Text className='photo-btn-tit'>拍照识别</Text>
          <Text className='photo-btn-sub'>拍标签自动录入</Text>
        </View>
        <View className='photo-btn' onClick={() => chooseImage('album')}>
          <Text className='photo-btn-ico'>🖼️</Text>
          <Text className='photo-btn-tit'>相册选图</Text>
          <Text className='photo-btn-sub'>选图自动识别</Text>
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
          <View className='photo-foot'>
            <Text className='photo-tip'>点击图片可预览大图</Text>
            <Text className='photo-retry' onClick={reOcr}>🔄 重新识别</Text>
          </View>
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
            {cats.map((c) => (
              <View
                key={c.key}
                className={`chip${category === c.key ? ' active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                {c.icon} {c.label}
              </View>
            ))}
            <View className='chip manage' onClick={() => Taro.navigateTo({ url: '/pages/categories/index' })}>
              ＋ 分类
            </View>
          </View>
        </View>
      </View>

      <View className='card'>
        <View className='card-title'>日期信息</View>
        <View className='field'>
          <Text className='label'>到期日<Text className='req'>*</Text></Text>
          <View className='expiry-row'>
            <Picker
              mode='date'
              value={expiryDate || todayStr()}
              onChange={(e) => {
                setExpiryDate(e.detail.value);
                setExpiryAuto(false);
              }}
            >
              <View
                className={`input picker input-box${expiryDate ? '' : ' placeholder'}${
                  hl ? ' hl' : ''
                }`}
              >
                {expiryDate || '选择到期日'}
              </View>
            </Picker>
            {expiryAuto && <Text className='auto-tag'>自动计算</Text>}
          </View>
        </View>

        <View className='field'>
          <Text className='label'>生产日期<Text className='opt'>选填</Text></Text>
          <Picker
            mode='date'
            value={productionDate || todayStr()}
            end={todayStr()}
            onChange={(e) => setProductionDate(e.detail.value)}
          >
            <View
              className={`input picker input-box${productionDate ? '' : ' placeholder'}${
                hl ? ' hl' : ''
              }`}
            >
              {productionDate || '选择生产日期'}
            </View>
          </Picker>
        </View>

        <View className='field'>
          <Text className='label'>保质期<Text className='opt'>选填</Text></Text>
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
              range={SHELF_UNITS.map((u) => u.label)}
              onChange={(e) => setShelfUnit(SHELF_UNITS[Number(e.detail.value)].key)}
            >
              <View className={`input picker unit input-box${hl ? ' hl' : ''}`}>
                {unit.label} ▾
              </View>
            </Picker>
          </View>
        </View>
        <View className='calc-hint'>
          填了「生产日期 + 保质期」会自动算出到期日，也可以直接选到期日
        </View>
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
