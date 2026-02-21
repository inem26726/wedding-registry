#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const [, , username, password, role = 'owner'] = process.argv;

if (!username || !password) {
    console.error('Usage: node scripts/create-cms-user.js <username> <password> [role]');
    process.exit(1);
}

const allowedRoles = new Set(['owner', 'admin', 'editor']);
if (!allowedRoles.has(role)) {
    console.error('Role harus salah satu: owner | admin | editor');
    process.exit(1);
}

function hashPassword(rawPassword) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(rawPassword, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

const dbPath = path.resolve(__dirname, '..', 'registry.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Gagal buka DB:', err.message);
        process.exit(1);
    }
});

const passwordHash = hashPassword(password);

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

    db.run(
        'INSERT INTO cms_users (username, password_hash, role, is_active) VALUES (?,?,?,1)',
        [username, passwordHash, role],
        function (err) {
            if (err) {
                console.error('Gagal create user:', err.message);
                process.exitCode = 1;
            } else {
                console.log(`User berhasil dibuat. id=${this.lastID}, username=${username}, role=${role}`);
            }
            db.close();
        }
    );
});