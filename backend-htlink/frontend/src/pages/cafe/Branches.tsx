import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    faCircleCheck,
    faCircleInfo,
    faEdit,
    faEye,
    faFlag,
    faGripVertical,
    faImage,
    faInfoCircle,
    faMapMarkerAlt,
    faPlay,
    faPlus,
    faSave,
    faTimes,
    faTrash,
    faVrCardboard
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import MediaPickerModal from '../../components/MediaPickerModal';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import { useDebouncedVr360Autosave } from '../../hooks/useDebouncedVr360Autosave';
import { cafeBranchesApi, cafeLanguagesApi, cafeSettingsApi, restaurantVr360Api, type Branch, type BranchTranslation, type RestaurantVR360Scene, type RestaurantVR360SectionSettings } from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';


const buildBranchTranslationsPayload = (localizedData: Record<string, BranchLocalizedFields>): BranchTranslation[] => {
  const translations: BranchTranslation[] = [];

  Object.entries(localizedData).forEach(([locale, data]) => {
    const name = data?.name?.trim() || '';
    if (name) {
      translations.push({
        locale,
        name,
        address: data?.address?.trim() || undefined,
        description: data?.description?.trim() || undefined,
        amenities_text: data?.amenities_text?.trim() || undefined,
      });
    }
  });

  return translations;
};

const getBranchTranslation = (branch: Branch, locale: string) =>
  branch.translations?.find((translation) => translation.locale === locale);

const getBranchName = (branch: Branch) =>
  getBranchTranslation(branch, 'vi')?.name ||
  getBranchTranslation(branch, 'en')?.name ||
  branch.name_vi ||
  branch.name_en ||
  branch.code ||
  'Untitled Branch';

const getBranchAddress = (branch: Branch) =>
  getBranchTranslation(branch, 'vi')?.address ||
  getBranchTranslation(branch, 'en')?.address ||
  branch.address_vi ||
  branch.address_en ||
  '';

const getBranchOpeningHours = (branch: Branch) => {
  const attrs = branch.attributes_json as Record<string, unknown> | undefined;
  const fromAttributes =
    (typeof attrs?.opening_hours_vi === 'string' && attrs.opening_hours_vi) ||
    (typeof attrs?.opening_hours === 'string' && attrs.opening_hours) ||
    (typeof attrs?.hours === 'string' && attrs.hours);

  return fromAttributes || branch.opening_hours || branch.opening_hours_vi || branch.opening_hours_en || '';
};

const getBranchTags = (branch: Branch): string[] => {
  const translationAmenities =
    getBranchTranslation(branch, 'vi')?.amenities_text ||
    getBranchTranslation(branch, 'en')?.amenities_text ||
    branch.translations?.find((translation) => translation.amenities_text)?.amenities_text;

  if (translationAmenities) {
    return translationAmenities
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const attrs = branch.attributes_json as Record<string, unknown> | undefined;
  const tagSources = [attrs?.tags, attrs?.amenities, attrs?.features];

  for (const source of tagSources) {
    if (Array.isArray(source)) {
      return source.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
    }
  }

  return [];
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

type BranchLocalizedFields = {
  name: string;
  address: string;
  description: string;
  opening_hours: string;
  amenities_text: string;
};

const buildEmptyLocalizedBranchData = (locales: string[]) =>
  locales.reduce<Record<string, BranchLocalizedFields>>((acc, locale) => {
    acc[locale] = { name: '', address: '', description: '', opening_hours: '', amenities_text: '' };
    return acc;
  }, {});

// Sortable Branch Item Component
interface SortableBranchItemProps {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (id: number) => void;
  imageUrls: Map<number, string>;
}

const SortableBranchItem: React.FC<SortableBranchItemProps> = ({ branch, onEdit, onDelete, imageUrls }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: branch.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const imageId = branch.primary_image_media_id ?? branch.image_media_id;
  const imageUrl = imageId ? imageUrls.get(imageId) : null;
  const branchName = getBranchName(branch);
  const branchAddress = getBranchAddress(branch);
  const openingHours = getBranchOpeningHours(branch);
  const tags = getBranchTags(branch);
  const subtitle = branch.phone || branch.email || branch.code || 'No contact info';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-md p-2 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        >
          <FontAwesomeIcon icon={faGripVertical} />
        </div>

        <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:w-52">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={branchName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
              <FontAwesomeIcon icon={faImage} className="text-xl" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-800">{branchName}</h3>
            {!branch.is_active && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                Inactive
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            {branchAddress && <span className="truncate">{branchAddress}</span>}
            <span>{subtitle}</span>
            {openingHours && <span>Hours: {openingHours}</span>}
            <span>Status: {branch.is_active ? 'active' : 'inactive'}</span>
          </div>

          {branchAddress && (
            <p className="mt-2 line-clamp-1 text-sm text-slate-500">{branchAddress}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onEdit(branch)}
            className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
            title="Edit Branch"
          >
            <FontAwesomeIcon icon={faEdit} />
            Edit
          </button>
          <button
            onClick={() => onDelete(branch.id)}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            title="Delete Branch"
          >
            <FontAwesomeIcon icon={faTrash} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const RestaurantBranches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentLang, setCurrentLang] = useState('vi');
  const [imageUrls, setImageUrls] = useState<Map<number, string>>(new Map());
  
  // Media picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');

  // Translation state
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['vi', 'en']);
  const [localizedBranchData, setLocalizedBranchData] = useState<Record<string, BranchLocalizedFields>>(
    () => buildEmptyLocalizedBranchData(['vi', 'en'])
  );
  // Display status state
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
      restaurantVr360Api.updateSectionSettings('branches', {
        target_id: settings.target_id || null,
        panorama_url: settings.panorama_url || null,
        vr360_link: settings.vr360_link || null,
        vr_title: settings.vr_title || null,
        title_translations: settings.title_translations || {},
      }),
    onErrorMessage: 'Failed to save VR360 settings',
    getErrorMessage: (error: any) => error?.response?.data?.detail,
  });
  const [amenityInput, setAmenityInput] = useState('');
  const [formData, setFormData] = useState<{
    code: string;
    name_vi: string;
    name_en: string;
    address_vi: string;
    address_en: string;
    phone: string;
    email: string;
    opening_hours_vi: string;
    opening_hours_en: string;
    map_latitude?: number;
    map_longitude?: number;
    google_map_url: string;
    image_media_id?: number;
    is_active: boolean;
  }>({
    code: '',
    name_vi: '',
    name_en: '',
    address_vi: '',
    address_en: '',
    phone: '',
    email: '',
    opening_hours_vi: '',
    opening_hours_en: '',
    google_map_url: '',
    is_active: true,
  });

  useEffect(() => {
    loadBranches();
    loadLanguageSettings();
  }, []);

  useEffect(() => {
    const handleLanguagesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ supportedLanguages?: string[] }>;
      const nextLanguages = customEvent.detail?.supportedLanguages;
      if (nextLanguages && nextLanguages.length > 0) {
        setSupportedLanguages(nextLanguages);
        setLocalizedBranchData((prev) => {
          const next = buildEmptyLocalizedBranchData(nextLanguages);
          nextLanguages.forEach((locale) => {
            if (prev[locale]) {
              next[locale] = {
                ...next[locale],
                ...prev[locale],
              };
            }
          });
          return next;
        });
      }
    };

    window.addEventListener('restaurant-languages-updated', handleLanguagesUpdated as EventListener);
    return () => window.removeEventListener('restaurant-languages-updated', handleLanguagesUpdated as EventListener);
  }, []);

  const loadLanguageSettings = async () => {
    try {
      const langs = await cafeLanguagesApi.getLanguageCodes();
      setSupportedLanguages(langs);
      setLocalizedBranchData((prev) => {
        const next = buildEmptyLocalizedBranchData(langs);
        langs.forEach((locale) => {
          if (prev[locale]) {
            next[locale] = {
              ...next[locale],
              ...prev[locale],
            };
          }
        });
        return next;
      });
      
      // Load display status
      const [settings, vr360Data] = await Promise.all([
        cafeSettingsApi.getSettings(),
        restaurantVr360Api.getSettings(),
      ]);
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;
      const displayStatus = settingsJson.branches_is_displaying ?? true;
      setIsDisplaying(displayStatus);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.branches || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.branches_vr360_link === 'string' ? settingsJson.branches_vr360_link : null,
        vr_title: typeof settingsJson.branches_vr_title === 'string' ? settingsJson.branches_vr_title : null,
        title_translations: {},
      });
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      const data = await cafeBranchesApi.getBranches();
      setBranches(data);
      
      // Load images for branches that have them
      const urlMap = new Map<number, string>();
      data.forEach(branch => {
        const imageId = branch.primary_image_media_id ?? branch.image_media_id;
        if (imageId) {
          urlMap.set(imageId, `${getApiBaseUrl()}/media/${imageId}/view`);
        }
      });
      setImageUrls(urlMap);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setIsLoading(false);
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

  const handleAdd = () => {
    setEditingBranch(null);
    setSelectedImageId(null);
    setPreviewImageUrl('');
    setAmenityInput('');
    setLocalizedBranchData(buildEmptyLocalizedBranchData(supportedLanguages));
    setFormData({
      code: `branch_${Date.now()}`,
      name_vi: '',
      name_en: '',
      address_vi: '',
      address_en: '',
      phone: '',
      email: '',
      opening_hours_vi: '',
      opening_hours_en: '',
      google_map_url: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (branch: Branch) => {
    const viTranslation = getBranchTranslation(branch, 'vi');
    const enTranslation = getBranchTranslation(branch, 'en');
    const openingHoursByLocale =
      (branch.attributes_json as Record<string, unknown> | undefined)?.opening_hours_by_locale as
        | Record<string, string>
        | undefined;

    const nextLocalizedData = buildEmptyLocalizedBranchData(supportedLanguages);
    supportedLanguages.forEach((locale) => {
      const translation = getBranchTranslation(branch, locale);
      nextLocalizedData[locale] = {
        name: translation?.name || (locale === 'vi' ? branch.name_vi || '' : locale === 'en' ? branch.name_en || '' : ''),
        address: translation?.address || (locale === 'vi' ? branch.address_vi || '' : locale === 'en' ? branch.address_en || '' : ''),
        description: translation?.description || '',
        opening_hours:
          openingHoursByLocale?.[locale] ||
          (locale === 'vi' ? branch.opening_hours_vi || '' : locale === 'en' ? branch.opening_hours_en || '' : ''),
        amenities_text: translation?.amenities_text || '',
      };
    });
    setLocalizedBranchData(nextLocalizedData);

    setEditingBranch(branch);
    setAmenityInput('');
    setFormData({
      code: branch.code || '',
      name_vi: viTranslation?.name || branch.name_vi || '',
      name_en: enTranslation?.name || branch.name_en || '',
      address_vi: viTranslation?.address || branch.address_vi || '',
      address_en: enTranslation?.address || branch.address_en || '',
      phone: branch.phone || '',
      email: branch.email || '',
      opening_hours_vi: branch.opening_hours_vi || '',
      opening_hours_en: branch.opening_hours_en || '',
      map_latitude: branch.map_latitude,
      map_longitude: branch.map_longitude,
      google_map_url: branch.google_maps_url || branch.google_map_url || '',
      image_media_id: branch.primary_image_media_id ?? branch.image_media_id,
      is_active: branch.is_active,
    });
    
    const imageId = branch.primary_image_media_id ?? branch.image_media_id;

    if (imageId) {
      setSelectedImageId(imageId);
      setPreviewImageUrl(`${getApiBaseUrl()}/media/${imageId}/view`);
    } else {
      setSelectedImageId(null);
      setPreviewImageUrl('');
    }
    
    setShowModal(true);
  };

  const handleAddAmenities = () => {
    const nextAmenities = amenityInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (nextAmenities.length === 0) {
      return;
    }

    setLocalizedBranchData((prev) => {
      const currentAmenities = (prev[currentLang]?.amenities_text || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const merged = [...currentAmenities];
      nextAmenities.forEach((amenity) => {
        if (!merged.some((existing) => existing.toLowerCase() === amenity.toLowerCase())) {
          merged.push(amenity);
        }
      });

      return {
        ...prev,
        [currentLang]: {
          ...(prev[currentLang] || { name: '', address: '', opening_hours: '', amenities_text: '' }),
          amenities_text: merged.join(', '),
        },
      };
    });
    setAmenityInput('');
  };

  const handleRemoveAmenity = (amenityToRemove: string) => {
    setLocalizedBranchData((prev) => {
      const nextAmenities = (prev[currentLang]?.amenities_text || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((amenity) => amenity !== amenityToRemove);

      return {
        ...prev,
        [currentLang]: {
          ...(prev[currentLang] || { name: '', address: '', opening_hours: '', amenities_text: '' }),
          amenities_text: nextAmenities.join(', '),
        },
      };
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    
    try {
      await cafeBranchesApi.deleteBranch(id);
      toast.success('Branch deleted successfully');
      await loadBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('Failed to delete branch');
    }
  };

  const currentLocalizedBranch = localizedBranchData[currentLang] || { name: '', address: '', description: '', opening_hours: '', amenities_text: '' };

  const handleLocalizedBranchChange = (locale: string, field: keyof BranchLocalizedFields, value: string) => {
    setLocalizedBranchData((prev) => ({
      ...prev,
      [locale]: {
        ...(prev[locale] || { name: '', address: '', description: '', opening_hours: '', amenities_text: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!(localizedBranchData.vi?.name || '').trim()) {
      toast.error('Please enter branch name (Vietnamese)');
      return;
    }

    if (!formData.code.trim()) {
      toast.error('Please enter branch code');
      return;
    }
    
    try {
      setIsSaving(true);

      const openingHoursByLocale = Object.entries(localizedBranchData).reduce<Record<string, string>>((acc, [locale, value]) => {
        const hours = value.opening_hours.trim();
        if (hours) {
          acc[locale] = hours;
        }
        return acc;
      }, {});
      const primaryLocale = supportedLanguages[0] || 'vi';
      const primaryOpeningHours = openingHoursByLocale.vi || openingHoursByLocale[primaryLocale] || undefined;
      const existingAttributes =
        editingBranch?.attributes_json && typeof editingBranch.attributes_json === 'object'
          ? (editingBranch.attributes_json as Record<string, unknown>)
          : {};
      const {
        opening_hours_by_locale: _ignoredOpeningHoursByLocale,
        opening_hours_vi: _ignoredOpeningHoursVi,
        ...remainingAttributes
      } = existingAttributes;
      const nextAttributes = {
        ...remainingAttributes,
        ...(Object.keys(openingHoursByLocale).length > 0
          ? {
              opening_hours_by_locale: openingHoursByLocale,
              ...(primaryOpeningHours ? { opening_hours_vi: primaryOpeningHours } : {}),
            }
          : {}),
      };
      const payload = {
        code: formData.code.trim(),
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        latitude: formData.map_latitude,
        longitude: formData.map_longitude,
        google_maps_url: formData.google_map_url || undefined,
        primary_image_media_id: selectedImageId || undefined,
        is_active: formData.is_active,
        display_order: editingBranch?.display_order ?? branches.length,
        attributes_json: Object.keys(nextAttributes).length > 0 ? nextAttributes : undefined,
        translations: buildBranchTranslationsPayload(localizedBranchData),
        media_ids: selectedImageId ? [selectedImageId] : [],
      };

      if (editingBranch) {
        await cafeBranchesApi.updateBranch(editingBranch.id, payload);
        toast.success('Branch updated successfully');
      } else {
        await cafeBranchesApi.createBranch(payload);
        toast.success('Branch created successfully');
      }

      setShowModal(false);
      await loadBranches();
    } catch (error: any) {
      console.error('Error saving branch:', error);
      toast.error(error?.message || error.response?.data?.detail || 'Failed to save branch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = branches.findIndex((b) => b.id === active.id);
    const newIndex = branches.findIndex((b) => b.id === over.id);
    
    // Optimistic UI update
    const newBranches = [...branches];
    const [movedBranch] = newBranches.splice(oldIndex, 1);
    newBranches.splice(newIndex, 0, movedBranch);
    
    // Update display_order
    const updatedBranches = newBranches.map((branch, index) => ({
      ...branch,
      display_order: index + 1,
    }));
    
    setBranches(updatedBranches);
    
    // Update on server
    try {
      await Promise.all(
        updatedBranches.map((branch, index) =>
          cafeBranchesApi.reorderBranch(branch.id, index + 1)
        )
      );
      toast.success('Branch order updated');
    } catch (error) {
      console.error('Error reordering branches:', error);
      toast.error('Failed to update order');
      loadBranches(); // Reload on error
    }
  };

  const handleMediaSelect = async (mediaId: number, mediaUrl: string) => {
    setSelectedImageId(mediaId);
    setPreviewImageUrl(`${getApiBaseUrl()}/media/${mediaId}/view`);
    setMediaPickerOpen(false);
  };

  const handleRemoveImage = () => {
    setSelectedImageId(null);
    setPreviewImageUrl('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FontAwesomeIcon icon={faFlag} className="text-4xl text-blue-600 animate-pulse mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Display Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Branches Section</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDisplaying ? 'text-green-600' : 'text-slate-500'}`}>
              {isDisplaying ? 'Displaying' : 'Hidden'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isDisplaying}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  try {
                    setSavingDisplayStatus(true);
                    const currentSettings = await cafeSettingsApi.getSettings();
                    await cafeSettingsApi.updateSettings({
                      settings_json: {
                        ...currentSettings.settings_json,
                        branches_is_displaying: newValue
                      }
                    });
                    setIsDisplaying(newValue);
                    toast.success(newValue ? 'Branches section enabled' : 'Branches section disabled');
                  } catch (error: any) {
                    toast.error(error.response?.data?.detail || 'Failed to update display status');
                  } finally {
                    setSavingDisplayStatus(false);
                  }
                }}
                disabled={savingDisplayStatus}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
            </label>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-600 text-xl mt-0.5" />
          <span className="text-blue-800 text-sm">
            When display is turned off, the "Branches" section will not appear on the website. You can still edit and manage branch locations.
          </span>
        </div>
      </div>

      {/* VR360 Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center gap-3">
          <FontAwesomeIcon icon={faVrCardboard} className="text-purple-600 text-xl" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>
        
        <VR360SettingsPanel
          sectionLabel="Branches"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentLang}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLang}
          onChange={(nextValue) => void handleVR360Change(nextValue)}
          disabled={savingVR}
        />
        <div className="hidden space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Link VR360 Panorama / YouTube Video
            </label>
            <input
              type="url"
              placeholder="https://example.com/panorama.jpg or https://youtube.com/watch?v=..."
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={vr360Link}
              onChange={(e) => handleVR360Change('link', e.target.value)}
              disabled={savingVR}
            />
            <p className="mt-2 text-sm text-slate-500 flex items-start gap-2">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
              <span>
                Enter the URL to a 360� panorama image (equirectangular JPG, min 4096x2048px) or YouTube video URL
              </span>
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">VR Tour Title</label>
            <input
              type="text"
              placeholder="Enter VR tour title"
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={vrTitle}
              onChange={(e) => handleVR360Change('title', e.target.value)}
              disabled={savingVR}
            />
          </div>
          
          {vr360Link && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faEye} className="text-slate-600" />
                <h3 className="text-sm font-medium text-slate-700">VR360 Preview</h3>
              </div>
              
              <div className="border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                <div className="relative w-full" style={{ height: '500px' }}>
                  <iframe
                    src={vr360Link}
                    className="absolute top-0 left-0 w-full h-full"
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
                  className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlay} />
                  View Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Branch Management</h2>
            <p className="mt-1 text-sm text-slate-500">Manage your restaurant locations and details</p>
          </div>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            Add New Branch
          </button>
        </div>

        {branches.length > 0 ? (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={branches.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {branches.map((branch) => (
                  <SortableBranchItem
                  key={branch.id}
                  branch={branch}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  imageUrls={imageUrls}
                />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-5xl text-slate-400 mb-4" />
            <p className="text-lg text-slate-600">No branches found</p>
            <p className="text-sm text-slate-500 mt-2">Click "Add New Branch" to create your first branch</p>
          </div>
        )}
      </div>

      {/* Edit/Add Modal - VR Hotel Design */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Sticky Header */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
                type="button"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Content */}
              <div className="p-6">
                {/* Language Tabs */}
                <div className="mb-6 overflow-x-auto border-b border-slate-200">
                  <div className="flex w-max min-w-full gap-2 whitespace-nowrap pr-2">
                    {supportedLanguages.map((locale) => (
                      <button
                        key={locale}
                        type="button"
                        onClick={() => setCurrentLang(locale)}
                        className={`shrink-0 border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                          currentLang === locale
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        {getLocaleShortLabel(locale)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Translation Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Branch Name ({getLocaleShortLabel(currentLang)}) {currentLang === 'vi' && '*'}
                    </label>
                    <input
                      type="text"
                      value={currentLocalizedBranch.name}
                      onChange={(e) => handleLocalizedBranchChange(currentLang, 'name', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="e.g., DB Restaurant - Downtown"
                      required={currentLang === 'vi'}
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Address ({getLocaleShortLabel(currentLang)})
                    </label>
                    <textarea
                      value={currentLocalizedBranch.address}
                      onChange={(e) => handleLocalizedBranchChange(currentLang, 'address', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      rows={3}
                      placeholder="123 Nguyen Hue Street, District 1, Ho Chi Minh City"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description ({getLocaleShortLabel(currentLang)})
                    </label>
                    <textarea
                      value={currentLocalizedBranch.description}
                      onChange={(e) => handleLocalizedBranchChange(currentLang, 'description', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      rows={4}
                      placeholder="Describe this branch location, atmosphere, and unique features..."
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Opening Hours ({getLocaleShortLabel(currentLang)})
                    </label>
                    <input
                      type="text"
                      value={currentLocalizedBranch.opening_hours}
                      onChange={(e) => handleLocalizedBranchChange(currentLang, 'opening_hours', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Mon-Fri: 7:00-22:00, Sat-Sun: 8:00-23:00"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Amenities ({getLocaleShortLabel(currentLang)})
                    </label>
                    <div className="mb-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={amenityInput}
                          onChange={(e) => setAmenityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAmenities();
                            }
                          }}
                          className="flex-1 rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                          placeholder="Enter amenity name(s)..."
                          disabled={isSaving}
                        />
                        <button
                          type="button"
                          onClick={handleAddAmenities}
                          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                          disabled={isSaving}
                        >
                          <FontAwesomeIcon icon={faPlus} />
                          Add
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Tip: Separate multiple amenities with commas (e.g., "WiFi, Parking, Air Conditioner")
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentLocalizedBranch.amenities_text
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((amenity) => (
                        <div key={amenity} className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                          <FontAwesomeIcon icon={faCircleCheck} className="text-blue-600" />
                          <span className="text-slate-700">{amenity}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAmenity(amenity)}
                            className="ml-1 text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-red-300"
                            disabled={isSaving}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Settings Section */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Branch Code *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="e.g., branch_q1"
                      disabled={isSaving}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                    <select
                      value={formData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                      className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      disabled={isSaving}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                        placeholder="+84 28 1234 5678"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                        placeholder="branch@dbcafe.vn"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <FontAwesomeIcon icon={faMapMarkerAlt} />
                      Google Maps URL
                    </label>
                    <input
                      type="url"
                      value={formData.google_map_url}
                      onChange={(e) => setFormData({ ...formData, google_map_url: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="https://maps.google.com/..."
                      disabled={isSaving}
                    />
                    <p className="mt-2 text-sm text-slate-500 flex items-start gap-2">
                      <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5" />
                      <span>Enter the Google Maps URL for this branch location</span>
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <FontAwesomeIcon icon={faImage} />
                      Branch Image
                    </label>
                    
                    {previewImageUrl ? (
                      <div className="mt-4 grid grid-cols-4 gap-3">
                        <div className="relative group">
                          <img 
                            src={previewImageUrl} 
                            alt="Branch" 
                            className="w-full h-24 object-cover rounded-md border-2 border-slate-200"
                          />
                          <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </div>
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              disabled={isSaving}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => setMediaPickerOpen(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                          disabled={isSaving}
                        >
                          <FontAwesomeIcon icon={faImage} />
                          Select Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="border-t border-slate-200 p-6 bg-slate-50 sticky bottom-0">
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border border-slate-600 text-slate-600 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faSave} />
                    {isSaving ? 'Saving...' : editingBranch ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        title="Select Branch Image"
        kind="image"
        source="restaurant"
        folder="branches"
        folderAliases={["branch", "restaurant/branches", "restaurant/branch"]}
      />
    </div>
  );
};

export default RestaurantBranches;





