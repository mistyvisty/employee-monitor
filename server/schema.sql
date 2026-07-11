CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department_id INTEGER,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    login_time TEXT NOT NULL,
    logout_time TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    app_name TEXT NOT NULL,
    window_title TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS website_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    browser TEXT,
    time_spent_sec INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    blurred INTEGER DEFAULT 0,
    encrypted INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS idle_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS productivity_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('app','website')),
    match_value TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Productive','Neutral','Non-Productive'))
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    capture_interval_min INTEGER DEFAULT 10,
    capture_mode TEXT DEFAULT 'fixed',
    blur_enabled INTEGER DEFAULT 1,
    encrypt_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_projects (
    employee_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (employee_id, project_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Some starter productivity rules, matching the spec example
INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'Visual Studio', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'Visual Studio');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'VS Code', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'VS Code');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'IntelliJ', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'IntelliJ');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'GitHub', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'GitHub');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'Jira', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'Jira');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'app', 'Teams', 'Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'Teams');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'google.com', 'Neutral'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'google.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'chatgpt.com', 'Neutral'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'chatgpt.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'stackoverflow.com', 'Neutral'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'stackoverflow.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'youtube.com', 'Non-Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'youtube.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'facebook.com', 'Non-Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'facebook.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'instagram.com', 'Non-Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'instagram.com');

INSERT INTO productivity_rules (rule_type, match_value, category)
SELECT 'website', 'netflix.com', 'Non-Productive'
WHERE NOT EXISTS (SELECT 1 FROM productivity_rules WHERE match_value = 'netflix.com');

-- One default settings row
INSERT INTO settings (capture_interval_min, capture_mode, blur_enabled, encrypt_enabled)
SELECT 10, 'fixed', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM settings);
