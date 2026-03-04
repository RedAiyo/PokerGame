import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

interface Settings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  notifications: boolean;
  theme: string;
  language: string;
  autoMuck: boolean;
  showHandStrength: boolean;
  [key: string]: any;
}

const defaultSettings: Settings = {
  soundEnabled: true,
  musicEnabled: true,
  notifications: true,
  theme: 'dark',
  language: 'zh-CN',
  autoMuck: true,
  showHandStrength: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Settings>('/settings');
      setSettings({ ...defaultSettings, ...data });
    } catch {
      // Use defaults on error
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updated = await api.put<Settings>('/settings', newSettings);
    setSettings((prev) => ({ ...prev, ...updated }));
    return updated;
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSettings };
}
