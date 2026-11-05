import {CONFIG} from './config.js';
import {isConfigured,configurationMessage,getClient} from './supabase-client.js';
import {currentUser,signIn,requestPasswordReset,updatePassword,onAuthChange,friendlyError} from './auth-service.js';
import {loadDraft,draftKey,draftMatchesUser} from './form-core.js';
const configNotice=document.querySelector('[data-config-notice]');
const notice=document.querySelector('[data-auth-notice]');
const login=document.querySelector('#login-form');
const requestForm=document.querySelector('#reset-request-form');
const passwordForm=document.querySelector('#reset-password-form');
const params=new URLSearchParams(location.search);
let storage=null,busy=false,recoveryReady=false;
try{storage=localStorage;}catch{}
if(!isConfigured()){configNotice.textContent=configurationMessage();configNotice.dataset.kind='info';}
function show(text,kind='error'){notice.textContent=text;notice.dataset.kind=kind;}
function fieldError(name,text){const e=document.getElementById(`${name}-error`);if(e)e.textContent=text;const input=document.getElementById(name);if(input){input.setAttribute('aria-invalid','true');input.focus();}}
function resetErrors(form){form.querySelectorAll('.field-error').forEach(e=>e.textContent='');form.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));}
function emailValid(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function setBusy(form,value){busy=value;form.querySelector('button[type=submit]').disabled=value;form.setAttribute('aria-busy',String(value));}
function resumeTarget(user){
  const draft=storage?loadDraft(storage,draftKey(),Date.now(),CONFIG.draftTtlDays||7):null;
  const matching=draft&&draftMatchesUser(draft.values,user);
  return matching||params.has('retomar')?'./criar-perfil.html?retomar=1':'./conta.html';
}
login?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;resetErrors(login);
  const email=login.elements.namedItem('login_email').value.trim(),password=login.elements.namedItem('login_password').value;
  if(!emailValid(email)){fieldError('login_email','Confira o endereço de e-mail.');return;}
  if(!password){fieldError('login_password','Informe sua senha.');return;}
  if(!isConfigured()){show(configurationMessage());return;}
  setBusy(login,true);show('Verificando seu acesso…','info');
  try{const user=await signIn(email,password);login.elements.namedItem('login_password').value='';location.assign(new URL(resumeTarget(user),location.href));}
  catch(error){show(friendlyError(error));}
  finally{setBusy(login,false);}
});
requestForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;resetErrors(requestForm);
  const email=requestForm.elements.namedItem('reset_email').value.trim();
  if(!emailValid(email)){fieldError('reset_email','Confira o endereço de e-mail.');return;}
  if(!isConfigured()){show(configurationMessage());return;}
  setBusy(requestForm,true);
  try{await requestPasswordReset(email);show('Se o endereço puder receber um link, você receberá as instruções conforme a configuração de e-mail do Supabase. Verifique também a pasta de spam.','success');}
  catch(error){show(friendlyError(error));}
  finally{setBusy(requestForm,false);}
});
passwordForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;resetErrors(passwordForm);
  const password=passwordForm.elements.namedItem('new_password').value,repeat=passwordForm.elements.namedItem('new_password_repeat').value;
  if(password.length<8){fieldError('new_password','Use pelo menos 8 caracteres.');return;}
  if(password!==repeat){fieldError('new_password_repeat','As senhas precisam ser iguais.');return;}
  if(!recoveryReady){show('Abra o link de recuperação enviado ao seu e-mail antes de alterar a senha.');return;}
  setBusy(passwordForm,true);
  try{await updatePassword(password);passwordForm.reset();show('Sua nova senha foi salva. Você pode entrar novamente.','success');passwordForm.hidden=true;}
  catch(error){show(friendlyError(error));}
  finally{setBusy(passwordForm,false);}
});
function showRecovery(){
  recoveryReady=true;requestForm.hidden=true;passwordForm.hidden=false;document.querySelector('[data-reset-title]').textContent='Defina uma nova senha';show('Link de recuperação validado. Escolha uma nova senha.','info');
}
async function initialize(){
  if(!isConfigured())return;
  const initialHash=new URLSearchParams(location.hash.slice(1));
  if(initialHash.has('error')||params.has('error')){show('Este link não pôde ser validado. Solicite um novo link ou tente entrar novamente.');history.replaceState(null,'',location.pathname);}
  if(passwordForm){
    // O SDK detecta a sessão no fragmento e informa o evento, sem copiar tokens para logs.
    onAuthChange((event)=>{if(event==='PASSWORD_RECOVERY')showRecovery();});
    if(initialHash.get('type')==='recovery'){
      try{const client=getClient();const {data,error}=await client.auth.getSession();if(!error&&data.session&&await currentUser())showRecovery();}catch{show('O link expirou ou não pôde ser validado. Solicite outro.');}
    }
  }
  if(login){
    try{const user=await currentUser();if(user){show('Seu acesso está autenticado. Continue para seu perfil.','success');const a=document.createElement('a');a.className='btn btn-primary';a.href=resumeTarget(user);a.textContent='Continuar para meu perfil';notice.append(document.createElement('br'),a);}}
    catch(error){show(friendlyError(error));}
  }
}
initialize();
