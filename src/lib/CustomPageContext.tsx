import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';
import { CustomPageConfig } from '../types';

interface CustomPageContextType {
  pages: Record<string, CustomPageConfig>;
  getPageConfig: (pageKey: string) => CustomPageConfig | undefined;
  refresh: () => Promise<void>;
  /** Locally apply a just-saved config without waiting on a refetch. */
  setPageConfigLocally: (pageKey: string, config: CustomPageConfig) => void;
}

const CustomPageContext = createContext<CustomPageContextType | undefined>(undefined);

export const CustomPageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pages, setPages] = useState<Record<string, CustomPageConfig>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await apiRequest<Record<string, CustomPageConfig>>('/public/custom-pages');
      if (res.success && res.data) {
        setPages(res.data);
      }
    } catch (err) {
      // Silent — the site just renders with stock pages if this fails
      console.error('[CustomPageContext] Failed to load page overrides:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPageConfig = useCallback((pageKey: string) => pages[pageKey], [pages]);

  const setPageConfigLocally = useCallback((pageKey: string, config: CustomPageConfig) => {
    setPages(prev => ({ ...prev, [pageKey]: config }));
  }, []);

  return (
    <CustomPageContext.Provider value={{ pages, getPageConfig, refresh, setPageConfigLocally }}>
      {children}
    </CustomPageContext.Provider>
  );
};

export const useCustomPages = (): CustomPageContextType => {
  const context = useContext(CustomPageContext);
  if (!context) {
    throw new Error('useCustomPages must be used within a CustomPageProvider');
  }
  return context;
};
