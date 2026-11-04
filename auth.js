// Auth is handled by Supabase Auth. Browser code uses only the project's public key.
const config = window.SPIDER_HUB_CONFIG || {};
const message = document.querySelector('[data-auth-message]');
const form = document.querySelector('[data-auth-form]');
const submit = form?.querySelector('[type="submit"]');
const discordButton = document.querySelector('[data-discord-login]');
const dashboardUrl = new URL('/dashboard/', location.origin).href;
const loginUrl = new URL('/login/', location.origin).href;

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
    'Unsupported provider': 'Discord sign-in is not enabled yet. Please contact the site owner.'
  };
  return known[error?.message] || error?.message || 'Something went wrong. Please try again.';
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

    const callbackError = new URLSearchParams(location.search).get('error_description');
    if (callbackError) showMessage('Discord sign-in could not be completed. Please try again.');

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (session) {
      location.replace(dashboardUrl);
      return;
    }

    discordButton?.addEventListener('click', async () => {
      showMessage('Redirecting to Discord…');
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
      } catch (error) {
        showMessage(friendlyError(error));
        discordButton.disabled = false;
        if (submit) submit.disabled = false;
      }
    });

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
        if (discordButton) discordButton.disabled = false;
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
