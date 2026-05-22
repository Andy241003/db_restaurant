import {
  faAward,
  faCircleInfo,
  faEye,
  faGlobe,
  faImage,
  faImages,
  faInfoCircle,
  faPenToSquare,
  faPlus,
  faStar,
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
import { useDebouncedVr360Autosave } from '../../hooks/useDebouncedVr360Autosave';
import {
  cafeAchievementsApi,
  cafeLanguagesApi,
  cafeSettingsApi,
  restaurantVr360Api,
  type Achievement,
  type AchievementCreate,
  type AchievementTranslation,
  type RestaurantVR360Scene,
  type RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const LABEL_CLASS = 'mb-2 block text-sm font-medium text-slate-700';
const FIELD_CLASS = 'w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'rounded-lg bg-white p-6 shadow';

type AchievementLocalizedFields = {
  title: string;
  description: string;
};

type EditableAchievement = {
  id?: number;
  code: string;
  achievement_type: string;
  issuer: string;
  awarded_at: string;
  location_text: string;
  reference_url: string;
  primary_image_media_id?: number;
  media_ids: number[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  translations: Record<string, AchievementLocalizedFields>;
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

const buildEmptyLocalizedAchievementData = (locales: string[]) =>
  locales.reduce<Record<string, AchievementLocalizedFields>>((acc, locale) => {
    acc[locale] = { title: '', description: '' };
    return acc;
  }, {});

const convertToEmbedUrl = (url: string): string => {
  if (!url) return url;
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(youtubeRegex);
  if (match?.[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
};

const getAchievementTranslation = (achievement: Achievement, locale: string) =>
  achievement.translations?.find((translation) => translation.locale === locale);

const getAchievementTitle = (achievement: Achievement) =>
  getAchievementTranslation(achievement, 'vi')?.title ||
  getAchievementTranslation(achievement, 'en')?.title ||
  achievement.translations?.find((translation) => translation.title)?.title ||
  achievement.code ||
  'Untitled achievement';

const getAchievementDescription = (achievement: Achievement) =>
  getAchievementTranslation(achievement, 'vi')?.description ||
  getAchievementTranslation(achievement, 'en')?.description ||
  achievement.translations?.find((translation) => translation.description)?.description ||
  '';

const RestaurantAchievements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
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
  const { saving: savingVR, scheduleSave: scheduleVr360Save } = useDebouncedVr360Autosave({
    onSave: (settings) =>
      restaurantVr360Api.updateSectionSettings('achievements', {
        target_id: settings.target_id || null,
        panorama_url: settings.panorama_url || null,
        vr360_link: settings.vr360_link || null,
        vr_title: settings.vr_title || null,
        title_translations: settings.title_translations || {},
      }),
    onErrorMessage: 'Failed to save VR settings',
    getErrorMessage: (error: any) => error?.message,
  });
  const [filter, setFilter] = useState<'all' | 'featured' | 'active' | 'inactive'>('all');
  const [editingAchievement, setEditingAchievement] = useState<EditableAchievement | null>(null);
  const [savingAchievement, setSavingAchievement] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'gallery' | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [achievementData, languages, settings, vr360Data] = await Promise.all([
        cafeAchievementsApi.getAchievements(),
        cafeLanguagesApi.getLanguages(),
        cafeSettingsApi.getSettings(),
        restaurantVr360Api.getSettings(),
      ]);

      const locales = languages.length > 0 ? languages.map((item) => item.locale) : ['vi', 'en'];
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;
      setSupportedLanguages(locales);
      setCurrentLocale((previous) => (locales.includes(previous) ? previous : locales[0]));
      setAchievements(achievementData);
      setIsDisplaying(settingsJson.achievements_is_displaying ?? true);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.achievements || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.achievements_vr360_link === 'string' ? settingsJson.achievements_vr360_link : null,
        vr_title: typeof settingsJson.achievements_vr_title === 'string' ? settingsJson.achievements_vr_title : null,
        title_translations: {},
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const loadAchievements = async () => {
    try {
      const achievementData = await cafeAchievementsApi.getAchievements();
      setAchievements(achievementData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh achievements');
    }
  };

  const makeTranslations = (achievement?: Achievement) => {
    const result = buildEmptyLocalizedAchievementData(supportedLanguages);
    supportedLanguages.forEach((locale) => {
      const translation = achievement?.translations?.find((item) => item.locale === locale);
      result[locale] = {
        title: translation?.title || '',
        description: translation?.description || '',
      };
    });
    return result;
  };

  const createDraftAchievement = (achievement?: Achievement): EditableAchievement => ({
    id: achievement?.id,
    code: achievement?.code || `achievement_${Date.now()}`,
    achievement_type: achievement?.achievement_type || '',
    issuer: achievement?.issuer || '',
    awarded_at: achievement?.awarded_at || '',
    location_text: achievement?.location_text || '',
    reference_url: achievement?.reference_url || '',
    primary_image_media_id: achievement?.primary_image_media_id ?? undefined,
    media_ids: achievement?.media?.map((item) => item.media_id) || [],
    is_active: achievement?.is_active ?? true,
    is_featured: achievement?.is_featured ?? false,
    display_order: achievement?.display_order ?? achievements.length,
    translations: makeTranslations(achievement),
  });

  const filteredAchievements = useMemo(() => {
    if (filter === 'all') return achievements;
    if (filter === 'featured') return achievements.filter((item) => item.is_featured);
    if (filter === 'active') return achievements.filter((item) => item.is_active);
    return achievements.filter((item) => !item.is_active);
  }, [achievements, filter]);

  const currentTranslation = useMemo(
    () => editingAchievement?.translations[currentLocale] || { title: '', description: '' },
    [currentLocale, editingAchievement]
  );

  const handleAddNew = () => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingAchievement(createDraftAchievement());
  };

  const handleEdit = (achievement: Achievement) => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingAchievement(createDraftAchievement(achievement));
  };

  const handleDelete = async (achievementId: number) => {
    const confirmed = window.confirm('Delete this achievement? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await cafeAchievementsApi.deleteAchievement(achievementId);
      toast.success('Achievement deleted');
      if (editingAchievement?.id === achievementId) {
        setEditingAchievement(null);
      }
      await loadAchievements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete achievement');
    }
  };

  const handleLocalizedFieldChange = (field: keyof AchievementLocalizedFields, value: string) => {
    setEditingAchievement((previous) => {
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

  const handleFieldChange = <K extends keyof EditableAchievement>(field: K, value: EditableAchievement[K]) => {
    setEditingAchievement((previous) => (previous ? { ...previous, [field]: value } : previous));
  };

  const handleGallerySelect = (mediaIds: number[]) => {
    setEditingAchievement((previous) => {
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
    setEditingAchievement((previous) => {
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
    setEditingAchievement((previous) => (previous ? { ...previous, primary_image_media_id: mediaId } : previous));
  };

  const handleSaveAchievement = async () => {
    if (!editingAchievement || savingAchievement) return;

    const translations: AchievementTranslation[] = supportedLanguages
      .map((locale) => ({
        locale,
        title: editingAchievement.translations[locale]?.title?.trim() || '',
        description: editingAchievement.translations[locale]?.description?.trim() || '',
      }))
      .filter((translation) => translation.title || translation.description);

    if (translations.length === 0 || !translations.some((translation) => translation.title)) {
      toast.error('Please add at least one achievement title');
      return;
    }

    if (!editingAchievement.code.trim()) {
      toast.error('Achievement code is required');
      return;
    }

    const payload: AchievementCreate = {
      code: editingAchievement.code.trim(),
      achievement_type: editingAchievement.achievement_type.trim() || null,
      issuer: editingAchievement.issuer.trim() || null,
      awarded_at: editingAchievement.awarded_at || null,
      location_text: editingAchievement.location_text.trim() || null,
      reference_url: editingAchievement.reference_url.trim() || null,
      primary_image_media_id: editingAchievement.primary_image_media_id || null,
      is_active: editingAchievement.is_active,
      is_featured: editingAchievement.is_featured,
      display_order: Number.isFinite(editingAchievement.display_order) ? editingAchievement.display_order : achievements.length,
      attributes_json: null,
      translations,
      media_ids: editingAchievement.media_ids,
    };

    try {
      setSavingAchievement(true);
      if (editingAchievement.id) {
        await cafeAchievementsApi.updateAchievement(editingAchievement.id, payload);
        toast.success('Achievement updated');
      } else {
        await cafeAchievementsApi.createAchievement(payload);
        toast.success('Achievement created');
      }
      setEditingAchievement(null);
      await loadAchievements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save achievement');
    } finally {
      setSavingAchievement(false);
    }
  };

  const handleVR360Change = (nextSettings: RestaurantVR360SectionSettings | 'link' | 'title', value?: string) => {
    const resolvedSettings: RestaurantVR360SectionSettings = typeof nextSettings === 'string'
      ? {
          ...vr360Settings,
          vr360_link: nextSettings === 'link' ? convertToEmbedUrl(value || '') || null : vr360Settings.vr360_link,
          vr_title: nextSettings === 'title' ? value || null : vr360Settings.vr_title,
        }
      : nextSettings;
    setVr360Settings(resolvedSettings);
    scheduleVr360Save(resolvedSettings);
  };

  const handleDisplayStatusChange = async (nextValue: boolean) => {
    try {
      setSavingDisplayStatus(true);
      const currentSettings = await cafeSettingsApi.getSettings();
      await cafeSettingsApi.updateSettings({
        settings_json: {
          ...currentSettings.settings_json,
          achievements_is_displaying: nextValue,
        },
      });
      setIsDisplaying(nextValue);
      toast.success(nextValue ? 'Achievements section enabled' : 'Achievements section hidden');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update display status');
    } finally {
      setSavingDisplayStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Achievements Section</h2>
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
          <span>When display is turned off, the Achievements section will not appear on the website, but you can still manage achievement content here.</span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <FontAwesomeIcon icon={faVrCardboard} className="text-xl text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>
        <VR360SettingsPanel
          sectionLabel="Achievements"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLocale}
          onChange={(nextValue) => void handleVR360Change(nextValue)}
        />
        <div className="hidden space-y-6">
          <div>
            <label className={LABEL_CLASS}>VR360 Link</label>
            <input type="url" className={FIELD_CLASS} value={vr360Link} onChange={(e) => void handleVR360Change('link', e.target.value)} placeholder="https://example.com/panorama.jpg or https://youtube.com/watch?v=..." />
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-slate-500" />
              <span>Enter a 360 panorama image URL or YouTube video URL for the Achievements landing experience.</span>
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>VR Tour Title</label>
            <input type="text" className={FIELD_CLASS} value={vrTitle} onChange={(e) => void handleVR360Change('title', e.target.value)} placeholder="Enter VR tour title" />
          </div>
          {vr360Link && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faEye} className="text-slate-600" />
                <h3 className="text-sm font-medium text-slate-700">VR360 Preview</h3>
              </div>
              <div className="overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-50">
                <div className="relative w-full" style={{ height: '500px' }}>
                  <iframe src={vr360Link} className="absolute left-0 top-0 h-full w-full" allowFullScreen title="Achievements VR360 Preview" allow="xr-spatial-tracking; gyroscope; accelerometer" />
                </div>
              </div>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => window.open(vr360Link, '_blank')} className="inline-flex items-center gap-2 rounded-md bg-slate-600 px-6 py-2 text-white transition-colors hover:bg-slate-700">
                  <FontAwesomeIcon icon={faGlobe} />
                  View Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Achievements Management</h2>
            <p className="mt-1 text-sm text-slate-500">Manage awards, certifications, milestones, and featured recognition for the restaurant brand.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-11 min-w-[140px] rounded-md border border-slate-300 px-4 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500">
              <option value="all">All items</option>
              <option value="featured">Featured</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="button" onClick={handleAddNew} className="inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              <FontAwesomeIcon icon={faPlus} />
              Add New Achievement
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">Loading achievements...</div>
        ) : filteredAchievements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">No achievements found for the current filter.</div>
        ) : (
          <div className="space-y-4">
            {filteredAchievements.map((achievement) => {
              const title = getAchievementTitle(achievement);
              const description = getAchievementDescription(achievement);
              const primaryImageId = achievement.primary_image_media_id || achievement.media?.[0]?.media_id;
              const awardDateLabel = achievement.awarded_at ? dayjs(achievement.awarded_at).format('DD/MM/YYYY') : 'No award date';
              const mediaCount = achievement.media?.length || 0;
              const translationCount = achievement.translations?.length || 0;

              return (
                <div key={achievement.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md">
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
                            {!achievement.is_active && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">inactive</span>}
                            {achievement.is_featured && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">featured</span>}
                          </div>
                          {description && <p className="line-clamp-2 text-sm text-slate-500">{description}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faAward} className="text-blue-500" />{achievement.achievement_type || 'General achievement'}</span>
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faStar} className="text-blue-500" />{achievement.issuer || 'No issuer'}</span>
                            <span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faEye} className="text-blue-500" />{awardDateLabel}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{mediaCount > 0 ? `${mediaCount} images` : 'No gallery'}</span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{translationCount > 0 ? `${translationCount} languages` : 'No translations'}</span>
                            {achievement.location_text && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{achievement.location_text}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-3 self-start md:self-auto">
                          <button type="button" className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50" title="Edit achievement" onClick={() => handleEdit(achievement)}>
                            <FontAwesomeIcon icon={faPenToSquare} />
                            Edit
                          </button>
                          <button type="button" className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700" title="Delete achievement" onClick={() => void handleDelete(achievement.id)}>
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

      {editingAchievement && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingAchievement.id ? 'Edit Achievement' : 'Add New Achievement'}</h2>
                <p className="mt-1 text-sm text-slate-500">Manage award information, media, and localized achievement content.</p>
              </div>
              <button type="button" onClick={() => setEditingAchievement(null)} className="text-slate-400 transition-colors hover:text-slate-600">
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
                  <label className={LABEL_CLASS}>Achievement Code</label>
                  <input type="text" className={FIELD_CLASS} value={editingAchievement.code} onChange={(e) => handleFieldChange('code', e.target.value)} placeholder="e.g. michelin_2026" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Achievement Type</label>
                  <input type="text" className={FIELD_CLASS} value={editingAchievement.achievement_type} onChange={(e) => handleFieldChange('achievement_type', e.target.value)} placeholder="award, certification, milestone..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Issuer</label>
                  <input type="text" className={FIELD_CLASS} value={editingAchievement.issuer} onChange={(e) => handleFieldChange('issuer', e.target.value)} placeholder="Michelin Guide, local authority..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Award Date</label>
                  <input type="date" className={FIELD_CLASS} value={editingAchievement.awarded_at} onChange={(e) => handleFieldChange('awarded_at', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Display Order</label>
                  <input type="number" className={FIELD_CLASS} value={editingAchievement.display_order} onChange={(e) => handleFieldChange('display_order', Number(e.target.value))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Location</label>
                  <input type="text" className={FIELD_CLASS} value={editingAchievement.location_text} onChange={(e) => handleFieldChange('location_text', e.target.value)} placeholder="Paris, Vietnam, Online..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Reference URL</label>
                  <input type="url" className={FIELD_CLASS} value={editingAchievement.reference_url} onChange={(e) => handleFieldChange('reference_url', e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Title ({getLocaleShortLabel(currentLocale)})</label>
                  <input type="text" className={FIELD_CLASS} value={currentTranslation.title} onChange={(e) => handleLocalizedFieldChange('title', e.target.value)} placeholder="Achievement title" />
                </div>
                <div className="flex flex-wrap items-center gap-6 pt-8">
                  <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={editingAchievement.is_active} onChange={(e) => handleFieldChange('is_active', e.target.checked)} />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={editingAchievement.is_featured} onChange={(e) => handleFieldChange('is_featured', e.target.checked)} />
                    Featured Achievement
                  </label>
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Description ({getLocaleShortLabel(currentLocale)})</label>
                <textarea className={`${FIELD_CLASS} min-h-[120px]`} value={currentTranslation.description} onChange={(e) => handleLocalizedFieldChange('description', e.target.value)} placeholder="Short description for this achievement" />
              </div>

              <div className="mt-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FontAwesomeIcon icon={faImages} />
                  Achievement Images
                </label>
                <button type="button" onClick={() => setMediaPickerMode('gallery')} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  <FontAwesomeIcon icon={faImages} />
                  Select Images
                </button>

                {editingAchievement.media_ids.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {editingAchievement.media_ids.map((mediaId) => {
                      const isPrimary = editingAchievement.primary_image_media_id === mediaId;
                      return (
                        <div key={mediaId} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <img src={`${getApiBaseUrl()}/media/${mediaId}/view`} alt={`Achievement media ${mediaId}`} className="h-24 w-full object-cover" />
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
              <button type="button" onClick={() => setEditingAchievement(null)} disabled={savingAchievement} className="rounded-md border border-slate-300 px-5 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => void handleSaveAchievement()} disabled={savingAchievement} className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                {savingAchievement ? 'Saving...' : editingAchievement.id ? 'Update Achievement' : 'Save Achievement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAchievement && mediaPickerMode && (
        <MediaPickerModal
          isOpen={mediaPickerMode !== null}
          onClose={() => setMediaPickerMode(null)}
          title="Select Achievement Images"
          kind="image"
          source="restaurant"
          folder="achievements"
          folderAliases={['achievement', 'restaurant/achievements', 'restaurant/achievement']}
          allowMultiple
          initialSelectedIds={editingAchievement.media_ids}
          onSelectMultiple={handleGallerySelect}
        />
      )}
    </div>
  );
};

export default RestaurantAchievements;
