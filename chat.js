/* Guild Lobby on the website.
   Reads the same 100-line ring buffer the ring polls (GET /antrom-afk/lobby/chat) and lets visitors post as guests
   (POST, no wallet: the server keys limits on the client IP and tags the line WEB). Loaded before app.js; it only
   touches the DOM once app.js calls Chat.init(), and only polls while the Online tab is showing. */

const Chat = (() => {
  const API = localStorage.getItem('guildstone.api') || 'https://dcl-firebase-backend.vercel.app';
  const POLL_MS = 8 * 1000;
  const NAME_KEY = 'guildstone.chat.name';
  const state = { messages: [], mine: new Set(), visible: false, timer: null, canPost: true, guestNumber: 0, loaded: false, sending: false, error: null };

  let log, form, nameInput, textInput, sendBtn, note;

  function hue(tag) {
    let h = 0;
    for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }
  const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayOf = (ts) => new Date(ts).toDateString();
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 40;

  function setNote(text, kind = '') {
    note.textContent = text || '';
    note.className = `chat-note${kind ? ` ${kind}` : ''}`;
  }

  function line(m) {
    const tag = m.web
      ? el('span', { class: 'ctag web', title: 'Posted from guildstone.dev' }, 'WEB')
      : m.tag ? el('span', { class: 'ctag', style: `--h:${hue(m.tag)}`, title: `Guild ${m.tag}` }, m.tag) : null;
    return el('div', { class: `cline${state.mine.has(m.id) ? ' mine' : ''}${m.web ? ' web' : ''}` },
      el('time', { datetime: new Date(m.at).toISOString(), title: new Date(m.at).toLocaleString() }, clock(m.at)),
      el('span', { class: 'cwho' }, tag, el('strong', null, m.name || 'Someone')),
      el('span', { class: 'ctext' }, m.text)
    );
  }

  function render() {
    if (!log) return;
    const stick = atBottom() || !state.loaded;
    if (!state.messages.length) {
      log.replaceChildren(el('div', { class: 'chat-empty' }, state.loaded ? 'Quiet in here. Say hello.' : el('span', { class: 'spin' })));
    } else {
      const nodes = [];
      let day = '';
      for (const m of state.messages) {
        const d = dayOf(m.at);
        if (d !== day) {
          day = d;
          nodes.push(el('div', { class: 'cday' }, d === dayOf(Date.now()) ? 'Today' : new Date(m.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })));
        }
        nodes.push(line(m));
      }
      log.replaceChildren(...nodes);
    }
    if (stick) log.scrollTop = log.scrollHeight;
    const off = !state.canPost;
    textInput.disabled = off;
    sendBtn.disabled = off || state.sending;
    textInput.placeholder = off ? 'Website chat is paused. Talk in the ring.' : 'Say something to the lobby…';
    if (!nameInput.value && state.guestNumber) nameInput.placeholder = `Guest ${state.guestNumber}`;
  }

  async function poll() {
    try {
      const res = await fetch(`${API}/antrom-afk/lobby/chat`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      state.messages = Array.isArray(data.messages) ? data.messages : [];
      state.canPost = data.canPost !== false;
      state.guestNumber = data.guestNumber || state.guestNumber;
      state.loaded = true;
      if (state.error) { state.error = null; setNote(''); }
      render();
    } catch (e) {
      state.error = e.message;
      if (!state.loaded) log.replaceChildren(el('div', { class: 'chat-empty' }, 'Could not reach the lobby. ', el('button', { class: 'chip', onclick: poll }, 'Try again')));
      else setNote(`Lost the lobby (${e.message}). Retrying.`, 'err');
    }
  }
  function schedule() {
    clearInterval(state.timer);
    state.timer = state.visible ? setInterval(poll, POLL_MS) : null;
    if (state.visible) poll();
  }

  async function send(e) {
    e.preventDefault();
    const text = textInput.value.replace(/\s+/g, ' ').trim();
    if (!text || state.sending) return;
    const name = nameInput.value.trim();
    state.sending = true;
    sendBtn.disabled = true;
    setNote('');
    try {
      const res = await fetch(`${API}/antrom-afk/lobby/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
      textInput.value = '';
      if (name) { try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode */ } }
      if (data.message) {
        state.mine.add(data.message.id);
        if (!state.messages.some((m) => m.id === data.message.id)) state.messages = [...state.messages, data.message].slice(-100);
        state.loaded = true;
        render();
        log.scrollTop = log.scrollHeight;
      }
      if (typeof data.left === 'number' && data.left <= 5) setNote(data.left ? `${data.left} line${data.left === 1 ? '' : 's'} left today.` : 'That was your last line for today.', 'warn');
    } catch (err) {
      setNote(err.message, 'err');
    } finally {
      state.sending = false;
      sendBtn.disabled = !state.canPost;
      textInput.focus();
    }
  }

  function init() {
    log = $('#chat-log'); form = $('#chat-form'); nameInput = $('#chat-name'); textInput = $('#chat-text'); sendBtn = $('#chat-form button'); note = $('#chat-note');
    if (!log) return;
    try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* private mode */ }
    form.addEventListener('submit', send);
    render();
  }
  function setVisible(visible) {
    if (visible === state.visible && (state.loaded || !visible)) return;
    state.visible = visible;
    schedule();
  }

  return { init, setVisible };
})();
