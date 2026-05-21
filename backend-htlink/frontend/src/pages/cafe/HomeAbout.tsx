import {
    faArrowRotateLeft,
    faCircleInfo,
    faFlag,
    faFloppyDisk,
    faVrCardboard,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import type {
    RestaurantPageSettings,
    ContentSection,
    ContentSectionTranslation,
    RestaurantVR360Scene,
    RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';
import {
    restaurantContentSectionsApi,
    restaurantLanguagesApi,
    restaurantPageSettingsApi,
    restaurantVr360Api,
} from '../../services/restaurantApi';

const INPUT_CLASS = 'w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed';
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-y`;
const SECTION_CLASS = 'bg-white rounded-lg shadow p-6';

const LANGUAGE_META: Record<string, { label: string }> = {
  en: { label: 'English' },
  vi: { label: 'Vietnamese' },
  tl: { label: 'Filipino (Tagalog)' },
  zh: { label: 'Chinese (Traditional)' },
  'zh-TW': { label: 'Chinese (Traditional)' },
  ja: { label: 'Japanese' },
  ko: { label: 'Korean' },
  fr: { label: 'French' },
  de: { label: 'German' },
  es: { label: 'Spanish' },
  th: { label: 'Thai' },
  yue: { label: 'Cantonese' },
};

interface TranslationFormValue {
  title: string;
  description: string;
  content: string;
}

interface IntroductionFormState {
  id?: number;
  page_code: 'home' | 'about';
  section_type: 'introduction';
  is_active: boolean;
  translations: Record<string, TranslationFormValue>;
}

interface PageSettingsFormState {
  page_code: 'home' | 'about';
  is_displaying: boolean;
  vr360: RestaurantVR360SectionSettings;
}

interface RestaurantHomeAboutPageProps {
  pageCode: 'home' | 'about';
  pageTitle: string;
  pageDescription: string;
}

const getLanguageLabel = (locale: string) => {
  const meta = LANGUAGE_META[locale];
  return meta ? `${meta.label}` : locale.toUpperCase();
};

const buildBlankTranslations = (locales: string[]) => {
  const entries = locales.map((locale) => [
    locale,
    {
      title: '',
      description: '',
      content: '',
    },
  ] as const);

  return Object.fromEntries(entries) as Record<string, TranslationFormValue>;
};

const buildIntroductionState = (
  locales: string[],
  pageCode: 'home' | 'about',
  section?: ContentSection,
): IntroductionFormState => {
  const translations = buildBlankTranslations(locales);

  section?.translations?.forEach((translation) => {
    translations[translation.locale] = {
      title: translation.title || '',
      description: translation.description || '',
      content: translation.content || '',
    };
  });

  return {
    id: section?.id,
    page_code: pageCode,
    section_type: 'introduction',
    is_active: section?.is_active ?? true,
    translations,
  };
};

const buildDefaultVr360State = (
  pageSettings?: RestaurantPageSettings,
): RestaurantVR360SectionSettings => ({
  target_id: null,
  panorama_url: null,
  vr360_link: pageSettings?.vr360_link || null,
  vr_title: pageSettings?.vr_title || null,
  title_translations: {},
});

const buildPageSettingsState = (
  pageCode: 'home' | 'about',
  pageSettings?: RestaurantPageSettings,
): PageSettingsFormState => ({
  page_code: pageCode,
  is_displaying: pageSettings?.is_displaying ?? true,
  vr360: buildDefaultVr360State(pageSettings),
});

const RestaurantHomeAboutPage: React.FC<RestaurantHomeAboutPageProps> = ({
  pageCode,
  pageTitle,
  pageDescription,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['vi', 'en']);
  const [currentLocale, setCurrentLocale] = useState<string>('vi');
  const [introduction, setIntroduction] = useState<IntroductionFormState | null>(null);
  const [pageSettings, setPageSettings] = useState<PageSettingsFormState>(() => buildPageSettingsState(pageCode));
  const [scenes, setScenes] = useState<RestaurantVR360Scene[]>([]);
  const [initialIntroduction, setInitialIntroduction] = useState<IntroductionFormState | null>(null);
  const [initialPageSettings, setInitialPageSettings] = useState<PageSettingsFormState>(() => buildPageSettingsState(pageCode));

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);

      const languages = await restaurantLanguagesApi.getLanguages();
      const locales = languages.map((language) => language.locale);
      const resolvedLocales = locales.length > 0 ? locales : ['vi', 'en'];
      setSupportedLanguages(resolvedLocales);
      setCurrentLocale((prev) => (resolvedLocales.includes(prev) ? prev : resolvedLocales[0]));

      const [sections, pageSetting, vr360Settings] = await Promise.all([
        restaurantContentSectionsApi.getContentSections(pageCode, 'introduction'),
        restaurantPageSettingsApi.getPageSetting(pageCode).catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
          }
          throw error;
        }),
        restaurantVr360Api.getSettings(),
      ]);

      const introductionSection = sections[0];
      const nextIntroduction = buildIntroductionState(resolvedLocales, pageCode, introductionSection);
      const nextPageSettings = buildPageSettingsState(pageCode, pageSetting || undefined);
      const sectionVr360 = vr360Settings.sections[pageCode];
      if (sectionVr360) {
        nextPageSettings.vr360 = {
          target_id: sectionVr360.target_id || null,
          panorama_url: sectionVr360.panorama_url || null,
          vr360_link: sectionVr360.vr360_link || null,
          vr_title: sectionVr360.vr_title || null,
          title_translations: sectionVr360.title_translations || {},
        };
      }

      setIntroduction(nextIntroduction);
      setInitialIntroduction(JSON.parse(JSON.stringify(nextIntroduction)));
      setPageSettings(nextPageSettings);
      setInitialPageSettings(JSON.parse(JSON.stringify(nextPageSettings)));
      setScenes(vr360Settings.scenes);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load introduction data');
    } finally {
      setLoading(false);
    }
  }, [pageCode]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleDisplayToggle = (checked: boolean) => {
    setPageSettings((prev) => ({ ...prev, is_displaying: checked }));
  };

  const handleVr360Change = (nextVr360: RestaurantVR360SectionSettings) => {
    setPageSettings((prev) => ({ ...prev, vr360: nextVr360 }));
  };

  const handleTranslationChange = (locale: string, field: keyof TranslationFormValue, value: string) => {
    setIntroduction((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [locale]: {
            ...prev.translations[locale],
            [field]: value,
          },
        },
      };
    });
  };

  const handleCancel = () => {
    if (initialIntroduction) {
      setIntroduction(JSON.parse(JSON.stringify(initialIntroduction)));
    }
    setPageSettings(JSON.parse(JSON.stringify(initialPageSettings)));
    toast.success('Changes reverted');
  };

  const handleSave = async () => {
    if (!introduction) return;

    try {
      setSaving(true);

      const translations: ContentSectionTranslation[] = supportedLanguages.map((locale) => ({
        locale,
        title: introduction.translations[locale]?.title || '',
        description: introduction.translations[locale]?.description || '',
        content: introduction.translations[locale]?.content || '',
      }));

      const contentPayload = {
        section_type: 'introduction',
        page_code: pageCode,
        is_active: pageSettings.is_displaying,
        translations,
      };

      const [savedSection] = await Promise.all([
        introduction.id
          ? restaurantContentSectionsApi.updateContentSection(introduction.id, contentPayload)
          : restaurantContentSectionsApi.createContentSection(contentPayload),
        restaurantPageSettingsApi.createOrUpdatePageSetting({
          page_code: pageCode,
          is_displaying: pageSettings.is_displaying,
        }),
        restaurantVr360Api.updateSectionSettings(pageCode, {
          target_id: pageSettings.vr360.target_id || null,
          panorama_url: pageSettings.vr360.panorama_url || null,
          vr360_link: pageSettings.vr360.vr360_link || null,
          vr_title: pageSettings.vr360.vr_title || null,
          title_translations: pageSettings.vr360.title_translations || {},
        }),
      ]);

      const nextIntroduction = buildIntroductionState(supportedLanguages, pageCode, savedSection);
      const nextPageSettings = { ...pageSettings };

      setIntroduction(nextIntroduction);
      setInitialIntroduction(JSON.parse(JSON.stringify(nextIntroduction)));
      setInitialPageSettings(JSON.parse(JSON.stringify(nextPageSettings)));
      toast.success(`${pageTitle} content saved successfully`);
    } catch (error: any) {
      console.error('Failed to save introduction page:', error);
      toast.error(error.response?.data?.detail || 'Failed to save page content');
    } finally {
      setSaving(false);
    }
  };

  const currentTranslation = useMemo(
    () => introduction?.translations[currentLocale] || { title: '', description: '', content: '' },
    [currentLocale, introduction],
  );

  if (loading || !introduction) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading introduction...</div>
      </div>
    );
  }

  const fieldsDisabled = saving;

  return (
    <div className="space-y-6">
      <div className={SECTION_CLASS}>
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Introduction Section</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${pageSettings.is_displaying ? 'text-green-600' : 'text-slate-500'}`}>
              {pageSettings.is_displaying ? 'Displaying' : 'Hidden'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={pageSettings.is_displaying}
                onChange={(event) => handleDisplayToggle(event.target.checked)}
                disabled={saving}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <FontAwesomeIcon icon={faCircleInfo} className="text-blue-600 text-xl mt-0.5" />
          <span className="text-blue-800 text-sm">
            When display is turned off, the &quot;Introduction&quot; section will not appear on the website, but you can still edit and manage the content here.
          </span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800">Introduction Content</h2>
          <p className="text-slate-500 mt-1 text-sm">{pageDescription}</p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200 flex-wrap">
          {supportedLanguages.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setCurrentLocale(locale)}
              className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                currentLocale === locale
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <FontAwesomeIcon icon={faFlag} />
              {getLanguageLabel(locale)}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
            <input
              type="text"
              placeholder="Enter title"
              className={INPUT_CLASS}
              value={currentTranslation.title}
              onChange={(event) => handleTranslationChange(currentLocale, 'title', event.target.value)}
              disabled={fieldsDisabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Short Description</label>
            <textarea
              placeholder="Enter short description"
              rows={3}
              className={TEXTAREA_CLASS}
              value={currentTranslation.description}
              onChange={(event) => handleTranslationChange(currentLocale, 'description', event.target.value)}
              disabled={fieldsDisabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Detailed Content</label>
            <textarea
              placeholder="Enter detailed content"
              rows={12}
              className={`${TEXTAREA_CLASS} font-mono text-sm`}
              value={currentTranslation.content}
              onChange={(event) => handleTranslationChange(currentLocale, 'content', event.target.value)}
              disabled={fieldsDisabled}
            />
          </div>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center gap-3">
          <FontAwesomeIcon icon={faVrCardboard} className="text-purple-600 text-xl" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>

        <VR360SettingsPanel
          sectionLabel={pageTitle}
          value={pageSettings.vr360}
          scenes={scenes}
          currentLocale={currentLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLocale}
          onChange={handleVr360Change}
          disabled={fieldsDisabled}
        />
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faFloppyDisk} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-6 py-2 border border-slate-600 text-slate-600 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowRotateLeft} />
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RestaurantHomeAboutPage;
