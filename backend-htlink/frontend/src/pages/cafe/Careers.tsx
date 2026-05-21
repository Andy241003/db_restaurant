import {
    faBriefcase,
    faCircleInfo,
    faEye,
    faImages,
    faInfoCircle,
    faPenToSquare,
    faPhone,
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
import {
    cafeBranchesApi,
    cafeCareersApi,
    cafeLanguagesApi,
    cafeSettingsApi,
    restaurantVr360Api,
    type Branch,
    type Career,
    type CareerCreate,
    type CareerTranslation,
    type RestaurantVR360Scene,
    type RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const LABEL_CLASS = 'mb-2 block text-sm font-medium text-slate-700';
const FIELD_CLASS = 'w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'rounded-lg bg-white p-6 shadow';

type CareerStatus = 'open' | 'closed' | 'filled';

type CareerLocalizedFields = {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
};

type EditableCareer = {
  id?: number;
  code: string;
  job_type: string;
  experience_required: string;
  salary_min: string;
  salary_max: string;
  salary_text: string;
  deadline: string;
  contact_email: string;
  contact_phone: string;
  application_url: string;
  primary_image_media_id?: number;
  media_ids: number[];
  branch_id?: number | null;
  status: CareerStatus;
  display_order: number;
  is_urgent: boolean;
  translations: Record<string, CareerLocalizedFields>;
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

const buildEmptyLocalizedCareerData = (locales: string[]) =>
  locales.reduce<Record<string, CareerLocalizedFields>>((acc, locale) => {
    acc[locale] = { title: '', description: '', requirements: '', benefits: '' };
    return acc;
  }, {});

const getCareerTranslation = (career: Career, locale: string) =>
  career.translations?.find((translation) => translation.locale === locale);

const getCareerTitle = (career: Career) =>
  getCareerTranslation(career, 'vi')?.title ||
  getCareerTranslation(career, 'en')?.title ||
  career.translations?.find((translation) => translation.title)?.title ||
  career.code ||
  'Untitled job';

const getCareerDescription = (career: Career) =>
  getCareerTranslation(career, 'vi')?.description ||
  getCareerTranslation(career, 'en')?.description ||
  career.translations?.find((translation) => translation.description)?.description ||
  '';

const getCareerSalaryLabel = (career: Career) => {
  if (career.salary_text?.trim()) return career.salary_text.trim();
  if (career.salary_min && career.salary_max) {
    return `${career.salary_min.toLocaleString('vi-VN')} - ${career.salary_max.toLocaleString('vi-VN')} VND`;
  }
  if (career.salary_min) return `From ${career.salary_min.toLocaleString('vi-VN')} VND`;
  if (career.salary_max) return `Up to ${career.salary_max.toLocaleString('vi-VN')} VND`;
  return 'Negotiable';
};

const getCareerLanguageLabel = (career: Career) => {
  const count = career.translations?.length || 0;
  return count > 0 ? `${count} languages` : 'No translations';
};

const getBranchName = (branch: Branch) =>
  branch.translations?.find((translation) => translation.locale === 'vi')?.name ||
  branch.translations?.find((translation) => translation.locale === 'en')?.name ||
  branch.name_vi ||
  branch.name_en ||
  branch.code ||
  'Unknown branch';

const getStatusBadgeClass = (status: CareerStatus) => {
  switch (status) {
    case 'closed':
      return 'bg-slate-200 text-slate-700';
    case 'filled':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

const RestaurantCareers: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [careers, setCareers] = useState<Career[]>([]);
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
  const [savingVR, setSavingVR] = useState(false);
  const vr360Link = vr360Settings.vr360_link || '';
  const vrTitle = vr360Settings.vr_title || '';
  const [careerFilter, setCareerFilter] = useState<'all' | CareerStatus>('all');
  const [editingCareer, setEditingCareer] = useState<EditableCareer | null>(null);
  const [savingCareer, setSavingCareer] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'gallery' | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [careerData, languages, settings, branchData, vr360Data] = await Promise.all([
        cafeCareersApi.getCareers(),
        cafeLanguagesApi.getLanguages(),
        cafeSettingsApi.getSettings(),
        cafeBranchesApi.getBranches(),
        restaurantVr360Api.getSettings(),
      ]);

      const locales = languages.length > 0 ? languages.map((item) => item.locale) : ['vi', 'en'];
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;
      setSupportedLanguages(locales);
      setCurrentLocale((previous) => (locales.includes(previous) ? previous : locales[0]));
      setCareers(careerData);
      setBranches(branchData);
      setIsDisplaying(settingsJson.careers_is_displaying ?? true);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.careers || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.careers_vr360_link === 'string' ? settingsJson.careers_vr360_link : null,
        vr_title: typeof settingsJson.careers_vr_title === 'string' ? settingsJson.careers_vr_title : null,
        title_translations: {},
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load careers');
    } finally {
      setLoading(false);
    }
  };

  const loadCareers = async () => {
    try {
      const careerData = await cafeCareersApi.getCareers();
      setCareers(careerData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh careers');
    }
  };

  const makeTranslations = (career?: Career) => {
    const result = buildEmptyLocalizedCareerData(supportedLanguages);
    supportedLanguages.forEach((locale) => {
      const translation = career?.translations?.find((item) => item.locale === locale);
      result[locale] = {
        title: translation?.title || '',
        description: translation?.description || '',
        requirements: translation?.requirements || '',
        benefits: translation?.benefits || '',
      };
    });
    return result;
  };

  const createDraftCareer = (career?: Career): EditableCareer => ({
    id: career?.id,
    code: career?.code || `career_${Date.now()}`,
    job_type: career?.job_type || '',
    experience_required: career?.experience_required || '',
    salary_min: career?.salary_min ? String(career.salary_min) : '',
    salary_max: career?.salary_max ? String(career.salary_max) : '',
    salary_text: career?.salary_text || '',
    deadline: career?.deadline || '',
    contact_email: career?.contact_email || '',
    contact_phone: career?.contact_phone || '',
    application_url: career?.application_url || '',
    primary_image_media_id: career?.primary_image_media_id ?? undefined,
    media_ids: career?.media_ids || [],
    branch_id: career?.branch_id ?? undefined,
    status: (career?.status as CareerStatus) || 'open',
    display_order: career?.display_order ?? careers.length,
    is_urgent: career?.is_urgent ?? false,
    translations: makeTranslations(career),
  });

  const filteredCareers = useMemo(() => {
    if (careerFilter === 'all') return careers;
    return careers.filter((career) => career.status === careerFilter);
  }, [careerFilter, careers]);

  const currentTranslation = useMemo(
    () => editingCareer?.translations[currentLocale] || { title: '', description: '', requirements: '', benefits: '' },
    [currentLocale, editingCareer]
  );

  const handleAddNew = () => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingCareer(createDraftCareer());
  };

  const handleEdit = (career: Career) => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingCareer(createDraftCareer(career));
  };

  const handleDelete = async (careerId: number) => {
    const confirmed = window.confirm('Delete this job posting? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await cafeCareersApi.deleteCareer(careerId);
      toast.success('Career deleted');
      if (editingCareer?.id === careerId) {
        setEditingCareer(null);
      }
      await loadCareers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete career');
    }
  };

  const handleLocalizedFieldChange = (field: keyof CareerLocalizedFields, value: string) => {
    setEditingCareer((previous) => {
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

  const handleFieldChange = <K extends keyof EditableCareer>(field: K, value: EditableCareer[K]) => {
    setEditingCareer((previous) => (previous ? { ...previous, [field]: value } : previous));
  };
  const handleSaveCareer = async () => {
    if (!editingCareer) return;

    const translations: CareerTranslation[] = supportedLanguages
      .map((locale) => ({
        locale,
        title: editingCareer.translations[locale]?.title?.trim() || '',
        description: editingCareer.translations[locale]?.description?.trim() || '',
        requirements: editingCareer.translations[locale]?.requirements?.trim() || '',
        benefits: editingCareer.translations[locale]?.benefits?.trim() || '',
      }))
      .filter((translation) => translation.title || translation.description || translation.requirements || translation.benefits);

    if (translations.length === 0 || !translations.some((translation) => translation.title)) {
      toast.error('Please add at least one job title');
      return;
    }

    if (!editingCareer.code.trim()) {
      toast.error('Career code is required');
      return;
    }

    const payload: CareerCreate = {
      code: editingCareer.code.trim(),
      job_type: editingCareer.job_type.trim(),
      experience_required: editingCareer.experience_required.trim(),
      salary_min: editingCareer.salary_min ? Number(editingCareer.salary_min) : null,
      salary_max: editingCareer.salary_max ? Number(editingCareer.salary_max) : null,
      salary_text: editingCareer.salary_text.trim(),
      deadline: editingCareer.deadline || undefined,
      contact_email: editingCareer.contact_email.trim(),
      contact_phone: editingCareer.contact_phone.trim(),
      application_url: editingCareer.application_url.trim(),
      primary_image_media_id: editingCareer.primary_image_media_id || null,
      branch_id: editingCareer.branch_id || null,
      status: editingCareer.status,
      display_order: Number.isFinite(editingCareer.display_order) ? editingCareer.display_order : careers.length,
      is_urgent: editingCareer.is_urgent,
      attributes_json: null,
      translations,
      media_ids: editingCareer.media_ids,
    };

    try {
      setSavingCareer(true);
      if (editingCareer.id) {
        await cafeCareersApi.updateCareer(editingCareer.id, payload);
        toast.success('Career updated');
      } else {
        await cafeCareersApi.createCareer(payload);
        toast.success('Career created');
      }
      setEditingCareer(null);
      await loadCareers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save career');
    } finally {
      setSavingCareer(false);
    }
  };

  const handleGallerySelect = (mediaIds: number[]) => {
    setEditingCareer((previous) => {
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
    setEditingCareer((previous) => {
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
    setEditingCareer((previous) => (previous ? { ...previous, primary_image_media_id: mediaId } : previous));
  };

  const handleVR360Change = async (nextSettings: RestaurantVR360SectionSettings | 'link' | 'title', value?: string) => {
    try {
      setSavingVR(true);
      if (typeof nextSettings === 'string') {
        const legacyNextSettings: RestaurantVR360SectionSettings = {
          ...vr360Settings,
          vr360_link: nextSettings === 'link' ? value || null : vr360Settings.vr360_link,
          vr_title: nextSettings === 'title' ? value || null : vr360Settings.vr_title,
        };
        setVr360Settings(legacyNextSettings);
        await restaurantVr360Api.updateSectionSettings('careers', {
          target_id: legacyNextSettings.target_id || null,
          panorama_url: legacyNextSettings.panorama_url || null,
          vr360_link: legacyNextSettings.vr360_link || null,
          vr_title: legacyNextSettings.vr_title || null,
          title_translations: legacyNextSettings.title_translations || {},
        });
        toast.success('VR360 settings saved');
        return;
      }
      setVr360Settings(nextSettings);
      await restaurantVr360Api.updateSectionSettings('careers', {
        target_id: nextSettings.target_id || null,
        panorama_url: nextSettings.panorama_url || null,
        vr360_link: nextSettings.vr360_link || null,
        vr_title: nextSettings.vr_title || null,
        title_translations: nextSettings.title_translations || {},
      });
      toast.success('VR360 settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save VR settings');
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
          careers_is_displaying: nextValue,
        },
      });
      setIsDisplaying(nextValue);
      toast.success(nextValue ? 'Careers section enabled' : 'Careers section hidden');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update display status');
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
          <h2 className="text-xl font-bold text-slate-800">Display Status - Careers Section</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDisplaying ? 'text-emerald-600' : 'text-slate-500'}`}>
              {isDisplaying ? 'Displaying' : 'Hidden'}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isDisplaying}
                onChange={(e) => void handleDisplayStatusChange(e.target.checked)}
                disabled={savingDisplayStatus}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 text-blue-600" />
          <span>When display is turned off, the Careers section will not appear on the website, but you can still manage job postings here.</span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <FontAwesomeIcon icon={faVrCardboard} className="text-xl text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>

        <>
          <VR360SettingsPanel
            sectionLabel="Careers"
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
            <input
              type="url"
              className={FIELD_CLASS}
              value={vr360Link}
              onChange={(e) => void handleVR360Change('link', e.target.value)}
              placeholder="https://example.com/panorama.jpg or https://youtube.com/watch?v=..."
              disabled={savingVR}
            />
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-slate-500" />
              <span>Enter the URL to a 360� panorama image or YouTube video URL.</span>
            </p>
          </div>

          <div>
            <label className={LABEL_CLASS}>VR360 Title</label>
            <input
              type="text"
              className={FIELD_CLASS}
              value={vrTitle}
              onChange={(e) => void handleVR360Change('title', e.target.value)}
              placeholder="Enter VR tour title"
              disabled={savingVR}
            />
          </div>

          {vr360Link && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faEye} className="text-slate-600" />
                <h3 className="text-sm font-medium text-slate-700">VR360 Preview</h3>
              </div>
              <div className="overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-50">
                <div className="relative w-full" style={{ height: '500px' }}>
                  <iframe
                    src={vr360Link}
                    className="absolute left-0 top-0 h-full w-full"
                    allowFullScreen
                    title="VR360 Preview"
                    allow="xr-spatial-tracking; gyroscope; accelerometer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      </div>
      <div className={SECTION_CLASS}>
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Careers Management</h2>
            <p className="mt-1 text-sm text-slate-500">Manage job postings, branches, deadlines, and featured hiring priorities for the restaurant site.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={careerFilter}
              onChange={(e) => setCareerFilter(e.target.value as 'all' | CareerStatus)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="filled">Filled</option>
            </select>
            <button
              type="button"
              onClick={handleAddNew}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <FontAwesomeIcon icon={faPlus} />
              Add New Position
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">Loading careers...</div>
        ) : filteredCareers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">No job postings found for the current filter.</div>
        ) : (
          <div className="space-y-4">
            {filteredCareers.map((career) => {
              const title = getCareerTitle(career);
              const description = getCareerDescription(career);
              const branchLabel = getBranchLabelById(career.branch_id);
              const salaryLabel = getCareerSalaryLabel(career);
              const languageLabel = getCareerLanguageLabel(career);
              const imageId = career.primary_image_media_id ?? career.media_ids?.[0];
              const imageUrl = imageId ? `${getApiBaseUrl()}/media/${imageId}/view` : null;

              return (
                <div key={career.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className={`flex h-32 w-full shrink-0 overflow-hidden rounded-xl lg:w-52 ${imageUrl ? 'bg-slate-100' : 'bg-blue-50 text-blue-600'}`}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-blue-600">
                          <FontAwesomeIcon icon={faBriefcase} className="text-2xl" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-slate-800">{title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(career.status as CareerStatus)}`}>
                          {career.status}
                        </span>
                        {career.is_urgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                            <FontAwesomeIcon icon={faStar} />
                            Urgent
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                        <span>{career.job_type || 'No type'}</span>
                        <span>{branchLabel}</span>
                        <span>{salaryLabel}</span>
                        <span>{career.deadline ? dayjs(career.deadline).format('YYYY-MM-DD') : 'No deadline'}</span>
                        <span>{career.contact_phone || career.contact_email || 'No contact info'}</span>
                      </div>

                      {description && <p className="mt-2 line-clamp-1 text-sm text-slate-500">{description}</p>}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{languageLabel}</span>
                        {career.experience_required && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{career.experience_required}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-3 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() => handleEdit(career)}
                        className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
                        title="Edit career"
                      >
                        <FontAwesomeIcon icon={faPenToSquare} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(career.id)}
                        className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                        title="Delete career"
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingCareer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-6">
              <h3 className="text-xl font-bold text-slate-800">{editingCareer.id ? 'Edit Career' : 'Add New Career'}</h3>
              <button
                type="button"
                onClick={() => setEditingCareer(null)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 overflow-x-auto border-b border-slate-200 pb-0">
                <div className="flex w-max min-w-full gap-2 whitespace-nowrap pr-2">
                  {supportedLanguages.map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => setCurrentLocale(locale)}
                      className={`shrink-0 border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${currentLocale === locale ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                    >
                      {getLocaleShortLabel(locale)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLASS}>Job Title *</label>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={currentTranslation.title}
                    onChange={(e) => handleLocalizedFieldChange('title', e.target.value)}
                    placeholder="Enter job title..."
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea
                    rows={4}
                    className={FIELD_CLASS}
                    value={currentTranslation.description}
                    onChange={(e) => handleLocalizedFieldChange('description', e.target.value)}
                    placeholder="Describe the role and responsibilities..."
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Requirements</label>
                  <textarea
                    rows={4}
                    className={FIELD_CLASS}
                    value={currentTranslation.requirements}
                    onChange={(e) => handleLocalizedFieldChange('requirements', e.target.value)}
                    placeholder="List the required skills and qualifications..."
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Benefits</label>
                  <textarea
                    rows={3}
                    className={FIELD_CLASS}
                    value={currentTranslation.benefits}
                    onChange={(e) => handleLocalizedFieldChange('benefits', e.target.value)}
                    placeholder="What benefits do you offer?..."
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Code</label>
                  <input type="text" className={FIELD_CLASS} value={editingCareer.code} onChange={(e) => handleFieldChange('code', e.target.value)} placeholder="career_code" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Branch</label>
                  <select
                    className={FIELD_CLASS}
                    value={editingCareer.branch_id ?? ''}
                    onChange={(e) => handleFieldChange('branch_id', e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">All branches / not assigned</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{getBranchName(branch)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Job Type</label>
                  <input type="text" className={FIELD_CLASS} value={editingCareer.job_type} onChange={(e) => handleFieldChange('job_type', e.target.value)} placeholder="Full-time, Part-time, Internship..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Experience Required</label>
                  <input type="text" className={FIELD_CLASS} value={editingCareer.experience_required} onChange={(e) => handleFieldChange('experience_required', e.target.value)} placeholder="1 year, Senior, Entry level..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Salary Min</label>
                  <input type="number" className={FIELD_CLASS} value={editingCareer.salary_min} onChange={(e) => handleFieldChange('salary_min', e.target.value)} min={0} placeholder="8000000" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Salary Max</label>
                  <input type="number" className={FIELD_CLASS} value={editingCareer.salary_max} onChange={(e) => handleFieldChange('salary_max', e.target.value)} min={0} placeholder="12000000" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Salary Text</label>
                  <input type="text" className={FIELD_CLASS} value={editingCareer.salary_text} onChange={(e) => handleFieldChange('salary_text', e.target.value)} placeholder="Negotiable, Up to 15M..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Deadline</label>
                  <input type="date" className={FIELD_CLASS} value={editingCareer.deadline} onChange={(e) => handleFieldChange('deadline', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Contact Email</label>
                  <input type="email" className={FIELD_CLASS} value={editingCareer.contact_email} onChange={(e) => handleFieldChange('contact_email', e.target.value)} placeholder="hr@example.com" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Contact Phone</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <FontAwesomeIcon icon={faPhone} />
                    </span>
                    <input type="text" className={`${FIELD_CLASS} pl-10`} value={editingCareer.contact_phone} onChange={(e) => handleFieldChange('contact_phone', e.target.value)} placeholder="0123 456 789" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Application URL</label>
                  <input type="url" className={FIELD_CLASS} value={editingCareer.application_url} onChange={(e) => handleFieldChange('application_url', e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Status</label>
                  <select className={FIELD_CLASS} value={editingCareer.status} onChange={(e) => handleFieldChange('status', e.target.value as CareerStatus)}>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="filled">Filled</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Display Order</label>
                  <input type="number" className={FIELD_CLASS} value={editingCareer.display_order} onChange={(e) => handleFieldChange('display_order', parseInt(e.target.value, 10) || 0)} min={0} />
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FontAwesomeIcon icon={faImages} />
                  Career Images
                </label>
                <button type="button" onClick={() => setMediaPickerMode('gallery')} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  <FontAwesomeIcon icon={faImages} />
                  Select Images
                </button>

                {editingCareer.media_ids.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {editingCareer.media_ids.map((mediaId) => {
                      const isPrimary = editingCareer.primary_image_media_id === mediaId;
                      return (
                        <div key={mediaId} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <img src={`${getApiBaseUrl()}/media/${mediaId}/view`} alt={`Career media ${mediaId}`} className="h-24 w-full object-cover" />
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

              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Urgent Hiring</h3>
                  <p className="text-sm text-slate-500">Highlight this job posting as an urgent opening.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={editingCareer.is_urgent} onChange={(e) => handleFieldChange('is_urgent', e.target.checked)} />
                  <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-rose-500 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-4 border-t border-slate-200 bg-slate-50 p-6">
              <button
                type="button"
                onClick={() => setEditingCareer(null)}
                disabled={savingCareer}
                className="rounded-md border border-slate-600 px-6 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCareer()}
                disabled={savingCareer}
                className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
              >
                {savingCareer ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCareer && mediaPickerMode && (
        <MediaPickerModal
          isOpen={mediaPickerMode !== null}
          onClose={() => setMediaPickerMode(null)}
          title="Select Career Images"
          kind="image"
          source="restaurant"
          folder="careers"
          folderAliases={['career', 'restaurant/careers', 'restaurant/career']}
          allowMultiple
          initialSelectedIds={editingCareer?.media_ids || []}
          onSelectMultiple={handleGallerySelect}
        />
      )}
    </div>
  );
};

export default RestaurantCareers;



