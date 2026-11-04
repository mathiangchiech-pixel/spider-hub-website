// Spider Websites homepage copy, navbar branding, Discord invite links, and session redirect.
const config = window.SPIDER_HUB_CONFIG || {};
const DISCORD_INVITE = 'https://discord.gg/dVUtXEGGf';

function updateHomepageCopy() {
  if (location.pathname !== '/') return;

  const heading = document.querySelector('.hero h1');
  const description = document.querySelector('.hero .lede');
  const actions = document.querySelector('.hero .hero-cta');
  if (!heading || !description || !actions) return;

  heading.textContent = 'Welcome to Spider Websites';
  description.textContent = 'Your home for premium scripts, secure license management and powerful tools. Join our community to stay updated!';

  const discord = document.createElement('a');
  discord.className = 'btn btn-primary btn-lg';
  discord.href = DISCORD_INVITE;
  discord.target = '_blank';
  discord.rel = 'noopener noreferrer';
  discord.textContent = 'Join Our Discord';

  const plans = document.createElement('a');
  plans.className = 'btn btn-ghost btn-lg';
  plans.href = '/pricing';
  plans.textContent = 'Explore Plans';

  actions.replaceChildren(discord, plans);

  let note = document.querySelector('[data-community-note]');
  if (!note) {
    note = document.createElement('p');
    note.dataset.communityNote = '';
    note.style.cssText = 'margin-top:14px;color:var(--ink-3);font-size:13px';
    actions.insertAdjacentElement('afterend', note);
  }
  note.textContent = 'Get updates, announcements, support and news in our Discord community.';
}

function updateBrandAndDiscordLinks(root = document) {
  const brand = document.querySelector('.nav .logo b');
  if (brand) {
    const name = brand.firstChild;
    if (name?.nodeType === Node.TEXT_NODE) name.nodeValue = 'Spider';
    else brand.insertBefore(document.createTextNode('Spider'), brand.firstChild);
    let suffix = brand.querySelector('span');
    if (!suffix) {
      suffix = document.createElement('span');
      brand.append(suffix);
    }
    suffix.textContent = ' Web';
  }

  const anchors = root.querySelectorAll ? [
    ...(root instanceof HTMLAnchorElement ? [root] : []),
    ...root.querySelectorAll('a[href]')
  ] : [];
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    const label = (anchor.textContent || '').trim();
    let isDiscordLink = false;
    try {
      const target = new URL(href, location.href);
      isDiscordLink = /(^|\.)discord\.gg$/i.test(target.hostname) ||
        (/discord\.com$/i.test(target.hostname) && /\/invite\//i.test(target.pathname));
    } catch { /* Leave invalid and non-Discord URLs untouched. */ }

    const isDiscordCommunityButton = /^(join\s+(our\s+)?discord|discord\s+updates|support|community)$/i.test(label);
    if (isDiscordLink || isDiscordCommunityButton) {
      anchor.href = DISCORD_INVITE;
      if (anchor === document.querySelector('.hero .hero-cta a')) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    }
  }
}

function updateHomepage() {
  updateHomepageCopy();
  updateBrandAndDiscordLinks();
}

updateHomepage();
const brandingObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList') {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          updateHomepageCopy();
          updateBrandAndDiscordLinks(node);
        }
      });
    } else if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
      updateBrandAndDiscordLinks(record.target);
    }
  }
});
brandingObserver.observe(document.documentElement, {
  subtree: true, childList: true, attributes: true, attributeFilter: ['href']
});

// Signed-in visitors are sent to their dashboard; public pages remain accessible.
if (location.pathname === '/' && config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    const redirect = session => { if (session) location.replace('/dashboard/'); };
    const { data, error } = await client.auth.getSession();
    if (!error) redirect(data.session);
    client.auth.onAuthStateChange((_event, session) => redirect(session));
  } catch { /* A failed session check must not hide the public site. */ }
}
