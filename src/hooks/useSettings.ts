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

interface ServerSettings {
  sound_enabled?: boolean;
  music_enabled?: boolean;
  notification_enabled?: boolean;
  table_theme?: string;
  language?: string;
  auto_muck_losing_hand?: boolean;
  show_hand_strength?: boolean;
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

function fromServerSettings(server: ServerSettings): Settings {
  return {
    soundEnabled: server.sound_enabled ?? defaultSettings.soundEnabled,
    musicEnabled: server.music_enabled ?? defaultSettings.musicEnabled,
    notifications: server.notification_enabled ?? defaultSettings.notifications,
    theme: server.table_theme ?? defaultSettings.theme,
    language: server.language ?? defaultSettings.language,
    autoMuck: server.auto_muck_losing_hand ?? defaultSettings.autoMuck,
    showHandStrength: server.show_hand_strength ?? defaultSettings.showHandStrength,
    ...server,
  };
}

function toServerSettings(client: Partial<Settings>): Record<string, any> {
  const mapped: Record<string, any> = { ...client };
  if (client.soundEnabled !== undefined) mapped.sound_enabled = client.soundEnabled;
  if (client.musicEnabled !== undefined) mapped.music_enabled = client.musicEnabled;
  if (client.notifications !== undefined) mapped.notification_enabled = client.notifications;
  if (client.theme !== undefined) mapped.table_theme = client.theme;
  if (client.autoMuck !== undefined) mapped.auto_muck_losing_hand = client.autoMuck;
  if (client.showHandStrength !== undefined) mapped.show_hand_strength = client.showHandStrength;
  delete mapped.soundEnabled;
  delete mapped.musicEnabled;
  delete mapped.notifications;
  delete mapped.theme;
  delete mapped.autoMuck;
  delete mapped.showHandStrength;
  return mapped;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<ServerSettings>('/settings');
      setSettings({ ...defaultSettings, ...fromServerSettings(data) });
    } catch {
      // Use defaults on error
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const payload = toServerSettings(newSettings);
    const updated = await api.put<ServerSettings>('/settings', payload);
    const normalized = fromServerSettings(updated);
    setSettings((prev) => ({ ...prev, ...normalized }));
    return normalized;
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSettings };
}
