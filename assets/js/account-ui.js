import {isConfigured,configurationMessage} from './supabase-client.js';
import {currentUser,signOut,friendlyError,onAuthChange} from './auth-service.js';
import {getMyProfile,saveMyProfile,deleteMyProfile} from './profile-service.js';
import {draftKey} from './form-core.js';
const notice=document.querySelector('[data-account-notice]');
const content=document.querySelector('[data-account-content]');
const configNotice=document.querySelector('[data-config-notice]');
let profile=null,busy=false;
function message(text,kind='error'){notice.textContent=text;notice.dataset.kind=kind;}
function actionLink(text,href){const link=document.createElement('a');link.href=href;link.className='text-link';link.textContent=text;notice.append(document.createElement('br'),link);}
function render(){
  const dl=document.querySelector('[data-account-review]');dl.replaceChildren();
  const p=profile;
  const preferenceLabels={horoscope_enabled:'Interesse em reflexões diárias',horoscope_focus:'Focos',dream_style:'Sonhos',movies_enabled:'Interesse em filmes/séries',movie_genres:'Gêneros de filmes',series_genres:'Gêneros de séries',movie_dislikes:'Gêneros de filmes evitados',series_dislikes:'Gêneros de séries evitados',favorite_movies:'Filmes favoritos',favorite_series:'Séries favoritas',disliked_movies:'Filmes que não gostou',disliked_series:'Séries que não gostou',content_tone:'Tom',morning_mood:'Início do dia',routine:'Rotina',content_types:'Conteúdos'};
  const rows=[['Nome',p.full_name],['E-mail',p.email],['Nascimento',p.birth_date?.split('-').reverse().join('/')],['Horário',p.birth_time||'Não informado'],['Local',[p.birth_city,p.birth_state,p.birth_country].filter(Boolean).join(', ')],['Signo solar',p.solar_sign],['Interesses',(p.interests||[]).join(', ')],...Object.entries(p.preferences||{}).map(([key,val])=>[preferenceLabels[key]||key,Array.isArray(val)?val.join(', '):typeof val==='boolean'?val?'Sim':'Não':val]),['Informação adicional',p.additional_info||'Não informada'],['WhatsApp',p.whatsapp||'Não informado'],['Consentimento de perfil',p.privacy_consent?'Autorizado':'Não autorizado'],['Consentimento WhatsApp',p.whatsapp_consent?'Autorizado':'Não autorizado']];
  for(const [label,text]of rows){const row=document.createElement('div');row.className='review-row';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text||'Sem preferência';row.append(dt,dd);dl.append(row);}
  document.querySelector('[data-consent-status]').textContent=p.whatsapp_consent?'Seu consentimento opcional de WhatsApp está registrado. Não há envio ativo nesta versão.':'Você não autorizou mensagens por WhatsApp.';
  document.querySelector('[data-revoke-whatsapp]').disabled=!p.whatsapp_consent;
  content.hidden=false;
}
async function initialize(){
  if(!isConfigured()){configNotice.textContent=configurationMessage();message('Conexão ainda não configurada. Nenhum perfil pessoal foi carregado.','info');actionLink('Voltar ao início','./index.html');document.querySelector('[data-signout]').disabled=true;return;}
  try{
    const user=await currentUser();
    if(!user){message('Entre para acessar os dados do seu perfil.','info');actionLink('Entrar na minha conta','./entrar.html');return;}
    profile=await getMyProfile();
    if(!profile){message('Seu acesso está autenticado, mas ainda não há um perfil salvo para esta conta.','info');actionLink('Preencher ou retomar meu perfil','./criar-perfil.html?retomar=1');return;}
    render();message('Seu perfil foi carregado com acesso autenticado.','success');
    onAuthChange((event)=>{if(event==='SIGNED_OUT'){profile=null;content.hidden=true;message('Sessão encerrada. Entre novamente para consultar seus dados.','info');actionLink('Entrar','./entrar.html');}});
  }catch(error){message(friendlyError(error));const button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.textContent='Tentar novamente';button.addEventListener('click',initialize);notice.append(document.createElement('br'),button);}
}
document.querySelector('[data-signout]').addEventListener('click',async event=>{
  if(busy)return;busy=true;event.target.disabled=true;
  try{await signOut();try{localStorage.removeItem(draftKey());}catch{}profile=null;content.hidden=true;location.assign(new URL('./entrar.html',location.href));}
  catch(error){message(friendlyError(error));}
  finally{busy=false;event.target.disabled=false;}
});
document.querySelector('[data-revoke-whatsapp]').addEventListener('click',async event=>{
  if(busy||!profile)return;busy=true;event.target.disabled=true;
  try{profile=await saveMyProfile({...profile,whatsapp_consent:false,whatsapp:null});render();message('Consentimento de WhatsApp revogado e número removido do perfil.','success');}
  catch(error){message(friendlyError(error));}
  finally{busy=false;event.target.disabled=!profile?.whatsapp_consent;}
});
document.querySelector('[data-export-profile]').addEventListener('click',()=>{
  if(!profile)return;const blob=new Blob([JSON.stringify(profile,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='meu-perfil-astromentor.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Arquivo do seu perfil preparado para download. Guarde-o com cuidado: contém dados pessoais.','info');
});
document.querySelector('[data-delete-profile]').addEventListener('click',async event=>{
  if(busy||!profile||!confirm('Excluir os dados do seu perfil do Supabase? Esta ação não pode ser desfeita. Sua conta de acesso continuará existindo.'))return;
  busy=true;event.target.disabled=true;
  try{await deleteMyProfile();try{localStorage.removeItem(draftKey());}catch{}profile=null;content.hidden=true;message('Dados do perfil excluídos. Sua conta de autenticação ainda existe; solicite a exclusão completa ao responsável pelo serviço.','success');actionLink('Voltar ao início','./index.html');}
  catch(error){message(friendlyError(error));}
  finally{busy=false;event.target.disabled=false;}
});
initialize();
