// Spider Hub homepage session redirect and shared legacy-brand cleanup.
// This rewrites only rendered branding; application code and public content remain intact.
const config = window.SPIDER_HUB_CONFIG || {};

function applySpiderWebsitesBranding(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest('script,style,noscript')) {
      node.nodeValue = node.nodeValue.replace(/lua[\s-]*secure/gi, 'Spider Websites');
    }
  }

  const elements = root.querySelectorAll ? [
    ...(root.matches?.('*') ? [root] : []),
    ...root.querySelectorAll('*')
  ] : [];
  for (const element of elements) {
    for (const attribute of ['alt', 'title', 'aria-label', 'content']) {
      const value = element.getAttribute?.(attribute);
      if (value && /lua[\s-]*secure/i.test(value)) {
        element.setAttribute(attribute, value.replace(/lua[\s-]*secure/gi, 'Spider Websites'));
      }
    }
    if (element instanceof HTMLImageElement && /(?:^|\/)logo\.webp(?:[?#].*)?$/i.test(element.getAttribute('src') || '')) {
      element.src = '/logo.svg';
    }
  }
  if (document.title && /lua[\s-]*secure/i.test(document.title)) {
    document.title = document.title.replace(/lua[\s-]*secure/gi, 'Spider Websites');
  }
}

applySpiderWebsitesBranding();
const brandingObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList') {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && !node.parentElement?.closest('script,style,noscript')) {
          node.nodeValue = node.nodeValue.replace(/lua[\s-]*secure/gi, 'Spider Websites');
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          applySpiderWebsitesBranding(node);
        }
      });
    } else if (record.type === 'attributes') {
      applySpiderWebsitesBranding(record.target);
    }
  }
});
brandingObserver.observe(document.documentElement, {
  subtree: true, childList: true, attributes: true,
  attributeFilter: ['alt', 'title', 'aria-label', 'content', 'src']
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
