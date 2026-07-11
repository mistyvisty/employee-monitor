const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve dashboard.html and any other static files placed in this server/ folder
app.use(express.static(__dirname));

// ---------- File upload setup (for screenshots) ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const screenshotStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + (path.extname(file.originalname) || '.png'));
    }
});
const upload = multer({ storage: screenshotStorage });

// Serve saved screenshot files so the dashboard can display them
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Employees ----------
app.post('/employees', (req, res) => {
    const { name, email, department_id } = req.body;
    const stmt = db.prepare(
        'INSERT INTO employees (name, email, department_id) VALUES (?, ?, ?)'
    );
    const info = stmt.run(name, email, department_id || null);
    res.json({ id: info.lastInsertRowid, name, email });
});

app.get('/employees', (req, res) => {
    const employees = db.prepare('SELECT id, name, email, department_id FROM employees ORDER BY name').all();
    res.json(employees);
});

// ---------- Sessions (login / logout) ----------
app.post('/session/login', (req, res) => {
    const { employee_id, login_time } = req.body;
    const stmt = db.prepare(
        'INSERT INTO sessions (employee_id, login_time) VALUES (?, ?)'
    );
    const info = stmt.run(employee_id, login_time || new Date().toISOString());
    res.json({ session_id: info.lastInsertRowid });
});

app.post('/session/logout', (req, res) => {
    const { session_id, logout_time } = req.body;
    db.prepare('UPDATE sessions SET logout_time = ? WHERE id = ?')
        .run(logout_time || new Date().toISOString(), session_id);
    res.json({ ok: true });
});

// ---------- Activity events (app switches) ----------
app.post('/activity', (req, res) => {
    const { employee_id, app_name, window_title, timestamp } = req.body;
    db.prepare(
        'INSERT INTO activity_events (employee_id, app_name, window_title, timestamp) VALUES (?, ?, ?, ?)'
    ).run(employee_id, app_name, window_title || '', timestamp || new Date().toISOString());
    res.json({ ok: true });
});

// ---------- Website usage ----------
app.post('/website-usage', (req, res) => {
    const { employee_id, url, domain, browser, time_spent_sec, timestamp } = req.body;
    db.prepare(
        `INSERT INTO website_usage (employee_id, url, domain, browser, time_spent_sec, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(employee_id, url, domain, browser || '', time_spent_sec || 0, timestamp || new Date().toISOString());
    res.json({ ok: true });
});

// ---------- Idle periods ----------
app.post('/idle', (req, res) => {
    const { employee_id, start_time, end_time } = req.body;
    db.prepare(
        'INSERT INTO idle_periods (employee_id, start_time, end_time) VALUES (?, ?, ?)'
    ).run(employee_id, start_time, end_time || null);
    res.json({ ok: true });
});

// ---------- Screenshots ----------
app.post('/screenshot', upload.single('image'), (req, res) => {
    const { employee_id, blurred, encrypted } = req.body;
    db.prepare(
        `INSERT INTO screenshots (employee_id, file_path, blurred, encrypted, timestamp)
         VALUES (?, ?, ?, ?, ?)`
    ).run(employee_id, req.file.filename, blurred ? 1 : 0, encrypted ? 1 : 0, new Date().toISOString());
    res.json({ ok: true });
});

app.get('/screenshots/:id', (req, res) => {
    const rows = db.prepare(
        'SELECT id, file_path, blurred, encrypted, timestamp FROM screenshots WHERE employee_id = ? ORDER BY timestamp DESC LIMIT 12'
    ).all(req.params.id);
    res.json(rows);
});

// ---------- Productivity rules ----------
app.get('/rules', (req, res) => {
    const rules = db.prepare('SELECT * FROM productivity_rules').all();
    res.json(rules);
});

app.post('/rules', (req, res) => {
    const { rule_type, match_value, category } = req.body;
    db.prepare(
        'INSERT INTO productivity_rules (rule_type, match_value, category) VALUES (?, ?, ?)'
    ).run(rule_type, match_value, category);
    res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
    res.json(settings);
});

app.post('/settings', (req, res) => {
    const { capture_interval_min, capture_mode, blur_enabled, encrypt_enabled } = req.body;
    db.prepare(
        `INSERT INTO settings (capture_interval_min, capture_mode, blur_enabled, encrypt_enabled)
         VALUES (?, ?, ?, ?)`
    ).run(capture_interval_min, capture_mode, blur_enabled ? 1 : 0, encrypt_enabled ? 1 : 0);
    res.json({ ok: true });
});

// ---------- Part 5: Productivity classification helper ----------
function classify(appOrDomain, ruleType) {
    const rule = db.prepare(
        'SELECT category FROM productivity_rules WHERE rule_type = ? AND match_value LIKE ?'
    ).get(ruleType, `%${appOrDomain}%`);
    return rule ? rule.category : 'Neutral';
}

// ---------- Timeline for one employee ----------
app.get('/employee/:id/timeline', (req, res) => {
    const id = req.params.id;
    const activity = db.prepare(
        'SELECT app_name AS label, timestamp FROM activity_events WHERE employee_id = ? ORDER BY timestamp'
    ).all(id);
    const idle = db.prepare(
        'SELECT start_time, end_time FROM idle_periods WHERE employee_id = ? ORDER BY start_time'
    ).all(id);
    const sessions = db.prepare(
        'SELECT login_time, logout_time FROM sessions WHERE employee_id = ? ORDER BY login_time'
    ).all(id);
    const website = db.prepare(
        'SELECT domain, browser, timestamp FROM website_usage WHERE employee_id = ? ORDER BY timestamp'
    ).all(id);
    res.json({ sessions, activity, idle, website });
});

// ---------- Daily report ----------
app.get('/reports/daily/:id', (req, res) => {
    const id = req.params.id;
    const today = new Date().toISOString().slice(0, 10);
    const session = db.prepare(
        `SELECT login_time, logout_time FROM sessions
         WHERE employee_id = ? AND login_time LIKE ? ORDER BY login_time LIMIT 1`
    ).get(id, `${today}%`);
    const topApps = db.prepare(
        `SELECT app_name, COUNT(*) AS events
         FROM activity_events
         WHERE employee_id = ? AND timestamp LIKE ?
         GROUP BY app_name ORDER BY events DESC LIMIT 5`
    ).all(id, `${today}%`);

    const topAppsWithCategory = topApps.map(row => ({
        ...row,
        category: classify(row.app_name, 'app')
    }));

    res.json({
        employee_id: id,
        date: today,
        login_time: session ? session.login_time : null,
        logout_time: session ? session.logout_time : null,
        top_applications: topAppsWithCategory
    });
});

// ---------- Weekly / Monthly reports ----------
function buildRangeReport(id, daysBack) {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceStr = since.toISOString();

    const topApps = db.prepare(
        `SELECT app_name, COUNT(*) AS events
         FROM activity_events
         WHERE employee_id = ? AND timestamp >= ?
         GROUP BY app_name ORDER BY events DESC LIMIT 8`
    ).all(id, sinceStr);

    const topAppsWithCategory = topApps.map(row => ({
        ...row,
        category: classify(row.app_name, 'app')
    }));

    const totalEvents = topAppsWithCategory.reduce((s, a) => s + a.events, 0);
    const productiveEvents = topAppsWithCategory.filter(a => a.category === 'Productive').reduce((s, a) => s + a.events, 0);
    const nonProductiveEvents = topAppsWithCategory.filter(a => a.category === 'Non-Productive').reduce((s, a) => s + a.events, 0);

    return {
        employee_id: id,
        since: sinceStr,
        total_events: totalEvents,
        productive_events: productiveEvents,
        non_productive_events: nonProductiveEvents,
        top_applications: topAppsWithCategory
    };
}

app.get('/reports/weekly/:id', (req, res) => {
    res.json(buildRangeReport(req.params.id, 7));
});

app.get('/reports/monthly/:id', (req, res) => {
    res.json(buildRangeReport(req.params.id, 30));
});

// ---------- Admin summary (dashboard-wide stats, SRS 4.12) ----------
app.get('/reports/admin-summary', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);

    const totalEmployees = db.prepare('SELECT COUNT(*) AS c FROM employees').get().c;

    // "Online" = has a session today with no logout yet
    const onlineEmployees = db.prepare(
        `SELECT COUNT(DISTINCT employee_id) AS c FROM sessions
         WHERE date(login_time) = date(?) AND logout_time IS NULL`
    ).get(today).c;
    const offlineEmployees = Math.max(totalEmployees - onlineEmployees, 0);

    // Per-employee working hours + idle time for today
    const sessionsToday = db.prepare(
        `SELECT employee_id, login_time, logout_time FROM sessions WHERE date(login_time) = date(?)`
    ).all(today);

    let totalWorkingHours = 0;
    let employeesWithSession = 0;
    let totalIdleSeconds = 0;

    sessionsToday.forEach(s => {
        const start = new Date(s.login_time);
        const end = s.logout_time ? new Date(s.logout_time) : new Date();
        const hours = (end - start) / (1000 * 60 * 60);
        if (hours > 0 && hours < 24) {
            totalWorkingHours += hours;
            employeesWithSession++;
        }
    });

    const idleToday = db.prepare(
        `SELECT start_time, end_time FROM idle_periods WHERE date(start_time) = date(?) AND end_time IS NOT NULL`
    ).all(today);
    idleToday.forEach(i => {
        totalIdleSeconds += (new Date(i.end_time) - new Date(i.start_time)) / 1000;
    });

    const avgWorkingHours = employeesWithSession ? (totalWorkingHours / employeesWithSession) : 0;
    const totalWorkingSeconds = totalWorkingHours * 3600;
    const idlePercentage = totalWorkingSeconds > 0 ? (totalIdleSeconds / totalWorkingSeconds) * 100 : 0;

    // Average productivity: % of today's activity events classified Productive, across all employees
    const activityToday = db.prepare(
        `SELECT app_name FROM activity_events WHERE date(timestamp) = date(?)`
    ).all(today);
    let productiveCount = 0;
    activityToday.forEach(a => {
        if (classify(a.app_name, 'app') === 'Productive') productiveCount++;
    });
    const avgProductivity = activityToday.length ? (productiveCount / activityToday.length) * 100 : 0;

    res.json({
        date: today,
        total_employees: totalEmployees,
        online_employees: onlineEmployees,
        offline_employees: offlineEmployees,
        avg_working_hours: Math.round(avgWorkingHours * 10) / 10,
        idle_percentage: Math.round(idlePercentage * 10) / 10,
        avg_productivity_percent: Math.round(avgProductivity * 10) / 10
    });
});

// ---------- Start server ----------
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
