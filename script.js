const SUPABASE_URL = 'https://thfrwuixfeilvztifcfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZnJ3dWl4ZmVpbHZ6dGlmY2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTI0MTAsImV4cCI6MjA5Mjk2ODQxMH0.1jHn3xM24uJ0PDm1HIjBK0TBzqutBM-7Zvbnc2G3leQ';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = { leagueName: "Elite Football Hub", leagueLogo: "", teams: [], matches: [] };

async function loadData() {
    const { data } = await _supabase.from('league_data').select('content').eq('id', 1).single();
    if (data) {
        state = data.content;
        populateWeekSelector();
        renderAll();
    }
}

async function save() {
    await _supabase.from('league_data').upsert({ id: 1, content: state });
    renderAll();
}

async function toBase64(file) {
    return new Promise((res) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => res(reader.result);
    });
}

async function updateLeagueSettings() {
    const name = document.getElementById('new-league-name').value;
    const file = document.getElementById('league-logo-upload').files[0];
    if (name) state.leagueName = name;
    if (file) state.leagueLogo = await toBase64(file);
    save();
}

async function addTeam() {
    const name = document.getElementById('team-name-input').value;
    const file = document.getElementById('team-logo-upload').files[0];
    if (!name || !file) return alert("Missing Info!");
    state.teams.push({ id: Date.now(), name, logo: await toBase64(file) });
    generateWeeks();
    save();
}

function generateWeeks() {
    state.matches = [];
    let t = [...state.teams];
    if (t.length < 2) return;
    if (t.length % 2 !== 0) t.push({ id: null, name: "BYE" });
    const n = t.length;
    for (let week = 0; week < n - 1; week++) {
        for (let i = 0; i < n / 2; i++) {
            const h = t[i], a = t[n-1-i];
            if (h.id && a.id) state.matches.push({ week: week + 1, homeId: h.id, awayId: a.id, hS: null, aS: null });
        }
        t.splice(1, 0, t.pop());
    }
}

function updateScore(idx, side, val) {
    state.matches[idx][side] = val === "" ? null : parseInt(val);
    save();
}

function renderAll() {
    document.getElementById('league-name-display').innerText = state.leagueName;
    if (state.leagueLogo) {
        const logo = document.getElementById('league-logo-display');
        logo.src = state.leagueLogo; logo.style.display = 'block';
    }

    const stats = state.teams.map(team => {
        let s = { ...team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
        state.matches.forEach(m => {
            if (m.hS === null || m.aS === null) return;
            if (m.homeId === team.id) {
                s.p++; s.gf += m.hS; s.ga += m.aS;
                if (m.hS > m.aS) { s.w++; s.pts += 3; } else if (m.hS === m.aS) { s.d++; s.pts += 1; } else s.l++;
            } else if (m.awayId === team.id) {
                s.p++; s.gf += m.aS; s.ga += m.hS;
                if (m.aS > m.hS) { s.w++; s.pts += 3; } else if (m.aS === m.hS) { s.d++; s.pts += 1; } else s.l++;
            }
        });
        s.gd = s.gf - s.ga;
        return s;
    });

    const sorted = [...stats].sort((a, b) => b.pts - a.pts || b.gd - a.gd);
    document.getElementById('table-body').innerHTML = sorted.map((t, i) => `<tr><td>${i+1}</td><td><img src="${t.logo}" class="team-logo-small">${t.name}</td><td>${t.p}</td><td>${t.w}</td><td>${t.gd}</td><td><strong>${t.pts}</strong></td></tr>`).join('');
    document.getElementById('attack-body').innerHTML = [...stats].sort((a,b) => b.gf - a.gf).map((t,i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.gf}</td></tr>`).join('');
    document.getElementById('defence-body').innerHTML = [...stats].sort((a,b) => a.ga - b.ga).map((t,i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.ga}</td></tr>`).join('');

    renderFixtures();
    renderAdmin();
}

function populateWeekSelector() {
    const weeks = [...new Set(state.matches.map(m => m.week))];
    document.getElementById('week-selector').innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
}

function renderFixtures() {
    const w = parseInt(document.getElementById('week-selector').value) || 1;
    const filtered = state.matches.filter(m => m.week === w);
    document.getElementById('match-list').innerHTML = filtered.map(m => {
        const h = state.teams.find(t => t.id === m.homeId), a = state.teams.find(t => t.id === m.awayId);
        return `<div class="match-row"><span><img src="${h.logo}" class="team-logo-small">${h.name}</span><b>${m.hS ?? '-'} : ${m.aS ?? '-'}</b><span>${a.name}<img src="${a.logo}" class="team-logo-small" style="margin-left:10px"></span></div>`;
    }).join('');
}

function renderAdmin() {
    const weeks = [...new Set(state.matches.map(m => m.week))];
    let html = "";
    weeks.forEach(w => {
        html += `<div style="color:var(--blue); margin-top:15px; font-weight:bold;">Week ${w}</div>`;
        state.matches.forEach((m, i) => {
            if (m.week !== w) return;
            const h = state.teams.find(t => t.id === m.homeId), a = state.teams.find(t => t.id === m.awayId);
            html += `<div class="match-row"><span>${h.name}</span><div><input type="number" class="score-input" value="${m.hS ?? ''}" onchange="updateScore(${i}, 'hS', this.value)"> : <input type="number" class="score-input" value="${m.aS ?? ''}" onchange="updateScore(${i}, 'aS', this.value)"></div><span>${a.name}</span></div>`;
        });
    });
    document.getElementById('admin-matches-list').innerHTML = html;
    document.getElementById('admin-team-list').innerHTML = state.teams.map(t => `<div class="match-row"><span>${t.name}</span><button class="delete-btn" onclick="deleteTeam(${t.id})">Del</button></div>`).join('');
}

function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function checkLogin() {
    if (document.getElementById('admin-pass').value === "admin123") {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('admin-controls').style.display = 'block';
    }
}

function downloadSection(id) {
    const el = document.getElementById(id);
    html2canvas(el, { backgroundColor: "#0b0e14", scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${id}.png`; link.href = canvas.toDataURL(); link.click();
    });
}

// DELETE TEAM FUNCTION
function deleteTeam(id) {
    if (confirm("Are you sure? This will reset all fixtures!")) {
        // 1. Remove the team from the state
        state.teams = state.teams.filter(t => t.id !== id);
        
        // 2. Regenerate the fixtures since the team count changed
        generateWeeks();
        
        // 3. Save the new state to Supabase
        save();
        
        // 4. Refresh to update the UI
        location.reload();
    }
}

loadData();
