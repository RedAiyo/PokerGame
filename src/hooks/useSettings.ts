import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface Settings {
  autoRebuy: boolean;
  showHandStrength: boolean;
  allowSpectators: boolean;
  hapticFeedback: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  highFrameRate: boolean;
  hideOnlineStatus: boolean;
  rejectStrangerMessages: boolean;
  hideMatchHistory: boolean;
  [key: string]: any;
}

interface ServerSettings {
  auto_rebuy?: boolean;
  show_hand_strength?: boolean;
  allow_spectators?: boolean;
  haptic_feedback?: boolean;
  master_volume?: number;
  sfx_volume?: number;
  music_volume?: number;
  high_frame_rate?: boolean;
  hide_online_status?: boolean;
  reject_stranger_messages?: boolean;
  hide_match_history?: boolean;
  [key: string]: any;
}

export const defaultSettings: Settings = {
  autoRebuy: false,
  showHandStrength: true,
  allowSpectators: true,
  hapticFeedback: true,
  masterVolume: 80,
  sfxVolume: 80,
  musicVolume: 50,
  highFrameRate: false,
  hideOnlineStatus: false,
  rejectStrangerMessages: false,
  hideMatchHistory: false,
};

function fromServerSettings(server: ServerSettings): Settings {
  return {
    autoRebuy: server.auto_rebuy ?? defaultSettings.autoRebuy,
    showHandStrength: server.show_hand_strength ?? defaultSettings.showHandStrength,
    allowSpectators: server.allow_spectators ?? defaultSettings.allowSpectators,
    hapticFeedback: server.haptic_feedback ?? defaultSettings.hapticFeedback,
    masterVolume: server.master_volume ?? defaultSettings.masterVolume,
    sfxVolume: server.sfx_volume ?? defaultSettings.sfxVolume,
    musicVolume: server.music_volume ?? defaultSettings.musicVolume,
    highFrameRate: server.high_frame_rate ?? defaultSettings.highFrameRate,
    hideOnlineStatus: server.hide_online_status ?? defaultSettings.hideOnlineStatus,
    rejectStrangerMessages: server.reject_stranger_messages ?? defaultSettings.rejectStrangerMessages,
    hideMatchHistory: server.hide_match_history ?? defaultSettings.hideMatchHistory,
    ...server,
  };
}

function toServerSettings(client: Partial<Settings>): Record<string, any> {
  const mapped: Record<string, any> = { ...client };
  if (client.autoRebuy !== undefined) mapped.auto_rebuy = client.autoRebuy;
  if (client.showHandStrength !== undefined) mapped.show_hand_strength = client.showHandStrength;
  if (client.allowSpectators !== undefined) mapped.allow_spectators = client.allowSpectators;
  if (client.hapticFeedback !== undefined) mapped.haptic_feedback = client.hapticFeedback;
  if (client.masterVolume !== undefined) mapped.master_volume = client.masterVolume;
  if (client.sfxVolume !== undefined) mapped.sfx_volume = client.sfxVolume;
  if (client.musicVolume !== undefined) mapped.music_volume = client.musicVolume;
  if (client.highFrameRate !== undefined) mapped.high_frame_rate = client.highFrameRate;
  if (client.hideOnlineStatus !== undefined) mapped.hide_online_status = client.hideOnlineStatus;
  if (client.rejectStrangerMessages !== undefined) mapped.reject_stranger_messages = client.rejectStrangerMessages;
  if (client.hideMatchHistory !== undefined) mapped.hide_match_history = client.hideMatchHistory;

  delete mapped.autoRebuy;
  delete mapped.showHandStrength;
  delete mapped.allowSpectators;
  delete mapped.hapticFeedback;
  delete mapped.masterVolume;
  delete mapped.sfxVolume;
  delete mapped.musicVolume;
  delete mapped.highFrameRate;
  delete mapped.hideOnlineStatus;
  delete mapped.rejectStrangerMessages;
  delete mapped.hideMatchHistory;

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
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));

    try {
      const payload = toServerSettings(newSettings);
      const updated = await api.put<ServerSettings>('/settings', payload);
      const normalized = { ...defaultSettings, ...fromServerSettings(updated) };
      setSettings(normalized);
      return normalized;
    } catch (error) {
      await fetchSettings();
      throw error;
    }
  }, [fetchSettings]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSettings, fetchSettings };
}
