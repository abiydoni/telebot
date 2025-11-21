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
