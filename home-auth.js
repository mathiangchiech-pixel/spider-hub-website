// Spider Hub homepage session redirect and precise navbar/Discord link updates.
const config = window.SPIDER_HUB_CONFIG || {};
const DISCORD_INVITE = 'https://discord.gg/dVUtXEGGf';

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

    const isDiscordCommunityButton = /^(join\s+discord|discord\s+updates|support|community)$/i.test(label);
    if (isDiscordLink || isDiscordCommunityButton) anchor.href = DISCORD_INVITE;
  }
}

updateBrandAndDiscordLinks();
const brandingObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList') {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) updateBrandAndDiscordLinks(node);
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
