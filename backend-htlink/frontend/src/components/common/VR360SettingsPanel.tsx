import {
  faCircleInfo,
  faEye,
  faImage,
  faPlay,
  faVrCardboard,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import type {
  RestaurantVR360Scene,
  RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';

const INPUT_CLASS =
  'w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed';

interface VR360SettingsPanelProps {
  sectionLabel: string;
  value: RestaurantVR360SectionSettings;
  scenes: RestaurantVR360Scene[];
  currentLocale: string;
  locales?: string[];
  onChange: (nextValue: RestaurantVR360SectionSettings) => void;
  onLocaleChange?: (locale: string) => void;
  disabled?: boolean;
}

const buildSceneLabel = (scene: RestaurantVR360Scene) => {
  return scene.scene_name
    ? `${scene.target_id} - ${scene.scene_name}`
    : scene.target_id;
};

const getPreviewUrl = (value: RestaurantVR360SectionSettings) => {
  return value.panorama_url || value.vr360_link || '';
};

const VR360SettingsPanel = ({
  sectionLabel,
  value,
  scenes,
  currentLocale,
  locales = [currentLocale],
  onChange,
  onLocaleChange,
  disabled = false,
}: VR360SettingsPanelProps) => {
  const handleTargetChange = (nextTargetId: string) => {
    if (nextTargetId === '__vr360_null__') {
      onChange({
        ...value,
        target_id: null,
        panorama_url: null,
      });
      return;
    }

    const selectedScene = scenes.find((scene) => scene.target_id === nextTargetId);
    onChange({
      ...value,
      target_id: nextTargetId,
      panorama_url: selectedScene?.panorama_url || null,
    });
  };

  const handleFieldChange = (
    field: keyof RestaurantVR360SectionSettings,
    nextFieldValue: string,
  ) => {
    onChange({
      ...value,
      [field]: nextFieldValue || null,
    });
  };

  const handleTitleTranslationChange = (locale: string, nextTitle: string) => {
    onChange({
      ...value,
      vr_title: locale === 'vi' ? nextTitle || null : value.vr_title || null,
      title_translations: {
        ...(value.title_translations || {}),
        [locale]: nextTitle,
      },
    });
  };

  const previewUrl = getPreviewUrl(value);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Target ID</label>
        <select
          className={INPUT_CLASS}
          value={value.target_id || '__vr360_null__'}
          onChange={(event) => handleTargetChange(event.target.value)}
          disabled={disabled}
        >
          <option value="__vr360_null__">Null</option>
          {scenes.map((scene) => (
            <option key={scene.target_id} value={scene.target_id}>
              {buildSceneLabel(scene)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-slate-500 flex items-start gap-2">
          <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
          <span>Select a synced scene to auto-fill `panorama_url`, or choose Null to keep fallback on `vr360_link`.</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Panorama URL</label>
        <input
          type="url"
          className={INPUT_CLASS}
          value={value.panorama_url || ''}
          onChange={(event) => handleFieldChange('panorama_url', event.target.value)}
          disabled={disabled}
          placeholder="https://example.com/panorama.jpg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">VR URL</label>
        <input
          type="url"
          placeholder="https://youtube.com/watch?v=... or https://example.com/vr"
          className={INPUT_CLASS}
          value={value.vr360_link || ''}
          onChange={(event) => handleFieldChange('vr360_link', event.target.value)}
          disabled={disabled}
        />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => onLocaleChange?.(locale)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                locale === currentLocale
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              disabled={disabled}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Title ({currentLocale.toUpperCase()})
        </label>
        <input
          type="text"
          placeholder="Enter title"
          className={INPUT_CLASS}
          value={value.title_translations?.[currentLocale] || ''}
          onChange={(event) => handleTitleTranslationChange(currentLocale, event.target.value)}
          disabled={disabled}
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <FontAwesomeIcon icon={faEye} className="text-slate-600" />
          <h3 className="text-sm font-medium text-slate-700">{sectionLabel} VR360 Preview</h3>
        </div>

        <div className="border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-50">
          {value.panorama_url ? (
            <div className="relative w-full bg-slate-900 flex items-center justify-center" style={{ height: '500px' }}>
              <img
                src={value.panorama_url}
                alt={`${sectionLabel} panorama preview`}
                className="h-full w-full object-contain"
              />
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow">
                <FontAwesomeIcon icon={faImage} className="mr-2" />
                Preview from panorama_url
              </div>
            </div>
          ) : value.vr360_link ? (
            <div className="relative w-full" style={{ height: '500px' }}>
              <iframe
                src={value.vr360_link}
                className="absolute top-0 left-0 w-full h-full"
                allowFullScreen
                title={`${sectionLabel} VR360 Preview`}
                allow="xr-spatial-tracking; gyroscope; accelerometer"
              />
            </div>
          ) : (
            <div className="p-8 text-center">
              <FontAwesomeIcon icon={faVrCardboard} className="text-slate-400 text-5xl mb-3" />
              <p className="text-slate-600 font-medium mb-1">VR360 Preview</p>
              <p className="text-slate-500 text-sm">
                Choose a target scene or enter a fallback VR link to preview
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={!previewUrl}
            onClick={() => window.open(previewUrl, '_blank')}
            className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            <FontAwesomeIcon icon={faPlay} />
            View Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
};

export default VR360SettingsPanel;
