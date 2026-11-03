import { HOME_SECTIONS } from './routes.js';

function showSection(behavior = 'auto') {
  const path = location.pathname.replace(/\/$/, '') || '/';
  const section = HOME_SECTIONS[path];
  if (section === 'top') window.scrollTo({ top: 0, behavior });
  else document.getElementById(section)?.scrollIntoView({ behavior, block: 'start' });
}

function migrateHash() {
  const oldSection = location.hash.slice(1);
  const path = Object.keys(HOME_SECTIONS).find(path => HOME_SECTIONS[path] === oldSection);
  if (path) history.replaceState(null, '', path + location.search);
}

document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || url.hash || !Object.hasOwn(HOME_SECTIONS, url.pathname)) return;
  event.preventDefault();
  if (location.pathname + location.search !== url.pathname + url.search) history.pushState(null, '', url.pathname + url.search);
  showSection(matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
});
addEventListener('popstate', () => showSection());
addEventListener('hashchange', () => { migrateHash(); showSection(); });
migrateHash();
requestAnimationFrame(() => showSection());
