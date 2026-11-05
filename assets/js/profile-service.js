import { getClient } from './supabase-client.js';

const SOLAR_SIGNS = [
  'Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem',
  'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes',
];

const PREFERENCE_KEYS = new Set([
  'horoscope_enabled', 'horoscope_focus', 'dream_style', 'movies_enabled',
  'movie_genres', 'series_genres', 'movie_dislikes', 'series_dislikes',
  'favorite_movies', 'favorite_series', 'disliked_movies', 'disliked_series',
  'content_tone', 'morning_mood', 'routine', 'content_types',
]);

const PREFERENCE_ARRAY_KEYS = new Set([
  'horoscope_focus', 'movie_genres', 'series_genres', 'content_types',
]);

const PREFERENCE_BOOLEAN_KEYS = new Set(['horoscope_enabled', 'movies_enabled']);
const PREFERENCE_ENUMS = {
  dream_style: ['Simbólica', 'Psicológica', 'Mista'],
  content_tone: ['Reflexivo', 'Direto', 'Acolhedor', 'Motivacional'],
  morning_mood: ['Tranquilo', 'Animado', 'Cansado', 'Estressado', 'Varia bastante'],
};
const PREFERENCE_ARRAY_ENUMS = {
  horoscope_focus: ['Geral', 'Amor', 'Carreira', 'Amizade', 'Autoconhecimento'],
  movie_genres: ['Ação', 'Comédia', 'Drama', 'Ficção científica', 'Fantasia', 'Suspense', 'Animação', 'Documentário', 'Romance'],
  series_genres: ['Ação', 'Comédia', 'Drama', 'Ficção científica', 'Fantasia', 'Suspense', 'Animação', 'Documentário', 'Romance'],
  content_types: ['Reflexões', 'Personalidade e signos', 'Relacionamentos', 'Cinema e séries', 'Sonhos'],
};
const LONG_PREFERENCE_KEYS = new Set([
  'movie_dislikes', 'series_dislikes', 'favorite_movies', 'favorite_series',
  'disliked_movies', 'disliked_series', 'routine',
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value, field, max, min = 1) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`Informe ${field}.`);
  if (result.length < min) throw new Error(`${field} é muito curto.`);
  if (result.length > max) throw new Error(`${field} excede o tamanho permitido.`);
  return result;
}

function optionalText(value, field, max) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  if (!result) return null;
  if (result.length > max) throw new Error(`${field} excede o tamanho permitido.`);
  return result;
}

function normalizeDate(value) {
  const result = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Informe uma data de nascimento válida.');
  const parsed = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error('Informe uma data de nascimento válida.');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (result < '1900-01-01') throw new Error('A data de nascimento deve ser a partir de 01/01/1900.');
  if (result > today) throw new Error('A data de nascimento não pode estar no futuro.');
  return result;
}

function normalizeTime(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const result = String(value).trim().toLowerCase();
  if (result === 'não sei' || result === 'nao sei') return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(result);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) {
    throw new Error('Informe um horário de nascimento válido ou deixe-o em branco.');
  }
  return `${match[1]}:${match[2]}${match[3] ? `:${match[3]}` : ''}`;
}

function normalizeStringArray(value, field, maxItems, maxLength, allowedValues = null) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${field} deve ser uma lista.`);
  if (value.length > maxItems) throw new Error(`${field} tem itens demais.`);
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const normalized = String(item ?? '').trim();
    if (!normalized) continue;
    if (normalized.length > maxLength) throw new Error(`${field} tem um item muito longo.`);
    if (allowedValues && !allowedValues.includes(normalized)) {
      throw new Error(`${field} contém uma opção inválida.`);
    }
    const identity = normalized.toLocaleLowerCase('pt-BR');
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(normalized);
    }
  }
  return result;
}

function jsonByteLength(value) {
  const serialized = JSON.stringify(value);
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(serialized).length;
  return serialized.length;
}

function normalizePreferences(input) {
  if (input === null || input === undefined) return {};
  if (!isRecord(input)) throw new Error('As preferências devem ser um objeto.');

  const result = {};
  for (const [key, rawValue] of Object.entries(input)) {
    // Descartar chaves desconhecidas impede guardar campos arbitrários ou secretos.
    if (!PREFERENCE_KEYS.has(key)) continue;
    if (PREFERENCE_BOOLEAN_KEYS.has(key)) {
      if (typeof rawValue !== 'boolean') throw new Error('Uma preferência booleana é inválida.');
      result[key] = rawValue;
      continue;
    }
    if (PREFERENCE_ARRAY_KEYS.has(key)) {
      result[key] = normalizeStringArray(
        rawValue,
        'Uma preferência de lista',
        20,
        80,
        PREFERENCE_ARRAY_ENUMS[key] || null,
      );
      continue;
    }

    const value = optionalText(rawValue, 'Uma preferência', LONG_PREFERENCE_KEYS.has(key) ? 1000 : 60);
    if (value === null) continue;
    if (PREFERENCE_ENUMS[key] && !PREFERENCE_ENUMS[key].includes(value)) {
      throw new Error('Uma preferência contém uma opção inválida.');
    }
    result[key] = value;
  }

  if (jsonByteLength(result) > 12000) throw new Error('As preferências excedem o limite permitido.');
  return result;
}

function normalizeWhatsapp(value) {
  const raw = optionalText(value, 'o WhatsApp', 40);
  if (raw === null) return null;
  if (!/^[+0-9() .-]+$/.test(raw)) throw new Error('Informe um WhatsApp válido.');
  const digits = raw.replace(/\D/g, '');
  if (!/^[1-9]\d{0,14}$/.test(digits)) throw new Error('Informe um WhatsApp válido.');
  return `+${digits}`;
}

function requireBoolean(input, key, label) {
  if (!hasOwn(input, key) || typeof input[key] !== 'boolean') {
    throw new Error(`Informe explicitamente ${label}.`);
  }
  return input[key];
}

export function validateProfile(input) {
  if (!isRecord(input)) throw new Error('Os dados do perfil são inválidos.');

  const privacyConsent = requireBoolean(input, 'privacy_consent', 'o consentimento de privacidade');
  const whatsappConsent = requireBoolean(input, 'whatsapp_consent', 'o consentimento de WhatsApp');
  if (!privacyConsent) throw new Error('O consentimento de privacidade é obrigatório para salvar o perfil.');
  // Sem consentimento, o número nunca chega ao payload persistido, mesmo que o formulário o contenha.
  const whatsapp = whatsappConsent ? normalizeWhatsapp(input.whatsapp) : null;
  if (whatsappConsent && (!privacyConsent || !whatsapp)) {
    throw new Error('O consentimento de WhatsApp exige privacidade autorizada e um WhatsApp válido.');
  }

  const solarSign = String(input.solar_sign ?? '').trim();
  if (!SOLAR_SIGNS.includes(solarSign)) throw new Error('Escolha um signo solar válido.');

  return {
    full_name: requiredText(input.full_name, 'seu nome completo', 120, 2),
    birth_date: normalizeDate(input.birth_date),
    birth_time: normalizeTime(input.birth_time),
    birth_city: requiredText(input.birth_city, 'sua cidade de nascimento', 120),
    birth_state: optionalText(input.birth_state, 'o estado de nascimento', 120),
    birth_country: requiredText(input.birth_country, 'seu país de nascimento', 120),
    solar_sign: solarSign,
    interests: normalizeStringArray(input.interests, 'Seus interesses', 30, 80),
    preferences: normalizePreferences(input.preferences),
    additional_info: optionalText(input.additional_info, 'a informação adicional', 2000),
    whatsapp,
    privacy_consent: privacyConsent,
    whatsapp_consent: whatsappConsent,
  };
}

async function authenticatedUser() {
  const client = getClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error('Não foi possível verificar sua sessão. Entre novamente para continuar.');
  if (!data?.user?.id) throw new Error('Você precisa entrar para acessar seu perfil.');
  return data.user;
}

function profileOperationError() {
  return new Error('Não foi possível concluir a operação do perfil agora. Tente novamente.');
}

export async function getMyProfile() {
  const client = getClient();
  const user = await authenticatedUser();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw profileOperationError();
  return data || null;
}

export async function saveMyProfile(input) {
  const payload = validateProfile(input);
  const client = getClient();
  const user = await authenticatedUser();
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw new Error('Não foi possível confirmar o e-mail da sessão.');

  // user_id e email vêm de getUser verificado; nunca são aceitos do objeto do formulário.
  const row = { ...payload, user_id: user.id, email };
  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error || !data) throw profileOperationError();
  return data;
}

export async function deleteMyProfile() {
  const client = getClient();
  const user = await authenticatedUser();
  const { error } = await client.from('profiles').delete().eq('user_id', user.id);
  if (error) throw profileOperationError();
}
