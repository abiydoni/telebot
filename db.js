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

  // Tabel botmenu (untuk menu bot)
  db.run(
    "CREATE TABLE IF NOT EXISTS tb_botmenu (" +
      "id INTEGER PRIMARY KEY," +
      "parent_id INTEGER," +
      "keyword TEXT," +
      "description TEXT," +
      "url TEXT" +
      ")"
  );

  // Isi data default untuk tb_botmenu jika belum ada
  var menuRes = db.exec("SELECT id FROM tb_botmenu LIMIT 1");
  if (!menuRes[0] || !menuRes[0].values || !menuRes[0].values.length) {
    // Data menu utama
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (1, NULL, '1', 'Data Kepala Keluarga', 'http://botwa.appsbee.my.id/api/ambil_data_kk.php')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (2, NULL, '2', 'Jadwal jaga hari ini', 'http://botwa.appsbee.my.id/api/ambil_data_jaga.php')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (3, NULL, '3', 'Semua Jadwal Jaga', NULL)"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (4, NULL, '4', 'Laporan', '')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (18, NULL, '5', 'Informasi lain', 'Masih dalam pengembangan')"
    );

    // Data submenu untuk "Semua Jadwal Jaga" (parent_id = 3)
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (5, 3, '31', 'Senin', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Monday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (6, 3, '32', 'Selasa', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Tuesday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (7, 3, '33', 'Rabu', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Wednesday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (8, 3, '34', 'Kamis', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Thursday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (9, 3, '35', 'Jumat', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Friday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (10, 3, '36', 'Sabtu', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Saturday')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (11, 3, '37', 'Minggu', 'http://botwa.appsbee.my.id/api/ambil_data_jaga_semua.php?hari=Sunday')"
    );

    // Data submenu untuk "Laporan" (parent_id = 4)
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (13, 4, '41', 'Laporan jimpitan semalam', 'http://botwa.appsbee.my.id/api/ambil_data_jimpitan.php')"
    );
    db.run(
      "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (14, 4, '42', 'Laporan lain', 'Masih dalam pengembangan')"
    );
    // Simpan perubahan ke database
    var data = db.export();
    var buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    // Verifikasi data ter-simpan
    var verifyRes = db.exec("SELECT COUNT(*) as count FROM tb_botmenu");
    var verifyCount =
      verifyRes && verifyRes[0] && verifyRes[0].values
        ? verifyRes[0].values[0][0]
        : 0;
  } else {
    // Data sudah ada, verifikasi
    var existingRes = db.exec("SELECT COUNT(*) as count FROM tb_botmenu");
    var existingCount =
      existingRes && existingRes[0] && existingRes[0].values
        ? existingRes[0].values[0][0]
        : 0;
  }

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

  // Pastikan database state ter-persist sebelum return
  var finalData = db.export();
  var finalBuffer = Buffer.from(finalData);
  fs.writeFileSync(dbPath, finalBuffer);

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
        try {
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
          } else {
            console.error("createBot: No row returned from SELECT");
          }
          persist(state);
          cb(null, row);
        } catch (err) {
          console.error("createBot: Error in try block:", err);
          cb(err);
        }
      })
      .catch(function (err) {
        console.error("createBot: Error in promise:", err);
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

  // BOTMENU CRUD
  // Ambil menu berdasarkan parent_id
  getMenuByParent: function (parentId, cb) {
    dbPromise
      .then(function (state) {
        var query =
          parentId === null
            ? "SELECT id, parent_id, keyword, description, url FROM tb_botmenu WHERE parent_id IS NULL ORDER BY keyword ASC"
            : "SELECT id, parent_id, keyword, description, url FROM tb_botmenu WHERE parent_id = ? ORDER BY keyword ASC";
        var params = parentId === null ? [] : [parentId];

        var stmt = state.db.prepare(query);
        if (params.length > 0) {
          stmt.bind(params);
        }

        var rows = [];
        while (stmt.step()) {
          var r = stmt.get();
          rows.push({
            id: r[0],
            parent_id: r[1],
            keyword: r[2],
            description: r[3],
            url: r[4],
          });
        }
        stmt.free();
        cb(null, rows);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil menu berdasarkan keyword
  getMenuByKeyword: function (keyword, cb) {
    dbPromise
      .then(function (state) {
        var stmt = state.db.prepare(
          "SELECT id, parent_id, keyword, description, url FROM tb_botmenu WHERE keyword = ? LIMIT 1"
        );
        stmt.bind([keyword]);
        var row = null;
        if (stmt.step()) {
          var r = stmt.get();
          row = {
            id: r[0],
            parent_id: r[1],
            keyword: r[2],
            description: r[3],
            url: r[4],
          };
        }
        stmt.free();
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil semua menu
  allMenus: function (cb) {
    // Pastikan database ter-load dengan benar - reload dari file setiap kali
    initSqlJs()
      .then(function (SQL) {
        var db;
        if (fs.existsSync(dbPath)) {
          var filebuffer = fs.readFileSync(dbPath);
          db = new SQL.Database(filebuffer);
        } else {
          db = new SQL.Database();
        }

        var res = db.exec(
          "SELECT id, parent_id, keyword, description, url FROM tb_botmenu ORDER BY parent_id, keyword ASC"
        );

        var rows =
          res[0] && res[0].values
            ? res[0].values.map(function (row) {
                return {
                  id: row[0],
                  parent_id:
                    row[1] === null || row[1] === undefined ? null : row[1],
                  keyword: row[2] || null,
                  description: row[3] || null,
                  url: row[4] || null,
                };
              })
            : [];

        cb(null, rows);
      })
      .catch(function (err) {
        console.error("Error in allMenus:", err);
        cb(err);
      });
  },

  // Buat menu baru
  createMenu: function (data, cb) {
    dbPromise
      .then(function (state) {
        // Cari ID terbesar untuk auto increment manual
        var maxIdRes = state.db.exec(
          "SELECT MAX(id) as max_id FROM tb_botmenu"
        );
        var newId = 1;
        if (
          maxIdRes[0] &&
          maxIdRes[0].values &&
          maxIdRes[0].values[0] &&
          maxIdRes[0].values[0][0] !== null
        ) {
          newId = maxIdRes[0].values[0][0] + 1;
        }

        state.db.run(
          "INSERT INTO tb_botmenu (id, parent_id, keyword, description, url) VALUES (?, ?, ?, ?, ?)",
          [
            newId,
            data.parent_id || null,
            data.keyword || null,
            data.description || null,
            data.url || null,
          ]
        );
        var res = state.db.exec(
          "SELECT id, parent_id, keyword, description, url FROM tb_botmenu WHERE id = " +
            newId +
            " LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            parent_id: r[1],
            keyword: r[2],
            description: r[3],
            url: r[4],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Update menu
  updateMenu: function (id, data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "UPDATE tb_botmenu SET parent_id = ?, keyword = ?, description = ?, url = ? WHERE id = ?",
          [
            data.parent_id || null,
            data.keyword || null,
            data.description || null,
            data.url || null,
            id,
          ]
        );
        var res = state.db.exec(
          "SELECT id, parent_id, keyword, description, url FROM tb_botmenu WHERE id = " +
            id +
            " LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            parent_id: r[1],
            keyword: r[2],
            description: r[3],
            url: r[4],
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Hapus menu
  deleteMenu: function (id, cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM tb_botmenu WHERE id = ?", [id]);
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },
};
