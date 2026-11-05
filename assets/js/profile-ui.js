import {CONFIG} from './config.js';
import {isConfigured,configurationMessage} from './supabase-client.js';
import {currentUser,signUp,friendlyError} from './auth-service.js';
import {getMyProfile,saveMyProfile,validateProfile} from './profile-service.js';
import {STEP_LABELS,solarSign,validateStep,loadDraft,storeDraft,draftKey,draftMatchesUser} from './form-core.js';
const form=document.querySelector('#profile-form');
const panes=[...form.querySelectorAll('[data-step]')];
const next=form.querySelector('[data-next]');
const back=form.querySelector('[data-back]');
const notice=document.querySelector('[data-form-notice]');
const configNotice=document.querySelector('[data-config-notice]');
const key=draftKey();
let storage=null;
try{storage=window.localStorage;}catch{/* Continuar sem rascunho quando o navegador bloquear armazenamento. */}
let step=0,user=null,busy=false,signWasEdited=false,initialized=false;
const fields=[...form.querySelectorAll('input,select,textarea')].filter(e=>e.name&&e.name!=='website'&&e.type!=='password');
function message(text,kind='error'){notice.textContent=text;notice.dataset.kind=kind;}
function values(){
  const result={preferences:{}};
  const arrayNames=new Set(['interests','horoscope_focus','movie_genres','series_genres','content_types']);
  for(const e of fields){
    const target=e.hasAttribute('data-pref')?result.preferences:result;
    if(arrayNames.has(e.name)){
      target[e.name]??=[];
      if(e.checked)target[e.name].push(e.value);
    }else target[e.name]=e.type==='checkbox'?e.checked:e.value.trim();
  }
  if(result.birth_time_unknown)result.birth_time=null;
  if(!result.whatsapp_consent)result.whatsapp=null;
  if(user)result.email=user.email;
  return result;
}
function fill(data){
  for(const e of fields){
    const source=e.hasAttribute('data-pref')?data.preferences||{}:data;
    if(source[e.name]===undefined)continue;
    if(e.type==='checkbox')e.checked=Array.isArray(source[e.name])?source[e.name].includes(e.value):source[e.name]===true;
    else e.value=source[e.name]??'';
    if(e.type==='time'&&e.value)e.value=e.value.slice(0,5);
  }
  signWasEdited=Boolean(data.solar_sign);
  syncConditional();
}
function syncConditional(){
  const unknown=form.elements.namedItem('birth_time_unknown').checked;
  const time=form.elements.namedItem('birth_time');time.disabled=unknown;if(unknown)time.value='';
  document.querySelector('[data-whatsapp-field]').hidden=!form.elements.namedItem('whatsapp_consent').checked;
  const authFields=document.querySelector('[data-auth-fields]');
  const authUser=document.querySelector('[data-auth-user]');
  authFields.hidden=Boolean(user);authUser.hidden=!user;
  if(user)authUser.textContent=`Acesso autenticado: ${user.email}. O perfil será vinculado somente a esta conta.`;
}
function saveDraft(){
  if(!initialized||busy)return;
  const saved=storage&&storeDraft(storage,key,values(),step);
  form.querySelector('[data-draft-status]').textContent=saved?'Rascunho salvo neste navegador. Sem senha. Expira em até 7 dias.':'Armazenamento indisponível. Mantenha esta página aberta para não perder o preenchimento.';
}
function clearErrors(){
  form.querySelectorAll('.field-error').forEach(e=>e.textContent='');
  form.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));
}
function showErrors(errors,{focus=false}={}){
  for(const [name,text] of Object.entries(errors)){
    const error=document.getElementById(`${name}-error`);if(error)error.textContent=text;
    const control=document.getElementById(name);if(control)control.setAttribute('aria-invalid','true');
  }
  if(focus){const first=Object.keys(errors)[0];document.getElementById(first)?.focus();}
}
function validation(index){return validateStep(index,values(),{authenticated:Boolean(user),password:form.elements.namedItem('password').value,repeatPassword:form.elements.namedItem('repeat_password').value});}
function go(index,{focus=true}={}){
  step=Math.max(0,Math.min(7,index));clearErrors();
  panes.forEach((pane,i)=>{pane.hidden=i!==step;pane.classList.toggle('active',i===step);});
  form.querySelector('[data-step-label]').textContent=STEP_LABELS[step];
  form.querySelector('[data-step-count]').textContent=`Etapa ${step+1} de 8`;
  form.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(step+1));
  form.querySelector('[data-progress]').style.width=`${(step+1)/8*100}%`;
  back.hidden=step===0;
  next.textContent=step===7?'Salvar meu perfil ↗':'Continuar →';
  if(step===7)renderReview();
  if(focus){panes[step].querySelector('h2')?.focus({preventScroll:true});panes[step].scrollIntoView({block:'nearest',behavior:'auto'});}
  saveDraft();
}
const displayRows=data=>[
  ['Nome',data.full_name],['Nascimento',data.birth_date?data.birth_date.split('-').reverse().join('/'):''],['Horário',data.birth_time||'Não informado'],['Local',[data.birth_city,data.birth_state,data.birth_country].filter(Boolean).join(', ')],['Signo solar',data.solar_sign],['Interesses',(data.interests||[]).join(', ')],['Tom',data.preferences?.content_tone||'Sem preferência'],['Conteúdos',(data.preferences?.content_types||[]).join(', ')||'Sem preferência'],['Reflexões diárias',data.preferences?.horoscope_enabled?'Interesse registrado':'Sem interesse registrado'],['Cinema e séries',data.preferences?.movies_enabled?'Interesse registrado':'Sem interesse registrado'],['Rotina',data.preferences?.routine||'Não informada'],['Informação adicional',data.additional_info||'Não informada'],['E-mail',data.email||''],['WhatsApp',data.whatsapp_consent?`${data.whatsapp||'Número a informar'} — autorização opcional`:'Não autorizado']
];
function renderReview(){
  const dl=form.querySelector('[data-review]');dl.replaceChildren();
  for(const [label,text] of displayRows(values())){
    const row=document.createElement('div');row.className='review-row';
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text||'Não informado';row.append(dt,dd);dl.append(row);
  }
}
function showFinish({saved=false,confirmation=false}={}){
  form.querySelector('[data-wizard]').hidden=true;
  const panel=form.querySelector('[data-success]');panel.hidden=false;panel.replaceChildren();
  const icon=document.createElement('div');icon.className='success-mark';icon.textContent= saved?'✓':'↗';icon.setAttribute('aria-hidden','true');
  const heading=document.createElement('h2');heading.tabIndex=-1;heading.textContent=saved?'Seu perfil foi salvo.':'Confira seu e-mail.';
  const text=document.createElement('p');text.textContent=saved?'Suas informações foram gravadas no Supabase e vinculadas à sua conta. Você pode revisar seus dados na área pessoal. IA e WhatsApp ainda não estão integrados.':'Se o cadastro puder ser realizado, o Supabase enviará um link de confirmação conforme a configuração de e-mail. Seu perfil ainda não foi salvo no banco. Depois de confirmar, entre e retome o rascunho neste navegador para revisar e salvar.';
  const link=document.createElement('a');link.className='btn btn-primary';link.href=saved?'./conta.html':'./entrar.html?retomar=1';link.textContent=saved?'Ver meu perfil':'Entrar e retomar';
  const small=document.createElement('p');small.className='field-help';small.textContent=confirmation?'O rascunho temporário não contém sua senha. Se estiver em outro navegador, será preciso preencher novamente.':'Nenhuma mensagem automática ou cobrança é ativada por este cadastro.';
  const image=document.createElement('img');image.src='./assets/images/brand-icon.png';image.width=56;image.height=56;image.alt='Personagem Astromentor na confirmação do perfil';image.style.borderRadius='50%';image.style.marginBottom='var(--s5)';
  panel.append(image,icon,heading,text,link,small);heading.focus();
}
form.addEventListener('input',event=>{
  if(event.target.name==='solar_sign')signWasEdited=true;
  if(event.target.name==='birth_date'&&!signWasEdited)form.elements.namedItem('solar_sign').value=solarSign(event.target.value);
  if(event.target.type==='password')return;
  saveDraft();
  const errors=validation(step),name=event.target.name,error=document.getElementById(`${name}-error`);
  if(error&&error.textContent){error.textContent=errors[name]||'';if(!errors[name])event.target.removeAttribute('aria-invalid');}
});
form.addEventListener('change',event=>{
  if(event.target.name==='birth_date'&&!signWasEdited)form.elements.namedItem('solar_sign').value=solarSign(event.target.value);
  syncConditional();saveDraft();
});
form.addEventListener('focusout',event=>{
  if(event.target.matches('input,select,textarea')){
    const error=validation(step)[event.target.name];if(error)showErrors({[event.target.name]:error});
  }
});
back.addEventListener('click',()=>{if(!busy){message('','info');go(step-1);}});
form.querySelector('[data-clear-draft]').addEventListener('click',()=>{
  if(busy||!confirm('Limpar o rascunho deste navegador? Os dados já salvos no Supabase não serão apagados.'))return;
  try{storage?.removeItem(key);}catch{}
  form.reset();signWasEdited=false;syncConditional();go(0);saveDraft();message('Rascunho limpo. Nenhum dado já salvo no banco foi alterado.','info');
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!initialized)return;clearErrors();message('','info');
  const errors=validation(step);if(Object.keys(errors).length){showErrors(errors,{focus:true});return;}
  if(step<7){go(step+1);return;}
  for(let i=0;i<8;i++){const errors=validation(i);if(Object.keys(errors).length){go(i);showErrors(errors,{focus:true});return;}}
  if(form.elements.namedItem('website').value){message('Não foi possível enviar. Recarregue e tente novamente.');return;}
  if(!isConfigured()){message(configurationMessage());return;}
  let payload;
  try{payload=validateProfile(values());}catch{message('Confira os campos do perfil: uma opção ou limite não é válido.');return;}
  saveDraft();busy=true;next.disabled=true;back.disabled=true;next.textContent='Salvando…';form.setAttribute('aria-busy','true');
  let accountCreated=false;
  try{
    if(!user){
      const result=await signUp(values().email,form.elements.namedItem('password').value,values().full_name);
      form.elements.namedItem('password').value='';form.elements.namedItem('repeat_password').value='';
      if(!result.session){
        if(storage)storeDraft(storage,key,values(),7);
        history.replaceState(null,'',new URL('./criar-perfil.html?confirmacao=1',location.href));
        showFinish({confirmation:true});return;
      }
      user=await currentUser();accountCreated=true;syncConditional();
    }
    if(!user)throw new Error('Sessão não disponível');
    await saveMyProfile(payload);
    try{storage?.removeItem(key);}catch{}
    history.replaceState(null,'',new URL('./criar-perfil.html?confirmacao=1',location.href));
    showFinish({saved:true});
  }catch(error){message(accountCreated?'Seu acesso foi criado, mas o perfil não pôde ser salvo. Seus dados continuam no rascunho; tente salvar novamente depois de conferir a configuração do banco.':friendlyError(error));}
  finally{busy=false;next.disabled=false;back.disabled=false;next.textContent='Salvar meu perfil ↗';form.removeAttribute('aria-busy');}
});
let cities;
form.querySelector('[data-city-search]').addEventListener('click',async event=>{
  const query=form.elements.namedItem('birth_city').value.trim();const container=form.querySelector('[data-city-results]');container.replaceChildren();
  if(query.length<2){container.textContent='Digite pelo menos 2 caracteres para buscar. Você também pode preencher manualmente.';return;}
  event.target.disabled=true;
  try{
    if(!cities){const response=await fetch(new URL('./cities-br.json',import.meta.url));if(!response.ok)throw new Error();cities=await response.json();}
    const normalize=text=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const matches=cities.filter(city=>normalize(city.name).includes(normalize(query))).slice(0,8);
    if(!matches.length)container.textContent='Não encontramos essa cidade no catálogo local. Informe cidade, estado e país manualmente.';
    for(const city of matches){
      const button=document.createElement('button');button.type='button';button.className='city-choice';button.textContent=`${city.name} — ${city.state}, ${city.country}`;
      button.addEventListener('click',()=>{form.elements.namedItem('birth_city').value=city.name;form.elements.namedItem('birth_state').value=city.state;form.elements.namedItem('birth_country').value=city.country;container.replaceChildren();container.textContent='Local selecionado. Você pode ajustar os campos.';saveDraft();});container.append(button);
    }
  }catch{container.textContent='A lista local não está disponível. Você pode preencher os campos manualmente.';}
  finally{event.target.disabled=false;}
});
async function initialize(){
  form.elements.namedItem('birth_country').setAttribute('list','countries-list');
  const date=form.elements.namedItem('birth_date');date.min='1900-01-01';date.max=new Date().toISOString().slice(0,10);
  const draft=storage?loadDraft(storage,key,Date.now(),CONFIG.draftTtlDays||7):null;
  const editing=new URLSearchParams(location.search).has('editar');
  if(!isConfigured()){configNotice.textContent=configurationMessage();configNotice.dataset.kind='info';}
  next.disabled=true;
  try{
    if(isConfigured())user=await currentUser();
    // Verificar pertencimento ANTES de expor dados locais na interface autenticada.
    if(user&&editing){
      const existing=await getMyProfile();
      form.reset();signWasEdited=false;step=0;
      if(existing)fill(existing);
    }else if(draft){
      if(user&&!draftMatchesUser(draft.values,user)){
        try{storage?.removeItem(key);}catch{}
        form.reset();signWasEdited=false;step=0;
        message('O rascunho anterior não foi identificado como desta conta e não foi carregado. Preencha apenas seus próprios dados.','info');
      }else{fill(draft.values);step=draft.step;}
    }
    syncConditional();
  }catch(error){message(friendlyError(error));}
  finally{next.disabled=false;}
  initialized=true;go(step,{focus:false});
}
initialize();
