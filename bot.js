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

// Simpan state quiz untuk setiap user
var quizSessions = {};

// Fungsi untuk memulai quiz
function startQuiz(chatId, userId) {
  var sessionKey = chatId + "_" + userId;
  quizSessions[sessionKey] = {
    score: 0,
    totalQuestions: 0,
    currentQuestion: null,
  };

  db.getRandomQuiz(function (err, quiz) {
    if (err || !quiz) {
      bot
        .sendMessage(
          chatId,
          "❌ Maaf, tidak ada pertanyaan quiz tersedia saat ini. Silakan hubungi admin untuk menambahkan pertanyaan."
        )
        .catch(function (e) {
          console.error("Gagal kirim error quiz:", e);
        });
      return;
    }

    quizSessions[sessionKey].currentQuestion = quiz;
    quizSessions[sessionKey].totalQuestions++;

    var questionText = "🎯 *QUIZ*\n\n";
    questionText += "*Pertanyaan:*\n" + quiz.question + "\n\n";
    questionText += "*Pilihan Jawaban:*\n";
    questionText += "A. " + quiz.option_a + "\n";
    questionText += "B. " + quiz.option_b + "\n";
    questionText += "C. " + quiz.option_c + "\n";
    questionText += "D. " + quiz.option_d + "\n\n";
    questionText += "Pilih jawaban dengan mengetik: *A*, *B*, *C*, atau *D*";

    bot
      .sendMessage(chatId, questionText, { parse_mode: "Markdown" })
      .catch(function (e) {
        bot.sendMessage(chatId, questionText).catch(function (err) {
          console.error("Gagal kirim quiz:", err);
        });
      });
  });
}

// Handler untuk jawaban quiz
function handleQuizAnswer(chatId, userId, answer) {
  var sessionKey = chatId + "_" + userId;
  var session = quizSessions[sessionKey];

  if (!session || !session.currentQuestion) {
    bot
      .sendMessage(
        chatId,
        "❌ Tidak ada quiz aktif. Ketik *6* atau *quiz* untuk memulai quiz baru.",
        { parse_mode: "Markdown" }
      )
      .catch(function (e) {
        bot.sendMessage(
          chatId,
          "❌ Tidak ada quiz aktif. Ketik 6 atau quiz untuk memulai quiz baru."
        );
      });
    return;
  }

  var userAnswer = answer.trim().toUpperCase();
  var correctAnswer = session.currentQuestion.correct_answer
    .trim()
    .toUpperCase();
  var isCorrect = userAnswer === correctAnswer;

  if (isCorrect) {
    session.score++;
  }

  var resultText = isCorrect ? "✅ *Benar!*" : "❌ *Salah!*";
  resultText += "\n\n";
  resultText += "*Jawaban yang benar:* " + correctAnswer + "\n";
  if (session.currentQuestion.explanation) {
    resultText += "*Penjelasan:* " + session.currentQuestion.explanation + "\n";
  }
  resultText += "\n";
  resultText +=
    "📊 *Skor saat ini:* " +
    session.score +
    " / " +
    session.totalQuestions +
    "\n\n";
  resultText += "Ketik *6* atau *quiz* untuk pertanyaan berikutnya";

  bot
    .sendMessage(chatId, resultText, { parse_mode: "Markdown" })
    .catch(function (e) {
      bot.sendMessage(chatId, resultText).catch(function (err) {
        console.error("Gagal kirim hasil quiz:", err);
      });
    });

  // Simpan skor ke database
  db.saveQuizScore(
    userId,
    String(chatId),
    session.score,
    session.totalQuestions,
    function (err) {
      if (err) {
        console.error("Error saving quiz score:", err);
      }
    }
  );

  // Reset current question dan ambil pertanyaan berikutnya
  session.currentQuestion = null;

  // Otomatis ambil pertanyaan berikutnya setelah 2 detik
  setTimeout(function () {
    db.getRandomQuiz(function (err, quiz) {
      if (err || !quiz) {
        return; // Tidak ada pertanyaan lagi
      }

      session.currentQuestion = quiz;
      session.totalQuestions++;

      var questionText = "🎯 *QUIZ - Pertanyaan Berikutnya*\n\n";
      questionText += "*Pertanyaan:*\n" + quiz.question + "\n\n";
      questionText += "*Pilihan Jawaban:*\n";
      questionText += "A. " + quiz.option_a + "\n";
      questionText += "B. " + quiz.option_b + "\n";
      questionText += "C. " + quiz.option_c + "\n";
      questionText += "D. " + quiz.option_d + "\n\n";
      questionText += "Pilih jawaban dengan mengetik: *A*, *B*, *C*, atau *D*";

      bot
        .sendMessage(chatId, questionText, { parse_mode: "Markdown" })
        .catch(function (e) {
          bot.sendMessage(chatId, questionText).catch(function (err) {
            console.error("Gagal kirim quiz berikutnya:", err);
          });
        });
    });
  }, 2000);
}

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
    if (!msg || !msg.text) {
      return; // Skip jika bukan pesan teks
    }
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
        first_name: msg.chat.first_name || "",
        type: msg.chat.type,
        updatedAt: new Date().toISOString(),
      };
      console.log("Chat terdaftar/diupdate di dashboard:", {
        id: msg.chat.id,
        type: msg.chat.type,
        title: msg.chat.title || msg.chat.first_name || "",
        username: msg.chat.username || "",
      });
    }

    // Handler balas otomatis untuk pesan "menu" dan angka menu
    var messageText = (msg.text || "").trim();
    var messageTextLower = messageText.toLowerCase();

    // Handler untuk jawaban quiz (A, B, C, D)
    if (/^[ABCD]$/i.test(messageText)) {
      handleQuizAnswer(msg.chat.id, msg.from.id, messageText);
      return;
    }

    if (
      messageTextLower === "menu" ||
      messageTextLower === "/menu" ||
      messageTextLower === "/help" ||
      messageTextLower === "/start"
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
    } else if (messageText === "6" || messageText.toLowerCase() === "quiz") {
      // Handler khusus untuk Quiz (menu 6) - konfirmasi dulu sebelum mulai
      var confirmText = "🎯 *QUIZ*\n\n";
      confirmText += "Apakah Anda ingin memulai quiz?\n\n";
      confirmText +=
        "Quiz akan menampilkan pertanyaan secara acak dan Anda akan mendapatkan skor berdasarkan jawaban yang benar.\n\n";
      confirmText += "Pilih opsi di bawah untuk melanjutkan:";

      // Pastikan msg.from.id ada
      if (!msg.from || !msg.from.id) {
        bot.sendMessage(
          msg.chat.id,
          "❌ Error: Tidak dapat mengidentifikasi user. Silakan coba lagi."
        );
        return;
      }

      var userId = String(msg.from.id);

      // Buat inline keyboard dengan format yang benar
      var keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ Ya, Mulai Quiz",
              callback_data: "quiz_start_" + userId,
            },
            { text: "❌ Tidak", callback_data: "quiz_cancel_" + userId },
          ],
        ],
      };

      console.log("Sending quiz confirmation to chat:", msg.chat.id);
      console.log("User ID:", userId);
      console.log("Keyboard:", JSON.stringify(keyboard));

      // Kirim dengan reply_markup
      var sendOptions = {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      };

      bot
        .sendMessage(msg.chat.id, confirmText, sendOptions)
        .then(function (result) {
          console.log(
            "✅ Quiz confirmation sent! Message ID:",
            result.message_id
          );
          console.log(
            "Reply markup applied:",
            result.reply_markup ? "Yes" : "No"
          );
        })
        .catch(function (error) {
          console.error("❌ Error:", error.message || error);

          // Fallback tanpa Markdown
          var fallbackOptions = {
            reply_markup: keyboard,
          };

          bot
            .sendMessage(
              msg.chat.id,
              confirmText.replace(/\*/g, ""),
              fallbackOptions
            )
            .then(function (result) {
              console.log(
                "✅ Sent with fallback! Message ID:",
                result.message_id
              );
            })
            .catch(function (err) {
              console.error("❌ Fallback also failed:", err.message || err);
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
          // Jika ada URL, ambil konten dari URL dengan dukungan redirect
          var http = require("http");
          var https = require("https");
          var url = require("url");

          // Normalisasi URL: jika URL menggunakan HTTP untuk domain tertentu, ubah ke HTTPS
          var normalizedUrl = item.url.trim();
          // Jika URL menggunakan HTTP dan domain mengandung appsbee atau rt07, ubah ke HTTPS
          if (
            normalizedUrl.match(/^http:\/\//) &&
            (normalizedUrl.includes("appsbee") ||
              normalizedUrl.includes("rt07"))
          ) {
            normalizedUrl = normalizedUrl.replace(/^http:/, "https:");
            console.log("URL dinormalisasi dari HTTP ke HTTPS:", normalizedUrl);
          }

          // Fungsi untuk fetch dengan mengikuti redirect
          function fetchWithRedirect(urlString, maxRedirects, callback) {
            if (maxRedirects <= 0) {
              return callback(new Error("Terlalu banyak redirect"));
            }

            console.log(
              "Fetching URL:",
              urlString,
              "(redirects left:",
              maxRedirects,
              ")"
            );

            var urlObj = url.parse(urlString);
            var client = urlObj.protocol === "https:" ? https : http;

            var options = {
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
              path: urlObj.path,
              method: "GET",
              headers: {
                "User-Agent": "TelegramBot/1.0",
                Accept: "text/html,application/json,text/plain,*/*",
                "Accept-Encoding": "identity", // Hindari compression
                Connection: "close",
              },
              // Untuk HTTPS, tambahkan opsi untuk mengabaikan SSL error jika perlu
              rejectUnauthorized: true,
            };

            var req = client.request(options, function (res) {
              console.log(
                "Response status:",
                res.statusCode,
                "from",
                urlString
              );
              console.log("Response headers:", JSON.stringify(res.headers));

              // Handle redirect (301, 302, 307, 308) - cek SEBELUM membaca body
              if (res.statusCode >= 300 && res.statusCode < 400) {
                // Jika ada location header, ikuti redirect
                if (res.headers.location) {
                  var redirectUrl = res.headers.location;
                  // Jika redirect URL relatif, buat absolute URL
                  if (!redirectUrl.match(/^https?:\/\//)) {
                    var baseUrl =
                      urlObj.protocol +
                      "//" +
                      urlObj.hostname +
                      (urlObj.port ? ":" + urlObj.port : "");
                    redirectUrl = url.resolve(baseUrl, redirectUrl);
                  }
                  console.log(
                    "Redirect dari",
                    urlString,
                    "ke",
                    redirectUrl,
                    "(" + res.statusCode + ")"
                  );
                  // Hentikan pembacaan body dan ikuti redirect
                  res.destroy();
                  return fetchWithRedirect(
                    redirectUrl,
                    maxRedirects - 1,
                    callback
                  );
                }
                // Jika tidak ada location header tapi status code adalah redirect,
                // coba beberapa opsi
                console.warn(
                  "Redirect status code",
                  res.statusCode,
                  "tanpa location header untuk",
                  urlString
                );

                // Coba ubah HTTP ke HTTPS
                if (urlObj.protocol === "http:") {
                  var httpsUrl = urlString.replace(/^http:/, "https:");
                  console.log("Mencoba HTTPS sebagai gantinya:", httpsUrl);
                  res.destroy();
                  return fetchWithRedirect(
                    httpsUrl,
                    maxRedirects - 1,
                    callback
                  );
                }

                // Jika sudah HTTPS, coba variasi path
                var pathVariations = [];
                if (!urlObj.path.endsWith("/")) {
                  pathVariations.push(urlString + "/");
                }
                if (urlObj.path.endsWith("/") && urlObj.path !== "/") {
                  pathVariations.push(
                    urlString.substring(0, urlString.length - 1)
                  );
                }

                if (pathVariations.length > 0 && maxRedirects > 1) {
                  console.log("Mencoba variasi path:", pathVariations[0]);
                  res.destroy();
                  return fetchWithRedirect(
                    pathVariations[0],
                    maxRedirects - 1,
                    callback
                  );
                }
              }

              // Jika bukan redirect, baca data
              var data = "";
              res.on("data", function (chunk) {
                data += chunk;
              });
              res.on("end", function () {
                // Cek jika response adalah HTML error page
                var trimmedData = data.trim();
                if (
                  trimmedData.startsWith("<!DOCTYPE") ||
                  trimmedData.startsWith("<html") ||
                  trimmedData.toLowerCase().includes("301 moved permanently") ||
                  trimmedData.toLowerCase().includes("moved permanently")
                ) {
                  console.error(
                    "Response adalah HTML error (301/redirect):",
                    urlString,
                    "Status:",
                    res.statusCode
                  );

                  // Coba ekstrak redirect URL dari HTML jika ada
                  var locationMatch = trimmedData.match(
                    /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i
                  );
                  if (locationMatch && locationMatch[1]) {
                    var extractedUrl = locationMatch[1].trim();
                    if (!extractedUrl.match(/^https?:\/\//)) {
                      var baseUrl =
                        urlObj.protocol +
                        "//" +
                        urlObj.hostname +
                        (urlObj.port ? ":" + urlObj.port : "");
                      extractedUrl = url.resolve(baseUrl, extractedUrl);
                    }
                    console.log(
                      "Mengikuti redirect dari meta tag:",
                      extractedUrl
                    );
                    return fetchWithRedirect(
                      extractedUrl,
                      maxRedirects - 1,
                      callback
                    );
                  }

                  // Coba variasi URL
                  var urlVariations = [];

                  // Jika path tidak berakhir dengan slash, coba dengan slash
                  if (!urlObj.path.endsWith("/")) {
                    urlVariations.push(urlString + "/");
                  }

                  // Jika path berakhir dengan slash, coba tanpa slash
                  if (urlObj.path.endsWith("/") && urlObj.path !== "/") {
                    urlVariations.push(
                      urlString.substring(0, urlString.length - 1)
                    );
                  }

                  // Coba dengan www jika tidak ada
                  if (!urlObj.hostname.startsWith("www.")) {
                    var wwwUrl = urlString.replace(
                      urlObj.hostname,
                      "www." + urlObj.hostname
                    );
                    urlVariations.push(wwwUrl);
                  }

                  // Coba variasi URL yang ada
                  if (urlVariations.length > 0 && maxRedirects > 1) {
                    var nextUrl = urlVariations[0];
                    console.log("Mencoba variasi URL:", nextUrl);
                    return fetchWithRedirect(
                      nextUrl,
                      maxRedirects - 1,
                      callback
                    );
                  }

                  return callback(
                    new Error(
                      "Server mengembalikan HTML error (301 redirect). URL: " +
                        urlString +
                        ". Coba periksa URL di database atau hubungi administrator."
                    )
                  );
                }
                callback(null, data);
              });
            });

            req.on("error", function (err) {
              console.error("Request error untuk", urlString, ":", err);
              // Jika error dan URL menggunakan HTTP, coba HTTPS
              if (urlObj.protocol === "http:" && maxRedirects > 0) {
                var httpsUrl = urlString.replace(/^http:/, "https:");
                console.log("Error dengan HTTP, mencoba HTTPS:", httpsUrl);
                return fetchWithRedirect(httpsUrl, maxRedirects - 1, callback);
              }
              callback(err);
            });

            req.setTimeout(10000, function () {
              req.destroy();
              callback(new Error("Request timeout"));
            });

            req.end();
          }

          // Panggil fetch dengan redirect
          fetchWithRedirect(normalizedUrl, 5, function (err, data) {
            if (err) {
              console.error("Error fetch URL:", err);
              bot
                .sendMessage(
                  msg.chat.id,
                  "Maaf, terjadi kesalahan saat mengambil data: " +
                    (err.message || "Unknown error")
                )
                .catch(function (e) {
                  console.error("Gagal kirim error:", e);
                });
              return;
            }

            var replyText =
              data.trim() || "Maaf, data tidak tersedia untuk saat ini.";
            // Kirim dengan parse_mode Markdown untuk format teks
            bot
              .sendMessage(msg.chat.id, replyText, { parse_mode: "Markdown" })
              .catch(function (err) {
                // Jika Markdown gagal, kirim tanpa parse_mode
                bot.sendMessage(msg.chat.id, replyText).catch(function (e) {
                  console.error("Gagal kirim data dari URL:", e);
                });
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

  // Handler untuk callback query (inline keyboard)
  bot.on("callback_query", function (callbackQuery) {
    var msg = callbackQuery.message;
    var data = callbackQuery.data;
    var userId = callbackQuery.from.id;

    // Handler konfirmasi quiz
    if (data && data.startsWith("quiz_start_")) {
      var callbackUserId = parseInt(data.split("_")[2]);
      if (callbackUserId === userId) {
        // Hapus pesan konfirmasi
        bot
          .answerCallbackQuery(callbackQuery.id, {
            text: "Quiz dimulai!",
          })
          .catch(function (e) {
            console.error("Error answer callback:", e);
          });

        // Mulai quiz
        startQuiz(msg.chat.id, userId);
      } else {
        bot
          .answerCallbackQuery(callbackQuery.id, {
            text: "Ini bukan untuk Anda!",
            show_alert: true,
          })
          .catch(function (e) {
            console.error("Error answer callback:", e);
          });
      }
    } else if (data && data.startsWith("quiz_cancel_")) {
      var callbackUserId = parseInt(data.split("_")[2]);
      if (callbackUserId === userId) {
        bot
          .answerCallbackQuery(callbackQuery.id, {
            text: "Quiz dibatalkan",
          })
          .catch(function (e) {
            console.error("Error answer callback:", e);
          });

        bot
          .sendMessage(
            msg.chat.id,
            "❌ Quiz dibatalkan. Ketik *6* atau *quiz* jika ingin memulai quiz lagi.",
            { parse_mode: "Markdown" }
          )
          .catch(function (e) {
            bot.sendMessage(
              msg.chat.id,
              "❌ Quiz dibatalkan. Ketik 6 atau quiz jika ingin memulai quiz lagi."
            );
          });
      } else {
        bot
          .answerCallbackQuery(callbackQuery.id, {
            text: "Ini bukan untuk Anda!",
            show_alert: true,
          })
          .catch(function (e) {
            console.error("Error answer callback:", e);
          });
      }
    }
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
      var chat = groups[id];
      // Pastikan ID selalu berupa string untuk konsistensi
      if (chat && chat.id !== undefined) {
        chat.id = String(chat.id);
      }
      return chat;
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
