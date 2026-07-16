(function exposeDeusMortuusNetwork(global) {
  "use strict";

  const STORE = "deus-mortuus-session-v2";
  const LOCAL_PREFIX = "deus-mortuus-local-";
  const listeners = new Map();
  let client = null;
  let channel = null;
  let localChannel = null;
  let subscribed = false;
  let saveTimer = null;
  let saveInFlight = false;
  let pendingState = null;
  let status = {
    mode: "local",
    connection: "offline",
    role: null,
    userId: null,
    characterName: "",
    roomId: null,
    code: "",
    version: 0,
    station: null,
    error: "",
  };

  const emit = (type, payload) => {
    for (const listener of listeners.get(type) || []) {
      try { listener(payload); } catch (error) { console.error(error); }
    }
  };
  const on = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
    return () => listeners.get(type)?.delete(listener);
  };
  const snapshot = () => ({ ...status, cloudAvailable: hasCloudConfig(), isGM: status.role === "gm" });
  const patch = values => {
    status = { ...status, ...values };
    persistSession();
    emit("status", snapshot());
  };
  const safeJSON = (text, fallback = null) => { try { return JSON.parse(text); } catch { return fallback; } };
  const stored = () => safeJSON(sessionStorage.getItem(STORE) || "{}", {}) || {};
  const persistSession = () => sessionStorage.setItem(STORE, JSON.stringify({
    role: status.role,
    characterName: status.characterName,
    roomId: status.roomId,
    code: status.code,
    station: status.station,
    mode: status.mode,
    userId: status.userId,
  }));
  const randomId = () => global.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.floor(Math.random() * 1e8)}`;
  const randomCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  };
  const config = () => global.DEUS_MORTUUS_CONFIG || {};
  const hasCloudConfig = () => Boolean(config().supabaseUrl && config().supabaseKey);

  async function waitForSupabase() {
    if (global.supabase?.createClient) return;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (global.supabase?.createClient) return;
    }
    throw new Error("Библиотека Supabase не загрузилась. Проверьте интернет или очистите config.js для локального режима.");
  }

  async function ensureIdentity(name) {
    const characterName = String(name || status.characterName || "Безымянный").trim().slice(0, 80) || "Безымянный";
    if (!hasCloudConfig()) {
      const saved = stored();
      patch({ mode: "local", userId: saved.userId || status.userId || randomId(), characterName, connection: "local", error: "" });
      const record = stored();
      record.userId = status.userId;
      localStorage.setItem(STORE, JSON.stringify(record));
      return;
    }
    await waitForSupabase();
    if (!client) {
      client = global.supabase.createClient(config().supabaseUrl, config().supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    patch({ mode: "cloud", connection: "connecting", characterName, error: "" });
    let result = await client.auth.getSession();
    if (result.error) throw result.error;
    let session = result.data.session;
    if (!session) {
      result = await client.auth.signInAnonymously({ options: { data: { display_name: characterName } } });
      if (result.error) throw result.error;
      session = result.data.session;
    }
    patch({ userId: session.user.id, connection: "authenticated" });
  }

  function localRoomKey(code) { return `${LOCAL_PREFIX}${String(code).toUpperCase()}`; }
  function readLocalRoom(code) { return safeJSON(localStorage.getItem(localRoomKey(code)) || "null"); }
  function writeLocalRoom(room) { localStorage.setItem(localRoomKey(room.code), JSON.stringify(room)); }

  async function closeChannels() {
    subscribed = false;
    if (channel && client) await client.removeChannel(channel);
    channel = null;
    if (localChannel) localChannel.close();
    localChannel = null;
  }

  async function openChannel() {
    await closeChannels();
    if (!status.roomId) return;
    if (status.mode === "local") {
      localChannel = new BroadcastChannel(`dm-${status.roomId}`);
      localChannel.onmessage = event => handleMessage(event.data || {});
      subscribed = true;
      patch({ connection: "local" });
      return;
    }
    channel = client.channel(`dm:${status.roomId}`, { config: { broadcast: { ack: false, self: false } } });
    await new Promise(resolve => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; clearTimeout(timeout); resolve(); } };
      const timeout = setTimeout(finish, 3500);
      channel
      .on("broadcast", { event: "state" }, ({ payload }) => handleMessage({ kind: "state", ...payload }))
      .on("broadcast", { event: "action" }, ({ payload }) => handleMessage({ kind: "action", ...payload }))
      .on("broadcast", { event: "players" }, ({ payload }) => handleMessage({ kind: "players", ...payload }))
      .on("broadcast", { event: "notice" }, ({ payload }) => handleMessage({ kind: "notice", ...payload }))
      .on("broadcast", { event: "result" }, ({ payload }) => handleMessage({ kind: "result", ...payload }))
      .on("postgres_changes", { event: "*", schema: "public", table: "train_members", filter: `session_id=eq.${status.roomId}` }, () => {
        if (status.role === "gm") void refreshPlayers();
        else void refreshMembership();
      })
      .subscribe(next => {
        subscribed = next === "SUBSCRIBED";
        patch({ connection: subscribed ? "online" : next === "CHANNEL_ERROR" ? "error" : "connecting", error: next === "CHANNEL_ERROR" ? "Ошибка Realtime-канала" : "" });
        if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(next)) finish();
      });
    });
  }

  function handleMessage(message) {
    if (message.kind === "state" && status.role !== "gm") {
      status.version = Number(message.version || status.version);
      emit("state", message.state);
    }
    if (message.kind === "action" && status.role === "gm") emit("action", message);
    if (message.kind === "players") {
      const players = message.players || [];
      const self = players.find(item => item.user_id === status.userId);
      if (self && self.station !== status.station) patch({ station: self.station || null });
      emit("players", players);
    }
    if (message.kind === "notice") {
      if (message.type === "member-joined" && status.role === "gm") void refreshPlayers();
      if (message.type === "station-assigned" && message.targetId === status.userId) patch({ station: message.station || null });
      emit("notice", message);
    }
    if (message.kind === "result" && (!message.targetId || message.targetId === status.userId)) emit("result", message);
  }

  async function broadcast(event, payload) {
    if (!subscribed) return false;
    if (status.mode === "local") {
      localChannel?.postMessage({ kind: event, ...payload });
      return true;
    }
    await channel.send({ type: "broadcast", event, payload });
    return true;
  }

  async function createRoom(characterName, initialState) {
    await ensureIdentity(characterName || "ГМ");
    if (status.mode === "local") {
      let code = randomCode();
      while (readLocalRoom(code)) code = randomCode();
      const roomId = `local-${code}`;
      const room = { roomId, code, state: initialState, version: 1, gmId: status.userId, players: [], createdAt: Date.now() };
      writeLocalRoom(room);
      patch({ role: "gm", roomId, code, version: 1, station: "gm" });
      await openChannel();
      emit("players", []);
      return { state: initialState, players: [] };
    }
    const result = await client.rpc("create_train_session", { p_gm_name: status.characterName, p_initial_state: initialState }).single();
    if (result.error) throw result.error;
    patch({ role: "gm", roomId: result.data.session_id, code: result.data.code, version: Number(result.data.version || 1), station: "gm" });
    await openChannel();
    await refreshPlayers();
    return { state: initialState, players: [] };
  }

  async function joinRoom(codeValue, characterName) {
    const code = String(codeValue || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) throw new Error("Код состоит из шести символов");
    await ensureIdentity(characterName);
    if (status.mode === "local") {
      const room = readLocalRoom(code);
      if (!room) throw new Error("Локальная комната не найдена. Для игры с разных устройств настройте Supabase.");
      const existing = room.players.find(item => item.user_id === status.userId);
      if (!existing && room.players.length >= 7) throw new Error("В составе уже семь персонажей");
      if (existing) existing.character_name = status.characterName;
      else room.players.push({ session_id: room.roomId, user_id: status.userId, character_name: status.characterName, station: null, attention: false, joined_at: new Date().toISOString() });
      writeLocalRoom(room);
      patch({ role: "player", roomId: room.roomId, code, version: room.version, station: existing?.station || null });
      await openChannel();
      await broadcast("players", { players: room.players });
      emit("state", room.state);
      return { state: room.state, players: room.players };
    }
    const result = await client.rpc("join_train_session", { p_code: code, p_character_name: status.characterName }).single();
    if (result.error) throw result.error;
    patch({ role: "player", roomId: result.data.session_id, code: result.data.code, version: Number(result.data.version || 1), station: result.data.station || null });
    await openChannel();
    await broadcast("notice", { type: "member-joined", actorId: status.userId, actor: status.characterName, sentAt: Date.now() });
    emit("state", result.data.state);
    return { state: result.data.state, players: [] };
  }

  async function resume() {
    const saved = stored();
    if (!saved.roomId || !saved.role || !saved.characterName) return null;
    await ensureIdentity(saved.characterName);
    if (saved.mode === "local" || status.mode === "local") {
      const room = readLocalRoom(saved.code);
      if (!room) return null;
      patch({ role: saved.role, roomId: room.roomId, code: room.code, version: room.version, station: saved.station || null });
      await openChannel();
      if (saved.role === "gm") emit("players", room.players || []);
      return { state: room.state, players: room.players || [] };
    }
    const roomQuery = await client.from("train_sessions").select("id,code,state,version,status").eq("id", saved.roomId).maybeSingle();
    if (roomQuery.error || !roomQuery.data || roomQuery.data.status === "closed") return null;
    const memberQuery = await client.from("train_members").select("role,station,character_name").eq("session_id", saved.roomId).eq("user_id", status.userId).maybeSingle();
    if (memberQuery.error || !memberQuery.data) return null;
    patch({ role: memberQuery.data.role, roomId: roomQuery.data.id, code: roomQuery.data.code, version: Number(roomQuery.data.version), station: memberQuery.data.station, characterName: memberQuery.data.character_name });
    await openChannel();
    const players = status.role === "gm" ? await refreshPlayers() : [];
    return { state: roomQuery.data.state, players };
  }

  async function refreshPlayers() {
    if (!status.roomId) return [];
    if (status.mode === "local") {
      const players = readLocalRoom(status.code)?.players || [];
      emit("players", players);
      return players;
    }
    const result = await client.from("train_members").select("user_id,character_name,role,station,attention,joined_at,last_seen").eq("session_id", status.roomId).order("joined_at", { ascending: true });
    if (result.error) throw result.error;
    const players = (result.data || []).filter(item => item.role === "player");
    emit("players", players);
    await broadcast("players", { players });
    return players;
  }

  async function refreshMembership() {
    if (status.mode !== "cloud" || !status.roomId || !status.userId || status.role === "gm") return null;
    const result = await client.from("train_members").select("station,character_name").eq("session_id", status.roomId).eq("user_id", status.userId).maybeSingle();
    if (result.error || !result.data) return null;
    if (result.data.station !== status.station) patch({ station: result.data.station || null, characterName: result.data.character_name || status.characterName });
    return result.data;
  }

  async function assignStation(userId, station) {
    if (status.role !== "gm") throw new Error("Посты назначает ГМ");
    const safeStation = ["driver", "engineer", "warden", "roaming"].includes(station) ? station : null;
    if (status.mode === "local") {
      const room = readLocalRoom(status.code);
      const player = room?.players.find(item => item.user_id === userId);
      if (!player) throw new Error("Игрок не найден");
      player.station = safeStation;
      writeLocalRoom(room);
      await broadcast("players", { players: room.players });
      emit("players", room.players);
      return;
    }
    const result = await client.rpc("assign_train_station", { p_session_id: status.roomId, p_user_id: userId, p_station: safeStation });
    if (result.error) throw result.error;
    await broadcast("notice", { type: "station-assigned", targetId: userId, station: safeStation, sentAt: Date.now() });
    await refreshPlayers();
  }

  async function sendAction(action) {
    if (!status.roomId) throw new Error("Нет активной комнаты");
    if (status.role === "gm") {
      emit("action", { action, actorId: status.userId, actor: status.characterName, station: "gm" });
      return true;
    }
    return broadcast("action", { action, actorId: status.userId, actor: status.characterName, station: status.station, sentAt: Date.now() });
  }

  async function sendResult(targetId, actionType, result) {
    if (status.role !== "gm" || !status.roomId || !targetId) return false;
    return broadcast("result", { targetId, actionType, result, sentAt: Date.now() });
  }

  async function sendState(state, immediate = false) {
    if (status.role !== "gm" || !status.roomId) return;
    await broadcast("state", { state, version: status.version, sentAt: Date.now() });
    pendingState = state;
    if (immediate) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushState, 20);
    } else if (!saveTimer) saveTimer = setTimeout(flushState, 3000);
  }

  async function flushState() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!pendingState || status.role !== "gm") return;
    if (saveInFlight) { saveTimer = setTimeout(flushState, 250); return; }
    saveInFlight = true;
    const state = pendingState;
    pendingState = null;
    try {
      if (status.mode === "local") {
        const room = readLocalRoom(status.code);
        if (!room) return;
        room.state = state;
        room.version += 1;
        writeLocalRoom(room);
        patch({ version: room.version });
        return;
      }
      const result = await client.rpc("save_train_state", { p_session_id: status.roomId, p_expected_version: status.version, p_state: state });
      if (result.error) {
        patch({ error: result.error.message || "Не удалось сохранить состояние", connection: "error" });
        return;
      }
      patch({ version: Number(result.data), connection: "online", error: "" });
    } finally {
      saveInFlight = false;
      if (pendingState && !saveTimer) saveTimer = setTimeout(flushState, 250);
    }
  }

  async function announce(text) { await broadcast("notice", { text: String(text || "").slice(0, 240), sentAt: Date.now() }); }
  async function leave() {
    clearTimeout(saveTimer);
    if (pendingState) await flushState();
    await closeChannels();
    sessionStorage.removeItem(STORE);
    status = { mode: hasCloudConfig() ? "cloud" : "local", connection: "offline", role: null, userId: status.userId, characterName: "", roomId: null, code: "", version: 0, station: null, error: "" };
    emit("status", snapshot());
  }

  const hasSavedSession = () => Boolean(stored().roomId && stored().role && stored().characterName);

  global.DM_NETWORK = { announce, assignStation, createRoom, flushState, hasCloudConfig, hasSavedSession, joinRoom, leave, on, refreshPlayers, resume, sendAction, sendResult, sendState, state: snapshot };
})(window);
