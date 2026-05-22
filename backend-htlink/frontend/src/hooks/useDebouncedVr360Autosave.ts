import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import type { RestaurantVR360SectionSettings } from '../services/restaurantApi';

interface UseDebouncedVr360AutosaveOptions {
  delayMs?: number;
  onSave: (settings: RestaurantVR360SectionSettings) => Promise<void>;
  onSuccessMessage?: string;
  onErrorMessage?: string;
  getErrorMessage?: (error: unknown) => string | null | undefined;
}

interface UseDebouncedVr360AutosaveResult {
  saving: boolean;
  scheduleSave: (settings: RestaurantVR360SectionSettings) => void;
}

export const useDebouncedVr360Autosave = ({
  delayMs = 1500,
  onSave,
  onSuccessMessage = 'VR360 settings saved',
  onErrorMessage = 'Failed to save VR360 settings',
  getErrorMessage,
}: UseDebouncedVr360AutosaveOptions): UseDebouncedVr360AutosaveResult => {
  const timeoutRef = useRef<number | null>(null);
  const saveRequestIdRef = useRef(0);
  const [saving, setSaving] = useState(false);

  const scheduleSave = useCallback((settings: RestaurantVR360SectionSettings) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      const requestId = ++saveRequestIdRef.current;

      void (async () => {
        try {
          setSaving(true);
          await onSave(settings);
          if (requestId === saveRequestIdRef.current) {
            toast.success(onSuccessMessage);
          }
        } catch (error) {
          if (requestId === saveRequestIdRef.current) {
            const detail = getErrorMessage?.(error);
            toast.error(detail || onErrorMessage);
          }
        } finally {
          if (requestId === saveRequestIdRef.current) {
            setSaving(false);
          }
        }
      })();
    }, delayMs);
  }, [delayMs, getErrorMessage, onErrorMessage, onSave, onSuccessMessage]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    saving,
    scheduleSave,
  };
};
