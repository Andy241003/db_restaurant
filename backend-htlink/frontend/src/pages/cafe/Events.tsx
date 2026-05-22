import {
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import MediaPickerModal from '../../components/MediaPickerModal';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import { useDebouncedVr360Autosave } from '../../hooks/useDebouncedVr360Autosave';
import {
    restaurantBranchesApi,
    restaurantEventsApi,
    restaurantLanguagesApi,
    restaurantVr360Api,
    restaurantSettingsApi,
    type Branch,
    type RestaurantEvent,
    type RestaurantEventCreate,
    type EventTranslation,
    type RestaurantVR360Scene,
    type RestaurantVR360SectionSettings,
} from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const LABEL_CLASS = 'mb-2 block text-sm font-medium text-slate-700';
const FIELD_CLASS = 'w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'rounded-lg bg-white p-6 shadow';

type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

type EventLocalizedFields = {
  title: string;
  description: string;
  details: string;
};

type EditableEvent = {
  id?: number;
  code: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  branch_id?: number | null;
  location_text: string;
  registration_url: string;
  max_participants: string;
  primary_image_media_id?: number;
  media_ids: number[];
  status: EventStatus;
  is_featured: boolean;
  display_order: number;
  translations: Record<string, EventLocalizedFields>;
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

const buildEmptyLocalizedEventData = (locales: string[]) =>
  locales.reduce<Record<string, EventLocalizedFields>>((acc, locale) => {
    acc[locale] = { title: '', description: '', details: '' };
    return acc;
  }, {});

const getEventTranslation = (event: RestaurantEvent, locale: string) =>
  event.translations?.find((translation) => translation.locale === locale);

const getEventTitle = (event: RestaurantEvent) =>
  getEventTranslation(event, 'vi')?.title ||
  getEventTranslation(event, 'en')?.title ||
  event.translations?.find((translation) => translation.title)?.title ||
  event.code ||
  'Untitled event';

const getEventDescription = (event: RestaurantEvent) =>
  getEventTranslation(event, 'vi')?.description ||
  getEventTranslation(event, 'en')?.description ||
  event.translations?.find((translation) => translation.description)?.description ||
  '';

const getEventPriceLabel = (event: RestaurantEvent) => {
  const attributes = event.attributes_json as Record<string, unknown> | null | undefined;
  const priceText = attributes?.price_text;
  const ticketPrice = attributes?.ticket_price;
  if (typeof priceText === 'string' && priceText.trim()) return priceText.trim();
  if (typeof ticketPrice === 'string' && ticketPrice.trim()) return ticketPrice.trim();
  if (typeof ticketPrice === 'number') return `${ticketPrice.toLocaleString('vi-VN')}d`;
  return 'Free';
};

const getEventLanguageLabel = (event: RestaurantEvent) => {
  const count = event.translations?.length || 0;
  return count > 0 ? `${count} languages` : 'No translations';
};

const getEventImageCountLabel = (event: RestaurantEvent) => {
  const count = event.media?.length || 0;
  return count > 0 ? `${count} images` : 'No gallery';
};

const getBranchName = (branch: Branch) =>
  branch.translations?.find((translation) => translation.locale === 'vi')?.name ||
  branch.translations?.find((translation) => translation.locale === 'en')?.name ||
  branch.name_vi ||
  branch.name_en ||
  branch.code ||
  'Unknown branch';

const getStatusBadgeClass = (status: EventStatus) => {
  switch (status) {
    case 'ongoing':
      return 'bg-emerald-100 text-emerald-700';
    case 'completed':
      return 'bg-slate-200 text-slate-700';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

const RestaurantEvents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RestaurantEvent[]>([]);
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
  const { saving: savingVR, scheduleSave: scheduleVr360Save } = useDebouncedVr360Autosave({
    onSave: (settings) =>
      restaurantVr360Api.updateSectionSettings('events', {
        target_id: settings.target_id || null,
        panorama_url: settings.panorama_url || null,
        vr360_link: settings.vr360_link || null,
        vr_title: settings.vr_title || null,
        title_translations: settings.title_translations || {},
      }),
    onErrorMessage: 'Failed to save VR settings',
    getErrorMessage: (error: any) => error?.response?.data?.detail,
  });
  const [eventFilter, setEventFilter] = useState<'all' | EventStatus>('all');
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'primary' | 'gallery' | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [eventData, languageCodes, settings, branchData, vr360Data] = await Promise.all([
        restaurantEventsApi.getEvents(),
        restaurantLanguagesApi.getLanguages(),
        restaurantSettingsApi.getSettings(),
        restaurantBranchesApi.getBranches(),
        restaurantVr360Api.getSettings(),
      ]);

      const locales = languageCodes.length > 0 ? languageCodes.map((item) => item.locale) : ['vi', 'en'];
      const settingsJson = (settings.settings_json ?? {}) as Record<string, unknown>;

      setSupportedLanguages(locales);
      setCurrentLocale((previous) => (locales.includes(previous) ? previous : locales[0]));
      setEvents(eventData);
      setBranches(branchData);
      setIsDisplaying(typeof settingsJson.events_is_displaying === 'boolean' ? settingsJson.events_is_displaying : true);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.events || {
        target_id: null,
        panorama_url: null,
        vr360_link: typeof settingsJson.events_vr360_link === 'string' ? settingsJson.events_vr360_link : null,
        vr_title: typeof settingsJson.events_vr_title === 'string' ? settingsJson.events_vr_title : null,
        title_translations: {},
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  const loadEvents = async () => {
    try {
      const eventData = await restaurantEventsApi.getEvents();
      setEvents(eventData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh events');
    }
  };

  const makeTranslations = useCallback(
    (event?: RestaurantEvent) => {
      const result = buildEmptyLocalizedEventData(supportedLanguages);
      supportedLanguages.forEach((locale) => {
        const translation = event?.translations?.find((item) => item.locale === locale);
        result[locale] = {
          title: translation?.title || '',
          description: translation?.description || '',
          details: translation?.details || '',
        };
      });
      return result;
    },
    [supportedLanguages]
  );

  const createDraftEvent = useCallback(
    (event?: RestaurantEvent): EditableEvent => ({
      id: event?.id,
      code: event?.code || `event_${Date.now()}`,
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      start_time: event?.start_time || '',
      end_time: event?.end_time || '',
      branch_id: event?.branch_id ?? undefined,
      location_text: event?.location_text || '',
      registration_url: event?.registration_url || '',
      max_participants: event?.max_participants ? String(event.max_participants) : '',
      primary_image_media_id: event?.primary_image_media_id ?? undefined,
      media_ids: event?.media?.map((item) => item.media_id) || [],
      status: (event?.status as EventStatus) || 'upcoming',
      is_featured: event?.is_featured ?? false,
      display_order: event?.display_order ?? events.length,
      translations: makeTranslations(event),
    }),
    [events.length, makeTranslations]
  );

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') {
      return events;
    }
    return events.filter((event) => event.status === eventFilter);
  }, [eventFilter, events]);

  const currentTranslation = useMemo(
    () => editingEvent?.translations[currentLocale] || { title: '', description: '', details: '' },
    [currentLocale, editingEvent]
  );

  const handleAddNew = () => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingEvent(createDraftEvent());
  };

  const handleEdit = (event: RestaurantEvent) => {
    setCurrentLocale((previous) => (supportedLanguages.includes(previous) ? previous : supportedLanguages[0] || 'vi'));
    setEditingEvent(createDraftEvent(event));
  };

  const handleDelete = async (eventId: number) => {
    const confirmed = window.confirm('Delete this event? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await restaurantEventsApi.deleteEvent(eventId);
      toast.success('Event deleted');
      if (editingEvent?.id === eventId) {
        setEditingEvent(null);
      }
      await loadEvents();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event');
    }
  };

  const handleLocalizedFieldChange = (field: keyof EventLocalizedFields, value: string) => {
    setEditingEvent((previous) => {
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

  const handleFieldChange = <K extends keyof EditableEvent>(field: K, value: EditableEvent[K]) => {
    setEditingEvent((previous) => (previous ? { ...previous, [field]: value } : previous));
  };

  const handlePrimaryMediaSelected = (mediaId: number) => {
    setEditingEvent((previous) => {
      if (!previous) return previous;
      const mediaIds = previous.media_ids.includes(mediaId) ? previous.media_ids : [mediaId, ...previous.media_ids];
      return {
        ...previous,
        primary_image_media_id: mediaId,
        media_ids: mediaIds,
      };
    });
    setMediaPickerMode(null);
  };

  const handleGalleryMediaSelected = (mediaIds: number[]) => {
    setEditingEvent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        media_ids: mediaIds,
        primary_image_media_id: mediaIds.includes(previous.primary_image_media_id || -1)
          ? previous.primary_image_media_id
          : mediaIds[0],
      };
    });
    setMediaPickerMode(null);
  };

  const handleRemoveMedia = (mediaId: number) => {
    setEditingEvent((previous) => {
      if (!previous) return previous;
      const remainingMediaIds = previous.media_ids.filter((id) => id !== mediaId);
      return {
        ...previous,
        media_ids: remainingMediaIds,
        primary_image_media_id: previous.primary_image_media_id === mediaId
          ? remainingMediaIds[0]
          : previous.primary_image_media_id,
      };
    });
  };
  const handleSaveEvent = async () => {
    if (!editingEvent) return;

    const translations: EventTranslation[] = supportedLanguages
      .map((locale) => ({
        locale,
        title: editingEvent.translations[locale]?.title?.trim() || '',
        description: editingEvent.translations[locale]?.description?.trim() || '',
        details: editingEvent.translations[locale]?.details?.trim() || '',
      }))
      .filter((translation) => translation.title || translation.description || translation.details);

    if (translations.length === 0 || !translations.some((translation) => translation.title)) {
      toast.error('Please add at least one event title');
      return;
    }

    if (!editingEvent.code.trim()) {
      toast.error('Event code is required');
      return;
    }

    const payload: RestaurantEventCreate = {
      code: editingEvent.code.trim(),
      start_date: editingEvent.start_date || undefined,
      end_date: editingEvent.end_date || undefined,
      start_time: editingEvent.start_time || undefined,
      end_time: editingEvent.end_time || undefined,
      branch_id: editingEvent.branch_id || null,
      location_text: editingEvent.location_text.trim() || undefined,
      registration_url: editingEvent.registration_url.trim() || undefined,
      max_participants: editingEvent.max_participants ? Number(editingEvent.max_participants) : null,
      primary_image_media_id: editingEvent.primary_image_media_id || null,
      status: editingEvent.status,
      is_featured: editingEvent.is_featured,
      display_order: Number.isFinite(editingEvent.display_order) ? editingEvent.display_order : events.length,
      attributes_json: null,
      translations,
      media_ids: editingEvent.media_ids,
    };

    try {
      setSavingEvent(true);
      if (editingEvent.id) {
        await restaurantEventsApi.updateEvent(editingEvent.id, payload);
        toast.success('Event updated');
      } else {
        await restaurantEventsApi.createEvent(payload);
        toast.success('Event created');
      }
      setEditingEvent(null);
      await loadEvents();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save event');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleVR360Change = (nextSettings: RestaurantVR360SectionSettings) => {
    setVr360Settings(nextSettings);
    scheduleVr360Save(nextSettings);
  };

  const handleDisplayStatusChange = async (nextValue: boolean) => {
    try {
      setSavingDisplayStatus(true);
      const currentSettings = await restaurantSettingsApi.getSettings();
      await restaurantSettingsApi.updateSettings({
        settings_json: {
          ...currentSettings.settings_json,
          events_is_displaying: nextValue,
        },
      });
      setIsDisplaying(nextValue);
      toast.success(nextValue ? 'Events section enabled' : 'Events section hidden');
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
          <h2 className="text-xl font-bold text-slate-800">Display Status - Events Section</h2>
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
          <span>When display is turned off, the Events section will not appear on the website, but you can still manage event content here.</span>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <FontAwesomeIcon icon={faVrCardboard} className="text-xl text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">VR360 Settings</h2>
        </div>
        <VR360SettingsPanel
          sectionLabel="Events"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentLocale}
          onChange={(nextValue) => void handleVR360Change(nextValue)}
          disabled={savingVR}
        />
      </div>

      {!editingEvent && (
        <div className={SECTION_CLASS}>
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Events Management</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as 'all' | EventStatus)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                type="button"
                onClick={handleAddNew}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
              >
                <FontAwesomeIcon icon={faPlus} />
                Add New Event
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">No events found for the current filter.</div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => {
                const imageUrl = event.primary_image_media_id
                  ? `${getApiBaseUrl()}/media/${event.primary_image_media_id}/view`
                  : null;
                const description = getEventDescription(event);
                const title = getEventTitle(event);
                const branchLabel = getBranchLabelById(event.branch_id);
                const priceLabel = getEventPriceLabel(event);
                const languageLabel = getEventLanguageLabel(event);
                const imageCountLabel = getEventImageCountLabel(event);

                return (
                  <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 lg:w-52">
                        {imageUrl ? (
                          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
                            <FontAwesomeIcon icon={faImage} className="text-xl" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-slate-800">{title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(event.status as EventStatus)}`}>
                            {event.status}
                          </span>
                          {event.is_featured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <FontAwesomeIcon icon={faStar} />
                              Featured
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                          <span>{event.start_date ? dayjs(event.start_date).format('YYYY-MM-DD') : 'No date'}</span>
                          <span>{event.start_time || '--:--'}{event.end_time ? ` - ${event.end_time}` : ''}</span>
                          <span>{branchLabel}</span>
                          <span>{priceLabel}</span>
                          <span>{event.max_participants ? `${event.max_participants} people` : 'Unlimited'}</span>
                        </div>

                        {description && <p className="mt-2 line-clamp-1 text-sm text-slate-500">{description}</p>}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{imageCountLabel}</span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{languageLabel}</span>
                          {event.location_text && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{event.location_text}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-3 self-start md:self-auto">
                        <button
                          type="button"
                          onClick={() => handleEdit(event)}
                          className="flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
                          title="Edit event"
                        >
                          <FontAwesomeIcon icon={faPenToSquare} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(event.id)}
                          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                          title="Delete event"
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
      )}

      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{editingEvent.id ? 'Edit Event' : 'Add New Event'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
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
                  <label className={LABEL_CLASS}>Event Title *</label>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={currentTranslation.title}
                    onChange={(e) => handleLocalizedFieldChange('title', e.target.value)}
                    placeholder="Enter event title..."
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea
                    rows={4}
                    className={FIELD_CLASS}
                    value={currentTranslation.description}
                    onChange={(e) => handleLocalizedFieldChange('description', e.target.value)}
                    placeholder="Enter a short description..."
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Code</label>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={editingEvent.code}
                    onChange={(e) => handleFieldChange('code', e.target.value)}
                    placeholder="event_code"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Branch</label>
                  <select
                    className={FIELD_CLASS}
                    value={editingEvent.branch_id ?? ''}
                    onChange={(e) => handleFieldChange('branch_id', e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">All branches / not assigned</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{getBranchName(branch)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Start Date</label>
                  <input type="date" className={FIELD_CLASS} value={editingEvent.start_date} onChange={(e) => handleFieldChange('start_date', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>End Date</label>
                  <input type="date" className={FIELD_CLASS} value={editingEvent.end_date} onChange={(e) => handleFieldChange('end_date', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Start Time</label>
                  <input type="time" className={FIELD_CLASS} value={editingEvent.start_time} onChange={(e) => handleFieldChange('start_time', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>End Time</label>
                  <input type="time" className={FIELD_CLASS} value={editingEvent.end_time} onChange={(e) => handleFieldChange('end_time', e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Location</label>
                  <input
                    type="text"
                    className={FIELD_CLASS}
                    value={editingEvent.location_text}
                    onChange={(e) => handleFieldChange('location_text', e.target.value)}
                    placeholder="Main hall, rooftop, branch address..."
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Max Participants</label>
                  <input
                    type="number"
                    className={FIELD_CLASS}
                    value={editingEvent.max_participants}
                    onChange={(e) => handleFieldChange('max_participants', e.target.value)}
                    min={0}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Registration URL</label>
                  <input
                    type="url"
                    className={FIELD_CLASS}
                    value={editingEvent.registration_url}
                    onChange={(e) => handleFieldChange('registration_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Status</label>
                  <select className={FIELD_CLASS} value={editingEvent.status} onChange={(e) => handleFieldChange('status', e.target.value as EventStatus)}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className={LABEL_CLASS}>Event Details</label>
                <textarea
                  rows={5}
                  className={FIELD_CLASS}
                  value={currentTranslation.details}
                  onChange={(e) => handleLocalizedFieldChange('details', e.target.value)}
                  placeholder="Agenda, guest speaker, notes..."
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Featured Event</h3>
                  <p className="text-sm text-slate-500">Highlight this event in featured sections on the website.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={editingEvent.is_featured} onChange={(e) => handleFieldChange('is_featured', e.target.checked)} />
                  <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
              </div>

              <div className="mt-6">
                <label className={`${LABEL_CLASS} flex items-center gap-2`}><FontAwesomeIcon icon={faImages} />Event Images</label>
                <button type="button" onClick={() => setMediaPickerMode('gallery')} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"><FontAwesomeIcon icon={faImages} />Select Images</button>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {editingEvent.media_ids.map((mediaId) => (
                    <div key={mediaId} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      <img src={`${getApiBaseUrl()}/media/${mediaId}/view`} alt={`Event media ${mediaId}`} className="h-24 w-full object-cover" />
                      {editingEvent.primary_image_media_id === mediaId && <div className="absolute left-2 top-2 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white">Primary</div>}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {editingEvent.primary_image_media_id !== mediaId && <button type="button" onClick={() => handleFieldChange('primary_image_media_id', mediaId)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Set Primary</button>}
                        <button type="button" onClick={() => handleRemoveMedia(mediaId)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-4 border-t border-slate-200 bg-slate-50 p-6">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                disabled={savingEvent}
                className="rounded-md border border-slate-600 px-6 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEvent()}
                disabled={savingEvent}
                className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
              >
                {savingEvent ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      <MediaPickerModal
        isOpen={mediaPickerMode === 'primary'}
        onClose={() => setMediaPickerMode(null)}
        onSelect={handlePrimaryMediaSelected}
        title="Select Event Image"
        kind="image"
        source="restaurant"
        folder="events"
        folderAliases={['event', 'restaurant/events', 'restaurant/event']}
      />

      <MediaPickerModal
        isOpen={mediaPickerMode === 'gallery'}
        onClose={() => setMediaPickerMode(null)}
        onSelectMultiple={handleGalleryMediaSelected}
        title="Select Event Gallery Images"
        kind="image"
        source="restaurant"
        folder="events"
        folderAliases={['event', 'restaurant/events', 'restaurant/event']}
        allowMultiple
      />
    </div>
  );
};

export default RestaurantEvents;























