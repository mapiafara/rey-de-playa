/**
 * Torneo Rey de la Playa - Main Application Logic
 * Supports 12 players (6M / 6F), extensible architecture, tie-breaker sorting,
 * non-repeating partner tracking, mobile responsiveness, and localStorage persistence.
 */

// Default Initial Player Roster
const DEFAULT_PLAYERS = [
  { id: 'm1', name: 'Andrés Merchán', gender: 'M' },
  { id: 'm2', name: 'Bolivar Martinez', gender: 'M' },
  { id: 'm3', name: 'Carlos Villacorta', gender: 'M' },
  { id: 'm4', name: 'Daniel Uribe', gender: 'M' },
  { id: 'm5', name: 'Fredy Vargas', gender: 'M' },
  { id: 'm6', name: 'Juan Vergara', gender: 'M' },
  { id: 'f1', name: 'Elizabeth Godoy', gender: 'F' },
  { id: 'f2', name: 'Maria José Palencia', gender: 'F' },
  { id: 'f3', name: 'Natalia Mendez', gender: 'F' },
  { id: 'f4', name: 'Selene Rojas', gender: 'F' },
  { id: 'f5', name: 'Violeta Murcia', gender: 'F' },
  { id: 'f6', name: 'Sofía Lazcano', gender: 'F' }
];

// App State
let state = {
  isAdmin: false,
  players: [...DEFAULT_PLAYERS],
  round1: { groups: [] },
  round2: { groups: [] },
  leaderboard: { male: [], female: [] },
  bracket: {
    maleQf: [],
    femaleQf: [],
    maleSf: [],
    femaleSf: [],
    maleFinal: null,
    femaleFinal: null
  }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  checkAdminMode();
  loadStateFromStorage();
  setupTabNavigation();
  setupEventListeners();
  renderPlayersInputs();
  renderAllViews();
  initCloudSync();
});

// --- URL MODE CHECK (READONLY VS ADMIN) ---
function checkAdminMode() {
  const params = new URLSearchParams(window.location.search);
  state.isAdmin = params.has('admin') || params.get('mode') === 'admin' || params.has('organizador') || params.has('edit');
  
  const modeBadge = document.getElementById('modeBadge');
  if (modeBadge) {
    if (state.isAdmin) {
      modeBadge.className = 'mode-badge-admin';
      modeBadge.innerHTML = '⚙️ Modo Edición';
    } else {
      modeBadge.className = 'mode-badge-view';
      modeBadge.innerHTML = '👁️ Modo Lectura';
    }
  }

  // Toggle visibility of admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = state.isAdmin ? '' : 'none';
  });
}

// --- CLOUD REALTIME SYNC ---
const CLOUD_ENDPOINT = 'https://api.restful-api.dev/objects/ff808181a09d98f701a101740d2a6b0b';
let lastSyncTimestamp = 0;
let syncDebounceTimer = null;

function updateSyncBadge(status) {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  if (status === 'online') {
    badge.className = 'sync-badge-online';
    badge.innerHTML = '🟢 En vivo';
    badge.title = 'Sincronizado con la nube en tiempo real';
  } else if (status === 'syncing') {
    badge.className = 'sync-badge-syncing';
    badge.innerHTML = '🟡 Guardando...';
    badge.title = 'Guardando cambios en la nube...';
  } else if (status === 'offline') {
    badge.className = 'sync-badge-offline';
    badge.innerHTML = '🔴 Sin Conexión';
    badge.title = 'Verifica tu conexión a internet';
  }
}

function saveStateToStorageLocally() {
  try {
    localStorage.setItem('rey_de_playa_state_v1', JSON.stringify(state));
  } catch (e) {
    console.error('Error saving state locally:', e);
  }
}

function saveStateToStorage() {
  saveStateToStorageLocally();
  if (state.isAdmin) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      pushStateToCloud();
    }, 400);
  }
}

async function pushStateToCloud() {
  if (!state.isAdmin) return;
  updateSyncBadge('syncing');
  try {
    const stateToSync = JSON.parse(JSON.stringify(state));
    delete stateToSync.isAdmin;
    stateToSync.updatedAt = Date.now();
    lastSyncTimestamp = stateToSync.updatedAt;

    const res = await fetch(CLOUD_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rey de Playa Tournament Live',
        data: stateToSync
      })
    });

    if (res.ok) {
      updateSyncBadge('online');
    } else {
      updateSyncBadge('offline');
    }
  } catch (err) {
    console.error('Error pushing state to cloud:', err);
    updateSyncBadge('offline');
  }
}

function ensureFullRoster() {
  if (!state.players || !Array.isArray(state.players) || state.players.length < 12) {
    state.players = [...DEFAULT_PLAYERS];
  }
}

async function fetchCloudState() {
  try {
    const res = await fetch(CLOUD_ENDPOINT);
    if (res.ok) {
      const resJson = await res.json();
      const data = resJson ? resJson.data : null;
      if (data && Array.isArray(data.players) && data.players.length === 12 && (!data.updatedAt || data.updatedAt > lastSyncTimestamp)) {
        lastSyncTimestamp = data.updatedAt || Date.now();
        const currentAdminMode = state.isAdmin;
        state = { ...state, ...data };
        state.isAdmin = currentAdminMode;
        ensureFullRoster();
        saveStateToStorageLocally();
        renderPlayersInputs();
        renderAllViews();
        updateSyncBadge('online');
      } else if (data) {
        updateSyncBadge('online');
      }
    }
  } catch (err) {
    console.warn('Error fetching cloud state:', err);
    updateSyncBadge('offline');
  }
}

function initCloudSync() {
  fetchCloudState();

  if (state.isAdmin) {
    setTimeout(() => {
      pushStateToCloud();
    }, 1000);
  }

  setInterval(() => {
    fetchCloudState();
  }, 3000);
}

function loadStateFromStorage() {
  try {
    const saved = localStorage.getItem('rey_de_playa_state_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      delete parsed.isAdmin; // Never overwrite URL-driven isAdmin with stored state!
      state = { ...state, ...parsed };
      ensureFullRoster();
      checkAdminMode(); // Re-apply URL mode after load
    } else {
      ensureFullRoster();
    }
  } catch (e) {
    console.error('Error loading state:', e);
    ensureFullRoster();
  }
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) toast.style.borderColor = 'var(--accent-pink)';
  toast.innerHTML = `<span>${isError ? '⚠️' : '✅'}</span> <span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// --- NAVIGATION ---
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function switchTab(tabId) {
  const tabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (tabBtn) tabBtn.click();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  document.getElementById('btnSavePlayers')?.addEventListener('click', handleSavePlayers);
  document.getElementById('btnToggleManualGroups')?.addEventListener('click', toggleManualGroupsPanel);
  document.getElementById('btnSaveManualGroups')?.addEventListener('click', handleSaveManualGroups);
  
  document.getElementById('btnAdvanceToRound2')?.addEventListener('click', handleGenerateRound2);
  document.getElementById('btnCalculateLeaderboard')?.addEventListener('click', handleCalculateLeaderboardNav);
  
  document.getElementById('btnRandomDrawMale')?.addEventListener('click', () => handleRandomDraw('M'));
  document.getElementById('btnRandomDrawFemale')?.addEventListener('click', () => handleRandomDraw('F'));

  document.getElementById('btnGoToBracketMale')?.addEventListener('click', () => handleGoToBracketNav('tab-bracket-male'));
  document.getElementById('btnGoToBracketFemale')?.addEventListener('click', () => handleGoToBracketNav('tab-bracket-female'));

  document.getElementById('btnResetMaleQF')?.addEventListener('click', () => resetQfSelections('male'));
  document.getElementById('btnResetMaleSF')?.addEventListener('click', () => resetSfSelections('male'));
  document.getElementById('btnResetFemaleQF')?.addEventListener('click', () => resetQfSelections('female'));
  document.getElementById('btnResetFemaleSF')?.addEventListener('click', () => resetSfSelections('female'));

  // Header Actions
  document.getElementById('btnSyncCloud')?.addEventListener('click', () => {
    pushStateToCloud();
    showToast('☁️ Datos sincronizados con la nube');
  });

  document.getElementById('btnCopyReadonlyLink')?.addEventListener('click', () => {
    const readUrl = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(readUrl).then(() => {
      showToast('Link de lectura copiado para compartir con jugadores');
    }).catch(() => {
      showToast('Enlace de lectura: ' + readUrl);
    });
  });

  document.getElementById('btnExport')?.addEventListener('click', exportStateJSON);
  document.getElementById('btnImport')?.addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput')?.addEventListener('change', importStateJSON);
  document.getElementById('btnReset')?.addEventListener('click', confirmResetTournament);
}

// --- PLAYER REGISTRATION ---
function renderPlayersInputs() {
  const maleContainer = document.getElementById('male-inputs-list');
  const femaleContainer = document.getElementById('female-inputs-list');
  
  const males = state.players.filter(p => p.gender === 'M');
  const females = state.players.filter(p => p.gender === 'F');

  maleContainer.innerHTML = males.map((p, idx) => `
    <div class="player-input-group">
      <span class="player-num">${idx + 1}.</span>
      <input type="text" class="input-field male-input" data-id="${p.id}" value="${escapeHtml(p.name)}" ${!state.isAdmin ? 'disabled' : ''} placeholder="Nombre del jugador">
    </div>
  `).join('');

  femaleContainer.innerHTML = females.map((p, idx) => `
    <div class="player-input-group">
      <span class="player-num">${idx + 1}.</span>
      <input type="text" class="input-field female-input" data-id="${p.id}" value="${escapeHtml(p.name)}" ${!state.isAdmin ? 'disabled' : ''} placeholder="Nombre de la jugadora">
    </div>
  `).join('');

  if (state.isAdmin) {
    document.querySelectorAll('.male-input, .female-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const val = e.target.value.trim();
        const player = state.players.find(p => p.id === id);
        if (player && val) {
          player.name = val;
          saveStateToStorage();
          renderAllViews();
        }
      });
    });
  }
}

function handleSavePlayers() {
  if (!state.isAdmin) return;
  const maleInputs = document.querySelectorAll('.male-input');
  const femaleInputs = document.querySelectorAll('.female-input');

  maleInputs.forEach(input => {
    const id = input.getAttribute('data-id');
    const player = state.players.find(p => p.id === id);
    if (player && input.value.trim()) player.name = input.value.trim();
  });

  femaleInputs.forEach(input => {
    const id = input.getAttribute('data-id');
    const player = state.players.find(p => p.id === id);
    if (player && input.value.trim()) player.name = input.value.trim();
  });

  if (!state.round1.groups || state.round1.groups.length === 0) {
    generateRound1Groups();
  }

  saveStateToStorage();
  renderAllViews();
  showToast('Jugadores guardados y grupos actualizados');
  switchTab('tab-round1');
}

// --- MANUAL GROUP ASSIGNMENT FOR ROUND 1 ---
function toggleManualGroupsPanel() {
  if (!state.isAdmin) return;
  const panel = document.getElementById('manual-groups-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    renderManualGroupSelectors();
  } else {
    panel.style.display = 'none';
  }
}

function renderManualGroupSelectors() {
  const container = document.getElementById('manual-groups-selectors');
  const males = state.players.filter(p => p.gender === 'M');
  const females = state.players.filter(p => p.gender === 'F');

  const defaultAssignments = [
    { name: 'Grupo 1', m: [males[0]?.id, males[1]?.id], f: [females[0]?.id, females[1]?.id] },
    { name: 'Grupo 2', m: [males[2]?.id, males[3]?.id], f: [females[2]?.id, females[3]?.id] },
    { name: 'Grupo 3', m: [males[4]?.id, males[5]?.id], f: [females[4]?.id, females[5]?.id] }
  ];

  container.innerHTML = defaultAssignments.map((g, gIdx) => `
    <div style="background: rgba(18, 26, 43, 0.8); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
      <h5 style="color: var(--primary); margin-bottom: 10px; font-size: 14px;">${g.name}</h5>
      
      <div style="margin-bottom: 8px;">
        <label style="font-size: 11px; color: var(--male-color); font-weight: 700;">Hombre 1:</label>
        <select class="select-dropdown manual-group-sel" data-group="${gIdx}" data-gender="M" data-index="0">
          ${males.map(m => `<option value="${m.id}" ${g.m[0] === m.id ? 'selected' : ''}>👨 ${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom: 8px;">
        <label style="font-size: 11px; color: var(--male-color); font-weight: 700;">Hombre 2:</label>
        <select class="select-dropdown manual-group-sel" data-group="${gIdx}" data-gender="M" data-index="1">
          ${males.map(m => `<option value="${m.id}" ${g.m[1] === m.id ? 'selected' : ''}>👨 ${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom: 8px;">
        <label style="font-size: 11px; color: var(--female-color); font-weight: 700;">Mujer 1:</label>
        <select class="select-dropdown manual-group-sel" data-group="${gIdx}" data-gender="F" data-index="0">
          ${females.map(f => `<option value="${f.id}" ${g.f[0] === f.id ? 'selected' : ''}>👩 ${escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom: 8px;">
        <label style="font-size: 11px; color: var(--female-color); font-weight: 700;">Mujer 2:</label>
        <select class="select-dropdown manual-group-sel" data-group="${gIdx}" data-gender="F" data-index="1">
          ${females.map(f => `<option value="${f.id}" ${g.f[1] === f.id ? 'selected' : ''}>👩 ${escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function handleSaveManualGroups() {
  if (!state.isAdmin) return;
  const selectors = document.querySelectorAll('.manual-group-sel');
  const groupP = [
    { m: [], f: [] },
    { m: [], f: [] },
    { m: [], f: [] }
  ];

  selectors.forEach(sel => {
    const gIdx = parseInt(sel.getAttribute('data-group'), 10);
    const gender = sel.getAttribute('data-gender');
    const val = sel.value;
    if (gender === 'M') groupP[gIdx].m.push(val);
    else groupP[gIdx].f.push(val);
  });

  const allSelected = [];
  for (let i = 0; i < 3; i++) {
    if (new Set(groupP[i].m).size !== 2 || new Set(groupP[i].f).size !== 2) {
      showToast(`En el Grupo ${i + 1} no puedes repetir el mismo jugador`, true);
      return;
    }
    allSelected.push(...groupP[i].m, ...groupP[i].f);
  }

  if (new Set(allSelected).size !== 12) {
    showToast('Asegúrate de que los 12 jugadores estén distribuidos sin duplicados entre los 3 grupos', true);
    return;
  }

  state.round1.groups = groupP.map((g, idx) => {
    const m1 = getPlayer(g.m[0]);
    const m2 = getPlayer(g.m[1]);
    const f1 = getPlayer(g.f[0]);
    const f2 = getPlayer(g.f[1]);

    return {
      name: `Grupo ${idx + 1}`,
      players: [m1.id, m2.id, f1.id, f2.id],
      matches: createGroupMatches(`R1_G${idx + 1}`, m1, m2, f1, f2)
    };
  });

  renderRound1View();
  saveStateToStorage();
  showToast('¡Grupos manuales de Ronda 1 guardados exitosamente!');
  switchTab('tab-round1');
}

// --- FIXTURE & GROUP GENERATOR ---
function createGroupMatches(groupName, m1, m2, f1, f2) {
  // Orden oficial solicitado por el usuario:
  // 1º Partido: Mixto 1 (M1+F1 vs M2+F2)
  // 2º Partido: Hombres vs Mujeres (M1+M2 vs F1+F2)
  // 3º Partido: Mixto 2 (M1+F2 vs M2+F1)
  return [
    {
      id: `${groupName}_m1`,
      num: 1,
      team1: [m1.id, f1.id],
      team2: [m2.id, f2.id],
      score1: null,
      score2: null
    },
    {
      id: `${groupName}_m2`,
      num: 2,
      team1: [m1.id, m2.id],
      team2: [f1.id, f2.id],
      score1: null,
      score2: null
    },
    {
      id: `${groupName}_m3`,
      num: 3,
      team1: [m1.id, f2.id],
      team2: [m2.id, f1.id],
      score1: null,
      score2: null
    }
  ];
}

function generateRound1Groups() {
  const males = state.players.filter(p => p.gender === 'M');
  const females = state.players.filter(p => p.gender === 'F');

  const g1Players = [males[0], males[1], females[0], females[1]];
  const g2Players = [males[2], males[3], females[2], females[3]];
  const g3Players = [males[4], males[5], females[4], females[5]];

  state.round1.groups = [
    {
      name: 'Grupo 1',
      players: g1Players.map(p => p.id),
      matches: createGroupMatches('R1_G1', males[0], males[1], females[0], females[1])
    },
    {
      name: 'Grupo 2',
      players: g2Players.map(p => p.id),
      matches: createGroupMatches('R1_G2', males[2], males[3], females[2], females[3])
    },
    {
      name: 'Grupo 3',
      players: g3Players.map(p => p.id),
      matches: createGroupMatches('R1_G3', males[4], males[5], females[4], females[5])
    }
  ];

  renderRound1View();
}

// --- RENDER ROUND 1 & ROUND 2 ---
function renderRound1View() {
  const container = document.getElementById('round1-groups-container');
  if (!state.round1.groups || state.round1.groups.length === 0) {
    container.innerHTML = '<div class="card"><p>Presiona "Generar Automático" o "Asignar Grupos Manualmente" en la pestaña Jugadores.</p></div>';
    return;
  }
  container.innerHTML = state.round1.groups.map(group => renderGroupCard(group, 'round1')).join('');
  attachScoreInputListeners('round1');
}

function renderGroupCard(group, roundKey) {
  const groupPlayers = group.players.map(id => getPlayer(id));
  
  return `
    <div class="card">
      <div class="group-header">
        <span>🏐 ${group.name}</span>
      </div>
      <div class="group-players-list">
        ${groupPlayers.map(p => `<span class="tag-player ${p.gender === 'M' ? 'male' : 'female'}">${p.gender === 'M' ? '👨' : '👩'} ${escapeHtml(p.name)}</span>`).join('')}
      </div>

      <div class="matches-list">
        ${group.matches.map(m => renderMatchCard(m, roundKey)).join('')}
      </div>

      <!-- Live Group Table -->
      <div style="margin-top: 16px;">
        <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Tabla del Grupo</h4>
        ${renderMiniGroupTable(group)}
      </div>
    </div>
  `;
}

function renderMatchCard(match, roundKey) {
  const t1p1 = getPlayer(match.team1[0]);
  const t1p2 = getPlayer(match.team1[1]);
  const t2p1 = getPlayer(match.team2[0]);
  const t2p2 = getPlayer(match.team2[1]);

  const s1 = match.score1 !== null ? match.score1 : '';
  const s2 = match.score2 !== null ? match.score2 : '';

  const scoreInputsHtml = state.isAdmin ? `
    <input type="number" class="score-input score-t1" data-match-id="${match.id}" data-round="${roundKey}" min="0" max="99" value="${s1}">
    <span class="score-divider">-</span>
    <input type="number" class="score-input score-t2" data-match-id="${match.id}" data-round="${roundKey}" min="0" max="99" value="${s2}">
  ` : `
    <span class="score-badge-readonly">${s1 !== '' ? s1 : '-'}</span>
    <span class="score-divider">-</span>
    <span class="score-badge-readonly">${s2 !== '' ? s2 : '-'}</span>
  `;

  return `
    <div class="match-card">
      <div class="match-number">
        <span>Partido ${match.num}</span>
        ${(s1 !== '' && s2 !== '') ? '<span style="color: var(--accent-green);">✓ Completado</span>' : ''}
      </div>
      <div class="match-teams">
        <div class="team team1">
          <span class="team-player ${t1p1.gender === 'M' ? 'male' : 'female'}">${escapeHtml(t1p1.name)}</span>
          <span class="team-player ${t1p2.gender === 'M' ? 'male' : 'female'}">${escapeHtml(t1p2.name)}</span>
        </div>
        <div class="vs-badge">VS</div>
        <div class="team team2">
          <span class="team-player ${t2p1.gender === 'M' ? 'male' : 'female'}">${escapeHtml(t2p1.name)}</span>
          <span class="team-player ${t2p2.gender === 'M' ? 'male' : 'female'}">${escapeHtml(t2p2.name)}</span>
        </div>
      </div>
      <div class="score-inputs">
        ${scoreInputsHtml}
      </div>
    </div>
  `;
}

function attachScoreInputListeners(roundKey) {
  if (!state.isAdmin) return;
  const inputs = document.querySelectorAll(`input[data-round="${roundKey}"]`);
  inputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const matchId = e.target.getAttribute('data-match-id');
      const isTeam1 = e.target.classList.contains('score-t1');
      const val = e.target.value !== '' ? parseInt(e.target.value, 10) : null;

      const groups = roundKey === 'round1' ? state.round1.groups : state.round2.groups;
      for (const g of groups) {
        const match = g.matches.find(m => m.id === matchId);
        if (match) {
          if (isTeam1) match.score1 = val;
          else match.score2 = val;
          break;
        }
      }

      saveStateToStorage();
      if (roundKey === 'round1') renderRound1View();
      else renderRound2View();
      
      calculateLeaderboards();
    });
  });
}

function renderMiniGroupTable(group) {
  const stats = calculateGroupStats(group);
  return `
    <table class="leaderboard-table" style="font-size: 12px;">
      <thead>
        <tr>
          <th>Jugador</th>
          <th>PG</th>
          <th>PF</th>
          <th>PC</th>
          <th>DIF</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(s => {
          const p = getPlayer(s.playerId);
          return `
            <tr>
              <td style="color: ${p.gender === 'M' ? 'var(--male-color)' : 'var(--female-color)'}; font-weight: 700;">
                ${escapeHtml(p.name)}
              </td>
              <td>${s.wins}</td>
              <td>${s.pf}</td>
              <td>${s.pc}</td>
              <td class="${s.diff >= 0 ? 'stat-positive' : 'stat-negative'}">${s.diff > 0 ? '+' + s.diff : s.diff}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// --- ROUND 2 GENERATION WITH REPETITION AVOIDANCE ---
function handleGenerateRound2() {
  if (!state.isAdmin) return;
  const allComplete = state.round1.groups.every(g => g.matches.every(m => m.score1 !== null && m.score2 !== null));
  if (!allComplete) {
    showToast('Ingresa los marcadores de todos los partidos de la Ronda 1', true);
    return;
  }

  const r1Matches = state.round1.groups.flatMap(g => g.matches);
  const r1Stats = calculatePlayersStatsFromMatches(r1Matches);
  const maleRanked = state.players.filter(p => p.gender === 'M').sort((a, b) => comparePlayersStats(r1Stats[a.id], r1Stats[b.id], [a.id, b.id], r1Matches));
  const femaleRanked = state.players.filter(p => p.gender === 'F').sort((a, b) => comparePlayersStats(r1Stats[a.id], r1Stats[b.id], [a.id, b.id], r1Matches));

  const topFemales = [femaleRanked[0], femaleRanked[1], femaleRanked[2]];
  const topMales = [maleRanked[0], maleRanked[1], maleRanked[2]];
  
  const botFemales = [femaleRanked[3], femaleRanked[4], femaleRanked[5]];
  const botMales = [maleRanked[3], maleRanked[4], maleRanked[5]];

  const getR1GroupMates = (pid) => {
    const r1Group = state.round1.groups.find(g => g.players.includes(pid));
    return r1Group ? r1Group.players : [];
  };

  const calculateGroupOverlap = (gPlayers) => {
    let overlaps = 0;
    for (let i = 0; i < gPlayers.length; i++) {
      const mates = getR1GroupMates(gPlayers[i]);
      for (let j = i + 1; j < gPlayers.length; j++) {
        if (mates.includes(gPlayers[j])) overlaps++;
      }
    }
    return overlaps;
  };

  const topFPerms = [
    [topFemales[0], topFemales[1], topFemales[2]],
    [topFemales[0], topFemales[2], topFemales[1]],
    [topFemales[1], topFemales[0], topFemales[2]],
    [topFemales[1], topFemales[2], topFemales[0]],
    [topFemales[2], topFemales[0], topFemales[1]],
    [topFemales[2], topFemales[1], topFemales[0]]
  ];

  const topMPerms = [
    [topMales[2], topMales[1], topMales[0]],
    [topMales[2], topMales[0], topMales[1]],
    [topMales[1], topMales[2], topMales[0]],
    [topMales[1], topMales[0], topMales[2]],
    [topMales[0], topMales[2], topMales[1]],
    [topMales[0], topMales[1], topMales[2]]
  ];

  const botFPerms = [
    [botFemales[2], botFemales[1], botFemales[0]],
    [botFemales[2], botFemales[0], botFemales[1]],
    [botFemales[1], botFemales[2], botFemales[0]],
    [botFemales[1], botFemales[0], botFemales[2]],
    [botFemales[0], botFemales[2], botFemales[1]],
    [botFemales[0], botFemales[1], botFemales[0]]
  ];

  const botMPerms = [
    [botMales[0], botMales[1], botMales[2]],
    [botMales[0], botMales[2], botMales[1]],
    [botMales[1], botMales[0], botMales[2]],
    [botMales[1], botMales[2], botMales[0]],
    [botMales[2], botMales[0], botMales[1]],
    [botMales[2], botMales[1], botMales[0]]
  ];

  let bestCombination = null;
  let minOverlaps = Infinity;
  let minDistance = Infinity;

  const idealTopF = [topFemales[0], topFemales[1], topFemales[2]];
  const idealTopM = [topMales[2], topMales[1], topMales[0]];
  const idealBotF = [botFemales[2], botFemales[1], botFemales[0]];
  const idealBotM = [botMales[0], botMales[1], botMales[2]];

  for (const tf of topFPerms) {
    for (const tm of topMPerms) {
      for (const bf of botFPerms) {
        for (const bm of botMPerms) {
          const candidateG1 = [tm[0].id, bm[0].id, tf[0].id, bf[0].id];
          const candidateG2 = [tm[1].id, bm[1].id, tf[1].id, bf[1].id];
          const candidateG3 = [tm[2].id, bm[2].id, tf[2].id, bf[2].id];

          const overlaps = calculateGroupOverlap(candidateG1) +
                           calculateGroupOverlap(candidateG2) +
                           calculateGroupOverlap(candidateG3);

          let dist = 0;
          for (let i = 0; i < 3; i++) {
            if (tf[i] !== idealTopF[i]) dist += 1;
            if (tm[i] !== idealTopM[i]) dist += 1;
            if (bf[i] !== idealBotF[i]) dist += 1;
            if (bm[i] !== idealBotM[i]) dist += 1;
          }

          if (overlaps < minOverlaps || (overlaps === minOverlaps && dist < minDistance)) {
            minOverlaps = overlaps;
            minDistance = dist;
            bestCombination = { g1: candidateG1, g2: candidateG2, g3: candidateG3 };
          }
        }
      }
    }
  }

  const g1P = bestCombination.g1.map(id => getPlayer(id));
  const g2P = bestCombination.g2.map(id => getPlayer(id));
  const g3P = bestCombination.g3.map(id => getPlayer(id));

  state.round2.groups = [
    {
      name: 'Grupo 1 (R2)',
      players: bestCombination.g1,
      matches: createGroupMatches('R2_G1', g1P[0], g1P[1], g1P[2], g1P[3])
    },
    {
      name: 'Grupo 2 (R2)',
      players: bestCombination.g2,
      matches: createGroupMatches('R2_G2', g2P[0], g2P[1], g2P[2], g2P[3])
    },
    {
      name: 'Grupo 3 (R2)',
      players: bestCombination.g3,
      matches: createGroupMatches('R2_G3', g3P[0], g3P[1], g3P[2], g3P[3])
    }
  ];

  renderRound2View();
  saveStateToStorage();
  showToast(minOverlaps === 0 
    ? '¡Grupos de Ronda 2 generados sin repeticiones de integrantes de la Ronda 1!' 
    : `¡Grupos de Ronda 2 generados por ranqueo (minimizadas repeticiones a ${minOverlaps})!`
  );
  switchTab('tab-round2');
}

function renderRound2View() {
  const container = document.getElementById('round2-groups-container');
  if (!state.round2.groups || state.round2.groups.length === 0) {
    container.innerHTML = '<div class="card"><p style="color: var(--text-muted);">Completa la Ronda 1 y haz clic en "Generar Grupos Ronda 2".</p></div>';
    return;
  }
  container.innerHTML = state.round2.groups.map(group => renderGroupCard(group, 'round2')).join('');
  attachScoreInputListeners('round2');
}

// --- LEADERBOARD & TIE-BREAKER LOGIC ---
function calculateGroupStats(group) {
  const stats = {};
  group.players.forEach(pid => {
    stats[pid] = { playerId: pid, wins: 0, pf: 0, pc: 0, diff: 0 };
  });

  group.matches.forEach(m => {
    if (m.score1 === null || m.score2 === null) return;
    const t1Wins = m.score1 > m.score2;
    const t2Wins = m.score2 > m.score1;

    m.team1.forEach(pid => {
      if (stats[pid]) {
        if (t1Wins) stats[pid].wins += 1;
        stats[pid].pf += m.score1;
        stats[pid].pc += m.score2;
        stats[pid].diff = stats[pid].pf - stats[pid].pc;
      }
    });

    m.team2.forEach(pid => {
      if (stats[pid]) {
        if (t2Wins) stats[pid].wins += 1;
        stats[pid].pf += m.score2;
        stats[pid].pc += m.score1;
        stats[pid].diff = stats[pid].pf - stats[pid].pc;
      }
    });
  });

  return Object.values(stats).sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pf - a.pf);
}

function getAllCompletedMatches() {
  const r1Matches = state.round1.groups ? state.round1.groups.flatMap(g => g.matches) : [];
  const r2Matches = state.round2.groups ? state.round2.groups.flatMap(g => g.matches) : [];
  return [...r1Matches, ...r2Matches];
}

function calculatePlayersStatsFromMatches(matchesList) {
  const stats = {};
  state.players.forEach(p => {
    stats[p.id] = { playerId: p.id, wins: 0, played: 0, pf: 0, pc: 0, diff: 0 };
  });

  matchesList.forEach(m => {
    if (m.score1 === null || m.score2 === null) return;
    const t1Wins = m.score1 > m.score2;
    const t2Wins = m.score2 > m.score1;

    m.team1.forEach(pid => {
      if (stats[pid]) {
        stats[pid].played += 1;
        if (t1Wins) stats[pid].wins += 1;
        stats[pid].pf += m.score1;
        stats[pid].pc += m.score2;
        stats[pid].diff = stats[pid].pf - stats[pid].pc;
      }
    });

    m.team2.forEach(pid => {
      if (stats[pid]) {
        stats[pid].played += 1;
        if (t2Wins) stats[pid].wins += 1;
        stats[pid].pf += m.score2;
        stats[pid].pc += m.score1;
        stats[pid].diff = stats[pid].pf - stats[pid].pc;
      }
    });
  });

  return stats;
}

function arePlayersTotallyTied(statA, statB, matchesList) {
  if (!statA || !statB) return false;
  const a = statA.total || statA;
  const b = statB.total || statB;
  if (!a || !b) return false;

  if (a.wins !== b.wins) return false;
  if (a.diff !== b.diff) return false;
  if (a.pf !== b.pf) return false;

  const p1Id = statA.playerId || statA.id;
  const p2Id = statB.playerId || statB.id;

  const h2h = getHeadToHeadWinner(p1Id, p2Id, matchesList);
  if (h2h !== null) return false;

  return true;
}

function comparePlayersStats(a, b, tiedIds, matchesList, gender) {
  if (!a || !b) return 0;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.diff !== a.diff) return b.diff - a.diff;
  if (b.pf !== a.pf) return b.pf - a.pf;

  const p1Id = a.playerId || a.id;
  const p2Id = b.playerId || b.id;

  const h2h = getHeadToHeadWinner(p1Id, p2Id, matchesList);
  if (h2h === p1Id) return -1;
  if (h2h === p2Id) return 1;

  // Criterion 5: Sorteo / Manual Tie Order priority
  const playerGender = gender || (p1Id ? getPlayer(p1Id)?.gender : null);
  const key = playerGender === 'M' ? 'male' : (playerGender === 'F' ? 'female' : null);
  if (key && state.manualTieOrder && state.manualTieOrder[key]) {
    const orderList = state.manualTieOrder[key];
    const idxA = orderList.indexOf(p1Id);
    const idxB = orderList.indexOf(p2Id);
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
  }

  return 0;
}

function getHeadToHeadWinner(p1Id, p2Id, matchesList) {
  for (const m of matchesList) {
    if (m.score1 === null || m.score2 === null) continue;
    const inTeam1P1 = m.team1.includes(p1Id);
    const inTeam1P2 = m.team1.includes(p2Id);
    const inTeam2P1 = m.team2.includes(p1Id);
    const inTeam2P2 = m.team2.includes(p2Id);

    if (inTeam1P1 && inTeam2P2) {
      return m.score1 > m.score2 ? p1Id : (m.score2 > m.score1 ? p2Id : null);
    }
    if (inTeam2P1 && inTeam1P2) {
      return m.score2 > m.score1 ? p1Id : (m.score1 > m.score2 ? p2Id : null);
    }
  }
  return null;
}

function movePlayerInSorteo(gender, playerId, direction) {
  if (!state.isAdmin) return;
  const list = gender === 'M' ? state.leaderboard.male : state.leaderboard.female;
  const key = gender === 'M' ? 'male' : 'female';
  if (!list || list.length === 0) return;

  const idx = list.findIndex(item => item.playerId === playerId);
  if (idx === -1) return;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= list.length) return;

  const r1Matches = state.round1.groups ? state.round1.groups.flatMap(g => g.matches) : [];
  const r2Matches = state.round2.groups ? state.round2.groups.flatMap(g => g.matches) : [];
  const allMatches = [...r1Matches, ...r2Matches];

  if (!arePlayersTotallyTied(list[idx], list[targetIdx], allMatches)) {
    showToast('Solo puedes mover jugadores en empate total (criterios 1 al 4 sin enfrentamiento directo)', true);
    return;
  }

  if (!state.manualTieOrder) state.manualTieOrder = { male: [], female: [] };
  if (!state.manualTieOrder[key] || state.manualTieOrder[key].length === 0) {
    state.manualTieOrder[key] = list.map(item => item.playerId);
  }

  const order = [...state.manualTieOrder[key]];
  const posA = order.indexOf(playerId);
  const posB = order.indexOf(list[targetIdx].playerId);

  if (posA !== -1 && posB !== -1) {
    const temp = order[posA];
    order[posA] = order[posB];
    order[posB] = temp;
    state.manualTieOrder[key] = order;
  }

  calculateLeaderboards();
  initBracketIfNeeded();
  saveStateToStorage();
  renderBracketView();
  const player = getPlayer(playerId);
  showToast(`🎲 Posición de ${player.name} reordenada por sorteo`);
}

function handleRandomDraw(gender) {
  if (!state.isAdmin) return;
  const list = gender === 'M' ? state.leaderboard.male : state.leaderboard.female;
  const key = gender === 'M' ? 'male' : 'female';
  if (!list || list.length === 0) return;

  const r1Matches = state.round1.groups ? state.round1.groups.flatMap(g => g.matches) : [];
  const r2Matches = state.round2.groups ? state.round2.groups.flatMap(g => g.matches) : [];
  const allMatches = [...r1Matches, ...r2Matches];

  let currentOrder = list.map(item => item.playerId);
  let changed = false;

  let i = 0;
  while (i < list.length) {
    let group = [list[i]];
    let j = i + 1;
    while (j < list.length && arePlayersTotallyTied(list[i], list[j], allMatches)) {
      group.push(list[j]);
      j++;
    }
    if (group.length > 1) {
      changed = true;
      const groupIds = group.map(g => g.playerId);
      for (let k = groupIds.length - 1; k > 0; k--) {
        const rand = Math.floor(Math.random() * (k + 1));
        const tmp = groupIds[k];
        groupIds[k] = groupIds[rand];
        groupIds[rand] = tmp;
      }
      for (let k = 0; k < groupIds.length; k++) {
        currentOrder[i + k] = groupIds[k];
      }
    }
    i = j;
  }

  if (!changed) {
    showToast('No hay empates totales de criterios 1 al 4 para sortear', true);
    return;
  }

  if (!state.manualTieOrder) state.manualTieOrder = { male: [], female: [] };
  state.manualTieOrder[key] = currentOrder;

  calculateLeaderboards();
  initBracketIfNeeded();
  saveStateToStorage();
  renderBracketView();
  showToast(`🎲 Sorteo aleatorio realizado para empates totales (${gender === 'M' ? 'Hombres' : 'Mujeres'})`);
}

function calculateLeaderboards() {
  const r1Matches = state.round1.groups ? state.round1.groups.flatMap(g => g.matches) : [];
  const r2Matches = state.round2.groups ? state.round2.groups.flatMap(g => g.matches) : [];
  const allMatches = [...r1Matches, ...r2Matches];

  const r1Stats = calculatePlayersStatsFromMatches(r1Matches);
  const r2Stats = calculatePlayersStatsFromMatches(r2Matches);
  const totalStats = calculatePlayersStatsFromMatches(allMatches);

  const combinedStats = {};
  state.players.forEach(p => {
    combinedStats[p.id] = {
      playerId: p.id,
      r1: r1Stats[p.id],
      r2: r2Stats[p.id],
      total: totalStats[p.id]
    };
  });

  const males = state.players.filter(p => p.gender === 'M')
    .map(p => combinedStats[p.id])
    .sort((a, b) => comparePlayersStats(a.total, b.total, [a.playerId, b.playerId], allMatches, 'M'));

  const females = state.players.filter(p => p.gender === 'F')
    .map(p => combinedStats[p.id])
    .sort((a, b) => comparePlayersStats(a.total, b.total, [a.playerId, b.playerId], allMatches, 'F'));

  state.leaderboard.male = males;
  state.leaderboard.female = females;

  renderLeaderboardView();
}

function renderLeaderboardView() {
  const maleBody = document.getElementById('leaderboard-male-body');
  const femaleBody = document.getElementById('leaderboard-female-body');

  if (!state.leaderboard.male || state.leaderboard.male.length === 0) {
    calculateLeaderboards();
  }

  maleBody.innerHTML = state.leaderboard.male.map((s, idx) => renderLeaderboardRow(s, idx, 'M')).join('');
  femaleBody.innerHTML = state.leaderboard.female.map((s, idx) => renderLeaderboardRow(s, idx, 'F')).join('');

  document.querySelectorAll('.btn-sorteo-move').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const gender = e.currentTarget.getAttribute('data-gender');
      const pId = e.currentTarget.getAttribute('data-id');
      const dir = e.currentTarget.getAttribute('data-dir');
      movePlayerInSorteo(gender, pId, dir);
    });
  });
}

function renderLeaderboardRow(stat, idx, gender) {
  const player = getPlayer(stat.playerId);
  const pos = idx + 1;
  const isDirectSemi = pos <= 2;
  
  let rankClass = '';
  if (pos === 1) rankClass = 'top1';
  else if (pos === 2) rankClass = 'top2';
  else if (pos === 3) rankClass = 'top3';

  const r1 = stat.r1 || { wins: 0, diff: 0, pf: 0 };
  const r2 = stat.r2 || { wins: 0, diff: 0, pf: 0 };
  const total = stat.total || { wins: 0, diff: 0, pf: 0 };

  const formatStat = (s) => `${s.wins}G (${s.diff >= 0 ? '+' + s.diff : s.diff} | ${s.pf}PF)`;

  const list = gender === 'M' ? state.leaderboard.male : state.leaderboard.female;
  const r1Matches = state.round1.groups ? state.round1.groups.flatMap(g => g.matches) : [];
  const r2Matches = state.round2.groups ? state.round2.groups.flatMap(g => g.matches) : [];
  const allMatches = [...r1Matches, ...r2Matches];

  const canMoveUp = idx > 0 && arePlayersTotallyTied(stat, list[idx - 1], allMatches);
  const canMoveDown = idx < list.length - 1 && arePlayersTotallyTied(stat, list[idx + 1], allMatches);
  const isTied = canMoveUp || canMoveDown;

  let moveButtonsHtml = '';
  if (state.isAdmin && isTied) {
    moveButtonsHtml = `
      <div style="display: inline-flex; gap: 3px; margin-left: 6px; vertical-align: middle;">
        ${canMoveUp ? `<button class="btn-sorteo-move" data-gender="${gender}" data-id="${stat.playerId}" data-dir="up" title="Mover arriba en sorteo de empate total">⬆️ Mover</button>` : ''}
        ${canMoveDown ? `<button class="btn-sorteo-move" data-gender="${gender}" data-id="${stat.playerId}" data-dir="down" title="Mover abajo en sorteo de empate total">⬇️ Mover</button>` : ''}
      </div>
    `;
  }

  return `
    <tr>
      <td><div class="rank-badge ${rankClass}">${pos}</div></td>
      <td style="color: ${player.gender === 'M' ? 'var(--male-color)' : 'var(--female-color)'}; font-weight: 700;">
        ${escapeHtml(player.name)}
        ${isTied ? `<span class="badge-sorteo" title="Empate total en Criterios 1 a 4. Mover por sorteo.">🎲 Empate Sorteo</span>` : ''}
      </td>
      <td style="font-size: 11px; color: var(--text-muted);">${formatStat(r1)}</td>
      <td style="font-size: 11px; color: var(--text-muted);">${formatStat(r2)}</td>
      <td style="font-size: 12px; font-weight: 800; color: var(--text-main);">${formatStat(total)}</td>
      <td>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="duo-badge" style="background: ${isDirectSemi ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 179, 0, 0.2)'}; color: ${isDirectSemi ? 'var(--accent-green)' : 'var(--secondary)'};">
            ${isDirectSemi ? '⭐ Semifinal Directa' : '⚔️ Cuartos'}
          </span>
          ${moveButtonsHtml}
        </div>
      </td>
    </tr>
  `;
}

function handleCalculateLeaderboardNav() {
  calculateLeaderboards();
  saveStateToStorage();
  switchTab('tab-leaderboard');
}

function handleGoToBracketNav(targetTab = 'tab-bracket-male') {
  calculateLeaderboards();
  initBracketIfNeeded();
  renderBracketView();
  saveStateToStorage();
  switchTab(targetTab);
}

// --- PARTNER HISTORY & NON-REPEATING FILTER ---
function getQfPartnerId(playerId) {
  if (!playerId) return null;
  const maleQf = state.bracket.maleQf || [];
  const femaleQf = state.bracket.femaleQf || [];

  for (const m of [...maleQf, ...femaleQf]) {
    if (!m) continue;

    if (m.chooserMaleId === playerId && m.chosenFemaleId) return m.chosenFemaleId;
    if (m.chosenFemaleId === playerId && m.chooserMaleId) return m.chooserMaleId;

    if (m.opponentMaleId === playerId && m.opponentFemaleId) return m.opponentFemaleId;
    if (m.opponentFemaleId === playerId && m.opponentMaleId) return m.opponentMaleId;

    if (m.chooserFemaleId === playerId && m.chosenMaleId) return m.chosenMaleId;
    if (m.chosenMaleId === playerId && m.chooserFemaleId) return m.chooserFemaleId;

    if (m.opponentFemaleId === playerId && m.opponentMaleId) return m.opponentMaleId;
    if (m.opponentMaleId === playerId && m.opponentFemaleId) return m.opponentFemaleId;
  }

  return null;
}

function getEliminationPartnerHistory(playerId) {
  const history = new Set();
  const qfPartner = getQfPartnerId(playerId);
  if (qfPartner) history.add(qfPartner);
  return history;
}

function getAvailablePartners(chooserId, targetGender, allowRepeat = false) {
  const chooser = getPlayer(chooserId);
  const partnerHistory = getEliminationPartnerHistory(chooserId);

  return state.players.filter(p => {
    if (p.id === chooserId) return false;
    if (targetGender && p.gender !== targetGender) return false;
    if (!allowRepeat && partnerHistory.has(p.id)) return false;
    return true;
  });
}

// --- AUTO ASSIGN & RESET HELPERS ---
function autoAssignRemainingQfPartner(category) {
  if (category === 'male') {
    const qfFemalesPool = [
      state.leaderboard.female[2]?.playerId,
      state.leaderboard.female[3]?.playerId,
      state.leaderboard.female[4]?.playerId,
      state.leaderboard.female[5]?.playerId
    ].filter(Boolean);

    const mqf1 = state.bracket.maleQf[0];
    const mqf2 = state.bracket.maleQf[1];
    if (!mqf1 || !mqf2) return;

    const selections = [
      { maleId: mqf1.chooserMaleId, femaleId: mqf1.chosenFemaleId, set: (id) => mqf1.chosenFemaleId = id },
      { maleId: mqf1.opponentMaleId, femaleId: mqf1.opponentFemaleId, set: (id) => mqf1.opponentFemaleId = id },
      { maleId: mqf2.chooserMaleId, femaleId: mqf2.chosenFemaleId, set: (id) => mqf2.chosenFemaleId = id },
      { maleId: mqf2.opponentMaleId, femaleId: mqf2.opponentFemaleId, set: (id) => mqf2.opponentFemaleId = id },
    ];

    const filledCount = selections.filter(s => s.femaleId).length;
    if (filledCount === 3) {
      const selectedFemales = selections.map(s => s.femaleId).filter(Boolean);
      const remainingFemale = qfFemalesPool.find(fId => !selectedFemales.includes(fId));
      const emptySelection = selections.find(s => !s.femaleId);
      if (remainingFemale && emptySelection) {
        emptySelection.set(remainingFemale);
      }
    }
  } else if (category === 'female') {
    const qfMalesPool = [
      state.leaderboard.male[2]?.playerId,
      state.leaderboard.male[3]?.playerId,
      state.leaderboard.male[4]?.playerId,
      state.leaderboard.male[5]?.playerId
    ].filter(Boolean);

    const fqf1 = state.bracket.femaleQf[0];
    const fqf2 = state.bracket.femaleQf[1];
    if (!fqf1 || !fqf2) return;

    const selections = [
      { femaleId: fqf1.chooserFemaleId, maleId: fqf1.chosenMaleId, set: (id) => fqf1.chosenMaleId = id },
      { femaleId: fqf1.opponentFemaleId, maleId: fqf1.opponentMaleId, set: (id) => fqf1.opponentMaleId = id },
      { femaleId: fqf2.chooserFemaleId, maleId: fqf2.chosenMaleId, set: (id) => fqf2.chosenMaleId = id },
      { femaleId: fqf2.opponentFemaleId, maleId: fqf2.opponentMaleId, set: (id) => fqf2.opponentMaleId = id },
    ];

    const filledCount = selections.filter(s => s.maleId).length;
    if (filledCount === 3) {
      const selectedMales = selections.map(s => s.maleId).filter(Boolean);
      const remainingMale = qfMalesPool.find(mId => !selectedMales.includes(mId));
      const emptySelection = selections.find(s => !s.maleId);
      if (remainingMale && emptySelection) {
        emptySelection.set(remainingMale);
      }
    }
  }
}

function resetQfSelections(category) {
  if (!state.isAdmin) return;
  if (!confirm(`¿Deseas borrar las elecciones y marcadores de Cuartos de Final (${category === 'male' ? 'Masculino' : 'Femenino'})?`)) return;

  if (category === 'male') {
    if (state.bracket.maleQf) {
      state.bracket.maleQf.forEach(m => {
        m.chosenFemaleId = null;
        m.opponentFemaleId = null;
        m.score1 = null;
        m.score2 = null;
      });
    }
    state.bracket.maleSf = [];
    state.bracket.maleFinal = null;
  } else if (category === 'female') {
    if (state.bracket.femaleQf) {
      state.bracket.femaleQf.forEach(m => {
        m.chosenMaleId = null;
        m.opponentMaleId = null;
        m.score1 = null;
        m.score2 = null;
      });
    }
    state.bracket.femaleSf = [];
    state.bracket.femaleFinal = null;
  }

  saveStateToStorage();
  renderBracketView();
  showToast(`Elecciones de Cuartos de Final (${category === 'male' ? 'Hombres' : 'Mujeres'}) borradas.`);
}

function resetSfSelections(category) {
  if (!state.isAdmin) return;
  if (!confirm(`¿Deseas borrar las elecciones y marcadores de Semifinales (${category === 'male' ? 'Masculino' : 'Femenino'})?`)) return;

  if (category === 'male') {
    if (state.bracket.maleSf) {
      state.bracket.maleSf.forEach(m => {
        m.seedFemalePartnerId = null;
        m.chosenPartnerFemaleId = null;
        m.qfWinFemalePartnerId = null;
        m.score1 = null;
        m.score2 = null;
      });
    }
    state.bracket.maleFinal = null;
  } else if (category === 'female') {
    if (state.bracket.femaleSf) {
      state.bracket.femaleSf.forEach(m => {
        m.seedMalePartnerId = null;
        m.chosenPartnerMaleId = null;
        m.qfWinMalePartnerId = null;
        m.score1 = null;
        m.score2 = null;
      });
    }
    state.bracket.femaleFinal = null;
  }

  saveStateToStorage();
  renderBracketView();
  showToast(`Elecciones de Semifinales (${category === 'male' ? 'Hombres' : 'Mujeres'}) borradas.`);
}

// --- BRACKET MANAGEMENT & SELECTION FOR MALE & FEMALE CATEGORIES ---
function initBracketIfNeeded() {
  const males = state.leaderboard.male;
  const females = state.leaderboard.female;

  if (!males || males.length < 6 || !females || females.length < 6) return;

  const qfMales = [males[2].playerId, males[3].playerId, males[4].playerId, males[5].playerId];
  const qfFemales = [females[2].playerId, females[3].playerId, females[4].playerId, females[5].playerId];

  if (!state.bracket.maleQf || state.bracket.maleQf.length === 0) {
    state.bracket.maleQf = [
      {
        id: 'MQF1',
        title: 'Cuartos Masculinos 1 (3º vs 6º)',
        chooserMaleId: qfMales[0], // Rank 3 M
        chosenFemaleId: null,
        opponentMaleId: qfMales[3], // Rank 6 M
        opponentFemaleId: null,
        score1: null,
        score2: null
      },
      {
        id: 'MQF2',
        title: 'Cuartos Masculinos 2 (4º vs 5º)',
        chooserMaleId: qfMales[1], // Rank 4 M
        chosenFemaleId: null,
        opponentMaleId: qfMales[2], // Rank 5 M
        opponentFemaleId: null,
        score1: null,
        score2: null
      }
    ];
  } else {
    // Dynamic sync of QF choosers & opponents to match current leaderboard ranks 3, 4, 5, 6
    if (state.bracket.maleQf[0].chooserMaleId !== qfMales[0] || state.bracket.maleQf[0].opponentMaleId !== qfMales[3]) {
      state.bracket.maleQf[0].chooserMaleId = qfMales[0];
      state.bracket.maleQf[0].opponentMaleId = qfMales[3];
      state.bracket.maleQf[0].chosenFemaleId = null;
      state.bracket.maleQf[0].opponentFemaleId = null;
      state.bracket.maleQf[0].score1 = null;
      state.bracket.maleQf[0].score2 = null;
    }
    if (state.bracket.maleQf[1].chooserMaleId !== qfMales[1] || state.bracket.maleQf[1].opponentMaleId !== qfMales[2]) {
      state.bracket.maleQf[1].chooserMaleId = qfMales[1];
      state.bracket.maleQf[1].opponentMaleId = qfMales[2];
      state.bracket.maleQf[1].chosenFemaleId = null;
      state.bracket.maleQf[1].opponentFemaleId = null;
      state.bracket.maleQf[1].score1 = null;
      state.bracket.maleQf[1].score2 = null;
    }
  }

  if (!state.bracket.femaleQf || state.bracket.femaleQf.length === 0) {
    state.bracket.femaleQf = [
      {
        id: 'FQF1',
        title: 'Cuartos Femeninos 1 (3ª vs 6ª)',
        chooserFemaleId: qfFemales[0], // Rank 3 F
        chosenMaleId: null,
        opponentFemaleId: qfFemales[3], // Rank 6 F
        opponentMaleId: null,
        score1: null,
        score2: null
      },
      {
        id: 'FQF2',
        title: 'Cuartos Femeninos 2 (4ª vs 5ª)',
        chooserFemaleId: qfFemales[1], // Rank 4 F
        chosenMaleId: null,
        opponentFemaleId: qfFemales[2], // Rank 5 F
        opponentMaleId: null,
        score1: null,
        score2: null
      }
    ];
  } else {
    // Dynamic sync of QF choosers & opponents to match current leaderboard ranks 3, 4, 5, 6
    if (state.bracket.femaleQf[0].chooserFemaleId !== qfFemales[0] || state.bracket.femaleQf[0].opponentFemaleId !== qfFemales[3]) {
      state.bracket.femaleQf[0].chooserFemaleId = qfFemales[0];
      state.bracket.femaleQf[0].opponentFemaleId = qfFemales[3];
      state.bracket.femaleQf[0].chosenMaleId = null;
      state.bracket.femaleQf[0].opponentFemaleId = null;
      state.bracket.femaleQf[0].score1 = null;
      state.bracket.femaleQf[0].score2 = null;
    }
    if (state.bracket.femaleQf[1].chooserFemaleId !== qfFemales[1] || state.bracket.femaleQf[1].opponentFemaleId !== qfFemales[2]) {
      state.bracket.femaleQf[1].chooserFemaleId = qfFemales[1];
      state.bracket.femaleQf[1].opponentFemaleId = qfFemales[2];
      state.bracket.femaleQf[1].chosenMaleId = null;
      state.bracket.femaleQf[1].opponentMaleId = null;
      state.bracket.femaleQf[1].score1 = null;
      state.bracket.femaleQf[1].score2 = null;
    }
  }
}

function renderBracketView() {
  renderMaleQFSection();
  renderMaleSFSection();
  renderMaleFinalSection();

  renderFemaleQFSection();
  renderFemaleSFSection();
  renderFemaleFinalSection();

  checkAndRenderWinners();
}

// Helper to get player rank text in leaderboard
function getPlayerRankInfo(playerId, gender) {
  const list = gender === 'M' ? (state.leaderboard.male || []) : (state.leaderboard.female || []);
  const idx = list.findIndex(item => item.playerId === playerId);
  if (idx !== -1) {
    return { pos: idx + 1, label: `${idx + 1}º` };
  }
  return { pos: 0, label: '' };
}

// --- MALE BRACKET RENDER ---
function renderMaleQFSection() {
  const container = document.getElementById('qf-male-matches-container');
  const hasLeaderboard = state.leaderboard.male && state.leaderboard.male.length >= 6 && state.leaderboard.female && state.leaderboard.female.length >= 6;

  if (hasLeaderboard) {
    initBracketIfNeeded();
  }

  const mqf1 = state.bracket.maleQf ? state.bracket.maleQf[0] : null;
  const mqf2 = state.bracket.maleQf ? state.bracket.maleQf[1] : null;

  // Pool restricted strictly to Rank 3 to Rank 6 Females (indices 2 to 5)
  const qfFemalesPool = hasLeaderboard ? [
    state.leaderboard.female[2],
    state.leaderboard.female[3],
    state.leaderboard.female[4],
    state.leaderboard.female[5]
  ].filter(Boolean) : [];

  const selectedMap = {
    [mqf1?.chooserMaleId]: mqf1?.chosenFemaleId,
    [mqf1?.opponentMaleId]: mqf1?.opponentFemaleId,
    [mqf2?.chooserMaleId]: mqf2?.chosenFemaleId,
    [mqf2?.opponentMaleId]: mqf2?.opponentFemaleId
  };

  const matchesData = [
    {
      matchNum: 1,
      id: 'MQF1',
      title: 'Partido 1: Cuartos Masculinos 1 (3º vs 6º)',
      chooserId: hasLeaderboard ? state.leaderboard.male[2].playerId : null,
      opponentId: hasLeaderboard ? state.leaderboard.male[5].playerId : null,
      chooserRankLabel: '3º',
      opponentRankLabel: '6º',
      matchObj: mqf1
    },
    {
      matchNum: 2,
      id: 'MQF2',
      title: 'Partido 2: Cuartos Masculinos 2 (4º vs 5º)',
      chooserId: hasLeaderboard ? state.leaderboard.male[3].playerId : null,
      opponentId: hasLeaderboard ? state.leaderboard.male[4].playerId : null,
      chooserRankLabel: '4º',
      opponentRankLabel: '5º',
      matchObj: mqf2
    }
  ];

  container.innerHTML = matchesData.map(m => {
    if (!hasLeaderboard || !m.matchObj) {
      return `
        <div class="card">
          <div class="card-title">
            <span>${m.title}</span>
            <span class="icon-badge">Mixto</span>
          </div>
          <div class="match-card">
            <div class="match-teams">
              <div class="team team1"><span class="team-player male"><span class="rank-tag">${m.chooserRankLabel}</span> ${m.chooserRankLabel} Ranqueado Masculino</span></div>
              <div class="vs-badge">VS</div>
              <div class="team team2"><span class="team-player male"><span class="rank-tag">${m.opponentRankLabel}</span> ${m.opponentRankLabel} Ranqueado Masculino</span></div>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">-- Completa la Ronda 2 para definir clasificados --</p>
          </div>
        </div>
      `;
    }

    const chooser = getPlayer(m.chooserId);
    const opponent = getPlayer(m.opponentId);
    const qfMatch = m.matchObj;

    const availForChooser = qfFemalesPool.filter(stat => {
      const fId = stat.playerId;
      if (fId === qfMatch.chosenFemaleId) return true;
      return !Object.values(selectedMap).includes(fId);
    });

    const availForOpponent = qfFemalesPool.filter(stat => {
      const fId = stat.playerId;
      if (fId === qfMatch.opponentFemaleId) return true;
      return !Object.values(selectedMap).includes(fId);
    });

    const selectHtml = state.isAdmin ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">Pareja de <span class="rank-tag">${m.chooserRankLabel}</span> <strong>${escapeHtml(chooser.name)}</strong>:</div>
          <select class="select-dropdown mqf-partner-select" data-qf-id="${m.id}" data-role="chosen">
            <option value="">-- Seleccionar (Pos 3-6) --</option>
            ${availForChooser.map(stat => {
              const f = getPlayer(stat.playerId);
              const rankInfo = getPlayerRankInfo(f.id, 'F');
              return `<option value="${f.id}" ${qfMatch.chosenFemaleId === f.id ? 'selected' : ''}>👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">Pareja de <span class="rank-tag">${m.opponentRankLabel}</span> <strong>${escapeHtml(opponent.name)}</strong>:</div>
          <select class="select-dropdown mqf-partner-select" data-qf-id="${m.id}" data-role="opponent">
            <option value="">-- Seleccionar (Pos 3-6) --</option>
            ${availForOpponent.map(stat => {
              const f = getPlayer(stat.playerId);
              const rankInfo = getPlayerRankInfo(f.id, 'F');
              return `<option value="${f.id}" ${qfMatch.opponentFemaleId === f.id ? 'selected' : ''}>👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    ` : '';

    const bothReady = qfMatch.chosenFemaleId && qfMatch.opponentFemaleId;

    return `
      <div class="card">
        <div class="card-title">
          <span>${m.title}</span>
          <span class="icon-badge">Mixto</span>
        </div>

        ${selectHtml}

        ${bothReady ? renderBracketMatchCard(
          m.id, 'maleQf', chooser, getPlayer(qfMatch.chosenFemaleId), opponent, getPlayer(qfMatch.opponentFemaleId), qfMatch.score1, qfMatch.score2,
          m.chooserRankLabel, m.opponentRankLabel
        ) : '<p style="font-size: 13px; color: var(--text-muted);">Selecciona la pareja femenina para cada jugador para visualizar el partido.</p>'}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.mqf-partner-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const qfId = e.target.getAttribute('data-qf-id');
      const role = e.target.getAttribute('data-role');
      const femaleId = e.target.value || null;
      const qfMatch = state.bracket.maleQf.find(m => m.id === qfId);
      if (qfMatch) {
        if (role === 'chosen') qfMatch.chosenFemaleId = femaleId;
        else if (role === 'opponent') qfMatch.opponentFemaleId = femaleId;

        autoAssignRemainingQfPartner('male');

        saveStateToStorage();
        renderBracketView();
      }
    });
  });

  attachBracketScoreListeners('maleQf');
}

function renderMaleSFSection() {
  const container = document.getElementById('sf-male-matches-container');
  const hasLeaderboard = state.leaderboard.male && state.leaderboard.male.length >= 6 && state.leaderboard.female && state.leaderboard.female.length >= 6;
  const qf1 = state.bracket.maleQf ? state.bracket.maleQf[0] : null;
  const qf2 = state.bracket.maleQf ? state.bracket.maleQf[1] : null;

  const qf1Complete = qf1 && qf1.score1 !== null && qf1.score2 !== null;
  const qf2Complete = qf2 && qf2.score1 !== null && qf2.score2 !== null;

  if (hasLeaderboard && qf1Complete && qf2Complete) {
    const qf1WinMale = qf1.score1 > qf1.score2 ? qf1.chooserMaleId : qf1.opponentMaleId;
    const qf1WinFemale = qf1.score1 > qf1.score2 ? qf1.chosenFemaleId : qf1.opponentFemaleId;

    const qf2WinMale = qf2.score1 > qf2.score2 ? qf2.chooserMaleId : qf2.opponentMaleId;
    const qf2WinFemale = qf2.score1 > qf2.score2 ? qf2.chosenFemaleId : qf2.opponentFemaleId;

    const m1 = state.leaderboard.male[0].playerId;
    const m2 = state.leaderboard.male[1].playerId;

    if (!state.bracket.maleSf || state.bracket.maleSf.length === 0) {
      state.bracket.maleSf = [
        {
          id: 'MSF1',
          title: 'Partido 3: Semifinal Masculina 1',
          seedMaleId: m1,
          qfWinMaleId: qf2WinMale,
          qfWinFemaleId: qf2WinFemale,
          seedFemalePartnerId: null,
          qfWinFemalePartnerId: null,
          score1: null,
          score2: null
        },
        {
          id: 'MSF2',
          title: 'Partido 4: Semifinal Masculina 2',
          seedMaleId: m2,
          qfWinMaleId: qf1WinMale,
          qfWinFemaleId: qf1WinFemale,
          seedFemalePartnerId: null,
          qfWinFemalePartnerId: null,
          score1: null,
          score2: null
        }
      ];
    } else {
      state.bracket.maleSf[0].seedMaleId = m1;
      state.bracket.maleSf[0].qfWinMaleId = qf2WinMale;
      state.bracket.maleSf[0].qfWinFemaleId = qf2WinFemale;

      state.bracket.maleSf[1].seedMaleId = m2;
      state.bracket.maleSf[1].qfWinMaleId = qf1WinMale;
      state.bracket.maleSf[1].qfWinFemaleId = qf1WinFemale;
    }
  }

  const msf1 = state.bracket.maleSf ? state.bracket.maleSf[0] : null;
  const msf2 = state.bracket.maleSf ? state.bracket.maleSf[1] : null;

  const matchesData = [
    {
      matchNum: 3,
      id: 'MSF1',
      title: 'Partido 3: Semifinal Masculina 1',
      seedMaleId: hasLeaderboard ? state.leaderboard.male[0].playerId : null,
      seedRankLabel: '1º',
      oppLabelPlaceholder: 'Ganador Partido 2 (Cuartos 2)',
      qfWinMaleId: msf1?.qfWinMaleId,
      qfWinFemaleId: msf1?.qfWinFemaleId,
      sfMatch: msf1
    },
    {
      matchNum: 4,
      id: 'MSF2',
      title: 'Partido 4: Semifinal Masculina 2',
      seedMaleId: hasLeaderboard ? state.leaderboard.male[1].playerId : null,
      seedRankLabel: '2º',
      oppLabelPlaceholder: 'Ganador Partido 1 (Cuartos 1)',
      qfWinMaleId: msf2?.qfWinMaleId,
      qfWinFemaleId: msf2?.qfWinFemaleId,
      sfMatch: msf2
    }
  ];

  const allFemales = hasLeaderboard ? state.players.filter(p => p.gender === 'F') : [];

  // Map of all females selected in ANY male SF slot
  const selectedFemalesMap = {};
  (state.bracket.maleSf || []).forEach(sf => {
    const p1 = sf.seedFemalePartnerId || sf.chosenPartnerFemaleId;
    const p2 = sf.qfWinFemalePartnerId;
    if (p1) selectedFemalesMap[sf.id + '_seed'] = p1;
    if (p2) selectedFemalesMap[sf.id + '_qfWin'] = p2;
  });

  container.innerHTML = matchesData.map(m => {
    const seedMale = m.seedMaleId ? getPlayer(m.seedMaleId) : null;
    const qfMale = m.qfWinMaleId ? getPlayer(m.qfWinMaleId) : null;

    const sfMatch = m.sfMatch;
    const seedPartnerId = sfMatch?.seedFemalePartnerId || sfMatch?.chosenPartnerFemaleId || null;
    const qfWinPartnerId = sfMatch?.qfWinFemalePartnerId || null;

    let selectHtml = '';
    if (state.isAdmin) {
      const seedSelectHtml = seedMale ? `
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">
            Pareja de <span class="rank-tag">${m.seedRankLabel}</span> <strong>${escapeHtml(seedMale.name)}</strong>:
          </div>
          <select class="select-dropdown msf-partner-select" data-sf-id="${m.id}" data-role="seed">
            <option value="">-- Seleccionar Pareja (1ª a 6ª) --</option>
            ${allFemales.map(f => {
              const rankInfo = getPlayerRankInfo(f.id, 'F');
              const slotKey = m.id + '_seed';
              const isSelectedInThisSlot = seedPartnerId === f.id;
              const isSelectedInOtherSlot = Object.entries(selectedFemalesMap).some(([k, v]) => k !== slotKey && v === f.id);

              if (isSelectedInThisSlot) {
                return `<option value="${f.id}" selected>👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
              } else if (isSelectedInOtherSlot) {
                return `<option value="${f.id}" disabled style="opacity: 0.5;">👩 (${rankInfo.label}) ${escapeHtml(f.name)} (Ya elegida en Semis)</option>`;
              } else {
                return `<option value="${f.id}">👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
              }
            }).join('')}
          </select>
        </div>
      ` : '';

      const qfWinSelectHtml = qfMale ? `
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">
            Pareja de <strong>${escapeHtml(qfMale.name)}</strong> (Ganador Cuartos):
          </div>
          <select class="select-dropdown msf-partner-select" data-sf-id="${m.id}" data-role="qfWin">
            <option value="">-- Seleccionar Pareja (1ª a 6ª) --</option>
            ${allFemales.map(f => {
              const rankInfo = getPlayerRankInfo(f.id, 'F');
              const slotKey = m.id + '_qfWin';
              const isSelectedInThisSlot = qfWinPartnerId === f.id;
              const isSelectedInOtherSlot = Object.entries(selectedFemalesMap).some(([k, v]) => k !== slotKey && v === f.id);
              const isQfRepeat = f.id === getQfPartnerId(qfMale.id);

              if (isSelectedInThisSlot) {
                return `<option value="${f.id}" selected>👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
              } else if (isSelectedInOtherSlot) {
                return `<option value="${f.id}" disabled style="opacity: 0.5;">👩 (${rankInfo.label}) ${escapeHtml(f.name)} (Ya elegida)</option>`;
              } else if (isQfRepeat) {
                return `<option value="${f.id}" disabled style="text-decoration: line-through; opacity: 0.5;"><s>👩 (${rankInfo.label}) ${escapeHtml(f.name)}</s> (🚫 Repetida en Cuartos)</option>`;
              } else {
                return `<option value="${f.id}">👩 (${rankInfo.label}) ${escapeHtml(f.name)}</option>`;
              }
            }).join('')}
          </select>
        </div>
      ` : '';

      if (seedSelectHtml || qfWinSelectHtml) {
        selectHtml = `
          <div style="display: grid; grid-template-columns: ${qfMale ? '1fr 1fr' : '1fr'}; gap: 10px; margin-bottom: 14px;">
            ${seedSelectHtml}
            ${qfWinSelectHtml}
          </div>
        `;
      }
    }

    const seedPartner = seedPartnerId ? getPlayer(seedPartnerId) : null;
    const qfWinPartner = qfWinPartnerId ? getPlayer(qfWinPartnerId) : null;
    const bothReady = seedMale && seedPartner && qfMale && qfWinPartner;

    return `
      <div class="card">
        <div class="card-title">
          <span>${m.title}</span>
          <span class="icon-badge">Mixto</span>
        </div>

        ${selectHtml}

        ${bothReady ? renderBracketMatchCard(
          m.id, 'maleSf', seedMale, seedPartner, qfMale, qfWinPartner, sfMatch.score1, sfMatch.score2,
          m.seedRankLabel, ''
        ) : `
          <div class="match-card">
            <div class="match-teams">
              <div class="team team1">
                <span class="team-player male">${seedMale ? `<span class="rank-tag">${m.seedRankLabel}</span> ${escapeHtml(seedMale.name)}` : `${m.seedRankLabel} Ranqueado Masculino`}</span>
                <span class="team-player female">${seedPartner ? escapeHtml(seedPartner.name) : '(Seleccionar Pareja Femenina)'}</span>
              </div>
              <div class="vs-badge">VS</div>
              <div class="team team2">
                <span class="team-player male">${qfMale ? escapeHtml(qfMale.name) : m.oppLabelPlaceholder}</span>
                <span class="team-player female">${qfWinPartner ? escapeHtml(qfWinPartner.name) : '(Seleccionar Pareja Femenina)'}</span>
              </div>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">
              ${!qf1Complete || !qf2Complete ? '-- Esperando Resultados de Cuartos de Final --' : 'Selecciona las parejas femeninas para ambos jugadores para habilitar marcador'}
            </p>
          </div>
        `}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.msf-partner-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const sfId = e.target.getAttribute('data-sf-id');
      const role = e.target.getAttribute('data-role');
      const femaleId = e.target.value || null;
      const sfMatch = state.bracket.maleSf ? state.bracket.maleSf.find(m => m.id === sfId) : null;
      if (sfMatch) {
        if (role === 'seed') {
          sfMatch.seedFemalePartnerId = femaleId;
          sfMatch.chosenPartnerFemaleId = femaleId;
        } else if (role === 'qfWin') {
          sfMatch.qfWinFemalePartnerId = femaleId;
        }
        saveStateToStorage();
        renderBracketView();
      }
    });
  });

  attachBracketScoreListeners('maleSf');
}

function renderMaleFinalSection() {
  const container = document.getElementById('final-male-matches-container');
  const msf1 = state.bracket.maleSf ? state.bracket.maleSf[0] : null;
  const msf2 = state.bracket.maleSf ? state.bracket.maleSf[1] : null;

  const msf1Complete = msf1 && msf1.score1 !== null && msf1.score2 !== null;
  const msf2Complete = msf2 && msf2.score1 !== null && msf2.score2 !== null;

  if (msf1Complete && msf2Complete) {
    const sf1WinMale = msf1.score1 > msf1.score2 ? msf1.seedMaleId : msf1.qfWinMaleId;
    const sf2WinMale = msf2.score1 > msf2.score2 ? msf2.seedMaleId : msf2.qfWinMaleId;

    if (!state.bracket.maleFinal) {
      state.bracket.maleFinal = {
        id: 'FINAL_MALE',
        title: 'Partido 5: 👑 Gran Final Masculina',
        finalist1Id: sf1WinMale,
        finalist2Id: sf2WinMale,
        partner1Id: null,
        partner2Id: null,
        score1: null,
        score2: null
      };
    } else {
      if (state.bracket.maleFinal.finalist1Id !== sf1WinMale) {
        state.bracket.maleFinal.finalist1Id = sf1WinMale;
        state.bracket.maleFinal.partner1Id = null;
      }
      if (state.bracket.maleFinal.finalist2Id !== sf2WinMale) {
        state.bracket.maleFinal.finalist2Id = sf2WinMale;
        state.bracket.maleFinal.partner2Id = null;
      }
    }
  }

  const m = state.bracket.maleFinal;
  const f1 = m ? getPlayer(m.finalist1Id) : null;
  const f2 = m ? getPlayer(m.finalist2Id) : null;

  const availP1 = f1 && f2 ? state.players.filter(p => p.gender === 'M' && p.id !== m.finalist1Id && p.id !== m.finalist2Id) : [];
  const availP2 = f1 && f2 ? state.players.filter(p => p.gender === 'M' && p.id !== m.finalist1Id && p.id !== m.finalist2Id && p.id !== m.partner1Id) : [];

  const selectHtml = (state.isAdmin && m) ? `
    <div class="pair-select-box">
      <div class="pair-select-label">Dupla Masculina para Finalista 1 (${escapeHtml(f1.name)}):</div>
      <select class="select-dropdown mfinal-p1-select">
        <option value="">-- Seleccionar Pareja Masculina --</option>
        ${availP1.map(p => `<option value="${p.id}" ${m.partner1Id === p.id ? 'selected' : ''}>👨 ${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="pair-select-box">
      <div class="pair-select-label">Dupla Masculina para Finalista 2 (${escapeHtml(f2.name)}):</div>
      <select class="select-dropdown mfinal-p2-select">
        <option value="">-- Seleccionar Pareja Masculina --</option>
        ${availP2.map(p => `<option value="${p.id}" ${m.partner2Id === p.id ? 'selected' : ''}>👨 ${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="card">
      <div class="card-title">
        <span>Partido 5: 👑 Gran Final Masculina</span>
        <span class="icon-badge">Masculina (2v2)</span>
      </div>
      ${selectHtml}
      ${(m && m.partner1Id && m.partner2Id) ? renderBracketMatchCard(
        m.id, 'maleFinal', f1, getPlayer(m.partner1Id), f2, getPlayer(m.partner2Id), m.score1, m.score2
      ) : `
        <div class="match-card">
          <div class="match-teams">
            <div class="team team1">
              <span class="team-player male">${f1 ? escapeHtml(f1.name) : 'Ganador Partido 3 (Semifinal 1)'}</span>
              <span class="team-player male">${m?.partner1Id ? escapeHtml(getPlayer(m.partner1Id).name) : '(Dupla Masculina)'}</span>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team team2">
              <span class="team-player male">${f2 ? escapeHtml(f2.name) : 'Ganador Partido 4 (Semifinal 2)'}</span>
              <span class="team-player male">${m?.partner2Id ? escapeHtml(getPlayer(m.partner2Id).name) : '(Dupla Masculina)'}</span>
            </div>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">
            ${!msf1Complete || !msf2Complete ? '-- Esperando Resultados de Semifinales --' : 'Selecciona las duplas para la Gran Final'}
          </p>
        </div>
      `}
    </div>
  `;

  document.querySelector('.mfinal-p1-select')?.addEventListener('change', (e) => {
    if (m) {
      m.partner1Id = e.target.value || null;
      saveStateToStorage();
      renderBracketView();
    }
  });

  document.querySelector('.mfinal-p2-select')?.addEventListener('change', (e) => {
    if (m) {
      m.partner2Id = e.target.value || null;
      saveStateToStorage();
      renderBracketView();
    }
  });

  attachBracketScoreListeners('maleFinal');
}

// --- FEMALE BRACKET RENDER ---
function renderFemaleQFSection() {
  const container = document.getElementById('qf-female-matches-container');
  const hasLeaderboard = state.leaderboard.male && state.leaderboard.male.length >= 6 && state.leaderboard.female && state.leaderboard.female.length >= 6;

  if (hasLeaderboard) {
    initBracketIfNeeded();
  }

  const fqf1 = state.bracket.femaleQf ? state.bracket.femaleQf[0] : null;
  const fqf2 = state.bracket.femaleQf ? state.bracket.femaleQf[1] : null;

  // Pool restricted strictly to Rank 3 to Rank 6 Males (indices 2 to 5)
  const qfMalesPool = hasLeaderboard ? [
    state.leaderboard.male[2],
    state.leaderboard.male[3],
    state.leaderboard.male[4],
    state.leaderboard.male[5]
  ].filter(Boolean) : [];

  const selectedMap = {
    [fqf1?.chooserFemaleId]: fqf1?.chosenMaleId,
    [fqf1?.opponentFemaleId]: fqf1?.opponentMaleId,
    [fqf2?.chooserFemaleId]: fqf2?.chosenMaleId,
    [fqf2?.opponentFemaleId]: fqf2?.opponentMaleId
  };

  const matchesData = [
    {
      matchNum: 6,
      id: 'FQF1',
      title: 'Partido 6: Cuartos Femeninos 1 (3ª vs 6ª)',
      chooserId: hasLeaderboard ? state.leaderboard.female[2].playerId : null,
      opponentId: hasLeaderboard ? state.leaderboard.female[5].playerId : null,
      chooserRankLabel: '3ª',
      opponentRankLabel: '6ª',
      matchObj: fqf1
    },
    {
      matchNum: 7,
      id: 'FQF2',
      title: 'Partido 7: Cuartos Femeninos 2 (4ª vs 5ª)',
      chooserId: hasLeaderboard ? state.leaderboard.female[3].playerId : null,
      opponentId: hasLeaderboard ? state.leaderboard.female[4].playerId : null,
      chooserRankLabel: '4ª',
      opponentRankLabel: '5ª',
      matchObj: fqf2
    }
  ];

  container.innerHTML = matchesData.map(m => {
    if (!hasLeaderboard || !m.matchObj) {
      return `
        <div class="card">
          <div class="card-title">
            <span>${m.title}</span>
            <span class="icon-badge">Mixto</span>
          </div>
          <div class="match-card">
            <div class="match-teams">
              <div class="team team1"><span class="team-player female"><span class="rank-tag female">${m.chooserRankLabel}</span> ${m.chooserRankLabel} Ranqueada Femenina</span></div>
              <div class="vs-badge">VS</div>
              <div class="team team2"><span class="team-player female"><span class="rank-tag female">${m.opponentRankLabel}</span> ${m.opponentRankLabel} Ranqueada Femenina</span></div>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">-- Completa la Ronda 2 para definir clasificadas --</p>
          </div>
        </div>
      `;
    }

    const chooser = getPlayer(m.chooserId);
    const opponent = getPlayer(m.opponentId);
    const qfMatch = m.matchObj;

    const availForChooser = qfMalesPool.filter(stat => {
      const mId = stat.playerId;
      if (mId === qfMatch.chosenMaleId) return true;
      return !Object.values(selectedMap).includes(mId);
    });

    const availForOpponent = qfMalesPool.filter(stat => {
      const mId = stat.playerId;
      if (mId === qfMatch.opponentMaleId) return true;
      return !Object.values(selectedMap).includes(mId);
    });

    const selectHtml = state.isAdmin ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">Pareja de <span class="rank-tag female">${m.chooserRankLabel}</span> <strong>${escapeHtml(chooser.name)}</strong>:</div>
          <select class="select-dropdown fqf-partner-select" data-qf-id="${m.id}" data-role="chosen">
            <option value="">-- Seleccionar (Pos 3-6) --</option>
            ${availForChooser.map(stat => {
              const male = getPlayer(stat.playerId);
              const rankInfo = getPlayerRankInfo(male.id, 'M');
              return `<option value="${male.id}" ${qfMatch.chosenMaleId === male.id ? 'selected' : ''}>👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">Pareja de <span class="rank-tag female">${m.opponentRankLabel}</span> <strong>${escapeHtml(opponent.name)}</strong>:</div>
          <select class="select-dropdown fqf-partner-select" data-qf-id="${m.id}" data-role="opponent">
            <option value="">-- Seleccionar (Pos 3-6) --</option>
            ${availForOpponent.map(stat => {
              const male = getPlayer(stat.playerId);
              const rankInfo = getPlayerRankInfo(male.id, 'M');
              return `<option value="${male.id}" ${qfMatch.opponentMaleId === male.id ? 'selected' : ''}>👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    ` : '';

    const bothReady = qfMatch.chosenMaleId && qfMatch.opponentMaleId;

    return `
      <div class="card">
        <div class="card-title">
          <span>${m.title}</span>
          <span class="icon-badge">Mixto</span>
        </div>

        ${selectHtml}

        ${bothReady ? renderBracketMatchCard(
          m.id, 'femaleQf', chooser, getPlayer(qfMatch.chosenMaleId), opponent, getPlayer(qfMatch.opponentMaleId), qfMatch.score1, qfMatch.score2,
          m.chooserRankLabel, m.opponentRankLabel
        ) : '<p style="font-size: 13px; color: var(--text-muted);">Selecciona la pareja masculina para cada jugadora para visualizar el partido.</p>'}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.fqf-partner-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const qfId = e.target.getAttribute('data-qf-id');
      const role = e.target.getAttribute('data-role');
      const maleId = e.target.value || null;
      const qfMatch = state.bracket.femaleQf.find(m => m.id === qfId);
      if (qfMatch) {
        if (role === 'chosen') qfMatch.chosenMaleId = maleId;
        else if (role === 'opponent') qfMatch.opponentMaleId = maleId;

        autoAssignRemainingQfPartner('female');

        saveStateToStorage();
        renderBracketView();
      }
    });
  });

  attachBracketScoreListeners('femaleQf');
}

function renderFemaleSFSection() {
  const container = document.getElementById('sf-female-matches-container');
  const hasLeaderboard = state.leaderboard.male && state.leaderboard.male.length >= 6 && state.leaderboard.female && state.leaderboard.female.length >= 6;
  const fqf1 = state.bracket.femaleQf ? state.bracket.femaleQf[0] : null;
  const fqf2 = state.bracket.femaleQf ? state.bracket.femaleQf[1] : null;

  const fqf1Complete = fqf1 && fqf1.score1 !== null && fqf1.score2 !== null;
  const fqf2Complete = fqf2 && fqf2.score1 !== null && fqf2.score2 !== null;

  if (hasLeaderboard && fqf1Complete && fqf2Complete) {
    const qf1WinFemale = fqf1.score1 > fqf1.score2 ? fqf1.chooserFemaleId : fqf1.opponentFemaleId;
    const qf1WinMale = fqf1.score1 > fqf1.score2 ? fqf1.chosenMaleId : fqf1.opponentMaleId;

    const qf2WinFemale = fqf2.score1 > fqf2.score2 ? fqf2.chooserFemaleId : fqf2.opponentFemaleId;
    const qf2WinMale = fqf2.score1 > fqf2.score2 ? fqf2.chosenMaleId : fqf2.opponentMaleId;

    const f1 = state.leaderboard.female[0].playerId;
    const f2 = state.leaderboard.female[1].playerId;

    if (!state.bracket.femaleSf || state.bracket.femaleSf.length === 0) {
      state.bracket.femaleSf = [
        {
          id: 'FSF1',
          title: 'Partido 8: Semifinal Femenina 1',
          seedFemaleId: f1,
          qfWinFemaleId: qf2WinFemale,
          qfWinMaleId: qf2WinMale,
          seedMalePartnerId: null,
          qfWinMalePartnerId: null,
          score1: null,
          score2: null
        },
        {
          id: 'FSF2',
          title: 'Partido 9: Semifinal Femenina 2',
          seedFemaleId: f2,
          qfWinFemaleId: qf1WinFemale,
          qfWinMaleId: qf1WinMale,
          seedMalePartnerId: null,
          qfWinMalePartnerId: null,
          score1: null,
          score2: null
        }
      ];
    } else {
      state.bracket.femaleSf[0].seedFemaleId = f1;
      state.bracket.femaleSf[0].qfWinFemaleId = qf2WinFemale;
      state.bracket.femaleSf[0].qfWinMaleId = qf2WinMale;

      state.bracket.femaleSf[1].seedFemaleId = f2;
      state.bracket.femaleSf[1].qfWinFemaleId = qf1WinFemale;
      state.bracket.femaleSf[1].qfWinMaleId = qf1WinMale;
    }
  }

  const fsf1 = state.bracket.femaleSf ? state.bracket.femaleSf[0] : null;
  const fsf2 = state.bracket.femaleSf ? state.bracket.femaleSf[1] : null;

  const matchesData = [
    {
      matchNum: 8,
      id: 'FSF1',
      title: 'Partido 8: Semifinal Femenina 1',
      seedFemaleId: hasLeaderboard ? state.leaderboard.female[0].playerId : null,
      seedRankLabel: '1ª',
      oppLabelPlaceholder: 'Ganadora Partido 7 (Cuartos 2)',
      qfWinFemaleId: fsf1?.qfWinFemaleId,
      qfWinMaleId: fsf1?.qfWinMaleId,
      sfMatch: fsf1
    },
    {
      matchNum: 9,
      id: 'FSF2',
      title: 'Partido 9: Semifinal Femenina 2',
      seedFemaleId: hasLeaderboard ? state.leaderboard.female[1].playerId : null,
      seedRankLabel: '2ª',
      oppLabelPlaceholder: 'Ganadora Partido 6 (Cuartos 1)',
      qfWinFemaleId: fsf2?.qfWinFemaleId,
      qfWinMaleId: fsf2?.qfWinMaleId,
      sfMatch: fsf2
    }
  ];

  const allMales = hasLeaderboard ? state.players.filter(p => p.gender === 'M') : [];

  // Map of all males selected in ANY female SF slot
  const selectedMalesMap = {};
  (state.bracket.femaleSf || []).forEach(sf => {
    const p1 = sf.seedMalePartnerId || sf.chosenPartnerMaleId;
    const p2 = sf.qfWinMalePartnerId;
    if (p1) selectedMalesMap[sf.id + '_seed'] = p1;
    if (p2) selectedMalesMap[sf.id + '_qfWin'] = p2;
  });

  container.innerHTML = matchesData.map(m => {
    const seedFemale = m.seedFemaleId ? getPlayer(m.seedFemaleId) : null;
    const qfFemale = m.qfWinFemaleId ? getPlayer(m.qfWinFemaleId) : null;

    const sfMatch = m.sfMatch;
    const seedPartnerId = sfMatch?.seedMalePartnerId || sfMatch?.chosenPartnerMaleId || null;
    const qfWinPartnerId = sfMatch?.qfWinMalePartnerId || null;

    let selectHtml = '';
    if (state.isAdmin) {
      const seedSelectHtml = seedFemale ? `
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">
            Pareja de <span class="rank-tag female">${m.seedRankLabel}</span> <strong>${escapeHtml(seedFemale.name)}</strong>:
          </div>
          <select class="select-dropdown fsf-partner-select" data-sf-id="${m.id}" data-role="seed">
            <option value="">-- Seleccionar Pareja (1º a 6º) --</option>
            ${allMales.map(male => {
              const rankInfo = getPlayerRankInfo(male.id, 'M');
              const slotKey = m.id + '_seed';
              const isSelectedInThisSlot = seedPartnerId === male.id;
              const isSelectedInOtherSlot = Object.entries(selectedMalesMap).some(([k, v]) => k !== slotKey && v === male.id);

              if (isSelectedInThisSlot) {
                return `<option value="${male.id}" selected>👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
              } else if (isSelectedInOtherSlot) {
                return `<option value="${male.id}" disabled style="opacity: 0.5;">👨 (${rankInfo.label}) ${escapeHtml(male.name)} (Ya elegido en Semis)</option>`;
              } else {
                return `<option value="${male.id}">👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
              }
            }).join('')}
          </select>
        </div>
      ` : '';

      const qfWinSelectHtml = qfFemale ? `
        <div class="pair-select-box" style="margin-bottom: 0;">
          <div class="pair-select-label">
            Pareja de <strong>${escapeHtml(qfFemale.name)}</strong> (Ganadora Cuartos):
          </div>
          <select class="select-dropdown fsf-partner-select" data-sf-id="${m.id}" data-role="qfWin">
            <option value="">-- Seleccionar Pareja (1º a 6º) --</option>
            ${allMales.map(male => {
              const rankInfo = getPlayerRankInfo(male.id, 'M');
              const slotKey = m.id + '_qfWin';
              const isSelectedInThisSlot = qfWinPartnerId === male.id;
              const isSelectedInOtherSlot = Object.entries(selectedMalesMap).some(([k, v]) => k !== slotKey && v === male.id);
              const isQfRepeat = male.id === getQfPartnerId(qfFemale.id);

              if (isSelectedInThisSlot) {
                return `<option value="${male.id}" selected>👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
              } else if (isSelectedInOtherSlot) {
                return `<option value="${male.id}" disabled style="opacity: 0.5;">👨 (${rankInfo.label}) ${escapeHtml(male.name)} (Ya elegido)</option>`;
              } else if (isQfRepeat) {
                return `<option value="${male.id}" disabled style="text-decoration: line-through; opacity: 0.5;"><s>👨 (${rankInfo.label}) ${escapeHtml(male.name)}</s> (🚫 Repetido en Cuartos)</option>`;
              } else {
                return `<option value="${male.id}">👨 (${rankInfo.label}) ${escapeHtml(male.name)}</option>`;
              }
            }).join('')}
          </select>
        </div>
      ` : '';

      if (seedSelectHtml || qfWinSelectHtml) {
        selectHtml = `
          <div style="display: grid; grid-template-columns: ${qfFemale ? '1fr 1fr' : '1fr'}; gap: 10px; margin-bottom: 14px;">
            ${seedSelectHtml}
            ${qfWinSelectHtml}
          </div>
        `;
      }
    }

    const seedPartner = seedPartnerId ? getPlayer(seedPartnerId) : null;
    const qfWinPartner = qfWinPartnerId ? getPlayer(qfWinPartnerId) : null;
    const bothReady = seedFemale && seedPartner && qfFemale && qfWinPartner;

    return `
      <div class="card">
        <div class="card-title">
          <span>${m.title}</span>
          <span class="icon-badge">Mixto</span>
        </div>

        ${selectHtml}

        ${bothReady ? renderBracketMatchCard(
          m.id, 'femaleSf', seedFemale, seedPartner, qfFemale, qfWinPartner, sfMatch.score1, sfMatch.score2,
          m.seedRankLabel, ''
        ) : `
          <div class="match-card">
            <div class="match-teams">
              <div class="team team1">
                <span class="team-player female">${seedFemale ? `<span class="rank-tag female">${m.seedRankLabel}</span> ${escapeHtml(seedFemale.name)}` : `${m.seedRankLabel} Ranqueada Femenina`}</span>
                <span class="team-player male">${seedPartner ? escapeHtml(seedPartner.name) : '(Seleccionar Pareja Masculina)'}</span>
              </div>
              <div class="vs-badge">VS</div>
              <div class="team team2">
                <span class="team-player female">${qfFemale ? escapeHtml(qfFemale.name) : m.oppLabelPlaceholder}</span>
                <span class="team-player male">${qfWinPartner ? escapeHtml(qfWinPartner.name) : '(Seleccionar Pareja Masculina)'}</span>
              </div>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">
              ${!fqf1Complete || !fqf2Complete ? '-- Esperando Resultados de Cuartos de Final --' : 'Selecciona las parejas masculinas para ambas jugadoras para habilitar marcador'}
            </p>
          </div>
        `}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.fsf-partner-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const sfId = e.target.getAttribute('data-sf-id');
      const role = e.target.getAttribute('data-role');
      const maleId = e.target.value || null;
      const sfMatch = state.bracket.femaleSf ? state.bracket.femaleSf.find(m => m.id === sfId) : null;
      if (sfMatch) {
        if (role === 'seed') {
          sfMatch.seedMalePartnerId = maleId;
          sfMatch.chosenPartnerMaleId = maleId;
        } else if (role === 'qfWin') {
          sfMatch.qfWinMalePartnerId = maleId;
        }
        saveStateToStorage();
        renderBracketView();
      }
    });
  });

  attachBracketScoreListeners('femaleSf');
}

function renderFemaleFinalSection() {
  const container = document.getElementById('final-female-matches-container');
  const fsf1 = state.bracket.femaleSf ? state.bracket.femaleSf[0] : null;
  const fsf2 = state.bracket.femaleSf ? state.bracket.femaleSf[1] : null;

  const fsf1Complete = fsf1 && fsf1.score1 !== null && fsf1.score2 !== null;
  const fsf2Complete = fsf2 && fsf2.score1 !== null && fsf2.score2 !== null;

  if (fsf1Complete && fsf2Complete) {
    const sf1WinFemale = fsf1.score1 > fsf1.score2 ? fsf1.seedFemaleId : fsf1.qfWinFemaleId;
    const sf2WinFemale = fsf2.score1 > fsf2.score2 ? fsf2.seedFemaleId : fsf2.qfWinFemaleId;

    if (!state.bracket.femaleFinal) {
      state.bracket.femaleFinal = {
        id: 'FINAL_FEMALE',
        title: 'Partido 10: 👑 Gran Final Femenina',
        finalist1Id: sf1WinFemale,
        finalist2Id: sf2WinFemale,
        partner1Id: null,
        partner2Id: null,
        score1: null,
        score2: null
      };
    } else {
      if (state.bracket.femaleFinal.finalist1Id !== sf1WinFemale) {
        state.bracket.femaleFinal.finalist1Id = sf1WinFemale;
        state.bracket.femaleFinal.partner1Id = null;
      }
      if (state.bracket.femaleFinal.finalist2Id !== sf2WinFemale) {
        state.bracket.femaleFinal.finalist2Id = sf2WinFemale;
        state.bracket.femaleFinal.partner2Id = null;
      }
    }
  }

  const m = state.bracket.femaleFinal;
  const f1 = m ? getPlayer(m.finalist1Id) : null;
  const f2 = m ? getPlayer(m.finalist2Id) : null;

  const availP1 = f1 && f2 ? state.players.filter(p => p.gender === 'F' && p.id !== m.finalist1Id && p.id !== m.finalist2Id) : [];
  const availP2 = f1 && f2 ? state.players.filter(p => p.gender === 'F' && p.id !== m.finalist1Id && p.id !== m.finalist2Id && p.id !== m.partner1Id) : [];

  const selectHtml = (state.isAdmin && m) ? `
    <div class="pair-select-box">
      <div class="pair-select-label">Dupla Femenina para Finalista 1 (${escapeHtml(f1.name)}):</div>
      <select class="select-dropdown ffinal-p1-select">
        <option value="">-- Seleccionar Pareja Femenina --</option>
        ${availP1.map(p => `<option value="${p.id}" ${m.partner1Id === p.id ? 'selected' : ''}>👩 ${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="pair-select-box">
      <div class="pair-select-label">Dupla Femenina para Finalista 2 (${escapeHtml(f2.name)}):</div>
      <select class="select-dropdown ffinal-p2-select">
        <option value="">-- Seleccionar Pareja Femenina --</option>
        ${availP2.map(p => `<option value="${p.id}" ${m.partner2Id === p.id ? 'selected' : ''}>👩 ${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="card">
      <div class="card-title">
        <span>Partido 10: 👑 Gran Final Femenina</span>
        <span class="icon-badge">Femenina (2v2)</span>
      </div>
      ${selectHtml}
      ${(m && m.partner1Id && m.partner2Id) ? renderBracketMatchCard(
        m.id, 'femaleFinal', f1, getPlayer(m.partner1Id), f2, getPlayer(m.partner2Id), m.score1, m.score2
      ) : `
        <div class="match-card">
          <div class="match-teams">
            <div class="team team1">
              <span class="team-player female">${f1 ? escapeHtml(f1.name) : 'Ganadora Partido 8 (Semifinal 1)'}</span>
              <span class="team-player female">${m?.partner1Id ? escapeHtml(getPlayer(m.partner1Id).name) : '(Dupla Femenina)'}</span>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team team2">
              <span class="team-player female">${f2 ? escapeHtml(f2.name) : 'Ganadora Partido 9 (Semifinal 2)'}</span>
              <span class="team-player female">${m?.partner2Id ? escapeHtml(getPlayer(m.partner2Id).name) : '(Dupla Femenina)'}</span>
            </div>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">
            ${!fsf1Complete || !fsf2Complete ? '-- Esperando Resultados de Semifinales --' : 'Selecciona las duplas para la Gran Final'}
          </p>
        </div>
      `}
    </div>
  `;

  document.querySelector('.ffinal-p1-select')?.addEventListener('change', (e) => {
    if (m) {
      m.partner1Id = e.target.value || null;
      saveStateToStorage();
      renderBracketView();
    }
  });

  document.querySelector('.ffinal-p2-select')?.addEventListener('change', (e) => {
    if (m) {
      m.partner2Id = e.target.value || null;
      saveStateToStorage();
      renderBracketView();
    }
  });

  attachBracketScoreListeners('femaleFinal');
}

// --- HELPER TO RENDER BRACKET MATCH CARDS ---
function renderBracketMatchCard(matchId, stageKey, t1p1, t1p2, t2p1, t2p2, s1, s2, t1RankTag = '', t2RankTag = '') {
  const score1 = s1 !== null ? s1 : '';
  const score2 = s2 !== null ? s2 : '';

  const scoreInputsHtml = state.isAdmin ? `
    <input type="number" class="score-input score-bracket" data-stage="${stageKey}" data-match-id="${matchId}" data-team="1" min="0" max="99" value="${score1}">
    <span class="score-divider">-</span>
    <input type="number" class="score-input score-bracket" data-stage="${stageKey}" data-match-id="${matchId}" data-team="2" min="0" max="99" value="${score2}">
  ` : `
    <span class="score-badge-readonly">${score1 !== '' ? score1 : '-'}</span>
    <span class="score-divider">-</span>
    <span class="score-badge-readonly">${score2 !== '' ? score2 : '-'}</span>
  `;

  return `
    <div class="match-card">
      <div class="match-teams">
        <div class="team team1">
          <span class="team-player ${t1p1.gender === 'M' ? 'male' : 'female'}">
            ${t1RankTag ? `<span class="rank-tag ${t1p1.gender === 'F' ? 'female' : ''}">${t1RankTag}</span>` : ''} ${escapeHtml(t1p1.name)}
          </span>
          <span class="team-player ${t1p2.gender === 'M' ? 'male' : 'female'}">
            ${escapeHtml(t1p2.name)}
          </span>
        </div>
        <div class="vs-badge">VS</div>
        <div class="team team2">
          <span class="team-player ${t2p1.gender === 'M' ? 'male' : 'female'}">
            ${t2RankTag ? `<span class="rank-tag ${t2p1.gender === 'F' ? 'female' : ''}">${t2RankTag}</span>` : ''} ${escapeHtml(t2p1.name)}
          </span>
          <span class="team-player ${t2p2.gender === 'M' ? 'male' : 'female'}">
            ${escapeHtml(t2p2.name)}
          </span>
        </div>
      </div>
      <div class="score-inputs">
        ${scoreInputsHtml}
      </div>
    </div>
  `;
}

function attachBracketScoreListeners(stageKey) {
  if (!state.isAdmin) return;
  const inputs = document.querySelectorAll(`input[data-stage="${stageKey}"]`);
  inputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const matchId = e.target.getAttribute('data-match-id');
      const isTeam1 = e.target.getAttribute('data-team') === '1';
      const val = e.target.value !== '' ? parseInt(e.target.value, 10) : null;

      let match = null;
      if (stageKey === 'maleQf') match = state.bracket.maleQf.find(m => m.id === matchId);
      else if (stageKey === 'femaleQf') match = state.bracket.femaleQf.find(m => m.id === matchId);
      else if (stageKey === 'maleSf') match = state.bracket.maleSf.find(m => m.id === matchId);
      else if (stageKey === 'femaleSf') match = state.bracket.femaleSf.find(m => m.id === matchId);
      else if (stageKey === 'maleFinal') match = state.bracket.maleFinal;
      else if (stageKey === 'femaleFinal') match = state.bracket.femaleFinal;

      if (match) {
        if (isTeam1) match.score1 = val;
        else match.score2 = val;

        saveStateToStorage();
        renderBracketView();
      }
    });
  });
}

function checkAndRenderWinners() {
  const maleBannerContainer = document.getElementById('male-winner-banner-container');
  const femaleBannerContainer = document.getElementById('female-winner-banner-container');

  const mf = state.bracket.maleFinal;
  const ff = state.bracket.femaleFinal;

  if (maleBannerContainer) {
    if (mf && mf.score1 !== null && mf.score2 !== null) {
      const kingTeam = mf.score1 > mf.score2 ? 1 : 2;
      const kingPlayer = getPlayer(kingTeam === 1 ? mf.finalist1Id : mf.finalist2Id);

      maleBannerContainer.innerHTML = `
        <div class="winner-card" style="margin-top: 30px;">
          <div class="winner-crown">👑 🏐 👑</div>
          <div class="winner-title">¡CAMPEÓN REY DE LA PLAYA!</div>
          <div style="margin-top: 16px;">
            <div style="color: var(--secondary); font-size: 14px; font-weight: 700;">REY DE LA PLAYA</div>
            <div class="winner-names">🤴 ${escapeHtml(kingPlayer.name)}</div>
          </div>
        </div>
      `;
    } else {
      maleBannerContainer.innerHTML = '';
    }
  }

  if (femaleBannerContainer) {
    if (ff && ff.score1 !== null && ff.score2 !== null) {
      const queenTeam = ff.score1 > ff.score2 ? 1 : 2;
      const queenPlayer = getPlayer(queenTeam === 1 ? ff.finalist1Id : ff.finalist2Id);

      femaleBannerContainer.innerHTML = `
        <div class="winner-card" style="margin-top: 30px; border-color: var(--female-color);">
          <div class="winner-crown">👑 🏐 👑</div>
          <div class="winner-title" style="color: var(--female-color);">¡CAMPEONA REINA DE LA PLAYA!</div>
          <div style="margin-top: 16px;">
            <div style="color: var(--accent-pink); font-size: 14px; font-weight: 700;">REINA DE LA PLAYA</div>
            <div class="winner-names">👸 ${escapeHtml(queenPlayer.name)}</div>
          </div>
        </div>
      `;
    } else {
      femaleBannerContainer.innerHTML = '';
    }
  }
}

// --- RENDER ALL VIEWS ---
function renderAllViews() {
  renderPlayersInputs();
  renderRound1View();
  renderRound2View();
  renderLeaderboardView();
  renderBracketView();
}

// --- UTILITIES ---
function getPlayer(id) {
  return state.players.find(p => p.id === id) || { id, name: id, gender: 'M' };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportStateJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `Rey_de_Playa_Torneo_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  dlAnchorElem.remove();
  showToast('Respaldo del torneo exportado');
}

function importStateJSON(event) {
  if (!state.isAdmin) return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedState = JSON.parse(e.target.result);
      if (importedState && importedState.players) {
        state = importedState;
        saveStateToStorage();
        renderPlayersInputs();
        renderAllViews();
        showToast('Datos del torneo importados correctamente');
      }
    } catch (err) {
      showToast('Error al importar el archivo JSON', true);
    }
  };
  reader.readAsText(file);
}

function confirmResetTournament() {
  if (!state.isAdmin) return;
  if (confirm('¿Estás seguro de reiniciar todo el torneo? Se borrarán los marcadores y configuraciones actuales.')) {
    state = {
      isAdmin: state.isAdmin,
      players: [...DEFAULT_PLAYERS],
      round1: { groups: [] },
      round2: { groups: [] },
      leaderboard: { male: [], female: [] },
      bracket: {
        maleQf: [],
        femaleQf: [],
        maleSf: [],
        femaleSf: [],
        maleFinal: null,
        femaleFinal: null
      }
    };
    saveStateToStorage();
    renderPlayersInputs();
    renderAllViews();
    showToast('Torneo reiniciado');
    switchTab('tab-players');
  }
}
