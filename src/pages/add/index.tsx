import { View, Text, Image, Input, Textarea, Picker, Button } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';
import { addProduct, getProduct, updateProduct, uploadPhoto } from '../../services/db';
import { loadCustomCategories } from '../../services/categories';
import { requestSubscribe } from '../../services/notify';
import { calcExpiry, dateStrToTs, daysLeftOfTs, todayStr, tsToDateStr } from '../../utils/date';
import { allCategories, SHELF_UNITS } from '../../utils/constants';
import type { ShelfUnitKey } from '../../utils/constants';
import './index.scss';

const toast = (title: string) => Taro.showToast({ title, icon: 'none' });

/**
 * 添加产品（PRD 3.2），带 id 参数时复用为编辑模式（详情页「编辑」跳入）
 *
 * 日期填写不区分模式：到期日可直接选择，也可由「生产日期 + 保质期」自动计算，
 * 手动选择的到期日优先，随时可覆盖。
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
  const [saving, setSaving] = useState(false);
  const [stockQuantity, setStockQuantity] = useState<string>('1');
  const [labelText, setLabelText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [efficacy, setEfficacy] = useState('');
  const [dosage, setDosage] = useState('');
  const [location, setLocation] = useState('');
  const recorderManager = Taro.getRecorderManager();

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
        if (p.efficacy) setEfficacy(p.efficacy);
        if (p.dosage) setDosage(p.dosage);
        if (p.location) setLocation(p.location);
        if (p.stockQuantity) setStockQuantity(String(p.stockQuantity));
        else setStockQuantity('1');
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
    } catch {
      // 用户取消
    }
  };

  const previewPhoto = () => {
    const url = photoFileID || photoTemp;
    if (url) Taro.previewImage({ urls: [url] });
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      await recorderManager.start({
        duration: 60000,
        format: 'mp3'
      });
      toast('正在录音，请说话...');
    } catch (e) {
      console.error('[add] 开始录音失败', e);
      setIsRecording(false);
      toast('录音失败，请手动输入');
    }
  };

  const stopRecording = async () => {
    try {
      await recorderManager.stop();
    } catch (e) {
      console.error('[add] 停止录音失败', e);
    }
  };

  recorderManager.onStop(async (res) => {
    const { tempFilePath } = res;
    try {
      setIsRecording(false);
      toast('正在识别语音...');

      console.log('[add] 录音完成，开始上传...');

      // 先上传音频文件到云存储
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath: `voice/${Date.now()}.mp3`,
        filePath: tempFilePath
      });

      console.log('[add] 上传成功，fileID:', uploadRes.fileID);

      const fileID = uploadRes.fileID;

      // 调用云函数进行语音识别
      console.log('[add] 调用识别云函数...');
      const result = await Taro.cloud.callFunction({
        name: 'recognizeSpeech',
        data: {
          action: 'recognize',
          fileID: fileID
        }
      });

      console.log('[add] 识别结果:', result);

      if (result.result && result.result.text) {
        const recognizedText = result.result.text;
        setLabelText(recognizedText);
        toast('识别成功，正在提取信息...');

        // 自动提取信息到表单
        extractInfoFromText(recognizedText);
      } else {
        toast('识别失败，请手动输入');
      }
    } catch (e) {
      console.error('[add] 语音识别失败', e);
      setIsRecording(false);
      toast('识别失败，请手动输入');
    }
  });

  recorderManager.onError((err) => {
    console.error('[add] 录音错误', err);
    setIsRecording(false);
    toast('录音错误，请手动输入');
  });

  // 从识别的文字中提取信息到表单
  const extractInfoFromText = (text: string) => {
    const trimmedText = text.trim();

    // 1. 提取产品名称（通常是第一个中文词组）
    const nameMatch = trimmedText.match(/^([^，。、\n]+)[，。、\n]/);
    if (nameMatch) {
      setName(nameMatch[1].trim());
    }

    // 2. 提取生产日期（支持多种格式）
    const dateMatch = trimmedText.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      const productionDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setProductionDate(productionDateStr);
    }

    // 3. 提取保质期
    const shelfMatch = trimmedText.match(/保质期\s*(\d+)\s*(天|个月|年)/);
    if (shelfMatch) {
      const amount = parseInt(shelfMatch[1]);
      const unit = shelfMatch[2];
      setShelfAmount(String(amount));

      // 根据单位设置 shelfUnit
      let unitKey: ShelfUnitKey = 'month';
      if (unit === '天') {
        unitKey = 'day';
      } else if (unit === '年') {
        unitKey = 'year';
      } else {
        unitKey = 'month';
      }
      setShelfUnit(unitKey);

      // 如果有生产日期，自动计算到期日
      if (productionDate) {
        const calculatedExpiry = calcExpiry(productionDate, amount, unitKey);
        setExpiryDate(calculatedExpiry);
        setExpiryAuto(true);
      }
    }

    // 4. 提取分类（根据关键词）
    const categoryKeywords: Record<string, string> = {
      '药品': 'medicine',
      '药': 'medicine',
      '食品': 'food',
      '食品': 'food',
      '饮料': 'drink',
      '饮料': 'drink',
      '化妆品': 'beauty',
      '化妆品': 'beauty',
      '美妆': 'beauty',
      '美妆': 'beauty'
    };

    for (const [keyword, category] of Object.entries(categoryKeywords)) {
      if (trimmedText.includes(keyword)) {
        setCategory(category);
        break;
      }
    }

    // 5. 提取产品数量（支持多种格式）
    const quantityMatch = trimmedText.match(/数量\s*[:：]\s*(\d+)/);
    if (quantityMatch) {
      setStockQuantity(quantityMatch[1]);
    } else {
      // 尝试从数字后面跟单位（个、箱、盒、包）
      const quantityMatch2 = trimmedText.match(/^(\d+)\s*(个|箱|盒|包)/);
      if (quantityMatch2) {
        setStockQuantity(quantityMatch2[1]);
      }
    }

    // 6. 提取存放位置（支持多种格式）
    const locationMatch = trimmedText.match(/位置\s*[:：]\s*([^，。、\n]+)/);
    if (locationMatch) {
      setLocation(locationMatch[1].trim());
    } else {
      // 尝试从"放在"后面跟位置
      const locationMatch2 = trimmedText.match(/放在\s*([^，。、\n]+)/);
      if (locationMatch2) {
        setLocation(locationMatch2[1].trim());
      }
    }

    // 7. 提取备注（支持多种格式）
    const noteMatch = trimmedText.match(/备注\s*[:：]\s*([^，。、\n]+)/);
    if (noteMatch) {
      setNote(noteMatch[1].trim());
    }
  };

  const onSave = async (): Promise<void> => {
    if (saving) return;
    const nameTrim = name.trim();
    if (!nameTrim) {
      toast('请填写产品名称');
      return;
    }
    if (nameTrim.length > 30) {
      toast('产品名称最长 30 字');
      return;
    }
    if (!expiryDate) {
      toast('请选择到期日，或填生产日期 + 保质期自动计算');
      return;
    }

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
        photoFileID: fileID || '',
        stockQuantity: parseInt(stockQuantity, 10) || 1
      };

      if (category === 'medicine') {
        data.efficacy = efficacy.trim();
        data.dosage = dosage.trim();
      }
      data.location = location.trim();
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
      {/* 产品信息识别 */}
      <View className='card label-card'>
        <View className='field'>
          <Textarea
            className='textarea'
            value={labelText}
            maxlength={500}
            placeholder='粘贴或输入产品标签文字，如：保质期 6 个月，生产日期 2024-01-01'
            placeholderClass='placeholder'
            onInput={(e) => setLabelText(e.detail.value)}
            style={{ height: '160rpx' }}
          />
        </View>
        <View className='action-buttons'>
          <Button
            className='action-btn left-btn'
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? '⏹️ 停止录音' : '🎤 语音输入'}
          </Button>
          <Button
            className='action-btn right-btn'
            onClick={() => {
              if (labelText.trim()) {
                extractInfoFromText(labelText);
                toast('已提取信息到表单');
              } else {
                toast('请先输入或粘贴文字');
              }
            }}
          >
            📄 识别文字
          </Button>
        </View>
      </View>

      {/* 产品图片模块 */}
      <View className='card photo-card'>
        <View className='card-title'>产品图片</View>
        <View className='photo-upload-section'>
          {(photoTemp || photoFileID) ? (
            <View className='photo-preview-wrap'>
              <Image
                className='photo-preview'
                src={photoFileID || photoTemp}
                mode='aspectFill'
                onClick={previewPhoto}
              />
              <View className='photo-actions'>
                <View className='photo-btn-small' onClick={previewPhoto}>
                  预览
                </View>
                <View className='photo-btn-small photo-btn-small-red' onClick={() => {
                  setPhotoTemp('');
                  setPhotoFileID('');
                }}>
                  删除
                </View>
              </View>
            </View>
          ) : (
            <View className='photo-upload-buttons'>
            <View className='upload-btn' onClick={() => chooseImage('album')}>
              <Text className='upload-btn-icon'>🖼️</Text>
              <Text className='upload-btn-text'>相册</Text>
            </View>
            <View className='upload-btn' onClick={() => chooseImage('camera')}>
              <Text className='upload-btn-icon'>📸</Text>
              <Text className='upload-btn-text'>拍照</Text>
            </View>
            </View>
          )}
        </View>
      </View>

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
          <Text className='label'>产品数量<Text className='req'>*</Text></Text>
          <Input
            className='input'
            type='number'
            value={stockQuantity}
            placeholder='如：1'
            placeholderClass='placeholder'
            onInput={(e) => setStockQuantity(e.detail.value)}
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

        {category === 'medicine' && (
          <>
            <View className='field'>
              <Text className='label'>产品功效</Text>
              <Input
                className='input'
                value={efficacy}
                maxlength={100}
                placeholder='如：消炎、止痛'
                placeholderClass='placeholder'
                onInput={(e) => setEfficacy(e.detail.value)}
              />
            </View>
            <View className='field'>
              <Text className='label'>用量</Text>
              <Input
                className='input'
                value={dosage}
                maxlength={100}
                placeholder='如：每次1片，每日3次'
                placeholderClass='placeholder'
                onInput={(e) => setDosage(e.detail.value)}
              />
            </View>
          </>
        )}

        <View className='field'>
          <Text className='label'>存放位置</Text>
          <Input
            className='input'
            value={location}
            maxlength={50}
            placeholder='如：冰箱冷藏层、柜子第二层'
            placeholderClass='placeholder'
            onInput={(e) => setLocation(e.detail.value)}
          />
        </View>
      </View>

      <View className='card expiry-card'>
        <View className='card-title'>到期日</View>
        <View className='calc-hint'>
          填了「生产日期 + 保质期」会自动算出到期日，也可以直接选到期日
        </View>
        <View className='field'>
          <Text className='label'>生产日期</Text>
          <Picker
            mode='date'
            value={productionDate || todayStr()}
            end={todayStr()}
            onChange={(e) => setProductionDate(e.detail.value)}
          >
            <View
              className={`input picker input-box${productionDate ? '' : ' placeholder'}`}
            >
              {productionDate || '选择生产日期'}
            </View>
          </Picker>
        </View>

        <View className='field'>
          <Text className='label'>保质期</Text>
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
              <View className={`input picker unit input-box`}>
                {unit.label} ▾
              </View>
            </Picker>
          </View>
        </View>
        <View className='field'>
          <Text className='label'>到期日<Text className='req'>*</Text>{expiryAuto && <Text className='auto-tag'>自动计算</Text>}</Text>
          <Picker
            mode='date'
            value={expiryDate || todayStr()}
              onChange={(e) => {
                setExpiryDate(e.detail.value);
                setExpiryAuto(false);
              }}
          >
            <View
              className={`input picker input-box${expiryDate ? '' : ' placeholder'}`}
            >
              {expiryDate || '选择到期日'}
            </View>
          </Picker>
        </View>
      </View>

      <View className='card'>
        <View className='card-title'>备注</View>
        <View className='field'>
          <Textarea
            className='textarea'
            value={note}
            maxlength={100}
            placeholder='请填写备注'
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
