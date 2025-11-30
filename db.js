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

  // Tabel quiz (untuk pertanyaan quiz)
  db.run(
    "CREATE TABLE IF NOT EXISTS tb_quiz (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "question TEXT NOT NULL," +
      "option_a TEXT NOT NULL," +
      "option_b TEXT NOT NULL," +
      "option_c TEXT NOT NULL," +
      "option_d TEXT NOT NULL," +
      "correct_answer TEXT NOT NULL," +
      "explanation TEXT," +
      "status INTEGER DEFAULT 1," +
      "createdAt TEXT DEFAULT (datetime('now'))," +
      "updatedAt TEXT" +
      ")"
  );

  // Update tabel yang sudah ada untuk menambahkan kolom status jika belum ada
  try {
    db.run("ALTER TABLE tb_quiz ADD COLUMN status INTEGER DEFAULT 1");
  } catch (e) {
    // Kolom sudah ada, skip
  }

  // Tabel quiz_scores (untuk menyimpan skor user)
  db.run(
    "CREATE TABLE IF NOT EXISTS tb_quiz_scores (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "user_id INTEGER NOT NULL," +
      "user_name TEXT," +
      "user_username TEXT," +
      "chat_id TEXT NOT NULL," +
      "chat_type TEXT," +
      "chat_title TEXT," +
      "score INTEGER DEFAULT 0," +
      "total_questions INTEGER DEFAULT 0," +
      "percentage REAL," +
      "played_at TEXT DEFAULT (datetime('now'))," +
      "createdAt TEXT DEFAULT (datetime('now'))," +
      "updatedAt TEXT" +
      ")"
  );

  // Update tabel yang sudah ada untuk menambahkan kolom baru jika belum ada
  try {
    db.run("ALTER TABLE tb_quiz_scores ADD COLUMN user_name TEXT");
  } catch (e) {
    // Kolom sudah ada, skip
  }
  try {
    db.run("ALTER TABLE tb_quiz_scores ADD COLUMN user_username TEXT");
  } catch (e) {
    // Kolom sudah ada, skip
  }
  try {
    db.run("ALTER TABLE tb_quiz_scores ADD COLUMN chat_type TEXT");
  } catch (e) {
    // Kolom sudah ada, skip
  }
  try {
    db.run("ALTER TABLE tb_quiz_scores ADD COLUMN chat_title TEXT");
  } catch (e) {
    // Kolom sudah ada, skip
  }
  try {
    db.run("ALTER TABLE tb_quiz_scores ADD COLUMN percentage REAL");
  } catch (e) {
    // Kolom sudah ada, skip
  }
  try {
    db.run("ALTER TABLE tb_quiz_scores RENAME COLUMN last_played TO played_at");
  } catch (e) {
    // Kolom sudah ada atau sudah di-rename, skip
  }

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

  // QUIZ CRUD
  // Ambil semua quiz
  allQuiz: function (cb) {
    dbPromise
      .then(function (state) {
        var res = state.db.exec(
          "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, status FROM tb_quiz ORDER BY id ASC"
        );
        var rows =
          res[0] && res[0].values
            ? res[0].values.map(function (row) {
                return {
                  id: row[0],
                  question: row[1],
                  option_a: row[2],
                  option_b: row[3],
                  option_c: row[4],
                  option_d: row[5],
                  correct_answer: row[6],
                  explanation: row[7] || "",
                  status: row[8] !== null && row[8] !== undefined ? row[8] : 1,
                };
              })
            : [];
        cb(null, rows);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil quiz random yang aktif
  getRandomQuiz: function (cb) {
    dbPromise
      .then(function (state) {
        var res = state.db.exec(
          "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, status FROM tb_quiz WHERE status = 1 ORDER BY RANDOM() LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            question: r[1],
            option_a: r[2],
            option_b: r[3],
            option_c: r[4],
            option_d: r[5],
            correct_answer: r[6],
            explanation: r[7] || "",
            status: r[8] || 1,
          };
        }
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil quiz random yang belum pernah ditanyakan dalam session
  getRandomQuizExcluding: function (excludeIds, cb) {
    dbPromise
      .then(function (state) {
        var excludeClause = "";
        if (excludeIds && excludeIds.length > 0) {
          var ids = excludeIds
            .map(function (id) {
              return parseInt(id);
            })
            .join(",");
          excludeClause = " AND id NOT IN (" + ids + ")";
        }
        var res = state.db.exec(
          "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, status FROM tb_quiz WHERE status = 1" +
            excludeClause +
            " ORDER BY RANDOM() LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            question: r[1],
            option_a: r[2],
            option_b: r[3],
            option_c: r[4],
            option_d: r[5],
            correct_answer: r[6],
            explanation: r[7] || "",
            status: r[8] || 1,
          };
        }
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Simpan skor quiz dengan data lengkap
  saveQuizScore: function (data, cb) {
    dbPromise
      .then(function (state) {
        var userId = data.user_id;
        var chatId = data.chat_id;
        var score = data.score || 0;
        var totalQuestions = data.total_questions || 0;
        var percentage =
          totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
        var userName = data.user_name || "";
        var userUsername = data.user_username || "";
        var chatType = data.chat_type || "";
        var chatTitle = data.chat_title || "";

        // Insert skor baru (setiap quiz session disimpan sebagai record baru)
        state.db.run(
          "INSERT INTO tb_quiz_scores (user_id, user_name, user_username, chat_id, chat_type, chat_title, score, total_questions, percentage, played_at, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))",
          [
            userId,
            userName,
            userUsername,
            chatId,
            chatType,
            chatTitle,
            score,
            totalQuestions,
            percentage.toFixed(2),
          ]
        );
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil skor user
  getQuizScore: function (userId, chatId, cb) {
    dbPromise
      .then(function (state) {
        var stmt = state.db.prepare(
          "SELECT score, total_questions, played_at FROM tb_quiz_scores WHERE user_id = ? AND chat_id = ? ORDER BY played_at DESC LIMIT 1"
        );
        stmt.bind([userId, chatId]);
        var row = null;
        if (stmt.step()) {
          var r = stmt.get();
          row = {
            score: r[0],
            total_questions: r[1],
            played_at: r[2],
          };
        }
        stmt.free();
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Cek apakah chat_id sudah ada di tabel quiz scores
  checkChatIdExistsInQuizScores: function (chatId, cb) {
    dbPromise
      .then(function (state) {
        var stmt = state.db.prepare(
          "SELECT COUNT(*) as count FROM tb_quiz_scores WHERE chat_id = ?"
        );
        stmt.bind([String(chatId)]);
        var count = 0;
        if (stmt.step()) {
          var r = stmt.get();
          count = r[0] || 0;
        }
        stmt.free();
        cb(null, count > 0);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Ambil semua skor quiz
  allQuizScores: function (cb) {
    dbPromise
      .then(function (state) {
        var res = state.db.exec(
          "SELECT id, user_id, user_name, user_username, chat_id, chat_type, chat_title, score, total_questions, percentage, played_at, createdAt FROM tb_quiz_scores ORDER BY played_at DESC, createdAt DESC"
        );
        var rows =
          res[0] && res[0].values
            ? res[0].values.map(function (row) {
                return {
                  id: row[0],
                  user_id: row[1],
                  user_name: row[2] || "",
                  user_username: row[3] || "",
                  chat_id: row[4] || "",
                  chat_type: row[5] || "",
                  chat_title: row[6] || "",
                  score: row[7] || 0,
                  total_questions: row[8] || 0,
                  percentage: row[9] || 0,
                  played_at: row[10] || "",
                  createdAt: row[11] || "",
                };
              })
            : [];
        cb(null, rows);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Hapus skor quiz berdasarkan ID
  deleteQuizScore: function (id, cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM tb_quiz_scores WHERE id = ?", [id]);
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Hapus semua skor quiz
  deleteAllQuizScores: function (cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM tb_quiz_scores");
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Buat quiz baru
  createQuiz: function (data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "INSERT INTO tb_quiz (question, option_a, option_b, option_c, option_d, correct_answer, explanation, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          [
            data.question || null,
            data.option_a || null,
            data.option_b || null,
            data.option_c || null,
            data.option_d || null,
            data.correct_answer || null,
            data.explanation || null,
            data.status !== undefined && data.status !== null ? data.status : 1,
          ]
        );
        var res = state.db.exec(
          "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, status FROM tb_quiz ORDER BY id DESC LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            question: r[1],
            option_a: r[2],
            option_b: r[3],
            option_c: r[4],
            option_d: r[5],
            correct_answer: r[6],
            explanation: r[7] || "",
            status: r[8] !== null && r[8] !== undefined ? r[8] : 1,
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Update quiz
  updateQuiz: function (id, data, cb) {
    dbPromise
      .then(function (state) {
        state.db.run(
          "UPDATE tb_quiz SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?, explanation = ?, status = ?, updatedAt = datetime('now') WHERE id = ?",
          [
            data.question || null,
            data.option_a || null,
            data.option_b || null,
            data.option_c || null,
            data.option_d || null,
            data.correct_answer || null,
            data.explanation || null,
            data.status !== undefined && data.status !== null ? data.status : 1,
            id,
          ]
        );
        var res = state.db.exec(
          "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, status FROM tb_quiz WHERE id = " +
            id +
            " LIMIT 1"
        );
        var row = null;
        if (res[0] && res[0].values && res[0].values[0]) {
          var r = res[0].values[0];
          row = {
            id: r[0],
            question: r[1],
            option_a: r[2],
            option_b: r[3],
            option_c: r[4],
            option_d: r[5],
            correct_answer: r[6],
            explanation: r[7] || "",
            status: r[8] !== null && r[8] !== undefined ? r[8] : 1,
          };
        }
        persist(state);
        cb(null, row);
      })
      .catch(function (err) {
        cb(err);
      });
  },

  // Hapus quiz
  deleteQuiz: function (id, cb) {
    dbPromise
      .then(function (state) {
        state.db.run("DELETE FROM tb_quiz WHERE id = ?", [id]);
        persist(state);
        cb(null);
      })
      .catch(function (err) {
        cb(err);
      });
  },
};
