const outputs = document.querySelectorAll('[data-service-status]');
async function check() {
  outputs.forEach(el => { el.textContent = 'Checking web service…'; });
  try {
    const response = await fetch('/healthz', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok || (await response.json()).ok !== true) throw new Error();
    outputs.forEach(el => { el.textContent = 'Web service responding'; el.dataset.state = 'ok'; });
  } catch {
    outputs.forEach(el => { el.textContent = 'Web service check unavailable'; el.dataset.state = 'unknown'; });
  }
  const time = document.querySelector('[data-status-time]');
  if (time) time.textContent = 'Last checked ' + new Date().toLocaleString();
}
if (outputs.length) void check();
document.querySelector('[data-status-refresh]')?.addEventListener('click', check);
