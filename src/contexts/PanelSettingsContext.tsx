import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PanelSettings {
  showVisualization: boolean;
  showOpenedItems: boolean;
}

interface PanelSettingsContextType {
  settings: PanelSettings;
  setSettings: (settings: PanelSettings) => void;
  togglePanel: (panel: keyof PanelSettings) => void;
}

const PanelSettingsContext = createContext<PanelSettingsContextType | undefined>(undefined);

export const PanelSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<PanelSettings>({
    showVisualization: false,
    showOpenedItems: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await invoke<{ show_visualization: boolean; show_opened_items: boolean }>('get_panel_settings');
        setSettings({
          showVisualization: savedSettings.show_visualization,
          showOpenedItems: savedSettings.show_opened_items,
        });
      } catch (err) {
        console.error('Failed to load panel settings:', err);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (newSettings: PanelSettings) => {
    try {
      await invoke('set_panel_settings', {
        settings: {
          show_visualization: newSettings.showVisualization,
          show_opened_items: newSettings.showOpenedItems,
        },
      });
    } catch (err) {
      console.error('Failed to save panel settings:', err);
    }
  };

  const updateSettings = (newSettings: PanelSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const togglePanel = (panel: keyof PanelSettings) => {
    const newSettings = { ...settings, [panel]: !settings[panel] };
    updateSettings(newSettings);
  };

  return (
    <PanelSettingsContext.Provider value={{ settings, setSettings: updateSettings, togglePanel }}>
      {children}
    </PanelSettingsContext.Provider>
  );
};

export const usePanelSettings = () => {
  const context = useContext(PanelSettingsContext);
  if (!context) {
    throw new Error('usePanelSettings must be used within PanelSettingsProvider');
  }
  return context;
};

