const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'registry.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create Table
  db.run(`CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    price INTEGER,
    image_url TEXT,
    link_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Check if empty, then seed
  db.get("SELECT count(*) as count FROM gifts", (err, row) => {
    if (err) {
      console.error(err);
      db.close();
      return;
    }

    if (row.count === 0) {
      console.log("Seeding dummy data...");
      const stmt = db.prepare("INSERT INTO gifts (name, category, price, image_url, link_url) VALUES (?, ?, ?, ?, ?)");
      
      const dummyData = [
        ["Lampu Gantung Minimalis", "Home", 399000, "https://images.unsplash.com/photo-1513506003011-38c346e67512?w=500", "https://shopee.co.id/lampu-gantung"],
        ["Hair Dryer Panasonic", "Electronics", 450000, "https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=500", "https://tokopedia.com/hair-dryer"],
        ["Set Piring Keramik (Isi 6)", "Kitchen", 250000, "https://images.unsplash.com/photo-1603195885232-a7d039648942?w=500", "https://shopee.co.id/piring-keramik"],
        ["Coffee Maker", "Kitchen", 1200000, "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500", "https://tokopedia.com/coffee-maker"],
        ["Bed Cover King Size", "Bedroom", 850000, "https://images.unsplash.com/photo-1522771753035-10a637fa3d64?w=500", "https://shopee.co.id/bed-cover"]
      ];

      let completed = 0;
      dummyData.forEach(item => {
        stmt.run(item, (err) => {
            completed++;
            if (completed === dummyData.length) {
                stmt.finalize();
                console.log("Dummy data seeded!");
                db.close(); // Close only after all inserts are done
            }
        });
      });
    } else {
        console.log("Database already has data. Skipping seed.");
        db.close();
    }
  });
});
