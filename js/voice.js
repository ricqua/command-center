(function() {
  const BACKEND = 'http://localhost:5050';

  const micBtn       = document.getElementById('mic-btn');
  const waveformBars = document.querySelectorAll('.wave-bar');
  const chatHistory  = document.getElementById('chat-history');
  const chatInput    = document.getElementById('chat-input');
  const chatSendBtn  = document.getElementById('chat-send-btn');

  let usingElevenLabs  = null;
  let analyserRaf      = null;
  const conversationHistory = [];

  // ── Chat history ──
  function addMessage(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg chat-msg-${role}`;

    const label = document.createElement('div');
    label.className = 'chat-msg-label';
    label.textContent = role === 'user' ? 'YOU' : 'NIGHTFALL';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    chatHistory.appendChild(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return bubble;
  }

  // ── Waveform ──
  function setWave(active, color) {
    waveformBars.forEach(b => {
      b.style.background = color || 'var(--cyan-dim)';
      if (active) b.classList.add('active');
      else { b.classList.remove('active'); b.style.height = '4px'; }
    });
  }

  // ── State management ──
  function setState(state) {
    micBtn.classList.remove('active', 'speaking');
    if (state === 'listening') {
      micBtn.classList.add('active');
      setWave(true, 'var(--red)');
    } else if (state === 'speaking') {
      micBtn.classList.add('speaking');
      setWave(true, 'var(--green)');
    } else {
      setWave(false);
    }
    if (window.plasmaSetState) window.plasmaSetState(state);
  }

  // ── Browser TTS fallback ──
  let voices = [];
  let browserTtsFallbackRaf = null;

  function loadVoices() { voices = speechSynthesis.getVoices(); }
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  function pickVoice() {
    const preferred = ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex'];
    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) return match;
    }
    return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }

  function startBrowserTtsFallback() {
    if (!window.plasmaSetAmplitude) return;
    let t = 0;
    function tick() {
      window.plasmaSetAmplitude(0.3 + Math.sin(t * 0.08) * 0.25);
      t++;
      browserTtsFallbackRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopBrowserTtsFallback() {
    if (browserTtsFallbackRaf) { cancelAnimationFrame(browserTtsFallbackRaf); browserTtsFallbackRaf = null; }
    if (window.plasmaSetAmplitude) window.plasmaSetAmplitude(0);
  }

  function speakBrowser(text, onEnd) {
    speechSynthesis.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.voice    = pickVoice();
    utt.pitch    = 0.85;
    utt.rate     = 0.92;
    utt.volume   = 1;
    utt.onstart  = () => { setState('speaking'); startBrowserTtsFallback(); };
    utt.onend    = () => { stopBrowserTtsFallback(); setState('idle'); if (onEnd) onEnd(); };
    utt.onerror  = () => { stopBrowserTtsFallback(); setState('idle'); if (onEnd) onEnd(); };
    speechSynthesis.speak(utt);
  }

  // ── ElevenLabs TTS ──
  let amplitudeCtx = null;

  function startAmplitudeFeed(audioEl) {
    if (!window.plasmaSetAmplitude) return;
    try {
      amplitudeCtx   = new (window.AudioContext || window.webkitAudioContext)();
      const source   = amplitudeCtx.createMediaElementSource(audioEl);
      const analyser = amplitudeCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(amplitudeCtx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = data[i] - 128; sum += v * v; }
        window.plasmaSetAmplitude(Math.min(Math.sqrt(sum / data.length) / 128 * 4, 1));
        analyserRaf = requestAnimationFrame(tick);
      }
      tick();
    } catch { /* Web Audio not available */ }
  }

  function stopAmplitudeFeed() {
    if (analyserRaf) { cancelAnimationFrame(analyserRaf); analyserRaf = null; }
    if (amplitudeCtx) { amplitudeCtx.close(); amplitudeCtx = null; }
    if (window.plasmaSetAmplitude) window.plasmaSetAmplitude(0);
  }

  async function speakElevenLabs(text, onEnd) {
    try {
      setState('speaking');
      const res = await fetch(`${BACKEND}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`TTS status ${res.status}`);
      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay   = () => startAmplitudeFeed(audio);
      audio.onended  = () => { stopAmplitudeFeed(); URL.revokeObjectURL(url); setState('idle'); if (onEnd) onEnd(); };
      audio.onerror  = () => { stopAmplitudeFeed(); URL.revokeObjectURL(url); speakBrowser(text, onEnd); };
      await audio.play();
    } catch {
      speakBrowser(text, onEnd);
    }
  }

  async function checkElevenLabs() {
    if (usingElevenLabs !== null) return usingElevenLabs;
    try {
      const res  = await fetch(`${BACKEND}/config`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      usingElevenLabs = !!data.elevenlabs_configured;
    } catch {
      usingElevenLabs = false;
    }
    return usingElevenLabs;
  }

  async function speak(text) {
    const usable = await checkElevenLabs();
    if (usable) {
      await speakElevenLabs(text, () => {});
    } else {
      speakBrowser(text, () => {});
    }
    if (window.logEvent) window.logEvent(`nightfall — ${text.slice(0, 40)}...`);
  }

  // ── Shared: send message to Claude and render response ──
  async function askClaude(message) {
    addMessage('user', message.toUpperCase());

    const aiBubble = addMessage('ai', '...');
    aiBubble.classList.add('thinking');

    // Snapshot history before this turn (exclude the greeting to keep context tight)
    const historySnapshot = conversationHistory.slice(-20);

    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: historySnapshot }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error) {
        aiBubble.classList.remove('thinking');
        aiBubble.textContent = '⚠ ' + data.error;
        return;
      }

      aiBubble.classList.remove('thinking');
      aiBubble.textContent = data.response;
      chatHistory.scrollTop = chatHistory.scrollHeight;

      // Record both turns in history for next request
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: data.response });

      if (window.logEvent) window.logEvent(`chat — ${message.trim().slice(0, 35)}`);
      await speak(data.response);

    } catch {
      aiBubble.classList.remove('thinking');
      aiBubble.textContent = '⚠ BACKEND OFFLINE';
      setState('idle');
    }
  }

  // ── Text input handler ──
  function submitText() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = '';
    askClaude(msg);
  }

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitText();
  });
  chatSendBtn.addEventListener('click', submitText);

  // ── STT ──
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    micBtn.disabled = true;
    micBtn.title    = 'Speech recognition not supported. Use Chrome or Edge.';
    addMessage('ai', 'STT UNAVAILABLE — USE CHROME OR EDGE');
  } else {
    const recognition          = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    let isListening = false;

    function startListening() {
      if (isListening) return;
      isListening = true;
      speechSynthesis.cancel();
      setState('listening');
      if (window.logEvent) window.logEvent('voice — listening started');
      recognition.start();
    }

    function stopListening() {
      if (!isListening) return;
      isListening = false;
      setState('idle');
      recognition.stop();
    }

    micBtn.addEventListener('click', () => {
      if (isListening) stopListening();
      else startListening();
    });

    recognition.onresult = e => {
      let interim = '', final = '';
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (chatInput) chatInput.placeholder = (final || interim).toUpperCase() || 'SEND A MESSAGE...';
      if (final) {
        chatInput.placeholder = 'SEND A MESSAGE...';
        stopListening();
        if (window.logEvent) window.logEvent(`voice command: ${final.trim().slice(0, 40)}`);
        askClaude(final.trim());
      }
    };

    recognition.onerror = e => {
      setState('idle');
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) stopListening();
    };

    // Greet on load
    setTimeout(async () => {
      await checkElevenLabs();
      const greeting = 'Nightfall online. Voice interface ready.';
      addMessage('ai', greeting);
      speak(greeting);
    }, 1500);
  }
})();
