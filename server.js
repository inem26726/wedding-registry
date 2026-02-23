const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3001;

const SESSION_COOKIE = 'cms_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ALLOWED_ORIGINS = new Set([
    'https://cms.ronagung.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());

// Database Connection
const dbPath = path.resolve(__dirname, 'registry.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the registry database.');
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function initAuthSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS cms_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS cms_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_token TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES cms_users(id)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_cms_sessions_token ON cms_sessions(session_token)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_cms_sessions_expires_at ON cms_sessions(expires_at)`);
    });
}

function parseCookies(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return {};

    return cookieHeader
        .split(';')
        .map(v => v.trim())
        .reduce((acc, item) => {
            const idx = item.indexOf('=');
            if (idx < 0) return acc;
            const key = decodeURIComponent(item.slice(0, idx));
            const value = decodeURIComponent(item.slice(idx + 1));
            acc[key] = value;
            return acc;
        }, {});
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, savedHash) {
    const [salt, originalHash] = (savedHash || '').split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(originalHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function setSessionCookie(res, token, expiresAt) {
    // For cross-site CMS at cms.ronagung.dev we need the cookie to be
    // available to subdomain ronagung.dev. Set Domain and SameSite=None
    // when running in production or when a CMS origin is used.
    const expires = new Date(expiresAt).toUTCString();
    const cookieDomain = '.ronagung.dev';
    // Prefer SameSite=None + Domain when the request origin is the CMS domain
    const origin = (res && res.req && res.req.headers && res.req.headers.origin) ? res.req.headers.origin : '';
    const isCmsOrigin = origin.includes('cms.ronagung.dev');
    const useCrossSite = process.env.NODE_ENV === 'production' || isCmsOrigin;
    const cookie = useCrossSite
        ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Domain=${cookieDomain}; HttpOnly; Secure; SameSite=None; Partitioned; Expires=${expires}`
        : `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
    res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

async function authRequired(req, res, next) {
    try {
        const cookies = parseCookies(req);
        const token = cookies[SESSION_COOKIE];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const now = Date.now();
        const session = await get(`SELECT s.id, s.user_id, s.expires_at, u.username, u.role, u.is_active
            FROM cms_sessions s
            JOIN cms_users u ON u.id = s.user_id
            WHERE s.session_token = ?`, [token]);

        if (!session || session.is_active !== 1 || session.expires_at < now) {
            if (session?.id) await run('DELETE FROM cms_sessions WHERE id = ?', [session.id]);
            clearSessionCookie(res);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Sliding session
        const newExpiry = now + SESSION_TTL_MS;
        await run('UPDATE cms_sessions SET expires_at = ? WHERE id = ?', [newExpiry, session.id]);
        setSessionCookie(res, token, newExpiry);

        req.user = { id: session.user_id, username: session.username, role: session.role };
        return next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

initAuthSchema();

// Serve Static Files with Prefix Support
const router = express.Router();
router.use('/', express.static(path.join(__dirname, 'public')));

// Auth routes
router.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password wajib diisi' });
        }

        const user = await get('SELECT id, username, password_hash, role, is_active FROM cms_users WHERE username = ?', [username]);
        if (!user || user.is_active !== 1 || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: 'Username atau password salah' });
        }

        const sessionToken = crypto.randomBytes(48).toString('hex');
        const expiresAt = Date.now() + SESSION_TTL_MS;

        await run('INSERT INTO cms_sessions (session_token, user_id, expires_at) VALUES (?,?,?)', [sessionToken, user.id, expiresAt]);
        setSessionCookie(res, sessionToken, expiresAt);

        return res.json({
            message: 'success',
            data: { username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/auth/logout', async (req, res) => {
    try {
        const cookies = parseCookies(req);
        const token = cookies[SESSION_COOKIE];
        if (token) {
            await run('DELETE FROM cms_sessions WHERE session_token = ?', [token]);
        }
        clearSessionCookie(res);
        return res.json({ message: 'logged_out' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/auth/me', authRequired, (req, res) => {
    return res.json({
        message: 'success',
        data: req.user
    });
});

// Public API Route
router.get('/api/gifts', (req, res) => {
    db.all('SELECT * FROM gifts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: 'success',
            data: rows
        });
    });
});

// Protected API Routes (CMS write actions)
router.post('/api/gifts', authRequired, (req, res) => {
    const { name, category, price, image_url, link_url } = req.body;
    const sql = 'INSERT INTO gifts (name, category, price, image_url, link_url) VALUES (?,?,?,?,?)';
    const params = [name, category, price, image_url, link_url];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: 'success',
            data: req.body,
            id: this.lastID
        });
    });
});

router.put('/api/gifts/:id', authRequired, (req, res) => {
    const { name, category, price, image_url, link_url } = req.body;
    
    // Basic validation
    if (!name || !category || !price) {
        return res.status(400).json({ error: 'Nama, kategori, dan harga wajib diisi' });
    }

    const sql = `UPDATE gifts 
                 SET name = ?, category = ?, price = ?, image_url = ?, link_url = ?
                 WHERE id = ?`;
    const params = [name, category, price, image_url, link_url, req.params.id];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({
            message: 'success',
            data: req.body,
            changes: this.changes
        });
    });
});

router.patch('/api/gifts/:id/purchased', authRequired, (req, res) => {
    const { is_purchased } = req.body;
    const sql = 'UPDATE gifts SET is_purchased = ? WHERE id = ?';
    const params = [is_purchased ? 1 : 0, req.params.id];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: 'updated', changes: this.changes });
    });
});

router.delete('/api/gifts/:id', authRequired, (req, res) => {
    const sql = 'DELETE FROM gifts WHERE id = ?';
    db.run(sql, req.params.id, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: 'deleted', changes: this.changes });
    });
});

app.use('/', router);
app.use('/wedding-registry', router);

app.listen(port, () => {
    console.log(`Registry Server running at http://localhost:${port}`);
});

module.exports = { hashPassword };