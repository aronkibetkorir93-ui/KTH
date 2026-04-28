const SUPABASE_URL = 'https://thfrwuixfeilvztifcfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZnJ3dWl4ZmVpbHZ6dGlmY2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTI0MTAsImV4cCI6MjA5Mjk2ODQxMH0.1jHn3xM24uJ0PDm1HIjBK0TBzqutBM-7Zvbnc2G3leQ';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = { leagueName: "Elite Football Hub", teams: [], matches: [] };

async function loadData() {
    const { data } = await _supabase.from('league_data').select('content').eq('id', 1).single();
    if (data) state = data.content;
    
    if (sessionStorage.getItem('isAdmin') === 'true') {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('admin-controls').style.display = 'block';
    }
    renderAll();
}

async function save() {
    await _supabase.from('league_data').upsert({ id: 1, content: state });
    renderAll();
}

async function addTeam() {
    const nameInput = document.getElementById('team-name-input');
    if (!nameInput.value) return alert("Enter team name!");

    state.teams.push({ id: Date.now(), name: nameInput.value });
    generateWeeks();
    await save();
    nameInput.value = "";
}

async function deleteTeam(id) {
    if (confirm("Delete team? Results will be reset.")) {
        state.teams = state.teams.filter(t => t.id !== id);
        generateWeeks();
        await save();
    }
}

function generateWeeks() {
    state.matches = [];
    let t = [...state.teams];
    if (t.length < 2) return;
    if (t.length % 2 !== 0) t.push({ id: null, name: "BYE" });
    const n = t.length;
    for (let week = 1; week < n; week++) {
        for (let i = 0; i < n / 2; i++) {
            const h = t[i], a = t[n-1-i];
            if (h.id && a.id) state.matches.push({ week, homeId: h.id, awayId: a.id, hS: null, aS: null });
        }
        t.splice(1, 0, t.pop());
    }
}

async function updateScore(idx, side, val) {
    state.matches[idx][side] = val === "" ? null : parseInt(val);
    await save();
}

function renderAll() {
    // 1. Calculate Stats
    const stats = state.teams.map(team => {
        let s = { ...team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
        state.matches.forEach(m => {
            if (m.hS === null || m.aS === null) return;
            const hS = parseInt(m.hS), aS = parseInt(m.aS);
            if (m.homeId === team.id) {
                s.p++; s.gf += hS; s.ga += aS;
                if (hS > aS) { s.w++; s.pts += 3; } else if (hS === aS) { s.d++; s.pts += 1; } else s.l++;
            } else if (m.awayId === team.id) {
                s.p++; s.gf += aS; s.ga += hS;
                if (aS > hS) { s.w++; s.pts += 3; } else if (aS === hS) { s.d++; s.pts += 1; } else s.l++;
            }
        });
        return s;
    }).sort((a,b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

    // 2. Render Standing Table
    document.getElementById('table-body').innerHTML = stats.map((t, i) => `
        <tr>
            <td>${i+1}</td>
            <td><strong>${t.name}</strong></td>
            <td>${t.p}</td><td>${t.w}</td><td>${t.gf}</td><td>${t.ga}</td>
            <td>${t.gf - t.ga}</td><td><strong>${t.pts}</strong></td>
        </tr>
    `).join('');

    // 3. Render Admin Lists
    document.getElementById('admin-team-list').innerHTML = state.teams.map(t => `
        <div class="match-row"><span>${t.name}</span> <button class="delete-btn" onclick="deleteTeam(${t.id})">Del</button></div>
    `).join('');

    document.getElementById('admin-matches-list').innerHTML = state.matches.map((m, i) => {
        const h = state.teams.find(x => x.id === m.homeId), a = state.teams.find(x => x.id === m.awayId);
        return `<div class="match-row"><span>Wk ${m.week}: ${h.name}</span> <div><input type="number" class="score-input" value="${m.hS??''}" onchange="updateScore(${i},'hS',this.value)"> - <input type="number" class="score-input" value="${m.aS??''}" onchange="updateScore(${i},'aS',this.value)"></div> <span>${a.name}</span></div>`;
    }).join('');

    renderFixturesDisplay();
}

function renderFixturesDisplay() {
    const sel = document.getElementById('week-selector');
    const weeks = [...new Set(state.matches.map(m => m.week))];
    if (sel.options.length !== weeks.length) {
        sel.innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
    }
    const w = parseInt(sel.value) || 1;
    document.getElementById('match-list').innerHTML = state.matches.filter(m => m.week === w).map(m => {
        const h = state.teams.find(x => x.id === m.homeId), a = state.teams.find(x => x.id === m.awayId);
        return `<div class="match-row"><span>${h.name}</span> <strong>${m.hS??'-'} : ${m.aS??'-'}</strong> <span>${a.name}</span></div>`;
    }).join('');
}

function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function checkLogin() {
    if (document.getElementById('admin-pass').value === "admin123") {
        sessionStorage.setItem('isAdmin', 'true');
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('admin-controls').style.display = 'block';
    }
}

function downloadSection(id) {
    html2canvas(document.getElementById(id), { backgroundColor: "#0b0e14" }).then(c => {
        const l = document.createElement('a'); l.download = 'table.png'; l.href = c.toDataURL(); l.click();
    });
}

loadData();
