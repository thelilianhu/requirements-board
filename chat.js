// 看板对话抽屉：调用 Vercel 后端 /api/chat，配置存在浏览器本地
(function () {
  const KEY = 'req.board.chat';
  const cfg = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  };
  const save = (v) => localStorage.setItem(KEY, JSON.stringify(v));
  const history = [];

  const btn = document.createElement('button');
  btn.className = 'chat-fab';
  btn.textContent = '💬 对话';
  document.body.appendChild(btn);

  const drawer = document.createElement('div');
  drawer.className = 'chat-drawer';
  drawer.innerHTML = `
    <div class="chat-head"><strong>需求助手</strong><button class="chat-close" aria-label="关闭">×</button></div>
    <div class="chat-settings">
      <input class="chat-endpoint" placeholder="后端地址，如 https://xxx.vercel.app">
      <input class="chat-token" placeholder="访问口令">
      <button class="chat-save">保存</button>
    </div>
    <div class="chat-log"></div>
    <form class="chat-send">
      <input class="chat-input" placeholder="问点需求相关的问题…" autocomplete="off">
      <button type="submit">发送</button>
    </form>`;
  document.body.appendChild(drawer);

  const log = drawer.querySelector('.chat-log');
  const endpoint = drawer.querySelector('.chat-endpoint');
  const token = drawer.querySelector('.chat-token');
  const saved = cfg();
  endpoint.value = saved.endpoint || '';
  token.value = saved.token || '';
  drawer.querySelector('.chat-save').onclick = () => {
    save({ endpoint: endpoint.value.trim().replace(/\/$/, ''), token: token.value.trim() });
    render('已保存配置');
  };

  function render(text) {
    if (text) {
      const p = document.createElement('p');
      p.className = 'chat-system';
      p.textContent = text;
      log.appendChild(p);
    }
    log.scrollTop = log.scrollHeight;
  }

  drawer.querySelector('.chat-close').onclick = () => drawer.classList.remove('open');
  btn.onclick = () => {
    drawer.classList.toggle('open');
    if (!cfg().endpoint) render('先在下面填后端地址和访问口令。');
  };

  drawer.querySelector('.chat-send').onsubmit = async (event) => {
    event.preventDefault();
    const input = drawer.querySelector('.chat-input');
    const text = input.value.trim();
    const { endpoint: base, token: pass } = cfg();
    if (!text) return;
    if (!base || !pass) return render('请先保存后端地址和访问口令。');
    input.value = '';
    history.push({ role: 'user', content: text });
    render(`你：${text}`);
    try {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: pass, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) return render(`调用失败（${res.status}）：${data.error || ''}`);
      history.push({ role: 'assistant', content: data.reply || '' });
      render(`助手：${data.reply || '（空回复）'}`);
    } catch (error) {
      render('网络错误，检查后端地址是否可访问。');
    }
  };
})();
