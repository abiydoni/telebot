var initSqlJs = require("sql.js");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var dbPath = path.join(__dirname, "bots.sqlite");

function hashPassword(plain) {
  return crypto.createHash("sha256").update(String(plain)).digest("hex");
}

// Inisialisasi database secara lazy, simpan di promise
var dbPromise = initSqlJs().then(function (SQL) {
  var db;

  if (fs.existsSync(dbPath)) {
    var filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Tabel bots
  db.run(
    "CREATE TABLE IF NOT EXISTS bots (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "name TEXT," +
      "username TEXT," +
      "token TEXT," +
      "createdAt TEXT DEFAULT (datetime('now'))," +
      "updatedAt TEXT" +
      ")"
  );

  // Tabel users (untuk login dashboard)
  db.run(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "username TEXT UNIQUE," +
      "passwordHash TEXT NOT NULL," +
      "createdAt TEXT DEFAULT (datetime('now'))," +
      "updatedAt TEXT" +
      ")"
  );

  // Pastikan user admin default ada
  var adminRes = db.exec(
    "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
  );
  if (!adminRes[0] || !adminRes[0].values || !adminRes[0].values.length) {
    // password default 'admin123', disimpan dalam bentuk hash
    db.run(
      "INSERT INTO users (username, passwordHash, updatedAt) VALUES ('admin', ?, datetime('now'))",
      [hashPassword("admin123")]
    );
  }

  return { SQL: SQL, db: db };
});

function persist(state) {
  var data = state.db.export();
  var buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

module.exports = {
  // BOT CRUD
  allBots: function (cb) {
    dbPromise
      .then(function (state) {
        var res = state.db.exec(
          "SELECT id, name, username, token, createdAt, updatedAt FROM bots ORDER BY id DESC"
        );
        var rows =
          res[0] && res[0].values
            ? res[0].values.map(function (row) {
                return {
                  id: row[0],
                  name: row[1],
                  username: row[2],
                  token: row[3],
                  createdAt: row[4],
                  updatedAt: row[5],
                };
              })
            : [];
        cb(null, rows);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  getBot: function (id, cb) {
    dbPromise
      .then(function (state) {
        var stmt = state.db.prepare(
          "SELECT id, name, username, token, createdAt, updatedAt FROM bots WHERE id = ?"
        );
        stmt.bind([id]);
        var row = null;
        if (stmt.step()) {
          var r = stmt.get();
          row = {
            id: r[0],
            name: r[1],
            username: r[2],
            token: r[3],
            createdAt: r[4],
            updatedAt: r[5],
          };
        }
        stmt.free();
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  createBot: function (data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "INSERT INTO bots (name, username, token, updatedAt) VALUES (?, ?, ?, datetime('now'))",
          [data.name || null, data.username || null, data.token || null]
        );
        var res = state.db.exec(
          "SELECT id, name, username, token, createdAt, updatedAt FROM bots ORDER BY id DESC LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            name: r[1],
            username: r[2],
            token: r[3],
            createdAt: r[4],
            updatedAt: r[5],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  updateBot: function (id, data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "UPDATE bots SET name = ?, username = ?, token = ?, updatedAt = datetime('now') WHERE id = ?",
          [data.name || null, data.username || null, data.token || null, id]
        );
        var res = state.db.exec(
          "SELECT id, name, username, token, createdAt, updatedAt FROM bots WHERE id = " +
            id +
            " LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            name: r[1],
            username: r[2],
            token: r[3],
            createdAt: r[4],
            updatedAt: r[5],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  deleteBot: function (id, cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM bots WHERE id = ?", [id]);
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // USER CRUD
  // Ambil user berdasarkan username (untuk login)
  getUserByUsername: function (username, cb) {
    dbPromise
      .then(function (state) {
        var stmt = state.db.prepare(
          "SELECT id, username, passwordHash, createdAt, updatedAt FROM users WHERE username = ?"
        );
        stmt.bind([username]);
        var row = null;
        if (stmt.step()) {
          var r = stmt.get();
          row = {
            id: r[0],
            username: r[1],
            passwordHash: r[2],
            createdAt: r[3],
            updatedAt: r[4],
          };
        }
        stmt.free();
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil semua user (untuk halaman manajemen user)
  allUsers: function (cb) {
    dbPromise
      .then(function (state) {
        var res = state.db.exec(
          "SELECT id, username, passwordHash, createdAt, updatedAt FROM users ORDER BY id DESC"
        );
        var rows =
          res[0] && res[0].values
            ? res[0].values.map(function (row) {
                return {
                  id: row[0],
                  username: row[1],
                  passwordHash: row[2],
                  createdAt: row[3],
                  updatedAt: row[4],
                };
              })
            : [];
        cb(null, rows);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Tambah user baru
  createUser: function (data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "INSERT INTO users (username, passwordHash, updatedAt) VALUES (?, ?, datetime('now'))",
          [data.username, data.passwordHash]
        );
        var res = state.db.exec(
          "SELECT id, username, passwordHash, createdAt, updatedAt FROM users WHERE username = '" +
            data.username.replace(/'/g, "''") +
            "' LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            username: r[1],
            passwordHash: r[2],
            createdAt: r[3],
            updatedAt: r[4],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Update user (username dan/atau passwordHash)
  updateUser: function (id, data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "UPDATE users SET username = ?, passwordHash = ?, updatedAt = datetime('now') WHERE id = ?",
          [data.username, data.passwordHash, id]
        );
        var res = state.db.exec(
          "SELECT id, username, passwordHash, createdAt, updatedAt FROM users WHERE id = " +
            id +
            " LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            username: r[1],
            passwordHash: r[2],
            createdAt: r[3],
            updatedAt: r[4],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Hapus user
  deleteUser: function (id, cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM users WHERE id = ?", [id]);
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },
};
