import { getClient, isConfigured } from './supabase-client.js';

function siteBaseUrl() {
  try {
    // auth-service.js está em site/assets/js; dois níveis chegam à raiz publicável site/.
    return new URL('../../', import.meta.url);
  } catch (_error) {
    const documentUrl = globalThis.document?.URL || globalThis.location?.href || 'https://localhost/';
    return new URL('./', documentUrl);
  }
}

function fixedRedirect(fileName) {
  return new URL(`./${fileName}`, siteBaseUrl()).toString();
}

function cleanEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  if (!value || !value.includes('@')) throw new Error('Informe um e-mail válido.');
  return value;
}

function cleanFullName(fullName) {
  return String(fullName ?? '').trim().slice(0, 120);
}

function clientOrThrow() {
  return getClient();
}

export async function currentUser() {
  if (!isConfigured()) return null;
  const client = clientOrThrow();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session) return null;

  // getSession apenas lê a sessão local; getUser verifica o usuário no servidor.
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}

export async function signUp(email, password, fullName = '') {
  const client = clientOrThrow();
  const options = {
    emailRedirectTo: fixedRedirect('entrar.html'),
  };
  const normalizedName = cleanFullName(fullName);
  if (normalizedName) options.data = { full_name: normalizedName };

  const { data, error } = await client.auth.signUp({
    email: cleanEmail(email),
    password,
    options,
  });
  if (error) throw error;
  return {
    user: data?.user || null,
    session: data?.session || null,
  };
}

export async function signIn(email, password) {
  const client = clientOrThrow();
  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail(email),
    password,
  });
  if (error) throw error;
  if (!data?.user) throw new Error('Não foi possível iniciar a sessão.');
  return data.user;
}

export async function signOut() {
  const client = clientOrThrow();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const client = clientOrThrow();
  const { error } = await client.auth.resetPasswordForEmail(cleanEmail(email), {
    redirectTo: fixedRedirect('recuperar-senha.html'),
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const client = clientOrThrow();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export function onAuthChange(callback) {
  if (typeof callback !== 'function') throw new Error('Informe uma função para acompanhar a sessão.');
  const client = clientOrThrow();
  const { data, error } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  if (error) throw error;
  const subscription = data?.subscription;
  return () => subscription?.unsubscribe?.();
}

export function friendlyError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('supabase') || message.includes('sdk local') || message.includes('publishable') || message.includes('service_role')) {
    return 'A integração de autenticação ainda não está disponível. Tente novamente mais tarde.';
  }
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
    return 'E-mail ou senha não conferem.';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'Não foi possível criar a conta com esses dados. Se já possui cadastro, tente entrar.';
  }
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
    return 'Confirme seu e-mail pelo link recebido antes de entrar.';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('at least'))) {
    return 'Escolha uma senha mais forte, conforme os requisitos exibidos no formulário.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to')) {
    return 'Não foi possível conectar ao serviço agora. Verifique sua conexão e tente novamente.';
  }
  if (message.includes('session') && message.includes('missing')) {
    return 'Sua sessão não está disponível. Entre novamente para continuar.';
  }
  if (message.includes('email')) {
    return 'Não foi possível processar esse e-mail. Confira o endereço e tente novamente.';
  }
  return 'Não foi possível concluir a operação agora. Tente novamente em instantes.';
}
