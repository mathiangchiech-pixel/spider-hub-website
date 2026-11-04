// Auth is handled by Supabase Auth. Browser code uses only the project's public key.
const config = window.SPIDER_HUB_CONFIG || {};
const message = document.querySelector('[data-auth-message]');
const form = document.querySelector('[data-auth-form]');
const submit = form?.querySelector('[type="submit"]');
const discordButton = document.querySelector('[data-discord-login]');
const dashboardUrl = new URL('/dashboard/', window.location.origin).toString();
const loginUrl = new URL('/login/', window.location.origin).toString();
let discordRedirectStarted = false;

function showMessage(text, success = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('success', success);
}

function friendlyError(error) {
  const known = {
    'Invalid login credentials': 'The email or password is incorrect.',
    'User already registered': 'An account already exists for this email. Try signing in instead.',
    'Email not confirmed': 'Please confirm your email using the link we sent you.',
    'Unsupported provider': 'Discord sign-in is not enabled in Supabase Auth yet. Please contact the site owner.',
    'Provider is not enabled': 'Discord sign-in is not enabled in Supabase Auth yet. Please contact the site owner.'
  };
  return known[error?.message] || 'Something went wrong. Please try again.';
}

function readOAuthError() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('error_description') || params.get('error') ||
    hash.get('error_description') || hash.get('error');
}

async function start() {
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    showMessage('Supabase is not configured. Check config.js and add your project URL and publishable key.');
    if (submit) submit.disabled = true;
    if (discordButton) discordButton.disabled = true;
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });

    if (readOAuthError()) {
      showMessage('Discord sign-in was not completed. Please try again or use email and password.');
      history.replaceState(null, '', location.pathname);
    }

    // Supabase processes the OAuth callback and stores the authenticated session.
    // If the callback lands on an auth page, continue to the protected dashboard.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (session) {
      location.replace(dashboardUrl);
      return;
    }

    discordButton?.addEventListener('click', async () => {
      if (discordRedirectStarted) return;
      discordRedirectStarted = true;
      showMessage('Redirecting to Discord…', true);
      discordButton.disabled = true;
      if (submit) submit.disabled = true;
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: dashboardUrl,
            scopes: 'identify email',
            queryParams: { prompt: 'consent' }
          }
        });
        if (error) throw error;
        // On success Supabase navigates to Discord. If it did not, restore the
        // controls so the user can retry instead of leaving a stuck button.
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') {
            discordRedirectStarted = false;
            discordButton.disabled = false;
            if (submit) submit.disabled = false;
            showMessage('Discord did not open. Check your connection and try again.');
          }
        }, 5000);
      } catch (error) {
        discordRedirectStarted = false;
        showMessage(friendlyError(error));
        discordButton.disabled = false;
        if (submit) submit.disabled = false;
      }
    }, { once: true });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      showMessage('');
      if (!form.reportValidity()) return;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      submit.disabled = true;
      if (discordButton) discordButton.disabled = true;
      submit.textContent = form.dataset.mode === 'signup' ? 'Creating account…' : 'Signing in…';

      try {
        if (form.dataset.mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: dashboardUrl }
          });
          if (error) throw error;
          if (data.session) {
            location.replace(dashboardUrl);
            return;
          }
          showMessage('Check your inbox for the confirmation link to finish creating your Spider Websites account.', true);
          form.reset();
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          location.replace(dashboardUrl);
          return;
        }
      } catch (error) {
        showMessage(friendlyError(error));
      } finally {
        submit.disabled = false;
        if (discordButton && !discordRedirectStarted) discordButton.disabled = false;
        submit.textContent = form.dataset.mode === 'signup' ? 'Create account' : 'Sign in';
      }
    });
  } catch (error) {
    showMessage(`Could not connect to Supabase. ${friendlyError(error)}`);
    if (submit) submit.disabled = true;
    if (discordButton) discordButton.disabled = true;
  }
}

start();
