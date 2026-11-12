// Синхронизация прогресса («изучено», избранное, текущий набор) с облаком внутри Telegram Mini App.
// Вне Telegram (обычный браузер) файл ничего не делает — приложение работает как раньше, только локально.
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  var API = (window.LW_CONFIG && window.LW_CONFIG.api) || '';
  if (!tg || !tg.initData || !API) return;

  try { tg.ready(); tg.expand(); tg.setHeaderColor('#1f2227'); tg.setBackgroundColor('#1f2227'); } catch (e) { /* старая версия клиента */ }

  var headers = { 'content-type': 'application/json', 'x-telegram-init-data': tg.initData };
  var timer = null;
  var applying = false;

  function localUpdatedAt() {
    try { return (JSON.parse(localStorage.getItem('de_full_state_v3')) || {}).updatedAt || 0; } catch (e) { return 0; }
  }
  function snapshot() {
    return { learned: Array.from(learnedSet), starred: Array.from(starredSet), activeDeckId: activeDeckId, updatedAt: localUpdatedAt() || Date.now() };
  }
  function push() {
    fetch(API + '/api/progress', { method: 'PUT', headers: headers, body: JSON.stringify(snapshot()) }).catch(function () { /* нет сети — отправим при следующем сохранении */ });
  }

  // каждое локальное сохранение → отправка в облако (не чаще раза в 1,5 с)
  var originalSave = window.saveState;
  window.saveState = function () {
    originalSave.apply(this, arguments);
    if (applying) return;
    clearTimeout(timer);
    timer = setTimeout(push, 1500);
  };

  // при открытии: если в облаке новее — берём оттуда, иначе отправляем своё
  function pull() {
    fetch(API + '/api/progress', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        if (!remote) return;
        if (remote.empty) { if (learnedSet.size || starredSet.size) push(); return; }
        if ((remote.updatedAt || 0) <= localUpdatedAt()) { push(); return; }
        applying = true;
        try {
          learnedSet = new Set(remote.learned || []);
          starredSet = new Set(remote.starred || []);
          if (remote.activeDeckId && (decks[remote.activeDeckId] || remote.activeDeckId === '__all__')) {
            switchDeck(remote.activeDeckId);
          } else {
            renderCard();
          }
          window.saveState();
          updateHeaderStats();
        } finally { applying = false; }
      })
      .catch(function () { /* офлайн — работаем с локальными данными */ });
  }

  // ждём, пока приложение восстановит локальное состояние
  window.addEventListener('load', function () { setTimeout(pull, 1200); });
})();
