import { CONFIG } from './config.js';

const memoryStorage = new Map();
let cachedClient = null;
let cachedStorage = null;

function memoryStorageAdapter() {
  return {
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null;
    },
    setItem(key, value) {
      memoryStorage.set(String(key), String(value));
    },
    removeItem(key) {
      memoryStorage.delete(String(key));
    },
  };
}

function usableLocalStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = '__astromentor_supabase_storage_probe__';
    storage.setItem(probe, 'ok');
    storage.removeItem(probe);
    return storage;
  } catch (_error) {
    return null;
  }
}

function authStorage() {
  if (!cachedStorage) cachedStorage = usableLocalStorage() || memoryStorageAdapter();
  return cachedStorage;
}

function decodeJwtPayload(value) {
  try {
    const encoded = value.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = globalThis.atob
      ? globalThis.atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}

function validateConfiguration() {
  const url = String(CONFIG.supabaseUrl || '').trim();
  const key = String(CONFIG.supabasePublishableKey || '').trim();

  if (!url || !key) {
    return {
      ok: false,
      message: 'Supabase ainda não foi configurado: informe a URL HTTPS e a chave pública em assets/js/config.js.',
    };
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
      return {
        ok: false,
        message: 'A URL do Supabase deve usar HTTPS e não pode conter credenciais embutidas.',
      };
    }
    if (!parsedUrl.hostname) {
      return { ok: false, message: 'A URL do Supabase não é válida.' };
    }
  } catch (_error) {
    return { ok: false, message: 'A URL do Supabase não é válida.' };
  }

  if (/^(sb_secret_|service_role|supabase_admin)/i.test(key)) {
    return {
      ok: false,
      message: 'Chave secreta ou privilegiada rejeitada: use somente uma chave publishable/anon no navegador.',
    };
  }

  if (key.startsWith('sb_publishable_')) {
    if (key.length <= 'sb_publishable_'.length) {
      return { ok: false, message: 'A chave publishable do Supabase está incompleta.' };
    }
    return { ok: true, message: 'Supabase configurado.' };
  }

  const payload = decodeJwtPayload(key);
  if (payload && payload.role === 'anon') {
    return { ok: true, message: 'Supabase configurado com chave anon legada.' };
  }

  if (payload?.role || /^eyJ/i.test(key)) {
    return {
      ok: false,
      message: 'A chave JWT legada não é uma chave anon; chaves authenticated, service_role ou administrativas são rejeitadas no navegador.',
    };
  }

  return {
    ok: false,
    message: 'Chave Supabase inválida: use uma chave sb_publishable_ ou uma chave JWT legada com role anon.',
  };
}

function storageNamespace() {
  try {
    const project = new URL(CONFIG.supabaseUrl).hostname.replace(/[^a-z0-9]+/gi, '-');
    const sitePath = CONFIG.siteUrl
      ? new URL(CONFIG.siteUrl).pathname
      : new URL('../../', import.meta.url).pathname;
    const path = sitePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    return `astromentor-auth-${project}-${path || 'root'}`.slice(0, 180);
  } catch (_error) {
    return 'astromentor-auth';
  }
}

export function isConfigured() {
  return validateConfiguration().ok;
}

export function configurationMessage() {
  return validateConfiguration().message;
}

export function getClient() {
  if (!isConfigured()) throw new Error(configurationMessage());
  if (cachedClient) return cachedClient;

  const sdk = globalThis.supabase;
  if (!sdk || typeof sdk.createClient !== 'function') {
    throw new Error('O SDK local do Supabase não foi carregado. Inclua assets/vendor/supabase.js antes dos módulos da aplicação.');
  }

  cachedClient = sdk.createClient(CONFIG.supabaseUrl.trim(), CONFIG.supabasePublishableKey.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storage: authStorage(),
      storageKey: storageNamespace(),
    },
  });

  return cachedClient;
}
