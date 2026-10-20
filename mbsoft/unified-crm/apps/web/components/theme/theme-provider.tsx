"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "parchment" | "dark";

const THEME_KEY = "ucrm-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // 挂载时同步 SSR 防闪烁脚本已写入的 data-theme
  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (cur === "light" || cur === "parchment" || cur === "dark") {
      setThemeState(cur);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    const el = document.documentElement;
    el.setAttribute("data-theme", t);
    el.style.colorScheme = t === "dark" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* 忽略隐私模式写入失败 */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
