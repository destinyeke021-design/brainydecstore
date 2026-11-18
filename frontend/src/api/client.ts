
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

const ACCESS = "bd_access";
const REFRESH = "bd_refresh";
const GUEST = "bd_guest_cart";

export const tokens = {
  get: () => localStorage.getItem(ACCESS),

  set: (a: string, r?: string) => {
    localStorage.setItem(ACCESS, a);
    if (r) localStorage.setItem(REFRESH, r);
  },

  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

api.interceptors.request.use((cfg) => {
  const t = tokens.get();

  if (t) {
    cfg.headers.Authorization = `Bearer ${t}`;
  }

  const g = localStorage.getItem(GUEST);

  if (g) {
    cfg.headers["X-Guest-Cart"] = g;
  }

  return cfg;
});

api.interceptors.response.use(
  (r) => {
    const g = r.headers["x-guest-cart"];

    if (g && !tokens.get()) {
      localStorage.setItem(GUEST, g);
    }

    return r;
  },
  async (err) => {
    const orig = err.config;
    const refresh = localStorage.getItem(REFRESH);

    if (err.response?.status === 401 && refresh && orig && !orig._retry) {
      orig._retry = true;

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          { refresh }
        );

        tokens.set(data.access, data.refresh);

        orig.headers.Authorization = `Bearer ${data.access}`;

        return api(orig);
      } catch {
        tokens.clear();
      }
    }

    return Promise.reject(err);
  }
);

export const clearGuestCart = () => localStorage.removeItem(GUEST);

export const errMsg = (e: any) => {
  const d = e?.response?.data;

  if (!d) return "Network error. Please try again.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;

  return Object.entries(d)
    .map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
    )
    .join(" · ");
};
