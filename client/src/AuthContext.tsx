import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken, type User } from "./api";
import { dictionaries, type Dict, type Lang } from "./i18n";

interface AuthState {
  user: User | null;
  loading: boolean;
  lang: Lang;
  t: Dict;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    language: Lang
  ) => Promise<void>;
  logout: () => void;
  setLanguage: (language: Lang) => Promise<void>;
  setUiLang: (language: Lang) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiLang, setUiLang] = useState<Lang>("en");

  const lang: Lang = user?.language ?? uiLang;
  const t = dictionaries[lang];

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => {
        setUser(user);
        setUiLang(user.language);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    setUiLang(user.language);
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      language: Lang
    ) => {
      const { token, user } = await api.register({
        email,
        password,
        displayName,
        language,
      });
      setToken(token);
      setUser(user);
      setUiLang(user.language);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const setLanguage = useCallback(async (language: Lang) => {
    const { user } = await api.setLanguage(language);
    setUser(user);
    setUiLang(user.language);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user } = await api.me();
    setUser(user);
    setUiLang(user.language);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      lang,
      t,
      login,
      register,
      logout,
      setLanguage,
      setUiLang,
      refreshUser,
    }),
    [
      user,
      loading,
      lang,
      t,
      login,
      register,
      logout,
      setLanguage,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
