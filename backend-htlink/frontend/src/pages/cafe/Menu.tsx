import { faImages, faVrCardboard, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Form, Input, InputNumber, Popconfirm, Select, Tag } from 'antd';
import { Coffee, Edit, Eye, GripVertical, Info, Play, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import MediaPickerModal from '../../components/MediaPickerModal';
import VR360SettingsPanel from '../../components/common/VR360SettingsPanel';
import { useDebouncedVr360Autosave } from '../../hooks/useDebouncedVr360Autosave';
import { cafeLanguagesApi, cafeMenuApi, cafeSettingsApi, restaurantVr360Api, type CategoryTranslation, type ItemTranslation, type MenuCategory, type MenuCategoryCreate, type MenuItem, type MenuItemCreate, type RestaurantVR360Scene, type RestaurantVR360SectionSettings } from '../../services/restaurantApi';
import { getApiBaseUrl } from '../../utils/api';

const { TextArea } = Input;

const LANGUAGE_CONFIG: Record<string, { name: string; flag: string; shortLabel: string }> = {
  vi: { name: 'Vietnamese', flag: 'VN', shortLabel: 'VI' },
  en: { name: 'English', flag: 'GB', shortLabel: 'EN' },
  zh: { name: 'Chinese', flag: 'CN', shortLabel: 'ZH' },
  'zh-TW': { name: 'Traditional Chinese', flag: 'TW', shortLabel: 'ZH-TW' },
  yue: { name: 'Cantonese', flag: 'HK', shortLabel: 'YUE' },
  ja: { name: 'Japanese', flag: 'JP', shortLabel: 'JA' },
  ko: { name: 'Korean', flag: 'KR', shortLabel: 'KO' },
  th: { name: 'Thai', flag: 'TH', shortLabel: 'TH' },
  fr: { name: 'French', flag: 'FR', shortLabel: 'FR' },
};

const getLanguageDisplay = (locale: string) => {
  return LANGUAGE_CONFIG[locale] || { name: locale.toUpperCase(), flag: locale.toUpperCase(), shortLabel: locale.toUpperCase() };
};

const pickInternalCode = (...candidates: Array<string | undefined | null>) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return undefined;
};

type MenuItemFormState = {
  category_id?: number;
  code?: string;
  price?: number;
  original_price?: number;
  status?: string;
  is_bestseller: boolean;
  is_new: boolean;
  is_seasonal: boolean;
  display_order?: number;
  calories?: number;
};

const RestaurantMenu: React.FC = () => {
  // Categories state
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryForm] = Form.useForm();
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Menu Items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuItemModalVisible, setMenuItemModalVisible] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuItemForm] = Form.useForm();
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false);
  
  // Media picker state
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'category-icon' | 'item-image'>('item-image');
  const [selectedCategoryIconId, setSelectedCategoryIconId] = useState<number | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [primaryImageId, setPrimaryImageId] = useState<number | null>(null);

  // Multi-language form state
  const [categoryTranslations, setCategoryTranslations] = useState<Record<string, CategoryTranslation>>({});
  const [itemTranslations, setItemTranslations] = useState<Record<string, ItemTranslation>>({});
  const [currentCategoryLocale, setCurrentCategoryLocale] = useState('vi');
  const [currentItemLocale, setCurrentItemLocale] = useState('vi');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['vi', 'en']);
  const [menuItemState, setMenuItemState] = useState<MenuItemFormState>({
    status: 'available',
    is_bestseller: false,
    is_new: false,
    is_seasonal: false,
  });
  const selectedCategoryStatus = Form.useWatch('is_active', categoryForm);
  const selectedCategoryDisplayOrder = Form.useWatch('display_order', categoryForm);

  // Temporary state for category form when media picker is open
  const [tempCategoryFormData, setTempCategoryFormData] = useState<any>(null);

  // Drag & drop state
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tempMenuItemFormData, setTempMenuItemFormData] = useState<any>(null);

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
  const { saving: savingVR, scheduleSave: scheduleVr360Save } = useDebouncedVr360Autosave({
    onSave: (settings) =>
      restaurantVr360Api.updateSectionSettings('menu', {
        target_id: settings.target_id || null,
        panorama_url: settings.panorama_url || null,
        vr360_link: settings.vr360_link || null,
        vr_title: settings.vr_title || null,
        title_translations: settings.title_translations || {},
      }),
    onErrorMessage: 'Failed to save VR360 settings',
    getErrorMessage: (error: any) => error?.response?.data?.detail,
  });

  useEffect(() => {
    loadCategories();
    loadLanguageSettings();
    loadMenuItems(); // Load items on mount
  }, []);

  useEffect(() => {
    const handleLanguagesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ supportedLanguages?: string[] }>;
      const nextLanguages = customEvent.detail?.supportedLanguages;
      if (nextLanguages && nextLanguages.length > 0) {
        setSupportedLanguages(nextLanguages);
        setCurrentCategoryLocale((prev) => nextLanguages.includes(prev) ? prev : nextLanguages[0]);
        setCurrentItemLocale((prev) => nextLanguages.includes(prev) ? prev : nextLanguages[0]);
      }
    };

    window.addEventListener('restaurant-languages-updated', handleLanguagesUpdated as EventListener);
    return () => window.removeEventListener('restaurant-languages-updated', handleLanguagesUpdated as EventListener);
  }, []);

  // Restore category form when returning from media picker
  useEffect(() => {
    if (categoryModalVisible && tempCategoryFormData) {
      // Restore form values
      categoryForm.setFieldsValue(tempCategoryFormData.formValues);
      setCategoryTranslations(tempCategoryFormData.translations);
      setCurrentCategoryLocale(tempCategoryFormData.locale);
      setEditingCategory(tempCategoryFormData.editingCategory);
    }
  }, [categoryModalVisible, tempCategoryFormData]);

  // Restore menu item form when returning from media picker
  useEffect(() => {
    if (menuItemModalVisible && tempMenuItemFormData) {
      // Restore form values
      menuItemForm.setFieldsValue(tempMenuItemFormData.formValues);
      setItemTranslations(tempMenuItemFormData.translations);
      setCurrentItemLocale(tempMenuItemFormData.locale);
      setEditingMenuItem(tempMenuItemFormData.editingMenuItem);
      setMenuItemState(tempMenuItemFormData.menuItemState || {
        status: 'available',
        is_bestseller: false,
        is_new: false,
        is_seasonal: false,
      });
    }
  }, [menuItemModalVisible, tempMenuItemFormData]);

  const updateMenuItemField = <K extends keyof MenuItemFormState>(field: K, value: MenuItemFormState[K]) => {
    setMenuItemState(prev => ({ ...prev, [field]: value }));
    menuItemForm.setFieldValue(field, value);
  };

  const loadLanguageSettings = async () => {
    try {
      const langs = await cafeLanguagesApi.getLanguageCodes();
      if (langs && langs.length > 0) {
        setSupportedLanguages(langs);
      }
      
      const [settings, vr360Data] = await Promise.all([
        cafeSettingsApi.getSettings(),
        restaurantVr360Api.getSettings(),
      ]);
      const displayStatus = settings.settings_json?.menu_is_displaying ?? true;
      setIsDisplaying(displayStatus);
      setScenes(vr360Data.scenes || []);
      setVr360Settings(vr360Data.sections.menu || {
        target_id: null,
        panorama_url: null,
        vr360_link: settings.settings_json?.menu_vr360_link || null,
        vr_title: settings.settings_json?.menu_vr_title || null,
        title_translations: {},
      });
    } catch (error) {
      console.error('Failed to load languages:', error);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const data = await cafeMenuApi.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
      console.error(error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const data = await cafeMenuApi.getItems();
      setMenuItems(data);
    } catch (error) {
      toast.error('Failed to load menu items');
      console.error(error);
    }
  };

  const handleVR360Change = (nextSettings: RestaurantVR360SectionSettings) => {
    setVr360Settings(nextSettings);
    scheduleVr360Save(nextSettings);
  };

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    categoryForm.resetFields();
    setSelectedCategoryIconId(null);
    const emptyTranslations: Record<string, CategoryTranslation> = {};
    supportedLanguages.forEach(lang => {
      emptyTranslations[lang] = { locale: lang, name: '', description: '' };
    });
    setCategoryTranslations(emptyTranslations);
    setCurrentCategoryLocale(supportedLanguages[0] || 'vi');
    categoryForm.setFieldsValue({ is_active: true, display_order: categories.length + 1 });
    setCategoryModalVisible(true);
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setSelectedCategoryIconId(category.icon_media_id || null);
    const translationsObj: Record<string, CategoryTranslation> = {};
    category.translations.forEach(t => {
      translationsObj[t.locale] = t;
    });
    supportedLanguages.forEach(lang => {
      if (!translationsObj[lang]) {
        translationsObj[lang] = { locale: lang, name: '', description: '' };
      }
    });
    setCategoryTranslations(translationsObj);
    setCurrentCategoryLocale(supportedLanguages[0] || 'vi');
    categoryForm.setFieldsValue({
      code: category.code,
      display_order: category.display_order,
      is_active: category.is_active
    });
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await cafeMenuApi.deleteCategory(id);
      toast.success('Category deleted successfully');
      loadCategories();
      loadMenuItems();
    } catch (error) {
      toast.error('Failed to delete category');
      console.error(error);
    }
  };

  const handleCategorySubmit = async (values: any) => {
    if (isSavingCategory) {
      return;
    }

    try {
      setIsSavingCategory(true);
      const translations = Object.values(categoryTranslations).filter(t => t.name.trim() !== '');
      
      if (translations.length === 0) {
        toast.error('Please provide at least one translation');
        return;
      }

      const displayOrder = values.display_order ?? categoryForm.getFieldValue('display_order') ?? (editingCategory?.display_order || categories.length + 1);
      const isActive = values.is_active ?? categoryForm.getFieldValue('is_active') ?? (editingCategory?.is_active ?? true);
      const submitCode =
        pickInternalCode(values.code, categoryForm.getFieldValue('code'), editingCategory?.code) ??
        `cat_${Date.now()}`;

      const submitData: MenuCategoryCreate = {
        code: submitCode,
        icon_media_id: selectedCategoryIconId || undefined,
        display_order: displayOrder,
        is_active: isActive,
        translations
      };


      if (editingCategory) {
        await cafeMenuApi.updateCategory(editingCategory.id, submitData);
        toast.success('Category updated successfully');
      } else {
        await cafeMenuApi.createCategory(submitData);
        toast.success('Category created successfully');
      }
      setCategoryModalVisible(false);
      setTempCategoryFormData(null);
      loadCategories();
    } catch (error: any) {
      console.error('Category submit error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to save category';
      toast.error(errorMsg);
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Menu Item handlers
  const handleAddMenuItem = (categoryId?: number) => {
    setEditingMenuItem(null);
    menuItemForm.resetFields();
    const emptyTranslations: Record<string, ItemTranslation> = {};
    supportedLanguages.forEach(lang => {
      emptyTranslations[lang] = { locale: lang, name: '', description: '', ingredients: '' };
    });
    setItemTranslations(emptyTranslations);
    setCurrentItemLocale(supportedLanguages[0] || 'vi');
    
    // Get display order based on category
    const catItems = categoryId ? menuItems.filter(item => item.category_id === categoryId) : menuItems;
    
    const initialState: MenuItemFormState = {
      category_id: categoryId,
      status: 'available',
      is_bestseller: false,
      is_new: false,
      is_seasonal: false,
      display_order: catItems.length + 1 
    };
    setMenuItemState(initialState);
    menuItemForm.setFieldsValue(initialState);
    setSelectedImageIds([]);
    setPrimaryImageId(null);
    setMenuItemModalVisible(true);
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item);
    const translationsObj: Record<string, ItemTranslation> = {};
    item.translations.forEach(t => {
      translationsObj[t.locale] = t;
    });
    supportedLanguages.forEach(lang => {
      if (!translationsObj[lang]) {
        translationsObj[lang] = { locale: lang, name: '', description: '', ingredients: '' };
      }
    });
    setItemTranslations(translationsObj);
    setCurrentItemLocale(supportedLanguages[0] || 'vi');
    
    // Load images if available
    if (item.image_media_id) {
      setSelectedImageIds([item.image_media_id]);
      setPrimaryImageId(item.image_media_id);
    } else {
      setSelectedImageIds([]);
      setPrimaryImageId(null);
    }
    
    const initialState: MenuItemFormState = {
      code: item.code,
      category_id: item.category_id,
      price: item.price,
      original_price: item.original_price,
      status: item.status,
      is_bestseller: item.is_bestseller,
      is_new: item.is_new,
      is_seasonal: item.is_seasonal,
      display_order: item.display_order,
      calories: item.calories
    };
    setMenuItemState(initialState);
    menuItemForm.setFieldsValue(initialState);
    
    // Load images if available
    if (item.image_media_id) {
      setSelectedImageIds([item.image_media_id]);
      setPrimaryImageId(item.image_media_id);
    } else if (item.primary_image_media_id) {
      setSelectedImageIds([item.primary_image_media_id]);
      setPrimaryImageId(item.primary_image_media_id);
    } else {
      setSelectedImageIds([]);
      setPrimaryImageId(null);
    }
    
    setMenuItemModalVisible(true);
  };

  const handleDeleteMenuItem = async (id: number) => {
    try {
      await cafeMenuApi.deleteItem(id);
      toast.success('Menu item deleted successfully');
      loadMenuItems();
    } catch (error) {
      toast.error('Failed to delete menu item');
      console.error(error);
    }
  };

  const handleMenuItemSubmit = async (values: any) => {
    if (isSavingMenuItem) {
      return;
    }

    try {
      setIsSavingMenuItem(true);
      const formValues = menuItemForm.getFieldsValue();
      const categoryId = values.category_id ?? menuItemState.category_id ?? formValues.category_id;

      if (!categoryId) {
        toast.error('Please select a category');
        return;
      }

      const translations = Object.values(itemTranslations).filter(t => t.name.trim() !== '');
      
      if (translations.length === 0) {
        toast.error('Please provide at least one translation');
        return;
      }

      const submitCode =
        pickInternalCode(values.code, menuItemState.code, formValues.code, editingMenuItem?.code) ??
        `item_${Date.now()}`;
      const submitStatus = values.status ?? menuItemState.status ?? formValues.status ?? editingMenuItem?.status ?? 'available';
      const submitDisplayOrder =
        values.display_order ??
        menuItemState.display_order ??
        formValues.display_order ??
        editingMenuItem?.display_order ??
        menuItems.filter(item => item.category_id === categoryId).length + (editingMenuItem ? 0 : 1);
      const submitPrice = values.price ?? menuItemState.price ?? formValues.price ?? editingMenuItem?.price;
      const submitOriginalPrice = values.original_price ?? menuItemState.original_price ?? formValues.original_price ?? editingMenuItem?.original_price;
      const submitCalories = values.calories ?? menuItemState.calories ?? formValues.calories ?? editingMenuItem?.calories;
      const submitIsBestseller = values.is_bestseller ?? menuItemState.is_bestseller ?? formValues.is_bestseller ?? editingMenuItem?.is_bestseller ?? false;
      const submitIsNew = values.is_new ?? menuItemState.is_new ?? formValues.is_new ?? editingMenuItem?.is_new ?? false;
      const submitIsSeasonal = values.is_seasonal ?? menuItemState.is_seasonal ?? formValues.is_seasonal ?? editingMenuItem?.is_seasonal ?? false;

      const submitData: MenuItemCreate = {
        code: submitCode,
        category_id: categoryId,
        price: submitPrice,
        original_price: submitOriginalPrice,
        status: submitStatus,
        is_bestseller: submitIsBestseller,
        is_new: submitIsNew,
        is_seasonal: submitIsSeasonal,
        display_order: submitDisplayOrder,
        calories: submitCalories,
        primary_image_media_id: primaryImageId || selectedImageIds[0] || editingMenuItem?.primary_image_media_id || undefined,
        media_ids: selectedImageIds.length > 0 ? selectedImageIds : undefined,
        translations: translations.map((translation) => ({
          locale: translation.locale,
          name: translation.name.trim(),
          description: translation.description?.trim() || undefined,
          ingredients: translation.ingredients?.trim() || undefined,
        })),
      };

      
      if (editingMenuItem) {
        await cafeMenuApi.updateItem(editingMenuItem.id, submitData);
        toast.success('Menu item updated successfully');
      } else {
        await cafeMenuApi.createItem(submitData);
        toast.success('Menu item created successfully');
      }
      setMenuItemModalVisible(false);
      setTempMenuItemFormData(null);
      loadMenuItems();
    } catch (error: any) {
      console.error('Menu item submit error:', error);
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail)
        ? detail.map((item: any) => item.msg).join(', ')
        : detail || 'Failed to save menu item';
      toast.error(errorMessage);
    } finally {
      setIsSavingMenuItem(false);
    }
  };

  const handleMediaSelect = (mediaId: number) => {
    if (mediaPickerMode === 'category-icon') {
      setSelectedCategoryIconId(mediaId);
      // Restore category modal if it was temporarily closed
      if (tempCategoryFormData) {
        setCategoryModalVisible(true);
        setTempCategoryFormData(null);
      }
    }
    setMediaPickerVisible(false);
  };

  const handleMultipleMediaSelect = (mediaIds: number[]) => {
    // Add new images that aren't already selected
    const newImageIds = mediaIds.filter(id => !selectedImageIds.includes(id));
    if (newImageIds.length > 0) {
      setSelectedImageIds(prev => [...prev, ...newImageIds]);
      // Set first new image as primary if no primary exists
      if (!primaryImageId && newImageIds.length > 0) {
        setPrimaryImageId(newImageIds[0]);
      }
    }
    // Restore menu item modal if it was temporarily closed
    if (tempMenuItemFormData) {
      setMenuItemModalVisible(true);
      setTempMenuItemFormData(null);
    }
    setMediaPickerVisible(false);
  };

  const handleOpenMediaPickerForCategory = () => {
    // Save current form state
    const currentFormValues = categoryForm.getFieldsValue();
    setTempCategoryFormData({
      formValues: currentFormValues,
      translations: { ...categoryTranslations },
      locale: currentCategoryLocale,
      editingCategory: editingCategory
    });
    // Close category modal and open media picker
    setCategoryModalVisible(false);
    setMediaPickerMode('category-icon');
    setMediaPickerVisible(true);
  };

  const handleOpenMediaPickerForMenuItem = () => {
    // Save current form state
    const currentFormValues = menuItemForm.getFieldsValue();
    setTempMenuItemFormData({
      formValues: currentFormValues,
      menuItemState: { ...menuItemState },
      translations: { ...itemTranslations },
      locale: currentItemLocale,
      editingMenuItem: editingMenuItem
    });
    // Close menu item modal and open media picker
    setMenuItemModalVisible(false);
    setMediaPickerMode('item-image');
    setMediaPickerVisible(true);
  };

  const handleCategoryModalClose = () => {
    setCategoryModalVisible(false);
    setTempCategoryFormData(null); // Clear temp data when manually closing
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCategoryIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedCategoryIndex === null || draggedCategoryIndex === dropIndex) return;

    const newCategories = [...categories];
    const [draggedItem] = newCategories.splice(draggedCategoryIndex, 1);
    newCategories.splice(dropIndex, 0, draggedItem);

    // Update display_order for all affected categories
    const updatePromises = newCategories.map((cat, idx) => 
      cafeMenuApi.updateCategory(cat.id, { display_order: idx + 1 })
    );

    Promise.all(updatePromises)
      .then(() => {
        setCategories(newCategories);
        toast.success('Category order updated');
      })
      .catch((error) => {
        console.error('Failed to update order:', error);
        toast.error('Failed to update category order');
        loadCategories(); // Reload to reset
      });

    setDraggedCategoryIndex(null);
  };

  const getBadgesForItem = (item: MenuItem) => {
    const badges: Array<{ text: string; className: string }> = [];

    if (item.is_bestseller) {
      badges.push({ text: 'HOT', className: 'bg-red-500 text-white' });
    }

    if (item.is_new) {
      badges.push({ text: 'NEW', className: 'bg-green-500 text-white' });
    }

    if (item.is_seasonal) {
      badges.push({ text: 'SEASON', className: 'bg-yellow-500 text-white' });
    }

    return badges;
  };

  const filteredCategories = categories.filter((category) => {
    if (categoryFilter === 'active') return category.is_active;
    if (categoryFilter === 'inactive') return !category.is_active;
    return true;
  });

  const handleMenuItemModalClose = () => {
    setMenuItemModalVisible(false);
    setTempMenuItemFormData(null); // Clear temp data when manually closing
    setMenuItemState({
      status: 'available',
      is_bestseller: false,
      is_new: false,
      is_seasonal: false,
    });
  };

  return (
    <div className="space-y-6 pt-6 px-6 pb-6">
      {/* Display Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Display Status - Menu Section</h2>
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
                        menu_is_displaying: newValue
                      }
                    });
                    setIsDisplaying(newValue);
                    toast.success(newValue ? 'Menu section enabled' : 'Menu section disabled');
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
          <Coffee className="text-blue-600 text-xl mt-0.5" />
          <span className="text-blue-800 text-sm">
            When display is turned off, the "Menu" section will not appear on the website. You can still edit and manage menu items.
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
          sectionLabel="Menu"
          value={vr360Settings}
          scenes={scenes}
          currentLocale={currentCategoryLocale}
          locales={supportedLanguages}
          onLocaleChange={setCurrentCategoryLocale}
          onChange={(nextValue) => void handleVR360Change(nextValue)}
          disabled={savingVR}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Menu Management</h2>
          <button
            type="button"
            onClick={handleAddCategory}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Category
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Filter by Status:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {categoriesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-500">Loading categories...</div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Coffee className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">No categories found</p>
            <p className="text-sm">Adjust the filter or add a new category to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map((category, catIndex) => {
              const catItems = menuItems.filter(item => item.category_id === category.id);
              const catName = category.translations.find(t => t.locale === 'vi')?.name ||
                            category.translations.find(t => t.locale === 'en')?.name ||
                            category.code;

              return (
                <div
                  key={category.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, catIndex)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, catIndex)}
                  className={`border border-slate-200 rounded-lg px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all ${
                    draggedCategoryIndex === catIndex ? 'opacity-60 border-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-2">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {category.icon_media_id ? (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-blue-600 shadow-sm">
                        <img
                          src={`${getApiBaseUrl()}/media/${category.icon_media_id}/view`}
                          alt={catName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-blue-600 text-white shadow-sm">
                        <Coffee className="h-5 w-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold leading-tight text-slate-800">{catName}</h3>
                        {!category.is_active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm leading-none text-slate-500">
                        {catItems.length} item{catItems.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditCategory(category)}
                        className="px-4 py-2 border border-slate-600 text-slate-600 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <Popconfirm
                        title="Delete Category"
                        description="Delete this category? All items in this category will be affected."
                        onConfirm={() => handleDeleteCategory(category.id)}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <button
                          type="button"
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </Popconfirm>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddMenuItem(category.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>

                    {catItems.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        <Coffee className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No items in this category yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
                        {catItems.map((item) => {
                          const itemName = item.translations.find(t => t.locale === 'vi')?.name ||
                                         item.translations.find(t => t.locale === 'en')?.name ||
                                         'Untitled';
                          const itemDesc = item.translations.find(t => t.locale === 'vi')?.description || '';
                          const badges = getBadgesForItem(item);

                          return (
                            <div
                              key={item.id}
                              className="group border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 bg-white relative"
                            >
                              {badges.length > 0 && (
                                <div className="absolute top-1.5 right-1.5 z-10 flex flex-row items-center gap-1">
                                  {badges.map((badge) => (
                                    <span
                                      key={badge.text}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow ${badge.className}`}
                                    >
                                      {badge.text}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {item.primary_image_media_id ? (
                                <div className="aspect-square overflow-hidden bg-slate-100">
                                  <img
                                    src={`${getApiBaseUrl()}/media/${item.primary_image_media_id}/view`}
                                    alt={itemName}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                </div>
                              ) : (
                                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                  <Coffee className="w-8 h-8 text-slate-400" />
                                </div>
                              )}

                              <div className="p-2.5">
                                <h4 className="text-sm font-semibold text-slate-800 mb-1 line-clamp-1">{itemName}</h4>
                                {itemDesc && (
                                  <p className="text-[11px] text-slate-500 mb-2 line-clamp-2 min-h-[32px]">{itemDesc}</p>
                                )}

                                <div className="flex items-center justify-between mb-2.5 min-h-[24px]">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-sm font-bold text-blue-600">
                                      {item.price?.toLocaleString()} VND
                                    </span>
                                    {item.original_price !== undefined && item.price !== undefined && item.original_price > item.price && (
                                      <span className="text-[10px] text-slate-400 line-through">
                                        {item.original_price.toLocaleString()} VND
                                      </span>
                                    )}
                                  </div>
                                  {item.status !== 'available' && (
                                    <Tag color={item.status === 'sold_out' ? 'red' : 'orange'} className="m-0 text-[10px] leading-none">
                                      {item.status === 'sold_out' ? 'Sold Out' : 'Unavailable'}
                                    </Tag>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    size="small"
                                    onClick={() => handleEditMenuItem(item)}
                                    icon={<Edit className="w-3 h-3" />}
                                    className="flex-1 text-xs px-2"
                                  >
                                    Edit
                                  </Button>
                                  <Popconfirm
                                    title="Delete this item?"
                                    onConfirm={() => handleDeleteMenuItem(item.id)}
                                    okText="Delete"
                                    cancelText="Cancel"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      icon={<Trash2 className="w-3 h-3" />}
                                      className="text-xs px-2"
                                    />
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {categoryModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header - Sticky */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                onClick={handleCategoryModalClose}
                className="flex h-10 w-10 items-center justify-center rounded-md text-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6">
              {/* Language Tabs */}
              <div className="mb-6 overflow-x-auto border-b border-slate-200">
                <div className="flex w-max min-w-full gap-2 whitespace-nowrap pr-2">
                  {supportedLanguages.map(lang => {
                    const languageDisplay = getLanguageDisplay(lang);

                    return (
                      <button
                        key={lang}
                        onClick={() => setCurrentCategoryLocale(lang)}
                        className={`shrink-0 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                          currentCategoryLocale === lang
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        {languageDisplay.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Form
                form={categoryForm}
                layout="vertical"
                onFinish={handleCategorySubmit}
              >
                {/* Translation Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Category Name {currentCategoryLocale === 'vi' && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      placeholder={`Ex: Coffee, Tea, Desserts`}
                      value={categoryTranslations[currentCategoryLocale]?.name || ''}
                      onChange={(e) => {
                        setCategoryTranslations(prev => ({
                          ...prev,
                          [currentCategoryLocale]: { ...prev[currentCategoryLocale], locale: currentCategoryLocale, name: e.target.value }
                        }));
                      }}
                      className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description (Optional)
                    </label>
                    <TextArea
                      rows={3}
                      placeholder={`Enter a brief description...`}
                      value={categoryTranslations[currentCategoryLocale]?.description || ''}
                      onChange={(e) => {
                        setCategoryTranslations(prev => ({
                          ...prev,
                          [currentCategoryLocale]: { ...prev[currentCategoryLocale], locale: currentCategoryLocale, description: e.target.value }
                        }));
                      }}
                      className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Settings Section */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Code (Internal) *</label>
                    <Input
                      placeholder="e.g., CAT-01"
                      defaultValue={editingCategory?.code || ''}
                      onChange={(e) => categoryForm.setFieldValue('code', e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Display Order</label>
                    <InputNumber 
                      min={1}
                      className="w-full"
                      value={selectedCategoryDisplayOrder}
                      onChange={(value) => categoryForm.setFieldValue('display_order', value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                    <Select
                      value={(selectedCategoryStatus ?? true) ? 'active' : 'inactive'}
                      onChange={(value) => categoryForm.setFieldValue('is_active', value === 'active')}
                      className="w-full"
                    >
                      <Select.Option value="active">Active</Select.Option>
                      <Select.Option value="inactive">Inactive</Select.Option>
                    </Select>
                  </div>
                </div>

                {/* Image Section */}
                <div className="mt-6 space-y-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <FontAwesomeIcon icon={faImages} />
                    Category Image
                  </label>
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={handleOpenMediaPickerForCategory}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faImages} />
                      Select Image
                    </button>
                  </div>
                  {selectedCategoryIconId && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      <div className="relative group">
                        <img 
                          src={`${getApiBaseUrl()}/media/${selectedCategoryIconId}/view`}
                          alt="Category Image"
                          className="w-full h-24 object-cover rounded-md border-2 border-slate-200"
                        />
                        <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                          Primary
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryIconId(null)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-sm text-slate-500 flex items-start gap-2">
                    <span>Info</span>
                    <span>Recommended: Square image (1:1 ratio) for best display</span>
                  </p>
                </div>
              </Form>
            </div>

            {/* Footer - Sticky */}
            <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end gap-4 sticky bottom-0">
              <button
                type="button"
                onClick={handleCategoryModalClose}
                disabled={isSavingCategory}
                className="rounded-md border border-slate-600 px-6 py-2 text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => categoryForm.submit()}
                disabled={isSavingCategory}
                className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSavingCategory ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Modal */}
      {menuItemModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header - Sticky */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">
                {editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h3>
              <button
                onClick={handleMenuItemModalClose}
                className="flex h-10 w-10 items-center justify-center rounded-md text-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6">
              {/* Language Tabs */}
              <div className="mb-6 overflow-x-auto border-b border-slate-200 pb-0">
                <div className="flex w-max min-w-full gap-2 whitespace-nowrap pr-2">
                  {supportedLanguages.map(lang => {
                    const languageDisplay = getLanguageDisplay(lang);

                    return (
                      <button
                        key={lang}
                        onClick={() => setCurrentItemLocale(lang)}
                        className={`shrink-0 px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                          currentItemLocale === lang
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        {languageDisplay.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Form
                form={menuItemForm}
                layout="vertical"
                onFinish={handleMenuItemSubmit}
              >
                {/* Translation Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Item Name {currentItemLocale === 'vi' && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      placeholder="e.g., Iced Coffee"
                      value={itemTranslations[currentItemLocale]?.name || ''}
                      onChange={(e) => {
                        setItemTranslations(prev => ({
                          ...prev,
                          [currentItemLocale]: { ...prev[currentItemLocale], locale: currentItemLocale, name: e.target.value }
                        }));
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description (Optional)
                    </label>
                    <TextArea
                      rows={3}
                      placeholder="Enter a brief description..."
                      value={itemTranslations[currentItemLocale]?.description || ''}
                      onChange={(e) => {
                        setItemTranslations(prev => ({
                          ...prev,
                          [currentItemLocale]: { ...prev[currentItemLocale], locale: currentItemLocale, description: e.target.value }
                        }));
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Ingredients (Optional)
                    </label>
                    <TextArea
                      rows={2}
                      placeholder="e.g., Coffee, Milk, Sugar"
                      value={itemTranslations[currentItemLocale]?.ingredients || ''}
                      onChange={(e) => {
                        setItemTranslations(prev => ({
                          ...prev,
                          [currentItemLocale]: { ...prev[currentItemLocale], locale: currentItemLocale, ingredients: e.target.value }
                        }));
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Settings Section */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                    <Select 
                      placeholder="Select category"
                      value={menuItemState.category_id}
                      onChange={(value) => updateMenuItemField('category_id', value)}
                      className="w-full"
                    >
                      {categories.map((cat) => {
                        const catName = cat.translations.find(t => t.locale === 'vi')?.name || cat.code;
                        return (
                          <Select.Option key={cat.id} value={cat.id}>
                            {catName}
                          </Select.Option>
                        );
                      })}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Code (Internal)</label>
                    <Input
                      placeholder="e.g., ITEM-01"
                      value={menuItemState.code ?? ''}
                      onChange={(e) => updateMenuItemField('code', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Price (VND)</label>
                    <InputNumber 
                      min={0}
                      className="w-full"
                      value={menuItemState.price}
                      onChange={(value) => updateMenuItemField('price', value === null ? undefined : Number(value))}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => Number((value ?? '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Original Price (VND)</label>
                    <InputNumber 
                      min={0}
                      className="w-full"
                      value={menuItemState.original_price}
                      onChange={(value) => updateMenuItemField('original_price', value === null ? undefined : Number(value))}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => Number((value ?? '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                    <Select 
                      value={menuItemState.status ?? 'available'}
                      onChange={(value) => updateMenuItemField('status', value)}
                      className="w-full"
                    >
                      <Select.Option value="available">Available</Select.Option>
                      <Select.Option value="unavailable">Unavailable</Select.Option>
                      <Select.Option value="sold_out">Sold Out</Select.Option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Display Order</label>
                    <InputNumber 
                      min={1}
                      className="w-full"
                      value={menuItemState.display_order}
                      onChange={(value) => updateMenuItemField('display_order', value === null ? undefined : Number(value))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Calories (Optional)</label>
                    <InputNumber 
                      min={0}
                      className="w-full"
                      value={menuItemState.calories}
                      onChange={(value) => updateMenuItemField('calories', value === null ? undefined : Number(value))}
                    />
                  </div>

                  <div className="flex flex-row flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={menuItemState.is_bestseller ?? false}
                        onChange={(e) => updateMenuItemField('is_bestseller', e.target.checked)}
                      />
                      Bestseller
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={menuItemState.is_new ?? false}
                        onChange={(e) => updateMenuItemField('is_new', e.target.checked)}
                      />
                      New Item
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={menuItemState.is_seasonal ?? false}
                        onChange={(e) => updateMenuItemField('is_seasonal', e.target.checked)}
                      />
                      Seasonal
                    </label>
                  </div>
                </div>

                {/* Item Image Section */}
                <div className="mt-6 space-y-4">
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={handleOpenMediaPickerForMenuItem}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      <FontAwesomeIcon icon={faImages} />
                      Select Images
                    </button>
                  </div>
                  
                  {selectedImageIds.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {selectedImageIds.map((imageId, index) => {
                        const isPrimary = imageId === primaryImageId;
                        return (
                          <div key={imageId} className="relative group">
                            <img 
                              src={`${getApiBaseUrl()}/media/${imageId}/view`}
                              alt={`Dining ${index + 1}`}
                              className="w-full h-24 object-cover rounded-md border-2 border-slate-200"
                            />
                            {isPrimary && (
                              <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                                Primary
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => setPrimaryImageId(imageId)}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedImageIds(prev => prev.filter(id => id !== imageId));
                                  if (primaryImageId === imageId) {
                                    setPrimaryImageId(selectedImageIds.filter(id => id !== imageId)[0] || null);
                                  }
                                }}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Form>
            </div>

            {/* Footer - Sticky */}
            <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end gap-4 sticky bottom-0">
              <Button 
                onClick={handleMenuItemModalClose}
                disabled={isSavingMenuItem}
                className="rounded-md border border-slate-600 px-6 py-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => menuItemForm.submit()}
                disabled={isSavingMenuItem}
                className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSavingMenuItem ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerVisible}
        onClose={() => {
          setMediaPickerVisible(false);
          // Restore category modal if it was temporarily closed
          if (tempCategoryFormData) {
            setCategoryModalVisible(true);
            setTempCategoryFormData(null);
          }
          // Restore menu item modal if it was temporarily closed
          if (tempMenuItemFormData) {
            setMenuItemModalVisible(true);
            setTempMenuItemFormData(null);
          }
        }}
        onSelect={mediaPickerMode === 'category-icon' ? handleMediaSelect : undefined}
        onSelectMultiple={mediaPickerMode === 'item-image' ? handleMultipleMediaSelect : undefined}
        allowMultiple={mediaPickerMode === 'item-image'}
        title={mediaPickerMode === 'category-icon' ? 'Select Category Image' : 'Select Menu Item Images'}
        kind="image"
        source="restaurant"
        folder={mediaPickerMode === 'category-icon' ? 'menu/categories' : 'menu/items'}
      />
    </div>
  );
};

export default RestaurantMenu;




