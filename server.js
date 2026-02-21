const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Database Connection
const dbPath = path.resolve(__dirname, 'registry.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the registry database.');
});

// Serve Static Files with Prefix Support
// This allows access via /wedding-registry/ AND root / (for dev)
const router = express.Router();

router.use('/', express.static(path.join(__dirname, 'public')));
// router.use('/cms', express.static(path.join(__dirname, 'cms'))); // Moved to cms.ronagung.dev

// API Routes
router.get('/api/gifts', (req, res) => {
    db.all("SELECT * FROM gifts ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message":"success",
            "data":rows
        });
    });
});

router.post('/api/gifts', (req, res) => {
    const { name, category, price, image_url, link_url } = req.body;
    const sql = "INSERT INTO gifts (name, category, price, image_url, link_url) VALUES (?,?,?,?,?)";
    const params = [name, category, price, image_url, link_url];
    
    db.run(sql, params, function (err, result) {
        if (err){
            res.status(400).json({"error": err.message})
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id" : this.lastID
        })
    });
});

// Update Purchased Status (New)
router.patch('/api/gifts/:id/purchased', (req, res) => {
    const { is_purchased } = req.body;
    const sql = "UPDATE gifts SET is_purchased = ? WHERE id = ?";
    const params = [is_purchased ? 1 : 0, req.params.id];

    db.run(sql, params, function (err, result) {
        if (err){
            res.status(400).json({"error": res.message})
            return;
        }
        res.json({"message":"updated", changes: this.changes})
    });
});

router.delete('/api/gifts/:id', (req, res) => {
    const sql = "DELETE FROM gifts WHERE id = ?";
    db.run(sql, req.params.id, function (err, result) {
        if (err){
            res.status(400).json({"error": res.message})
            return;
        }
        res.json({"message":"deleted", changes: this.changes})
    });
});

// Mount router on both paths to support direct & proxy access
app.use('/', router);
app.use('/wedding-registry', router);

app.listen(port, () => {
    console.log(`Registry Server running at http://localhost:${port}`);
});
