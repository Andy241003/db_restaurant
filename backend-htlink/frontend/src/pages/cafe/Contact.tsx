import { faArrowRotateLeft, faCircleInfo, faFloppyDisk, faPhone, faShareNodes, faVrCardboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import {
  cafeLanguagesApi,
  cafeContactApi,
  restaurantVr360Api,
  type RestaurantVR360Scene,
  type RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';

const INPUT_CLASS = 'w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const TEXTAREA_CLASS = 'w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL_CLASS = 'block text-sm font-medium text-slate-700 mb-2';
const SECTION_CLASS = 'bg-white rounded-lg shadow p-6';

interface ContactTranslationBlock {
  address: string;
  working_hours: string;
  description: string;
}

interface ContactSettings {
  is_displaying: boolean;
  phone: string;
  email: string;
  website: string;
  facebook_url: string;
  instagram_url: string;
  twitter_url: string;
  youtube_url: string;
  map_coordinates: string;
  settings_json: Record<string, ContactTranslationBlock>;
}

const EMPTY_VR360: RestaurantVR360SectionSettings = {
  target_id: null,
  panorama_url: null,
  vr360_link: null,
  vr_title: null,
  title_translations: {},
};

const CafeContact: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['vi', 'en']);
  const [currentLocale, setCurrentLocale] = useState<string>('vi');
  const [hasChanges, setHasChanges] = useState(false);
  const [scenes, setScenes] = useState<RestaurantVR360Scene[]>([]);

  const [settings, setSettings] = useState<ContactSettings>({
    is_displaying: true,
    phone: '',
    email: '',
    website: '',
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    youtube_url: '',
    map_coordinates: '',
    settings_json: {
      vi: { address: '', working_hours: '', description: '' },
      en: { address: '', working_hours: '', description: '' },
    },
  });
  const [originalSettings, setOriginalSettings] = useState<ContactSettings>(settings);
  const [vr360Settings, setVr360Settings] = useState<RestaurantVR360SectionSettings>(EMPTY_VR360);
  const [originalVr360Settings, setOriginalVr360Settings] = useState<RestaurantVR360SectionSettings>(EMPTY_VR360);
  const [savingDisplayStatus, setSavingDisplayStatus] = useState(false);

  useEffect(() => {
    void loadLanguagesAndSettings();
  }, []);

  const buildTranslationState = (
    langCodes: string[],
    existingTranslations: Record<string, ContactTranslationBlock> = {},
  ) => {
    const nextTranslations: Record<string, ContactTranslationBlock> = {};
    langCodes.forEach((locale) => {
      nextTranslations[locale] = {
        address: existingTranslations[locale]?.address || '',
        working_hours: existingTranslations[locale]?.working_hours || '',
        description: existingTranslations[locale]?.description || '',
      };
    });
    return nextTranslations;
  };

  const loadLanguagesAndSettings = async () => {
    try {
      setLoading(true);
      const languages = await cafeLanguagesApi.getLanguages();
      const langCodes = languages.map((lang) => lang.locale);
      const resolvedLanguages = langCodes.length > 0 ? langCodes : ['vi', 'en'];
      setSupportedLanguages(resolvedLanguages);
      setCurrentLocale((prev) => (resolvedLanguages.includes(prev) ? prev : resolvedLanguages[0]));
      await loadSettings(resolvedLanguages);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async (langCodes: string[]) => {
    try {
      const [contactData, vr360Data] = await Promise.all([
        cafeContactApi.getContact(),
        restaurantVr360Api.getSettings(),
      ]);

      const loadedSettings: ContactSettings = {
        is_displaying: contactData.is_displaying ?? true,
        phone: contactData.phone || '',
        email: contactData.email || '',
        website: contactData.website || '',
        facebook_url: contactData.facebook_url || '',
        instagram_url: contactData.instagram_url || '',
        twitter_url: contactData.twitter_url || '',
        youtube_url: contactData.youtube_url || '',
        map_coordinates: contactData.map_coordinates || '',
        settings_json: buildTranslationState(
          langCodes,
          contactData.address_translations || {},
        ),
      };

      const nextVr360 = vr360Data.sections.contact || {
        ...EMPTY_VR360,
        vr360_link: contactData.vr360_link || null,
        vr_title: contactData.vr_title || null,
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setVr360Settings(nextVr360);
      setOriginalVr360Settings(nextVr360);
      setScenes(vr360Data.scenes || []);
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load contact settings');
    }
  };

  const handleInputChange = useCallback((field: keyof Omit<ContactSettings, 'settings_json'>, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleDisplayToggle = async (newValue: boolean) => {
    try {
      setSavingDisplayStatus(true);
      await cafeContactApi.updateContact({ is_displaying: newValue });
      setSettings((prev) => ({ ...prev, is_displaying: newValue }));
      setOriginalSettings((prev) => ({ ...prev, is_displaying: newValue }));
      toast.success(newValue ? 'Contact section enabled' : 'Contact section disabled');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update display status');
      setSettings((prev) => ({ ...prev, is_displaying: !newValue }));
    } finally {
      setSavingDisplayStatus(false);
    }
  };

  const handleLocaleChange = useCallback((locale: string, field: keyof ContactTranslationBlock, value: string) => {
    setSettings((prev) => ({
      ...prev,
      settings_json: {
        ...prev.settings_json,
        [locale]: {
          ...prev.settings_json[locale],
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  }, []);

  const handleVr360Change = useCallback((nextValue: RestaurantVR360SectionSettings) => {
    setVr360Settings(nextValue);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      await cafeContactApi.updateContact({
        is_displaying: settings.is_displaying,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        facebook_url: settings.facebook_url,
        instagram_url: settings.instagram_url,
        twitter_url: settings.twitter_url,
        youtube_url: settings.youtube_url,
        map_coordinates: settings.map_coordinates,
        address_translations: settings.settings_json,
      });

      await restaurantVr360Api.updateSectionSettings('contact', {
        target_id: vr360Settings.target_id || null,
        panorama_url: vr360Settings.panorama_url || null,
        vr360_link: vr360Settings.vr360_link || null,
        vr_title: vr360Settings.vr_title || null,
        title_translations: vr360Settings.title_translations || {},
      });

      setOriginalSettings(settings);
      setOriginalVr360Settings(vr360Settings);
      setHasChanges(false);
      toast.success('Contact settings saved successfully!');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = useCallback(() => {
    setSettings(originalSettings);
    setVr360Settings(originalVr360Settings);
    setHasChanges(false);
  }, [originalSettings, originalVr360Settings]);

  const currentLocaleData = useMemo(
    () => settings.settings_json[currentLocale] || { address: '', working_hours: '', description: '' },
    [settings.settings_json, currentLocale],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading contact settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={SECTION_CLASS}>
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Contact Section</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${settings.is_displaying ? 'text-green-600' : 'text-slate-500'}`}>
              {settings.is_displaying ? 'Displaying' : 'Hidden'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.is_displaying}
                onChange={(e) => void handleDisplayToggle(e.target.checked)}
                disabled={savingDisplayStatus}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <FontAwesomeIcon icon={faCircleInfo} className="text-blue-600 text-xl mt-0.5" />
          <span className="text-blue-800 text-sm">
            When display is turned off, the "Contact" section will not appear on the website. You can still edit and save contact information.
          </span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FontAwesomeIcon icon={faPhone} />
          Contact Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Phone</label>
            <input
              type="tel"
              placeholder="+84 123 456 789"
              className={INPUT_CLASS}
              value={settings.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Email</label>
            <input
              type="email"
              placeholder="hello@restaurant.com"
              className={INPUT_CLASS}
              value={settings.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>Website</label>
            <input
              type="url"
              placeholder="https://www.restaurant.com"
              className={INPUT_CLASS}
              value={settings.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>Map Coordinates</label>
            <input
              type="text"
              placeholder="e.g., 10.7769,106.7009"
              className={INPUT_CLASS}
              value={settings.map_coordinates}
              onChange={(e) => handleInputChange('map_coordinates', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FontAwesomeIcon icon={faShareNodes} />
          Social Media
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Facebook</label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              className={INPUT_CLASS}
              value={settings.facebook_url}
              onChange={(e) => handleInputChange('facebook_url', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Instagram</label>
            <input
              type="url"
              placeholder="https://instagram.com/..."
              className={INPUT_CLASS}
              value={settings.instagram_url}
              onChange={(e) => handleInputChange('instagram_url', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Twitter/X</label>
            <input
              type="url"
              placeholder="https://twitter.com/..."
              className={INPUT_CLASS}
              value={settings.twitter_url}
              onChange={(e) => handleInputChange('twitter_url', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>YouTube</label>
            <input
              type="url"
              placeholder="https://youtube.com/..."
              className={INPUT_CLASS}
              value={settings.youtube_url}
              onChange={(e) => handleInputChange('youtube_url', e.target.value)}
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
          sectionLabel="Contact"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLocale}
          onChange={handleVr360Change}
          disabled={saving}
        />
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-xl font-bold text-slate-800 mb-6">Location Details</h2>

        <div className="border-b border-slate-200 mb-6 flex gap-2 flex-wrap">
          {supportedLanguages.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setCurrentLocale(locale)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                currentLocale === locale
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Address</label>
            <textarea
              placeholder="Enter address in this language..."
              rows={3}
              className={TEXTAREA_CLASS}
              value={currentLocaleData.address}
              onChange={(e) => handleLocaleChange(currentLocale, 'address', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Working Hours</label>
            <textarea
              placeholder="Mon-Fri: 9AM - 6PM"
              rows={3}
              className={TEXTAREA_CLASS}
              value={currentLocaleData.working_hours}
              onChange={(e) => handleLocaleChange(currentLocale, 'working_hours', e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              placeholder="Enter location description in this language..."
              rows={4}
              className={TEXTAREA_CLASS}
              value={currentLocaleData.description}
              onChange={(e) => handleLocaleChange(currentLocale, 'description', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 flex justify-end gap-3">
        <button
          onClick={handleCancel}
          disabled={!hasChanges || saving}
          className="px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowRotateLeft} />
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={!hasChanges || saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faFloppyDisk} className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default CafeContact;
