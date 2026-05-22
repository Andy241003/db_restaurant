import { faCircleCheck, faCircleInfo, faEye, faGripVertical, faImages, faPenToSquare, faPlay, faPlus, faTrash, faVrCardboard, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import MediaPickerModal from '../../components/MediaPickerModal';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import { useDebouncedVr360Autosave } from '../../hooks/useDebouncedVr360Autosave';
import type { RestaurantVR360Scene, RestaurantVR360SectionSettings, Space, SpaceTranslation } from '../../services/restaurantApi';
import { cafeLanguagesApi, cafeSettingsApi, cafeSpacesApi, restaurantVr360Api } from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const LABEL_CLASS = 'block text-sm font-medium text-slate-700 mb-2';
const FIELD_CLASS = 'w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'bg-white rounded-lg shadow p-6';

interface SpaceFormData {
  id?: number;
  code: string;
  primary_image_media_id?: number;
  capacity?: number;
  area_size?: string;
  is_active: boolean;
  display_order: number;
  amenities_text: string;
  media_ids: number[];
  translations: Record<string, { name: string; description: string }>;
}

const RestaurantSpace: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [editingSpace, setEditingSpace] = useState<SpaceFormData | null>(null);
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
      restaurantVr360Api.updateSectionSettings('spaces', {
        target_id: settings.target_id || null,
        panorama_url: settings.panorama_url || null,
        vr360_link: settings.vr360_link || null,
        vr_title: settings.vr_title || null,
        title_translations: settings.title_translations || {},
      }),
    onErrorMessage: 'Failed to save VR settings',
    getErrorMessage: (error: any) => error?.response?.data?.detail,
  });
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [draggingSpaceId, setDraggingSpaceId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [amenityInput, setAmenityInput] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    void loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [languages, settings, spaceData, vr360Data] = await Promise.all([
        cafeLanguagesApi.getLanguages(),
        cafeSettingsApi.getSettings(),
        cafeSpacesApi.getSpaces(),
        restaurantVr360Api.getSettings(),
      ]);
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;
      const langCodes = languages.map((item) => item.locale);
      if (langCodes.length > 0) {
        setSupportedLanguages(langCodes);
        setCurrentLocale(langCodes[0]);
      }
      setIsDisplaying(settingsJson.spaces_is_displaying ?? true);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.spaces || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.spaces_vr360_link === 'string' ? settingsJson.spaces_vr360_link : null,
        vr_title: typeof settingsJson.spaces_vr_title === 'string' ? settingsJson.spaces_vr_title : null,
        title_translations: {},
      });
      setSpaces(spaceData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaces = async () => {
    try {
      const data = await cafeSpacesApi.getSpaces();
      setSpaces(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load spaces');
    }
  };

  const makeTranslations = useCallback((space?: Space) => {
    const result: Record<string, { name: string; description: string }> = {};
    supportedLanguages.forEach((locale) => {
      const trans = space?.translations?.find((item) => item.locale === locale);
      result[locale] = {
        name: trans?.name || '',
        description: trans?.description || '',
      };
    });
    return result;
  }, [supportedLanguages]);

  const handleAddNew = () => {
    setAmenityInput('');
    setEditingSpace({
      code: `space_${Date.now()}`,
      primary_image_media_id: undefined,
      capacity: undefined,
      area_size: '',
      is_active: true,
      display_order: spaces.length,
      amenities_text: '',
      media_ids: [],
      translations: makeTranslations(),
    });
  };

  const handleEdit = (space: Space) => {
    const mediaIds = space.media?.map((item) => item.media_id) || [];
    const amenities = Array.isArray(space.amenities_json)
      ? space.amenities_json.map(String).join(', ')
      : '';
    setAmenityInput('');
    setEditingSpace({
      id: space.id,
      code: space.code,
      primary_image_media_id: space.primary_image_media_id || mediaIds[0],
      capacity: space.capacity,
      area_size: space.area_size,
      is_active: space.is_active,
      display_order: space.display_order,
      amenities_text: amenities,
      media_ids: mediaIds,
      translations: makeTranslations(space),
    });
  };
  const handleFieldChange = useCallback((field: keyof SpaceFormData, value: SpaceFormData[keyof SpaceFormData]) => {
    setEditingSpace((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleTranslationChange = useCallback((locale: string, field: 'name' | 'description', value: string) => {
    setEditingSpace((prev) => prev ? {
      ...prev,
      translations: {
        ...prev.translations,
        [locale]: {
          ...prev.translations[locale],
          [field]: value,
        },
      },
    } : null);
  }, []);

  const handleMediaSelected = useCallback((mediaId: number) => {
    setEditingSpace((prev) => {
      if (!prev) return prev;
      const mediaIds = prev.media_ids.includes(mediaId) ? prev.media_ids : [...prev.media_ids, mediaId];
      return {
        ...prev,
        media_ids: mediaIds,
        primary_image_media_id: prev.primary_image_media_id ?? mediaId,
      };
    });
    setMediaPickerVisible(false);
  }, []);

  const handleMediaSelectedMultiple = useCallback((mediaIds: number[]) => {
    setEditingSpace((prev) => prev ? {
      ...prev,
      media_ids: mediaIds,
      primary_image_media_id: mediaIds.includes(prev.primary_image_media_id || -1) ? prev.primary_image_media_id : mediaIds[0],
    } : null);
    setMediaPickerVisible(false);
  }, []);

  const handleRemoveMedia = useCallback((mediaId: number) => {
    setEditingSpace((prev) => {
      if (!prev) return prev;
      const mediaIds = prev.media_ids.filter((id) => id !== mediaId);
      return {
        ...prev,
        media_ids: mediaIds,
        primary_image_media_id: prev.primary_image_media_id === mediaId ? mediaIds[0] : prev.primary_image_media_id,
      };
    });
  }, []);

  const getEditingAmenities = useCallback(() => {
    if (!editingSpace?.amenities_text) return [] as string[];
    return editingSpace.amenities_text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [editingSpace?.amenities_text]);

  const updateAmenities = useCallback((amenities: string[]) => {
    handleFieldChange('amenities_text', amenities.join(', '));
  }, [handleFieldChange]);

  const handleAddAmenities = useCallback(() => {
    const nextAmenities = amenityInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (nextAmenities.length === 0) {
      return;
    }

    const mergedAmenities = [...getEditingAmenities()];
    nextAmenities.forEach((amenity) => {
      if (!mergedAmenities.some((existing) => existing.toLowerCase() === amenity.toLowerCase())) {
        mergedAmenities.push(amenity);
      }
    });

    updateAmenities(mergedAmenities);
    setAmenityInput('');
  }, [amenityInput, getEditingAmenities, updateAmenities]);

  const handleRemoveAmenity = useCallback((amenityToRemove: string) => {
    updateAmenities(
      getEditingAmenities().filter((amenity) => amenity !== amenityToRemove)
    );
  }, [getEditingAmenities, updateAmenities]);

  const handleSave = async () => {
    if (!editingSpace) return;

    const translations: SpaceTranslation[] = supportedLanguages
      .map((locale) => ({
        locale,
        name: editingSpace.translations[locale]?.name?.trim() || '',
        description: editingSpace.translations[locale]?.description?.trim() || '',
      }))
      .filter((item) => item.name || item.description);

    if (translations.length === 0) {
      toast.error('Please add at least one translation');
      return;
    }

    const payload = {
      code: editingSpace.code.trim(),
      primary_image_media_id: editingSpace.primary_image_media_id,
      capacity: editingSpace.capacity,
      area_size: editingSpace.area_size?.trim() || undefined,
      is_active: editingSpace.is_active,
      display_order: editingSpace.display_order,
      amenities_json: editingSpace.amenities_text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      media_ids: editingSpace.media_ids,
      translations,
    };

    try {
      setSaving(true);
      if (editingSpace.id) {
        await cafeSpacesApi.updateSpace(editingSpace.id, payload);
        toast.success('Space updated successfully');
      } else {
        await cafeSpacesApi.createSpace(payload);
        toast.success('Space created successfully');
      }
      setEditingSpace(null);
      await loadSpaces();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save space');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this space?')) return;
    try {
      await cafeSpacesApi.deleteSpace(id);
      toast.success('Space deleted successfully');
      await loadSpaces();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete space');
    }
  };

  const persistSpaceOrder = useCallback(async (orderedSpaces: Space[]) => {
    await cafeSpacesApi.reorderSpaces(orderedSpaces.map((space) => space.id));
  }, []);

  const handleDragStart = useCallback((spaceId: number) => {
    setDraggingSpaceId(spaceId);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback(async (targetSpaceId: number) => {
    if (draggingSpaceId === null || draggingSpaceId === targetSpaceId || reordering) {
      setDraggingSpaceId(null);
      return;
    }

    const sourceIndex = spaces.findIndex((space) => space.id === draggingSpaceId);
    const targetIndex = spaces.findIndex((space) => space.id === targetSpaceId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggingSpaceId(null);
      return;
    }

    const reorderedSpaces = [...spaces];
    const [movedSpace] = reorderedSpaces.splice(sourceIndex, 1);
    reorderedSpaces.splice(targetIndex, 0, movedSpace);

    setSpaces(reorderedSpaces);
    setDraggingSpaceId(null);

    try {
      setReordering(true);
      await persistSpaceOrder(reorderedSpaces);
      toast.success('Space order updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder spaces');
      await loadSpaces();
    } finally {
      setReordering(false);
    }
  }, [draggingSpaceId, loadSpaces, persistSpaceOrder, reordering, spaces]);

  const handleDisplayToggle = async (value: boolean) => {
    try {
      setSavingDisplayStatus(true);
      const currentSettings = await cafeSettingsApi.getSettings();
      await cafeSettingsApi.updateSettings({
        settings_json: {
          ...(currentSettings.settings_json || {}),
          spaces_is_displaying: value,
        },
      });
      setIsDisplaying(value);
      toast.success(value ? 'Spaces section enabled' : 'Spaces section disabled');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update display status');
    } finally {
      setSavingDisplayStatus(false);
    }
  };

  const convertToEmbedUrl = (url: string): string => {
    if (!url) return url;
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return url;
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
  const currentTranslation = useMemo(
    () => editingSpace?.translations[currentLocale] || { name: '', description: '' },
    [editingSpace, currentLocale]
  );

  const getShortLabel = useCallback((locale: string) => {
    switch (locale.toLowerCase()) {
      case 'vi': return 'VI';
      case 'en': return 'EN';
      case 'zh': return 'ZH';
      case 'zh-tw': return 'ZH-TW';
      case 'yue': return 'YUE';
      default: return locale.toUpperCase();
    }
  }, []);

  const getDisplayImage = useCallback((space: Space) => {
    const mediaId = space.primary_image_media_id || space.media?.[0]?.media_id;
    return mediaId ? `${getApiBaseUrl()}/media/${mediaId}/view` : null;
  }, []);

  const getAmenityTags = useCallback((space: Space) => {
    if (!Array.isArray(space.amenities_json)) return [] as string[];
    return space.amenities_json.map(String).filter(Boolean);
  }, []);

  const filteredSpaces = spaces.filter((space) => {
    if (spaceFilter === 'active') return space.is_active;
    if (spaceFilter === 'inactive') return !space.is_active;
    return true;
  });

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-600">Loading spaces...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Spaces Section</h2>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isDisplaying} onChange={(e) => handleDisplayToggle(e.target.checked)} disabled={savingDisplayStatus} />
            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:bg-white after:rounded-full after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full"></div>
          </label>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-blue-600" />
          <span>When disabled, the Spaces section will be hidden on the website.</span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <FontAwesomeIcon icon={faVrCardboard} className="text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>
        <VR360SettingsPanel
          sectionLabel="Spaces"
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
              <span>Enter the URL to a 360� panorama image (equirectangular JPG, min 4096x2048px) or YouTube video URL</span>
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
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => window.open(vr360Link, '_blank')}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-600 px-6 py-2 text-white transition-colors hover:bg-slate-700"
                >
                  <FontAwesomeIcon icon={faPlay} />
                  View Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!editingSpace && (
        <div className={SECTION_CLASS}>
          <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Space Management</h2>
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
              <FontAwesomeIcon icon={faPlus} />
              Add New Space
            </button>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Filter by Status:</label>
            <select
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Spaces</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredSpaces.map((space, index) => {
              const viName = space.translations?.find((item) => item.locale === 'vi')?.name;
              const enName = space.translations?.find((item) => item.locale === 'en')?.name;
              const description = space.translations?.find((item) => item.locale === 'vi')?.description || space.translations?.find((item) => item.locale === 'en')?.description || 'No description';
              const imageUrl = getDisplayImage(space);
              return (
                <div
                  key={space.id}
                  draggable={!reordering}
                  onDragStart={() => handleDragStart(space.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => void handleDrop(space.id)}
                  onDragEnd={() => setDraggingSpaceId(null)}
                  className={`rounded-lg border bg-white p-4 transition-all ${
                    draggingSpaceId === space.id ? 'border-blue-300 opacity-60 shadow-sm' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                  } ${reordering ? 'cursor-progress' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="cursor-grab rounded-md p-2 text-slate-400 hover:text-slate-600 active:cursor-grabbing">
                      <FontAwesomeIcon icon={faGripVertical} />
                    </div>
                    <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:w-52">
                      {imageUrl ? (
                        <img src={imageUrl} alt={viName || enName || 'Space'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400"><FontAwesomeIcon icon={faEye} /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-slate-800">{viName || enName || 'Untitled'}</h3>
                        {space.primary_image_media_id && <FontAwesomeIcon icon={faImages} className="text-blue-600" />}
                      </div>
                      <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                        <span className="font-medium text-blue-600">Order: {space.display_order ?? index}</span>
                        <span>{enName && enName !== viName ? enName : (space.area_size || 'No subtitle')}</span>
                        <span>Status: {space.is_active ? 'active' : 'inactive'}</span>
                      </div>
                      {description && <p className="mt-2 line-clamp-1 text-sm text-slate-500">{description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {getAmenityTags(space).slice(0, 4).map((tag) => <span key={`${space.id}-${tag}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{tag}</span>)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-3 self-start md:self-auto">
                      <button type="button" title="Edit space" onClick={() => handleEdit(space)} className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50">
                        <FontAwesomeIcon icon={faPenToSquare} />
                        Edit
                      </button>
                      <button type="button" title="Delete space" onClick={() => void handleDelete(space.id)} className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700">
                        <FontAwesomeIcon icon={faTrash} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {editingSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-6">
              <h3 className="text-xl font-bold text-slate-800">{editingSpace.id ? 'Edit Space' : 'Add New Space'}</h3>
              <button type="button" onClick={() => setEditingSpace(null)} className="flex h-10 w-10 items-center justify-center rounded-md text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <FontAwesomeIcon icon={faXmark} />
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
                      {getShortLabel(locale)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLASS}>Space Name *</label>
                  <input className={FIELD_CLASS} value={currentTranslation.name} onChange={(e) => handleTranslationChange(currentLocale, 'name', e.target.value)} placeholder="Enter space name..." />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea rows={4} className={FIELD_CLASS} value={currentTranslation.description} onChange={(e) => handleTranslationChange(currentLocale, 'description', e.target.value)} placeholder="Enter a short description..." />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div><label className={LABEL_CLASS}>Code</label><input className={FIELD_CLASS} value={editingSpace.code} onChange={(e) => handleFieldChange('code', e.target.value)} /></div>
                <div><label className={LABEL_CLASS}>Capacity (people)</label><input type="number" className={FIELD_CLASS} value={editingSpace.capacity || ''} onChange={(e) => handleFieldChange('capacity', parseInt(e.target.value, 10) || undefined)} /></div>
                <div><label className={LABEL_CLASS}>Area Size</label><input className={FIELD_CLASS} value={editingSpace.area_size || ''} onChange={(e) => handleFieldChange('area_size', e.target.value)} placeholder="e.g., 100 m2" /></div>
                <div><label className={LABEL_CLASS}>Display Order</label><input type="number" className={FIELD_CLASS} value={editingSpace.display_order} onChange={(e) => handleFieldChange('display_order', parseInt(e.target.value, 10) || 0)} /></div>
              </div>

              <div className="mt-4">
                <label className={LABEL_CLASS}>Amenities ({currentLocale})</label>
                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      value={amenityInput}
                      onChange={(e) => setAmenityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAmenities();
                        }
                      }}
                      placeholder="Enter amenity name(s)..."
                    />
                    <button
                      type="button"
                      onClick={handleAddAmenities}
                      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Add
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Tip: Separate multiple amenities with commas (e.g., "WiFi, Air Conditioner, Bathtub, Hair dryer")
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getEditingAmenities().map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                      <FontAwesomeIcon icon={faCircleCheck} className="text-blue-600" />
                      <span className="text-slate-700">{amenity}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAmenity(amenity)}
                        className="ml-1 text-red-600 hover:text-red-800"
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4"><label className={LABEL_CLASS}>Status</label><select className={FIELD_CLASS} value={editingSpace.is_active ? 'active' : 'inactive'} onChange={(e) => handleFieldChange('is_active', e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>

              <div className="mt-6">
                <label className={`${LABEL_CLASS} flex items-center gap-2`}><FontAwesomeIcon icon={faImages} />Space Images</label>
                <button type="button" onClick={() => setMediaPickerVisible(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"><FontAwesomeIcon icon={faImages} />Select Images</button>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {editingSpace.media_ids.map((mediaId) => (
                    <div key={mediaId} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      <img src={`${getApiBaseUrl()}/media/${mediaId}/view`} alt={`Space media ${mediaId}`} className="h-24 w-full object-cover" />
                      {editingSpace.primary_image_media_id === mediaId && <div className="absolute left-2 top-2 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white">Primary</div>}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {editingSpace.primary_image_media_id !== mediaId && <button type="button" onClick={() => handleFieldChange('primary_image_media_id', mediaId)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Set Primary</button>}
                        <button type="button" onClick={() => handleRemoveMedia(mediaId)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-4 border-t border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setEditingSpace(null)} disabled={saving} className="rounded-md border border-slate-600 px-6 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={() => void handleSave()} disabled={saving} className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal isOpen={mediaPickerVisible} onClose={() => setMediaPickerVisible(false)} onSelect={handleMediaSelected} onSelectMultiple={handleMediaSelectedMultiple} title="Select Space Images" kind="image" source="restaurant" folder="spaces" allowMultiple />
    </div>
  );
};

export default RestaurantSpace;





