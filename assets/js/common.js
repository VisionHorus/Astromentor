import { CONFIG } from './config.js';
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-mobile-menu]');
function closeMenu() {
  if (!menu || !menuButton) return;
  menu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Abrir menu');
  document.body.classList.remove('menu-open');
}
menuButton?.addEventListener('click',() => {
  if (!menu) return;
  const opening=menu.hidden;
  menu.hidden=!opening;menuButton.setAttribute('aria-expanded',String(opening));menuButton.setAttribute('aria-label',opening?'Fechar menu':'Abrir menu');
  document.body.classList.toggle('menu-open',opening);
  if (opening) menu.querySelector('a')?.focus();
});
menu?.addEventListener('click',event => {if(event.target.closest('a')) closeMenu();});
document.addEventListener('keydown',event => {
  if (!menu || menu.hidden) return;
  if (event.key==='Escape') {closeMenu();menuButton.focus();}
  if (event.key==='Tab') {
    const targets=[menuButton,...menu.querySelectorAll('a,button')].filter(e=>!e.hidden);
    const first=targets[0],last=targets.at(-1);
    if (event.shiftKey&&document.activeElement===first) {event.preventDefault();last.focus();}
    else if (!event.shiftKey&&document.activeElement===last) {event.preventDefault();first.focus();}
  }
});
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (motion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{threshold:.08});
  document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
}
const selector=document.querySelector('[data-reflection-select]');
const quote=document.querySelector('[data-reflection-text]');
selector?.addEventListener('change',()=>{
  const text=document.querySelector(`[data-reflection-index="${selector.selectedIndex}"]`);
  if(text&&quote) quote.textContent=text.content.textContent;
});
if (CONFIG.legalContact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONFIG.legalContact)) {
  document.querySelectorAll('[data-contact]').forEach(element=>{
    const link=document.createElement('a');link.href=`mailto:${CONFIG.legalContact}`;link.textContent=CONFIG.legalContact;element.replaceChildren(link);
  });
}
if (CONFIG.controllerName) document.querySelectorAll('[data-controller]').forEach(e=>{e.textContent=CONFIG.controllerName;});
