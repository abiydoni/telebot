var TelegramBot = require("node-telegram-bot-api");
var db = require("./db");

// Token runtime utama diambil dari:
// 1. ENV TELEGRAM_TOKEN (jika ada), atau
// 2. Baris pertama di tabel `bots` (bots.sqlite)
var token = process.env.TELEGRAM_TOKEN || null;
var bot = null;

// Simpan daftar grup yang pernah berinteraksi dengan bot
var groups = {};

// Simpan info bot (nama, username, dll) dari Telegram
var botProfile = null;

// Fungsi untuk mendapatkan teks menu dari database
function getMenuText(callback) {
  db.getMenuByParent(null, function (err, menus) {
    if (err || !menus || menus.length === 0) {
      // Fallback menu jika database error
      var fallbackMenu = "📋 *Menu Bot Telegram*\n\n";
      fallbackMenu += "Selamat datang! Berikut adalah menu yang tersedia:\n\n";
      fallbackMenu += "1️⃣ *Info Bot*\n";
      fallbackMenu += "   Ketik: `/info` untuk melihat informasi bot\n\n";
      fallbackMenu += "2️⃣ *Hello*\n";
      fallbackMenu += "   Ketik: `/say_hello [nama]` untuk menyapa\n\n";
      fallbackMenu += "3️⃣ *Kalkulator*\n";
      fallbackMenu +=
        "   Ketik: `/sum [angka1] [angka2] ...` untuk menjumlahkan angka\n\n";
      fallbackMenu += "4️⃣ *Menu*\n";
      fallbackMenu += "   Ketik: `menu` untuk menampilkan menu ini\n\n";
      fallbackMenu += "━━━━━━━━━━━━━━━━━━━━\n";
      fallbackMenu +=
        "💡 *Tips:* Gunakan command dengan awalan `/` atau ketik `menu` untuk melihat menu.\n";
      callback(fallbackMenu);
      return;
    }

    var menu = "📋 *Menu*\n\n";
    menus.forEach(function (item) {
      menu += item.keyword + ". " + item.description + "\n";
    });
    menu += "\nBalas dengan nomor yang diinginkan (contoh: 2 atau 31).";
    callback(menu);
  });
}

function startBot(selectedToken) {
  token = selectedToken;
  bot = new TelegramBot(token, { polling: true });

  console.log("bot server started...");

  bot
    .getMe()
    .then(function (me) {
      botProfile = me;
      console.log(
        "Bot terhubung sebagai:",
        me.first_name || "",
        "(" + (me.username || "tanpa username") + ")"
      );
    })
    .catch(function (err) {
      console.error("Gagal mengambil info bot (getMe):", err.message || err);
    });

  // Handler pesan masuk
  bot.on("message", function (msg) {
    console.log(
      "Pesan diterima dari chat:",
      msg.chat && msg.chat.id,
      "type:",
      msg.chat && msg.chat.type,
      "title:",
      msg.chat && msg.chat.title
    );

    if (msg.chat) {
      groups[msg.chat.id] = {
        id: msg.chat.id,
        title: msg.chat.title || msg.chat.first_name || "",
        username: msg.chat.username || "",
        type: msg.chat.type,
        updatedAt: new Date().toISOString(),
      };
      console.log("Chat terdaftar/diupdate di dashboard:", msg.chat.id);
    }

    // Handler balas otomatis untuk pesan "menu" dan angka menu
    var messageText = (msg.text || "").toLowerCase().trim();
    if (
      messageText === "menu" ||
      messageText === "/menu" ||
      messageText === "/help" ||
      messageText === "/start"
    ) {
      getMenuText(function (menuText) {
        bot
          .sendMessage(msg.chat.id, menuText, { parse_mode: "Markdown" })
          .catch(function (err) {
            // Jika Markdown gagal, kirim tanpa parse_mode
            bot.sendMessage(msg.chat.id, menuText).catch(function (e) {
              console.error("Gagal kirim menu:", e);
            });
          });
      });
    } else if (/^\d{1,3}$/.test(messageText)) {
      // Handler untuk angka menu (1, 2, 31, dll)
      db.getMenuByKeyword(messageText, function (err, item) {
        if (err || !item) {
          bot
            .sendMessage(
              msg.chat.id,
              "Maaf, menu tidak ditemukan. Ketik *menu* untuk melihat daftar menu.",
              { parse_mode: "Markdown" }
            )
            .catch(function (e) {
              bot.sendMessage(
                msg.chat.id,
                "Maaf, menu tidak ditemukan. Ketik menu untuk melihat daftar menu."
              );
            });
          return;
        }

        if (
          item.url &&
          item.url.trim() !== "" &&
          item.url !== "Masih dalam pengembangan"
        ) {
          // Jika ada URL, ambil konten dari URL
          var http = require("http");
          var https = require("https");
          var url = require("url");

          var urlObj = url.parse(item.url);
          var client = urlObj.protocol === "https:" ? https : http;

          var req = client.get(item.url, function (res) {
            var data = "";
            res.on("data", function (chunk) {
              data += chunk;
            });
            res.on("end", function () {
              var replyText =
                data.trim() || "Maaf, data tidak tersedia untuk saat ini.";
              bot.sendMessage(msg.chat.id, replyText).catch(function (e) {
                console.error("Gagal kirim data dari URL:", e);
              });
            });
          });

          req.on("error", function (err) {
            console.error("Error fetch URL:", err);
            bot
              .sendMessage(
                msg.chat.id,
                "Maaf, terjadi kesalahan saat mengambil data."
              )
              .catch(function (e) {
                console.error("Gagal kirim error:", e);
              });
          });

          req.setTimeout(10000, function () {
            req.destroy();
            bot
              .sendMessage(
                msg.chat.id,
                "Maaf, waktu tunggu habis saat mengambil data."
              )
              .catch(function (e) {
                console.error("Gagal kirim timeout:", e);
              });
          });
        } else {
          // Jika tidak ada URL atau "Masih dalam pengembangan", tampilkan submenu
          db.getMenuByParent(item.id, function (err, submenus) {
            if (err || !submenus || submenus.length === 0) {
              bot
                .sendMessage(
                  msg.chat.id,
                  "Belum ada data/menu untuk pilihan tersebut."
                )
                .catch(function (e) {
                  console.error("Gagal kirim submenu:", e);
                });
              return;
            }

            var submenuText = "📋 *" + item.description + "*\n\n";
            submenus.forEach(function (subitem) {
              submenuText +=
                subitem.keyword + ". " + subitem.description + "\n";
            });
            submenuText += "\nBalas dengan nomor yang diinginkan.";

            bot
              .sendMessage(msg.chat.id, submenuText, { parse_mode: "Markdown" })
              .catch(function (err) {
                bot.sendMessage(msg.chat.id, submenuText).catch(function (e) {
                  console.error("Gagal kirim submenu:", e);
                });
              });
          });
        }
      });
    }
  });

  // hello command
  bot.onText(/^\/say_hello (.+)$/, function (msg, match) {
    var name = match[1];
    bot.sendMessage(msg.chat.id, "Hello " + name + "!").then(function () {
      // reply sent!
    });
  });

  // sum command
  bot.onText(/^\/sum((\s+\d+)+)$/, function (msg, match) {
    var result = 0;
    match[1]
      .trim()
      .split(/\s+/)
      .forEach(function (i) {
        result += +i || 0;
      });
    bot.sendMessage(msg.chat.id, result).then(function () {
      // reply sent!
    });
  });

  // info command
  bot.onText(/^\/info$/, function (msg) {
    var infoText = "🤖 *Informasi Bot*\n\n";
    if (botProfile) {
      infoText += "📛 *Nama:* " + (botProfile.first_name || "-") + "\n";
      infoText +=
        "👤 *Username:* @" + (botProfile.username || "tidak ada") + "\n";
      infoText += "🆔 *Bot ID:* " + (botProfile.id || "-") + "\n";
    } else {
      infoText += "Informasi bot sedang dimuat...\n";
    }
    infoText += "\n━━━━━━━━━━━━━━━━━━━━\n";
    infoText += "Ketik `menu` untuk melihat menu lengkap.";

    bot
      .sendMessage(msg.chat.id, infoText, { parse_mode: "Markdown" })
      .catch(function (err) {
        bot.sendMessage(msg.chat.id, infoText).catch(function (e) {
          console.error("Gagal kirim info:", e);
        });
      });
  });
}

// Inisialisasi token dari ENV atau dari tabel bots
if (token) {
  startBot(token);
} else {
  db.allBots(function (err, bots) {
    if (err) {
      console.error("Gagal membaca daftar bot dari database:", err);
      return;
    }
    if (!bots || !bots.length) {
      console.error(
        "Tidak ada bot di tabel 'bots'. Tambahkan bot melalui dashboard atau set TELEGRAM_TOKEN."
      );
      return;
    }

    var firstBot = bots[0];
    console.log(
      "Menggunakan token dari tabel bots (id=%s, username=%s) sebagai bot runtime utama.",
      firstBot.id,
      firstBot.username || "-"
    );
    startBot(firstBot.token);
  });
}

// Ekspor bot dan fungsi untuk mendapatkan daftar grup
module.exports = {
  get bot() {
    return bot;
  },
  getGroups: function () {
    return Object.keys(groups).map(function (id) {
      return groups[id];
    });
  },
  getBotInfo: function () {
    var botId = null;
    if (typeof token === "string" && token.indexOf(":") !== -1) {
      botId = token.split(":")[0];
    }

    var maskedToken = token || "";
    if (typeof maskedToken === "string" && maskedToken.length > 10) {
      maskedToken =
        maskedToken.slice(0, 6) +
        "..." +
        maskedToken.slice(maskedToken.length - 4, maskedToken.length);
    }

    return {
      id: botId,
      tokenMasked: maskedToken || "-",
      firstName: botProfile && botProfile.first_name,
      username: botProfile && botProfile.username,
    };
  },
};
