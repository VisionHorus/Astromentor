export const SIGNS = ['Áries','Touro','Gêmeos','Câncer','Leão','Virgem','Libra','Escorpião','Sagitário','Capricórnio','Aquário','Peixes'];
export const STEP_LABELS = ['Seu nome','Nascimento','Signo solar','Interesses','Preferências','Seu contexto','Seu acesso','Revisão'];
export function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year,month,day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day && year >= 1900 && value <= new Date().toLocaleDateString('en-CA');
}
export function solarSign(value) {
  if (!validBirthDate(value)) return '';
  const [,month,day] = value.split('-').map(Number);
  const md = month*100+day;
  if (md>=321&&md<=419) return 'Áries';
  if (md>=420&&md<=520) return 'Touro';
  if (md>=521&&md<=620) return 'Gêmeos';
  if (md>=621&&md<=722) return 'Câncer';
  if (md>=723&&md<=822) return 'Leão';
  if (md>=823&&md<=922) return 'Virgem';
  if (md>=923&&md<=1022) return 'Libra';
  if (md>=1023&&md<=1121) return 'Escorpião';
  if (md>=1122&&md<=1221) return 'Sagitário';
  if (md>=1222||md<=119) return 'Capricórnio';
  if (md>=120&&md<=218) return 'Aquário';
  return 'Peixes';
}
export function validateStep(step, values, {authenticated=false,password='',repeatPassword=''}={}) {
  const errors = {};
  if (step===0 && (values.full_name||'').trim().length<2) errors.full_name='Diga como podemos chamar você, com pelo menos 2 caracteres.';
  if (step===1) {
    if (!validBirthDate(values.birth_date)) errors.birth_date='Informe uma data válida, entre 1900 e hoje.';
    if (!(values.birth_city||'').trim()) errors.birth_city='Informe sua cidade de nascimento. Você também pode digitá-la manualmente.';
    if (!(values.birth_country||'').trim()) errors.birth_country='Informe o país em que você nasceu.';
    if (values.birth_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.birth_time)) errors.birth_time='Confira o horário, no formato hora e minuto.';
  }
  if (step===2 && !SIGNS.includes(values.solar_sign)) errors.solar_sign='Confirme seu signo solar na lista.';
  if (step===3 && !(values.interests||[]).length) errors.interests='Escolha ao menos um interesse. Você poderá mudar depois.';
  if (step===6) {
    if (!authenticated) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email||'')) errors.email='Confira seu e-mail para criar e recuperar o acesso.';
      if (password.length<8) errors.password='Use uma senha com pelo menos 8 caracteres.';
      if (password!==repeatPassword) errors.repeat_password='As senhas precisam ser iguais.';
    }
    if (values.whatsapp_consent && !/^\+?[1-9]\d{7,14}$/.test((values.whatsapp||'').replace(/[\s()\-]/g,''))) errors.whatsapp='Informe o número com código do país, por exemplo +55, ou desmarque o consentimento.';
  }
  if (step===7 && !values.privacy_consent) errors.privacy_consent='Precisamos da sua escolha explícita para salvar o perfil. Leia os textos antes de aceitar.';
  return errors;
}
const DRAFT_FIELDS = ['full_name','birth_date','birth_time','birth_city','birth_state','birth_country','solar_sign','interests','preferences','additional_info','email','whatsapp','privacy_consent','whatsapp_consent','birth_time_unknown'];
export function safeDraft(values) {
  const clean = {};
  for (const key of DRAFT_FIELDS) if (Object.hasOwn(values,key)) clean[key]=values[key];
  // Nunca copiar objetos arbitrários para o rascunho: senhas e tokens ficam fora.
  clean.preferences = Object.fromEntries(Object.entries(values.preferences||{}).filter(([key]) => !/password|senha|token|secret/i.test(key)));
  return clean;
}
export function draftKey() {
  const path = typeof location !== 'undefined' ? location.pathname.replace(/[^/]*$/, '') : '/';
  return `astromentor:draft:v1:${path}`;
}
export function loadDraft(storage, key, now=Date.now(), ttlDays=7) {
  try {
    const item = JSON.parse(storage.getItem(key)||'null');
    if (!item) return null;
    if (!item.savedAt || now-item.savedAt>ttlDays*86400000 || item.savedAt>now || item.version!==1) {storage.removeItem(key);return null;}
    return {values:safeDraft(item.values||{}),step:Math.max(0,Math.min(7,Number(item.step)||0))};
  } catch {return null;}
}
export function storeDraft(storage,key,values,step,now=Date.now()) {
  try {storage.setItem(key,JSON.stringify({version:1,savedAt:now,step,values:safeDraft(values)}));return true;} catch {return false;}
}

export function draftMatchesUser(values,user) {
  const draftEmail=String(values?.email||'').trim().toLowerCase();
  const userEmail=String(user?.email||'').trim().toLowerCase();
  return Boolean(draftEmail&&userEmail&&draftEmail===userEmail);
}
