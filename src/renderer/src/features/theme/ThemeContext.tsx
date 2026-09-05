import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  theme: Theme;
  fontSize: number;
  setPreference: (preference: ThemePreference) => void;
  setFontSize: (fontSize: number) => void;
}

const THEME_STORAGE_KEY = "drawspace-theme";
const FONT_SIZE_STORAGE_KEY = "drawspace-font-size";
const DEFAULT_FONT_SIZE = 100;
const MIN_FONT_SIZE = 80;
const MAX_FONT_SIZE = 130;
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPreference(): ThemePreference {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "light" || savedTheme === "dark" || savedTheme === "system" ? savedTheme : "system";
}

function getStoredFontSize(): number {
  const savedFontSize = Number(localStorage.getItem(FONT_SIZE_STORAGE_KEY));
  return Number.isInteger(savedFontSize) && savedFontSize >= MIN_FONT_SIZE && savedFontSize <= MAX_FONT_SIZE
    ? savedFontSize
    : DEFAULT_FONT_SIZE;
}

/** 提供应用主题，并让外层界面与 Excalidraw 使用同一套主题状态。 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const [fontSize, setFontSizeState] = useState<number>(getStoredFontSize);
  const theme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(fontSize / 100));
  }, [fontSize]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const setPreference = (nextPreference: ThemePreference): void => {
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  };

  const setFontSize = (nextFontSize: number): void => {
    const normalizedFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(nextFontSize)));
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(normalizedFontSize));
    setFontSizeState(normalizedFontSize);
  };

  const value = useMemo(
    () => ({ preference, theme, fontSize, setPreference, setFontSize }),
    [fontSize, preference, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取当前主题，供设置页和编辑器共享。 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
