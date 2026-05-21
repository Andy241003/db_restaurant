
import {
    faCalendarAlt,
    faCircleInfo,
    faEye,
    faImage,
    faImages,
    faInfoCircle,
    faMoneyBillWave,
    faPenToSquare,
    faPercent,
    faPlus,
    faTag,
    faTimes,
    faTrashCan,
    faVrCardboard,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import MediaPickerModal from '../../components/MediaPickerModal';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import {
    cafeBranchesApi,
    cafeLanguagesApi,
    cafePromotionsApi,
    cafeSettingsApi,
    restaurantVr360Api,
    type Branch,
    type Promotion,
    type PromotionCreate,
    type PromotionTranslation,
    type RestaurantVR360Scene,
    type RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const LABEL_CLASS = 'mb-2 block text-sm font-medium text-slate-700';
const FIELD_CLASS = 'w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'rounded-lg bg-white p-6 shadow';

type PromotionTypeValue = 'percentage' | 'fixed_amount' | 'buy_one_get_one' | 'gift';

type PromotionLocalizedFields = {
  title: string;
  description: string;
  terms_and_conditions: string;
};

type EditablePromotion = {
  id?: number;
  code: string;
  promotion_type: PromotionTypeValue;
  discount_value: string;
  start_date: string;
  end_date: string;
  min_purchase_amount: string;
  primary_image_media_id?: number;
  media_ids: number[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  branch_id?: number | null;
  translations: Record<string, PromotionLocalizedFields>;
};

const getLocaleShortLabel = (locale: string) => {
  const normalized = locale.toLowerCase();
  const shortLabels: Record<string, string> = {
    vi: 'VI',
    en: 'EN',
    de: 'DE',
    zh: 'ZH',
    'zh-tw': 'ZH-TW',
    yue: 'YUE',
    ja: 'JA',
    ko: 'KO',
    fr: 'FR',
    ru: 'RU',
  };

  return shortLabels[normalized] || locale.toUpperCase();
};

const buildEmptyLocalizedPromotionData = (locales: string[]) =>
  locales.reduce<Record<string, PromotionLocalizedFields>>((acc, locale) => {
    acc[locale] = { title: '', description: '', terms_and_conditions: '' };
    return acc;
  }, {});

const getPromotionTranslation = (promotion: Promotion, locale: string) =>
  promotion.translations?.find((translation) => translation.locale === locale);

const getPromotionTitle = (promotion: Promotion) =>
  getPromotionTranslation(promotion, 'vi')?.title ||
  getPromotionTranslation(promotion, 'en')?.title ||
  promotion.translations?.find((translation) => translation.title)?.title ||
  promotion.code ||
  'Untitled promotion';

const getPromotionDescription = (promotion: Promotion) =>
  getPromotionTranslation(promotion, 'vi')?.description ||
  getPromotionTranslation(promotion, 'en')?.description ||
  promotion.translations?.find((translation) => translation.description)?.description ||
  '';

const getBranchName = (branch: Branch) =>
  branch.translations?.find((translation) => translation.locale === 'vi')?.name ||
  branch.translations?.find((translation) => translation.locale === 'en')?.name ||
  branch.name_vi ||
  branch.name_en ||
  branch.code ||
  'Unknown branch';

const getPromotionValueLabel = (promotion: Promotion) => {
  if (promotion.discount_value == null) return 'No discount value';
  if (promotion.promotion_type === 'percentage') return `${promotion.discount_value}% off`;
  return `${promotion.discount_value.toLocaleString('vi-VN')} VND`;
};

const getPromotionLanguageLabel = (promotion: Promotion) => {
  const count = promotion.translations?.length || 0;
  return count > 0 ? `${count} languages` : 'No translations';
};

const getPromotionImageCountLabel = (promotion: Promotion) => {
  const count = promotion.media?.length || 0;
  return count > 0 ? `${count} images` : 'No gallery';
};

const getPromotionStatusBadge = (promotion: Promotion) => {
  if (!promotion.is_active) {
    return { label: 'inactive', className: 'bg-slate-200 text-slate-700' };
  }

  const now = dayjs();
  const startDate = promotion.start_date ? dayjs(promotion.start_date) : null;
  const endDate = promotion.end_date ? dayjs(promotion.end_date) : null;

  if (startDate && now.isBefore(startDate, 'day')) {
    return { label: 'upcoming', className: 'bg-blue-100 text-blue-700' };
  }

  if (endDate && now.isAfter(endDate, 'day')) {
    return { label: 'expired', className: 'bg-slate-200 text-slate-700' };
  }

  return { label: 'active', className: 'bg-emerald-100 text-emerald-700' };
};

const getBranchIdFromPromotion = (promotion: Promotion): number | null => {
  const branchIds = promotion.applicable_branches?.branch_ids;
  if (Array.isArray(branchIds) && branchIds.length > 0) {
    const numericId = Number(branchIds[0]);
    return Number.isFinite(numericId) ? numericId : null;
  }
  return null;
};

const convertToEmbedUrl = (url: string): string => {
  if (!url) return url;
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(youtubeRegex);
  if (match?.[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
};

const RestaurantPromotions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['vi', 'en']);
  const [currentLocale, setCurrentLocale] = useState('vi');
  const [isDisplaying, setIsDisplaying] = useState(true);
  const [savingDisplayStatus, setSavingDisplayStatus] = useState(false);
  const [scenes, setScenes] = useState<RestaurantVR360Scene[]>([]);
  const [vr360Settings, setVr360Settings] = useState<RestaurantVR360SectionSettings>({
    target_id: null,
    panorama_url: null,
    vr360_link: null,
    vr_title: null,
    title_translations: {},
  });
  const vr360Link = vr360Settings.vr360_link || '';
  const vrTitle = vr360Settings.vr_title || '';
  const [savingVR, setSavingVR] = useState(false);
  const [promotionFilter, setPromotionFilter] = useState<'all' | 'active' | 'inactive' | 'upcoming' | 'expired'>('all');
  const [editingPromotion, setEditingPromotion] = useState<EditablePromotion | null>(null);
  const [savingPromotion, setSavingPromotion] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'gallery' | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [promotionData, languages, settings, branchData, vr360Data] = await Promise.all([
        cafePromotionsApi.getPromotions(),
        cafeLanguagesApi.getLanguages(),
        cafeSettingsApi.getSettings(),
        cafeBranchesApi.getBranches(),
        restaurantVr360Api.getSettings(),
      ]);

      const locales = languages.length > 0 ? languages.map((item) => item.locale) : ['vi', 'en'];
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;
      setSupportedLanguages(locales);
      setCurrentLocale((previous) => (locales.includes(previous) ? previous : locales[0]));
      setPromotions(promotionData);
      setBranches(branchData);
      setIsDisplaying(settingsJson.promotions_is_displaying ?? true);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.promotions || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.promotions_vr360_link === 'string' ? settingsJson.promotions_vr360_link : null,
        vr_title: typeof settingsJson.promotions_vr_title === 'string' ? settingsJson.promotions_vr_title : null,
        title_translations: {},
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const promotionData = await cafePromotionsApi.getPromotions();
      setPromotions(promotionData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh promotions');
    }
  };

  const makeTranslations = (promotion?: Promotion) => {
    const result = buildEmptyLocalizedPromotionData(supportedLanguages);
    supportedLanguages.forEach((locale) => {
      const translation = promotion?.translations?.find((item) => item.locale === locale);
      result[locale] = {
        title: translation?.title || '',
        description: translation?.description || '',
        terms_and_conditions: translation?.terms_and_conditions || '',
      };
    });
    return result;
  };
  const createDraftPromotion = (promotion?: Promotion): EditablePromotion => ({
    id: promotion?.id,
    code: promotion?.code || `promotion_${Date.now()}`,
    promotion_type: (promotion?.promotion_type as PromotionTypeValue) || 'percentage',
    discount_value: promotion?.discount_value != null ? String(promotion.discount_value) : '',
    start_date: promotion?.start_date || '',
    end_date: promotion?.end_date || '',
    min_purchase_amount: promotion?.min_purchase_amount != null ? String(promotion.min_purchase_amount) : '',
    primary_image_media_id: promotion?.primary_image_media_id ?? undefined,
    media_ids: promotion?.media?.map((item) => item.media_id) || [],
    is_active: promotion?.is_active ?? true,
    is_featured: promotion?.is_featured ?? false,
    display_order: promotion?.display_order ?? promotions.length,
    branch_id: promotion ? getBranchIdFromPromotion(promotion) ?? undefined : undefined,
    translations: makeTranslations(promotion),
  });

  const filteredPromotions = useMemo(() => {
    if (promotionFilter === 'all') return promotions;
    return promotions.filter((promotion) => getPromotionStatusBadge(promotion).label === promotionFilter);
  }, [promotionFilter, promotions]);

  const currentTranslation = useMemo(
    () => editingPromotion?.translations[currentLocale] || { title: '', description: '', terms_and_conditions: '' },
    [currentLocale, editingPromotion]
  );

  const handleAddNew = () => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingPromotion(createDraftPromotion());
  };

  const handleEdit = (promotion: Promotion) => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingPromotion(createDraftPromotion(promotion));
  };

  const handleDelete = async (promotionId: number) => {
    const confirmed = window.confirm('Delete this promotion? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await cafePromotionsApi.deletePromotion(promotionId);
      toast.success('Promotion deleted');
      if (editingPromotion?.id === promotionId) {
        setEditingPromotion(null);
      }
      await loadPromotions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete promotion');
    }
  };

  const handleLocalizedFieldChange = (field: keyof PromotionLocalizedFields, value: string) => {
    setEditingPromotion((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        translations: {
          ...previous.translations,
          [currentLocale]: {
            ...previous.translations[currentLocale],
            [field]: value,
          },
        },
      };
    });
  };

  const handleFieldChange = <K extends keyof EditablePromotion>(field: K, value: EditablePromotion[K]) => {
    setEditingPromotion((previous) => (previous ? { ...previous, [field]: value } : previous));
  };

  const handleGallerySelect = (mediaIds: number[]) => {
    setEditingPromotion((previous) => {
      if (!previous) return previous;
      const dedupedMediaIds = Array.from(new Set(mediaIds));
      const nextPrimary = previous.primary_image_media_id && dedupedMediaIds.includes(previous.primary_image_media_id)
        ? previous.primary_image_media_id
        : dedupedMediaIds[0];
      return {
        ...previous,
        media_ids: dedupedMediaIds,
        primary_image_media_id: nextPrimary,
      };
    });
    setMediaPickerMode(null);
  };

  const handleRemoveMedia = (mediaId: number) => {
    setEditingPromotion((previous) => {
      if (!previous) return previous;
      const nextMediaIds = previous.media_ids.filter((id) => id !== mediaId);
      const nextPrimary = previous.primary_image_media_id === mediaId ? nextMediaIds[0] : previous.primary_image_media_id;
      return {
        ...previous,
        media_ids: nextMediaIds,
        primary_image_media_id: nextPrimary,
      };
    });
  };

  const handleSetPrimaryMedia = (mediaId: number) => {
    setEditingPromotion((previous) => (previous ? { ...previous, primary_image_media_id: mediaId } : previous));
  };

  const handleSavePromotion = async () => {
    if (!editingPromotion) return;

    const translations: PromotionTranslation[] = supportedLanguages
      .map((locale) => ({
        locale,
        title: editingPromotion.translations[locale]?.title?.trim() || '',
        description: editingPromotion.translations[locale]?.description?.trim() || '',
        terms_and_conditions: editingPromotion.translations[locale]?.terms_and_conditions?.trim() || '',
      }))
      .filter((translation) => translation.title || translation.description || translation.terms_and_conditions);

    if (translations.length === 0 || !translations.some((translation) => translation.title)) {
      toast.error('Please add at least one promotion title');
      return;
    }

    if (!editingPromotion.code.trim()) {
      toast.error('Promotion code is required');
      return;
    }

    const branchIds = editingPromotion.branch_id ? [editingPromotion.branch_id] : [];

    const payload: PromotionCreate = {
      code: editingPromotion.code.trim(),
      promotion_type: editingPromotion.promotion_type,
      discount_value: editingPromotion.discount_value ? Number(editingPromotion.discount_value) : null,
      start_date: editingPromotion.start_date || undefined,
      end_date: editingPromotion.end_date || undefined,
      min_purchase_amount: editingPromotion.min_purchase_amount ? Number(editingPromotion.min_purchase_amount) : null,
      primary_image_media_id: editingPromotion.primary_image_media_id || null,
      is_active: editingPromotion.is_active,
      is_featured: editingPromotion.is_featured,
      display_order: Number.isFinite(editingPromotion.display_order) ? editingPromotion.display_order : promotions.length,
      applicable_branches: branchIds.length > 0 ? { branch_ids: branchIds } : null,
      attributes_json: null,
      translations,
      media_ids: editingPromotion.media_ids,
    };

    try {
      setSavingPromotion(true);
      if (editingPromotion.id) {
        await cafePromotionsApi.updatePromotion(editingPromotion.id, payload);
        toast.success('Promotion updated');
      } else {
        await cafePromotionsApi.createPromotion(payload);
        toast.success('Promotion created');
      }
      setEditingPromotion(null);
      await loadPromotions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save promotion');
    } finally {
      setSavingPromotion(false);
    }
  };

  const handleVR360Change = async (nextSettings: RestaurantVR360SectionSettings | 'link' | 'title', value?: string) => {
    try {
      setSavingVR(true);
      const resolvedSettings: RestaurantVR360SectionSettings = typeof nextSettings === 'string'
        ? {
            ...vr360Settings,
            vr360_link: nextSettings === 'link' ? convertToEmbedUrl(value || '') || null : vr360Settings.vr360_link,
            vr_title: nextSettings === 'title' ? value || null : vr360Settings.vr_title,
          }
        : nextSettings;
      setVr360Settings(resolvedSettings);
      await restaurantVr360Api.updateSectionSettings('promotions', {
        target_id: resolvedSettings.target_id || null,
        panorama_url: resolvedSettings.panorama_url || null,
        vr360_link: resolvedSettings.vr360_link || null,
        vr_title: resolvedSettings.vr_title || null,
        title_translations: resolvedSettings.title_translations || {},
      });
      toast.success('VR360 settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save VR settings');
    } finally {
      setSavingVR(false);
    }
  };

  const handleDisplayStatusChange = async (nextValue: boolean) => {
    try {
      setSavingDisplayStatus(true);
      const currentSettings = await cafeSettingsApi.getSettings();
      await cafeSettingsApi.updateSettings({
        settings_json: {
          ...currentSettings.settings_json,
          promotions_is_displaying: nextValue,
        },
      });
      setIsDisplaying(nextValue);
      toast.success(nextValue ? 'Promotions section enabled' : 'Promotions section hidden');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update display status');
    } finally {
      setSavingDisplayStatus(false);
    }
  };

  const getBranchLabelById = (branchId?: number | null) => {
    if (!branchId) return 'All branches';
    const branch = branches.find((item) => item.id === branchId);
    return branch ? getBranchName(branch) : 'Unknown branch';
  };

  return (
    <div className="space-y-6">
      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Promotions Section</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDisplaying ? 'text-emerald-600' : 'text-slate-500'}`}>
              {isDisplaying ? 'Displaying' : 'Hidden'}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" checked={isDisplaying} onChange={(e) => void handleDisplayStatusChange(e.target.checked)} disabled={savingDisplayStatus} />
              <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 text-blue-600" />
          <span>When display is turned off, the Promotions section will not appear on the website, but you can still manage promotions here.</span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <FontAwesomeIcon icon={faVrCardboard} className="text-xl text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>
        <VR360SettingsPanel
          sectionLabel="Promotions"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLocale}
          onChange={(nextValue) => void handleVR360Change(nextValue)}
          disabled={savingVR}
        />
        <div className="hidden space-y-6">
          <div>
            <label className={LABEL_CLASS}>VR360 Link</label>
            <input type="url" className={FIELD_CLASS} value={vr360Link} onChange={(e) => void handleVR360Change('link', e.target.value)} placeholder="https://example.com/panorama.jpg or https://youtube.com/watch?v=..." disabled={savingVR} />
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-slate-500" />
              <span>Enter the URL to a 360� panorama image or YouTube video URL.</span>
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>VR360 Title</label>
            <input type="text" className={FIELD_CLASS} value={vrTitle} onChange={(e) => void handleVR360Change('title', e.target.value)} placeholder="Enter VR tour title" disabled={savingVR} />
          </div>
          {vr360Link && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faEye} className="text-slate-600" />
                <h3 className="text-sm font-medium text-slate-700">VR360 Preview</h3>
              </div>
              <div className="overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-50">
                <div className="relative w-full" style={{ height: '500px' }}>
                  <iframe src={vr360Link} className="absolute left-0 top-0 h-full w-full" allowFullScreen title="VR360 Preview" allow="xr-spatial-tracking; gyroscope; accelerometer" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Promotions Management</h2>
            <p className="mt-1 text-sm text-slate-500">Manage promotion content, active period, featured deals, and visual highlights for the restaurant site.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <select value={promotionFilter} onChange={(e) => setPromotionFilter(e.target.value as typeof promotionFilter)} className="h-11 min-w-[140px] rounded-md border border-slate-300 px-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="button" onClick={handleAddNew} className="inline-flex h-11 min-w-[212px] items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              <FontAwesomeIcon icon={faPlus} />
              Add New Promotion
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">Loading promotions...</div>
        ) : filteredPromotions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">No promotions found for the current filter.</div>
        ) : (
          <div className="space-y-4">
            {filteredPromotions.map((promotion) => {
              const title = getPromotionTitle(promotion);
              const description = getPromotionDescription(promotion);
              const statusBadge = getPromotionStatusBadge(promotion);
              const branchLabel = getBranchLabelById(getBranchIdFromPromotion(promotion));
              const valueLabel = getPromotionValueLabel(promotion);
              const imageLabel = getPromotionImageCountLabel(promotion);
              const languageLabel = getPromotionLanguageLabel(promotion);
              const primaryImageId = promotion.primary_image_media_id || promotion.media?.[0]?.media_id;
              const startDateLabel = promotion.start_date ? dayjs(promotion.start_date).format('DD/MM/YYYY') : 'No start date';
              const endDateLabel = promotion.end_date ? dayjs(promotion.end_date).format('DD/MM/YYYY') : 'No end date';

              return (
                <div key={promotion.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:w-52">
                      {primaryImageId ? (
                        <img src={`${getApiBaseUrl()}/media/${primaryImageId}/view`} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-amber-50 text-amber-600">
                          <FontAwesomeIcon icon={faImage} className="text-2xl" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-semibold leading-tight text-slate-700">{title}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadge.className}`}>{statusBadge.label}</span>
                            {promotion.is_featured && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">featured</span>}
                          </div>
                          {description && <p className="line-clamp-2 text-sm text-slate-500">{description}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} className="text-blue-500" />{startDateLabel}</span>
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} className="text-blue-500" />{endDateLabel}</span>
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={promotion.promotion_type === 'percentage' ? faPercent : faMoneyBillWave} className="text-blue-500" />{valueLabel}</span>
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faTag} className="text-blue-500" />{branchLabel}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{imageLabel}</span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{languageLabel}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-3 self-start md:self-auto">
                          <button type="button" className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50" title="Edit promotion" onClick={() => handleEdit(promotion)}>
                            <FontAwesomeIcon icon={faPenToSquare} />
                            Edit
                          </button>
                          <button type="button" className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700" title="Delete promotion" onClick={() => void handleDelete(promotion.id)}>
                            <FontAwesomeIcon icon={faTrashCan} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingPromotion && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingPromotion.id ? 'Edit Promotion' : 'Add New Promotion'}</h2>
                <p className="mt-1 text-sm text-slate-500">Manage promotion details, media, and localized content.</p>
              </div>
              <button type="button" onClick={() => setEditingPromotion(null)} className="text-slate-400 transition-colors hover:text-slate-600">
                <FontAwesomeIcon icon={faTimes} className="text-2xl" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {supportedLanguages.map((locale) => (
                  <button key={locale} type="button" onClick={() => setCurrentLocale(locale)} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${currentLocale === locale ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {getLocaleShortLabel(locale)}
                  </button>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Promotion Code</label>
                  <input type="text" className={FIELD_CLASS} value={editingPromotion.code} onChange={(e) => handleFieldChange('code', e.target.value)} placeholder="e.g. happy_hour_apr" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Promotion Type</label>
                  <select className={FIELD_CLASS} value={editingPromotion.promotion_type} onChange={(e) => handleFieldChange('promotion_type', e.target.value as PromotionTypeValue)}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="buy_one_get_one">Buy One Get One</option>
                    <option value="gift">Gift</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Discount Value</label>
                  <input type="number" className={FIELD_CLASS} value={editingPromotion.discount_value} onChange={(e) => handleFieldChange('discount_value', e.target.value)} placeholder="e.g. 20 or 50000" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Minimum Purchase</label>
                  <input type="number" className={FIELD_CLASS} value={editingPromotion.min_purchase_amount} onChange={(e) => handleFieldChange('min_purchase_amount', e.target.value)} placeholder="Optional minimum order value" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Start Date</label>
                  <input type="date" className={FIELD_CLASS} value={editingPromotion.start_date} onChange={(e) => handleFieldChange('start_date', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>End Date</label>
                  <input type="date" className={FIELD_CLASS} value={editingPromotion.end_date} onChange={(e) => handleFieldChange('end_date', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Branch</label>
                  <select className={FIELD_CLASS} value={editingPromotion.branch_id ?? ''} onChange={(e) => handleFieldChange('branch_id', e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">All branches / not assigned</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{getBranchName(branch)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Display Order</label>
                  <input type="number" className={FIELD_CLASS} value={editingPromotion.display_order} onChange={(e) => handleFieldChange('display_order', Number(e.target.value))} />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Title ({getLocaleShortLabel(currentLocale)})</label>
                  <input type="text" className={FIELD_CLASS} value={currentTranslation.title} onChange={(e) => handleLocalizedFieldChange('title', e.target.value)} placeholder="Promotion title" />
                </div>
                <div className="flex flex-wrap items-center gap-6 pt-8">
                  <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={editingPromotion.is_active} onChange={(e) => handleFieldChange('is_active', e.target.checked)} />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={editingPromotion.is_featured} onChange={(e) => handleFieldChange('is_featured', e.target.checked)} />
                    Featured Promotion
                  </label>
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Description ({getLocaleShortLabel(currentLocale)})</label>
                <textarea className={`${FIELD_CLASS} min-h-[120px]`} value={currentTranslation.description} onChange={(e) => handleLocalizedFieldChange('description', e.target.value)} placeholder="Promotion description" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Terms & Conditions ({getLocaleShortLabel(currentLocale)})</label>
                <textarea className={`${FIELD_CLASS} min-h-[120px]`} value={currentTranslation.terms_and_conditions} onChange={(e) => handleLocalizedFieldChange('terms_and_conditions', e.target.value)} placeholder="Terms and conditions" />
              </div>

              <div className="mt-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FontAwesomeIcon icon={faImages} />
                  Promotion Images
                </label>
                <button type="button" onClick={() => setMediaPickerMode('gallery')} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  <FontAwesomeIcon icon={faImages} />
                  Select Images
                </button>

                {editingPromotion.media_ids.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {editingPromotion.media_ids.map((mediaId) => {
                      const isPrimary = editingPromotion.primary_image_media_id === mediaId;
                      return (
                        <div key={mediaId} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <img src={`${getApiBaseUrl()}/media/${mediaId}/view`} alt={`Promotion media ${mediaId}`} className="h-24 w-full object-cover" />
                          {isPrimary && <div className="absolute left-2 top-2 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white">Primary</div>}
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            {!isPrimary && <button type="button" onClick={() => handleSetPrimaryMedia(mediaId)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Set Primary</button>}
                            <button type="button" onClick={() => handleRemoveMedia(mediaId)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Remove</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button type="button" onClick={() => setEditingPromotion(null)} className="rounded-md border border-slate-300 px-5 py-2 text-slate-600 transition-colors hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void handleSavePromotion()} disabled={savingPromotion} className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                {savingPromotion ? 'Saving...' : editingPromotion.id ? 'Update Promotion' : 'Save Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPromotion && mediaPickerMode && (
        <MediaPickerModal
          isOpen={mediaPickerMode !== null}
          onClose={() => setMediaPickerMode(null)}
          title="Select Promotion Images"
          kind="image"
          source="restaurant"
          folder="promotions"
          folderAliases={['promotion', 'restaurant/promotions', 'restaurant/promotion']}
          allowMultiple
          initialSelectedIds={editingPromotion.media_ids}
          onSelectMultiple={handleGallerySelect}
        />
      )}
    </div>
  );
};

export default RestaurantPromotions;



