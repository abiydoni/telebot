var express = require("express");
var packageInfo = require("./package.json");
var botModule = require("./bot");
var db = require("./db");
var TelegramApi = require("node-telegram-bot-api");
var crypto = require("crypto");

var app = new express();

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());

// Penyimpanan sesi sederhana di memory
var sessions = {};

function createSession(username) {
  var token = crypto.randomBytes(24).toString("hex");
  sessions[token] = {
    username: username,
    createdAt: Date.now(),
  };
  return token;
}

function hashPassword(plain) {
  return crypto.createHash("sha256").update(String(plain)).digest("hex");
}

function getUserFromRequest(req) {
  var cookie = req.headers.cookie || "";
  var token = null;
  cookie.split(";").forEach(function (part) {
    var trimmed = part.trim();
    if (trimmed.startsWith("auth_token=")) {
      token = trimmed.split("=")[1];
    }
  });
  if (!token) return null;
  return sessions[token] || null;
}

function requireAuth(req, res, next) {
  var user = getUserFromRequest(req);
  if (!user) {
    return res.redirect("/login");
  }
  req.user = user;
  next();
}

// Middleware untuk API endpoint yang mengembalikan JSON error jika tidak terautentikasi
function requireAuthApi(req, res, next) {
  var user = getUserFromRequest(req);
  if (!user) {
    console.log("Unauthorized API request:", {
      path: req.path,
      method: req.method,
      cookies: req.headers.cookie || "no cookies",
      userAgent: req.headers["user-agent"],
    });
    return res
      .status(401)
      .json({ error: "Unauthorized. Silakan login terlebih dahulu." });
  }
  req.user = user;
  next();
}

// Helper: dapatkan base URL dengan protokol yang benar (mendukung proxy/load balancer)
function getBaseUrl(req) {
  var protocol = req.protocol;
  // Cek jika request datang melalui HTTPS via proxy/load balancer
  if (req.headers["x-forwarded-proto"]) {
    protocol = req.headers["x-forwarded-proto"].split(",")[0].trim();
  } else if (req.secure) {
    protocol = "https";
  }
  // Pastikan selalu HTTPS jika header menunjukkan HTTPS
  if (
    req.headers["x-forwarded-ssl"] === "on" ||
    req.headers["x-forwarded-proto"] === "https"
  ) {
    protocol = "https";
  }
  return protocol + "://" + req.headers.host;
}

// Helper: ambil info bot (nama & username) dari token Telegram
function fetchBotInfoFromToken(token) {
  return new Promise(function (resolve, reject) {
    try {
      var tempBot = new TelegramApi(token, { polling: false });
      tempBot
        .getMe()
        .then(function (me) {
          resolve({
            name: me.first_name || null,
            username: me.username || null,
          });
        })
        .catch(function (err) {
          reject(err);
        });
    } catch (e) {
      reject(e);
    }
  });
}

// Halaman login
app.get("/login", function (req, res) {
  var baseUrl = getBaseUrl(req);
  var error = req.query.error || null;

  var html =
    "<!DOCTYPE html>" +
    "<html>" +
    "<head>" +
    '<meta charset="utf-8" />' +
    "<title>Login - Telegram Bot Manager</title>" +
    '<script src="https://cdn.tailwindcss.com"></script>' +
    "</head>" +
    '<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">' +
    '<div class="w-full max-w-sm px-6 py-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl shadow-black/40">' +
    "<h1 class='text-xl font-semibold text-center mb-2'>Login Admin</h1>" +
    "<p class='text-slate-400 text-xs text-center mb-4'>Masuk untuk mengelola dashboard bot Telegram.</p>" +
    (error
      ? "<div class='mb-3 rounded-md bg-rose-900/40 border border-rose-700/70 text-rose-200 text-xs px-3 py-2'>" +
        "Username atau password salah." +
        "</div>"
      : "") +
    "<form method='POST' action='/login' class='space-y-3 text-sm'>" +
    "<div>" +
    "<label class='block text-slate-300 mb-1'>Username</label>" +
    "<input name='username' class='w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500' placeholder='admin' required />" +
    "</div>" +
    "<div>" +
    "<label class='block text-slate-300 mb-1'>Password</label>" +
    "<input type='password' name='password' class='w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500' placeholder='Password' required />" +
    "</div>" +
    "<button type='submit' class='w-full mt-2 inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition'>Masuk</button>" +
    "</form>" +
    "<p class='mt-4 text-[11px] text-center text-slate-500'>Default: username <span class='font-mono'>admin</span>, password <span class='font-mono'>admin123</span> (atau sesuai konfigurasi awal Anda).</p>" +
    "</div>" +
    "</body>" +
    "</html>";

  res.send(html);
});

app.post("/login", function (req, res) {
  var username = (req.body.username || "").trim();
  var password = req.body.password || "";

  if (!username || !password) {
    return res.redirect("/login?error=1");
  }

  db.getUserByUsername(username, function (err, user) {
    if (err) {
      console.error("DB getUserByUsername error:", err);
      return res.redirect("/login?error=1");
    }
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.redirect("/login?error=1");
    }

    var sessionToken = createSession(user.username);
    // Deteksi apakah menggunakan HTTPS
    var isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    var cookieOptions =
      "auth_token=" +
      sessionToken +
      "; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400";
    if (isSecure) {
      cookieOptions += "; Secure";
    }
    res.setHeader("Set-Cookie", cookieOptions);
    res.redirect("/");
  });
});

app.post("/logout", function (req, res) {
  var cookie = req.headers.cookie || "";
  var token = null;
  cookie.split(";").forEach(function (part) {
    var trimmed = part.trim();
    if (trimmed.startsWith("auth_token=")) {
      token = trimmed.split("=")[1];
    }
  });
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.setHeader("Set-Cookie", "auth_token=; HttpOnly; Path=/; Max-Age=0");
  res.redirect("/login");
});

// Halaman manajemen users (CRUD)
app.get("/users", requireAuth, function (req, res) {
  var baseUrl = getBaseUrl(req);
  var userError = req.query.userError || null;
  var userSuccess = req.query.userSuccess || null;

  db.allUsers(function (err, users) {
    if (err) {
      console.error("DB allUsers error:", err);
      users = [];
      userError = userError || "Gagal memuat daftar user.";
    }

    var userRows =
      users && users.length
        ? users
            .map(function (u) {
              return (
                "<tr>" +
                "<td class='px-3 py-2 text-xs font-mono text-slate-300'>" +
                u.id +
                "</td>" +
                "<td class='px-3 py-2 text-sm'>" +
                u.username +
                "</td>" +
                "<td class='px-3 py-2 text-[11px] font-mono text-amber-300 break-all'>" +
                (u.passwordHash ? u.passwordHash.substring(0, 8) + "…" : "-") +
                "</td>" +
                "<td class='px-3 py-2 text-[11px] text-slate-400'>" +
                (u.createdAt || "-") +
                "</td>" +
                "<td class='px-3 py-2 text-[11px] text-slate-400'>" +
                (u.updatedAt || "-") +
                "</td>" +
                "<td class='px-3 py-2 text-right text-xs space-x-1'>" +
                "<button type='button' class='inline-flex items-center justify-center rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-medium text-slate-50 hover:bg-sky-500' title='Edit user' onclick='editUser(" +
                u.id +
                ', "' +
                (u.username || "").replace(/"/g, "&quot;") +
                "\")'>&#9998;</button>" +
                (u.username === "admin"
                  ? ""
                  : "<form method='POST' action='/users/" +
                    u.id +
                    "/delete' style='display:inline' class='delete-user-form'>" +
                    "<button type='submit' class='inline-flex items-center justify-center rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-medium text-slate-50 hover:bg-rose-500' title='Hapus user'>&#128465;</button>" +
                    "</form>") +
                "</td>" +
                "</tr>"
              );
            })
            .join("")
        : "<tr><td colspan='6' class='px-3 py-4 text-center text-slate-400 text-xs'>Belum ada user.</td></tr>";

    var html =
      "<!DOCTYPE html>" +
      "<html>" +
      "<head>" +
      '<meta charset="utf-8" />' +
      "<title>Manajemen User - Telegram Bot Manager</title>" +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>' +
      "</head>" +
      '<body class="bg-slate-950 text-slate-100 min-h-screen">' +
      '<div class="max-w-5xl mx-auto px-4 py-8 space-y-6">' +
      '<header class="mb-4 flex items-center justify-between">' +
      "<div>" +
      '<h1 class="text-2xl font-semibold tracking-tight">Manajemen User</h1>' +
      '<p class="text-slate-400 text-sm mt-1">Kelola akun yang dapat mengakses dashboard.</p>' +
      "</div>" +
      "<div class='flex gap-2'>" +
      "<a href='/' class='inline-flex items-center rounded-xl border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition'>← Kembali ke Dashboard</a>" +
      "<form method='POST' action='/logout'>" +
      "<button type='submit' class='inline-flex items-center rounded-xl bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700'>Logout</button>" +
      "</form>" +
      "</div>" +
      "</header>" +
      '<section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
      "<h2 class='text-sm font-semibold mb-3 text-slate-200'>Tambah User Baru</h2>" +
      "<form method='POST' action='/users/create' class='grid gap-3 md:grid-cols-3 text-xs'>" +
      "<div><label class='block text-slate-300 mb-1'>Username</label><input name='username' class='w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500' placeholder='admin' required /></div>" +
      "<div><label class='block text-slate-300 mb-1'>Password</label><input type='password' name='password' class='w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500' placeholder='Password untuk login' required /></div>" +
      "<div class='flex items-end justify-end'><button type='submit' class='inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition'>Tambah User</button></div>" +
      "</form>" +
      "</section>" +
      '<section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
      "<h2 class='text-sm font-semibold mb-3 text-slate-200'>Daftar User</h2>" +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-xs border-separate border-spacing-0">' +
      '<thead><tr class="bg-slate-800/70">' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tl-xl">ID</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Username</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-400 border-b border-slate-700/70">Password (hash)</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-400 border-b border-slate-700/70">Dibuat</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-400 border-b border-slate-700/70">Update</th>' +
      '<th class="text-right px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tr-xl">Aksi</th>' +
      "</tr></thead>" +
      "<tbody>" +
      userRows +
      "</tbody>" +
      "</table>" +
      "</div>" +
      "</section>" +
      "</div>" +
      '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>' +
      "<script>" +
      "document.addEventListener('DOMContentLoaded',function(){" +
      "const params=new URLSearchParams(window.location.search);" +
      "const uErr=params.get('userError');const uOk=params.get('userSuccess');" +
      "if(uErr){Swal.fire({icon:'error',title:'Gagal',text:uErr});const cleanUrl=window.location.origin+window.location.pathname;window.history.replaceState({},'',cleanUrl);}" +
      "if(uOk){Swal.fire({icon:'success',title:'Berhasil',text:uOk});const cleanUrl2=window.location.origin+window.location.pathname;window.history.replaceState({},'',cleanUrl2);}" +
      "document.querySelectorAll('.delete-bot-form').forEach(function(form){" +
      "form.addEventListener('submit',function(e){" +
      "e.preventDefault();" +
      "Swal.fire({title:'Hapus user?',text:'User akan dihapus permanen.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#64748b',confirmButtonText:'Ya, hapus',cancelButtonText:'Batal'}).then(function(result){if(result.isConfirmed){form.submit();}});" +
      "});" +
      "});" +
      "});" +
      "async function editUser(id,currentUsername){const {value:formValues}=await Swal.fire({title:'Edit User',html:" +
      '\'<input id="swal-user-username" class="swal2-input" placeholder="Username" value="\'+(currentUsername||\'\')+\'" readonly>\'+ ' +
      '\'<input id="swal-user-password" class="swal2-input" type="password" placeholder="Password baru">\',' +
      "focusConfirm:false,showCancelButton:true,confirmButtonText:'Simpan',cancelButtonText:'Batal',preConfirm:()=>{" +
      "const u=document.getElementById('swal-user-username').value.trim();" +
      "const p=document.getElementById('swal-user-password').value.trim();" +
      "if(!p){Swal.showValidationMessage('Password baru wajib diisi');}" +
      "return [u,p];}});" +
      "if(!formValues)return;const [u,p]=formValues;try{const res=await fetch('" +
      baseUrl +
      "/users/'+id+'/update',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:u,password:p})});if(!res.ok){let errorMsg='Gagal mengupdate user';try{const data=await res.json();errorMsg=data.error||errorMsg;}catch(parseErr){if(res.status===401){errorMsg='Session expired. Silakan login ulang.';}else if(res.status===404){errorMsg='User tidak ditemukan.';}else if(res.status>=500){errorMsg='Server error. Silakan coba lagi.';}}throw new Error(errorMsg);}const result=await res.json();Swal.fire({icon:'success',title:'Berhasil',text:'Password user berhasil diupdate.'}).then(()=>window.location.reload());}catch(e){Swal.fire({icon:'error',title:'Gagal',text:e.message||'Terjadi kesalahan. Pastikan Anda masih login dan coba lagi.'});}}" +
      "</script>" +
      "</body>" +
      "</html>";

    res.send(html);
  });
});

// Halaman awal: ringkasan bot & navigasi ke dashboard (ambil data dari runtime + DB)
app.get("/", requireAuth, function (req, res) {
  var baseUrl = getBaseUrl(req);

  var errorMessage = req.query.error || null;

  db.allBots(function (err, bots) {
    if (err) {
      console.error("DB allBots error:", err);
      bots = [];
    }

    var botRows =
      bots && bots.length
        ? bots
            .map(function (b) {
              var displayName = b.name || "(tanpa nama)";
              var displayUsername = b.username ? "@" + b.username : "-";
              var dashboardUrl =
                "/dashboard?botId=" +
                encodeURIComponent(b.id) +
                "&name=" +
                encodeURIComponent(displayName) +
                "&username=" +
                encodeURIComponent(b.username || "");

              return (
                "<tr>" +
                "<td class='px-3 py-2 font-mono text-xs text-slate-200'>" +
                b.id +
                "</td>" +
                "<td class='px-3 py-2 text-sm'>" +
                "<a href='" +
                dashboardUrl +
                "' class='text-sky-400 hover:text-sky-300 underline decoration-sky-500/60 decoration-dotted'>" +
                displayName +
                "</a>" +
                "</td>" +
                "<td class='px-3 py-2 font-mono text-xs text-slate-200'>" +
                displayUsername +
                "</td>" +
                "<td class='px-3 py-2 font-mono text-[11px] text-amber-300 break-all'>" +
                (b.token || "-") +
                "</td>" +
                "<td class='px-3 py-2 text-[11px] text-slate-400'>" +
                (b.createdAt || "-") +
                "</td>" +
                "<td class='px-3 py-2 text-[11px] text-slate-400'>" +
                (b.updatedAt || "-") +
                "</td>" +
                "<td class='px-3 py-2 text-[11px]'>" +
                "<span class='inline-flex items-center rounded-full bg-emerald-900/50 text-emerald-300 px-2 py-0.5'>" +
                "<span class='mr-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse'></span>" +
                "Aktif" +
                "</span>" +
                "</td>" +
                "<td class='px-3 py-2 text-right text-xs space-x-1'>" +
                "<button type='button' class='inline-flex items-center justify-center rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-medium text-slate-50 hover:bg-sky-500' title='Edit bot' onclick='editBot(" +
                b.id +
                ")'>&#9998;</button>" + // ✏ icon
                "<form method='POST' action='/bots/" +
                b.id +
                "/delete' style='display:inline' class='delete-bot-form'>" +
                "<button type='submit' class='inline-flex items-center justify-center rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-medium text-slate-50 hover:bg-rose-500' title='Hapus bot'>&#128465;</button>" + // 🗑 icon
                "</form>" +
                "</td>" +
                "</tr>"
              );
            })
            .join("")
        : "<tr><td colspan='8' class='px-3 py-4 text-center text-slate-400 text-xs'>Belum ada data bot di database.</td></tr>";

    var html =
      "<!DOCTYPE html>" +
      "<html>" +
      "<head>" +
      '<meta charset="utf-8" />' +
      "<title>Telegram Bot Manager</title>" +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>' +
      "</head>" +
      '<body class="bg-slate-950 text-slate-100 min-h-screen">' +
      '<div class="max-w-5xl mx-auto px-4 py-10 space-y-8">' +
      '<header class="mb-4 flex items-center justify-between gap-3">' +
      "<div>" +
      '<h1 class="text-3xl font-bold tracking-tight">Telegram Bot Manager</h1>' +
      '<p class="text-slate-400 text-sm mt-2 max-w-xl">Halaman awal untuk mengelola bot Telegram: daftar bot tersimpan di database dan endpoint API.</p>' +
      "</div>" +
      "<div class='flex items-center gap-2'>" +
      "<span class='inline-flex items-center rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/60 px-3 py-1 text-[11px] font-medium'>" +
      "<span class='mr-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse'></span>" +
      "User: " +
      (req.user && req.user.username
        ? '<span class="font-mono ml-1">' + req.user.username + "</span>"
        : "<span class='ml-1'>-</span>") +
      "</span>" +
      "<div class='relative'>" +
      "<button id='userMenuButton' type='button' class='inline-flex items-center rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900'>" +
      "<span class='mr-1'>Menu</span>" +
      "<span class='text-slate-400'>▾</span>" +
      "</button>" +
      "<div id='userMenu' class='hidden absolute right-0 mt-2 w-40 rounded-md border border-slate-700 bg-slate-900/95 shadow-lg shadow-black/40 z-20'>" +
      "<a href='/users' class='block px-3 py-2 text-xs text-slate-200 hover:bg-slate-800'>Manajemen User</a>" +
      "<form method='POST' action='/logout' class='border-t border-slate-800'>" +
      "<button type='submit' class='w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-rose-900/40'>Logout</button>" +
      "</form>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</header>" +
      // Tabel semua bot dari SQLite
      '<section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/40">' +
      '<div class="flex items-center justify-between gap-2 mb-3">' +
      '<h2 class="text-lg font-semibold">Semua Bot di Database</h2>' +
      '<p class="text-xs text-slate-400">Data diambil dari tabel <span class="font-mono">bots</span> (SQLite). Gunakan endpoint <span class="font-mono">/api/bots</span> untuk CRUD.</p>' +
      "</div>" +
      '<form method="POST" action="/bots/create" class="mb-4 grid gap-3 md:grid-cols-3 text-xs bg-slate-950/60 border border-slate-800 rounded-xl p-3">' +
      "<div class='md:col-span-2'><label class='block text-slate-300 mb-1'>Token Bot Telegram</label><input name='token' class='w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500' placeholder='123456789:ABCDEF-token-dari-BotFather' required /></div>" +
      "<div class='md:col-span-1 flex items-end'><p class='text-[11px] text-slate-400'>Nama & username akan diambil otomatis dari Telegram menggunakan token ini.</p></div>" +
      "<div class='md:col-span-3 flex justify-end'>" +
      "<button type='submit' class='inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition'>Tambah Bot</button>" +
      "</div>" +
      "</form>" +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-xs border-separate border-spacing-0">' +
      '<thead><tr class="bg-slate-800/70">' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tl-xl">ID</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Nama</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Username</th>' +
      '<th class="text-left px-3 py-2 font-mono text-[11px] text-slate-200 border-b border-slate-700/70">Token</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Dibuat</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Update</th>' +
      '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Status</th>' +
      '<th class="text-right px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tr-xl">Aksi</th>' +
      "</tr></thead>" +
      "<tbody>" +
      botRows +
      "</tbody>" +
      "</table>" +
      "</div>" +
      "</section>" +
      // Ringkasan endpoint
      '<section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/40">' +
      '<h2 class="text-sm font-semibold mb-2 text-slate-200">Ringkasan Endpoint API</h2>' +
      '<p class="text-xs text-slate-400 mb-3">Endpoint yang sama seperti di dashboard, ditampilkan di sini untuk memudahkan integrasi cepat.</p>' +
      '<div class="space-y-2 text-xs font-mono bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-300">' +
      "<div><span class='text-emerald-400 font-semibold'>GET</span> " +
      baseUrl +
      "/api/chats</div>" +
      "<div><span class='text-emerald-400 font-semibold'>GET</span> " +
      baseUrl +
      "/api/groups</div>" +
      "<div><span class='text-emerald-400 font-semibold'>GET</span> " +
      baseUrl +
      "/api/private</div>" +
      "<div><span class='text-sky-400 font-semibold'>POST</span> " +
      baseUrl +
      "/api/send</div>" +
      "<div><span class='text-emerald-400 font-semibold'>GET</span> " +
      baseUrl +
      "/api/bots</div>" +
      "<div><span class='text-emerald-400 font-semibold'>GET</span> " +
      baseUrl +
      "/api/bots/:id</div>" +
      "<div><span class='text-sky-400 font-semibold'>POST</span> " +
      baseUrl +
      "/api/bots</div>" +
      "<div><span class='text-amber-400 font-semibold'>PUT</span> " +
      baseUrl +
      "/api/bots/:id</div>" +
      "<div><span class='text-rose-400 font-semibold'>DELETE</span> " +
      baseUrl +
      "/api/bots/:id</div>" +
      "</div>" +
      "</section>" +
      "</div>" +
      "<script>" +
      "document.addEventListener('DOMContentLoaded',function(){" +
      "var btn=document.getElementById('userMenuButton');" +
      "var menu=document.getElementById('userMenu');" +
      "if(btn&&menu){btn.addEventListener('click',function(e){e.stopPropagation();menu.classList.toggle('hidden');});document.addEventListener('click',function(){if(!menu.classList.contains('hidden')){menu.classList.add('hidden');}});}" +
      "const params=new URLSearchParams(window.location.search);" +
      "const err=params.get('error');" +
      "if(err){Swal.fire({icon:'error',title:'Token tidak valid',text:err});const cleanUrl=window.location.origin+window.location.pathname;window.history.replaceState({},'',cleanUrl);}" +
      "document.querySelectorAll('.delete-bot-form').forEach(function(form){" +
      "form.addEventListener('submit',function(e){" +
      "e.preventDefault();" +
      "Swal.fire({title:'Hapus bot?',text:'Tindakan ini tidak dapat dibatalkan.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#64748b',confirmButtonText:'Ya, hapus',cancelButtonText:'Batal'}).then(function(result){if(result.isConfirmed){form.submit();}});" +
      "});" +
      "});" +
      "});" +
      "async function editBot(id){try{const res=await fetch('" +
      baseUrl +
      "/api/bots/'+id,{credentials:'include'});if(!res.ok){throw new Error('Gagal mengambil data bot');}const bot=await res.json();" +
      "const {value:newToken}=await Swal.fire({title:'Update Token Bot',html:" +
      '\'<input id="swal-input-token" class="swal2-input" placeholder="Token baru" value="\'+(bot.token||\'\')+\'">\',' +
      "focusConfirm:false,showCancelButton:true,confirmButtonText:'Simpan',cancelButtonText:'Batal',preConfirm:()=>{" +
      "const t=document.getElementById('swal-input-token').value.trim();if(!t){Swal.showValidationMessage('Token tidak boleh kosong');}return t;}" +
      "});" +
      "if(!newToken)return;const updateRes=await fetch('" +
      baseUrl +
      "/api/bots/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({token:newToken})});if(!updateRes.ok){const errData=await updateRes.json().catch(()=>({error:'Gagal mengupdate bot'}));throw new Error(errData.error||'Gagal mengupdate bot');}Swal.fire({icon:'success',title:'Berhasil',text:'Token dan info bot telah diperbarui dari Telegram.'}).then(function(){location.reload();});}catch(e){Swal.fire({icon:'error',title:'Gagal',text:e.message});}}" +
      "</script>" +
      "</body>" +
      "</html>";

    res.send(html);
  });
});

// Dashboard sederhana: info + list group ID + form test kirim pesan
app.get("/dashboard", requireAuth, function (req, res) {
  var groups = botModule.getGroups();
  var botInfo = botModule.getBotInfo();
  var baseUrl = getBaseUrl(req);

  var selectedBotName = req.query.name || null;
  var selectedBotUsername = req.query.username || null;
  var sendStatus = req.query.sendStatus || null;

  console.log(
    "Dashboard diakses, jumlah chat terdaftar:",
    groups ? groups.length : 0
  );

  // Lebih toleran: anggap chat dengan ID negatif sebagai group/supergroup,
  // dan type !== 'private' juga dianggap group.
  var groupRows = groups
    .filter(function (g) {
      return (
        (typeof g.id === "number" && g.id < 0) ||
        (typeof g.id === "string" && g.id.indexOf("-") === 0) ||
        g.type === "group" ||
        g.type === "supergroup"
      );
    })
    .map(function (g) {
      return (
        "<tr>" +
        "<td>" +
        g.id +
        "</td>" +
        "<td>" +
        (g.title || "") +
        "</td>" +
        "<td>" +
        (g.type || "") +
        "</td>" +
        "<td>" +
        (g.updatedAt || "") +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  var privateRows = groups
    .filter(function (g) {
      return (
        g.type === "private" ||
        (typeof g.id === "number" && g.id > 0) ||
        (typeof g.id === "string" && g.id.indexOf("-") !== 0)
      );
    })
    .map(function (g) {
      return (
        "<tr>" +
        "<td>" +
        g.id +
        "</td>" +
        "<td>" +
        (g.title || g.username || "") +
        "</td>" +
        "<td>" +
        (g.type || "") +
        "</td>" +
        "<td>" +
        (g.updatedAt || "") +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  var html =
    "<!DOCTYPE html>" +
    "<html>" +
    "<head>" +
    '<meta charset="utf-8" />' +
    "<title>Telegram Bot Dashboard</title>" +
    '<script src="https://cdn.tailwindcss.com"></script>' +
    "</head>" +
    '<body class="bg-slate-950 text-slate-100 min-h-screen">' +
    '<div class="max-w-6xl mx-auto px-4 py-8">' +
    '<header class="mb-8 flex items-center justify-between gap-4">' +
    "<div>" +
    '<h1 class="text-3xl font-bold tracking-tight">Telegram Bot Dashboard</h1>' +
    "<p class='text-slate-400 text-sm mt-1'>Monitor informasi bot, group, dan kirim pesan uji dengan cepat." +
    (selectedBotName
      ? ' Menampilkan data untuk bot: <span class="font-mono text-sky-300">' +
        selectedBotName +
        (selectedBotUsername ? " (@" + selectedBotUsername + ")" : "") +
        "</span>."
      : "") +
    "</p>" +
    "</div>" +
    '<div class="flex items-center gap-2">' +
    '<span class="inline-flex items-center rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/60 px-3 py-1 text-[11px] font-medium">' +
    '<span class="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>' +
    "Online" +
    "</span>" +
    "<a href='/' class='inline-flex items-center rounded-xl border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition'>" +
    "← Kembali" +
    "</a>" +
    "</div>" +
    "</header>" +
    '<section class="grid gap-6 md:grid-cols-2 mb-8">' +
    '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
    '<h2 class="text-lg font-semibold mb-3 flex items-center gap-2">' +
    '<span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 mr-1">i</span>' +
    "Informasi Bot" +
    "</h2>" +
    '<dl class="space-y-2 text-sm">' +
    "<div><dt class='text-slate-400'>Nama paket</dt><dd class='font-medium text-slate-100'>" +
    packageInfo.name +
    "</dd></div>" +
    "<div><dt class='text-slate-400'>Versi</dt><dd class='font-medium text-slate-100'>" +
    packageInfo.version +
    "</dd></div>" +
    "<div><dt class='text-slate-400'>Nama bot</dt><dd class='font-medium text-slate-100'>" +
    (botInfo.firstName || "-") +
    "</dd></div>" +
    "<div><dt class='text-slate-400'>Username bot</dt><dd class='font-mono text-slate-100'>" +
    (botInfo.username ? "@" + botInfo.username : "-") +
    "</dd></div>" +
    "<div><dt class='text-slate-400'>Bot ID</dt><dd class='font-mono text-slate-100'>" +
    (botInfo.id || "-") +
    "</dd></div>" +
    "<div><dt class='text-slate-400'>Token (masked)</dt><dd class='font-mono text-amber-300 break-all'>" +
    (botInfo.tokenMasked || "-") +
    "</dd></div>" +
    "</dl>" +
    "</div>" +
    '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
    '<h2 class="text-lg font-semibold mb-3">Form Test Kirim Pesan</h2>' +
    '<p class="text-xs text-slate-400 mb-4">Gunakan Chat ID dari tabel di bawah untuk menguji pengiriman pesan ke group atau private chat.</p>' +
    "<form method='POST' action='/dashboard/test' class='space-y-3 text-sm'>" +
    "<div>" +
    "<label class='block text-slate-300 mb-1'>Chat ID</label>" +
    "<input type='text' name='chatId' required class='w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono' placeholder='contoh: -1001234567890' />" +
    "</div>" +
    "<div>" +
    "<label class='block text-slate-300 mb-1'>Pesan</label>" +
    "<textarea name='text' rows='3' required class='w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'>Pesan test dari dashboard</textarea>" +
    "</div>" +
    "<button type='submit' class='inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition'>" +
    "Kirim Pesan" +
    "</button>" +
    (sendStatus === "ok"
      ? "<div class='mt-3 rounded-lg border border-emerald-700/70 bg-emerald-900/40 px-3 py-2 text-xs text-emerald-200'>Pesan berhasil dikirim ke chat.</div>"
      : sendStatus === "error"
      ? "<div class='mt-3 rounded-lg border border-rose-700/70 bg-rose-900/40 px-3 py-2 text-xs text-rose-200'>Gagal mengirim pesan. Periksa kembali Chat ID dan token bot.</div>"
      : "") +
    "</form>" +
    "</div>" +
    "</section>" +
    '<section class="space-y-6">' +
    '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
    '<h2 class="text-lg font-semibold mb-3">Informasi API</h2>' +
    '<p class="text-xs text-slate-400 mb-1">Endpoint sederhana untuk diakses dari aplikasi lain.</p>' +
    '<p class="text-xs text-slate-400 mb-3">Base URL aplikasi ini: <span class="font-mono text-sky-300">' +
    baseUrl +
    "</span></p>" +
    '<div class="space-y-2 text-xs font-mono bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-300">' +
    '<div><span class="text-emerald-400 font-semibold">GET</span> ' +
    baseUrl +
    '/api/chats <span class="text-slate-500">// daftar semua chat (group & private)</span></div>' +
    '<div><span class="text-emerald-400 font-semibold">GET</span> ' +
    baseUrl +
    '/api/groups <span class="text-slate-500">// hanya group/supergroup</span></div>' +
    '<div><span class="text-emerald-400 font-semibold">GET</span> ' +
    baseUrl +
    '/api/private <span class="text-slate-500">// hanya private chat</span></div>' +
    '<div><span class="text-sky-400 font-semibold">POST</span> ' +
    baseUrl +
    '/api/send <span class="text-slate-500">// kirim pesan</span></div>' +
    '<div class="mt-2 text-slate-400">Contoh body <span class="text-sky-300">POST /api/send</span>:</div>' +
    '<pre class="mt-1 whitespace-pre-wrap text-[11px] text-slate-300">{\n  "chatId": "123456789",\n  "text": "Halo dari aplikasi lain"\n}</pre>' +
    "</div>" +
    "</div>" +
    '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
    '<div class="flex items-center justify-between gap-2 mb-3">' +
    '<h2 class="text-lg font-semibold">Daftar Group</h2>' +
    '<p class="text-xs text-slate-400">Tambahkan bot ke group dan kirim pesan di group tersebut. Tabel ini akan diperbarui otomatis setiap beberapa detik.</p>' +
    "</div>" +
    '<div class="overflow-x-auto">' +
    '<table class="min-w-full text-sm border-separate border-spacing-0">' +
    '<thead><tr class="bg-slate-800/70">' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tl-xl">Chat ID</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Nama Group</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Tipe</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tr-xl">Terakhir Update</th>' +
    "</tr></thead>" +
    "<tbody id='group-body'>" +
    (groupRows ||
      "<tr><td colspan='4' class='px-3 py-4 text-center text-slate-400 text-sm'>Belum ada data grup.</td></tr>") +
    "</tbody>" +
    "</table>" +
    "</div>" +
    "</div>" +
    '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">' +
    '<div class="flex items-center justify-between gap-2 mb-3">' +
    '<h2 class="text-lg font-semibold">Daftar Private Chat</h2>' +
    '<p class="text-xs text-slate-400">Chat langsung dengan bot. Tabel ini akan diperbarui otomatis setiap beberapa detik.</p>' +
    "</div>" +
    '<div class="overflow-x-auto">' +
    '<table class="min-w-full text-sm border-separate border-spacing-0">' +
    '<thead><tr class="bg-slate-800/70">' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tl-xl">Chat ID</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Nama / Username</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70">Tipe</th>' +
    '<th class="text-left px-3 py-2 font-medium text-slate-200 border-b border-slate-700/70 rounded-tr-xl">Terakhir Update</th>' +
    "</tr></thead>" +
    "<tbody id='private-body'>" +
    (privateRows ||
      "<tr><td colspan='4' class='px-3 py-4 text-center text-slate-400 text-sm'>Belum ada data private chat.</td></tr>") +
    "</tbody>" +
    "</table>" +
    "</div>" +
    "</div>" +
    "</section>" +
    "</div>" +
    "<script>" +
    "function renderGroupRows(data){if(!data||!data.length){return \"<tr><td colspan='4' class='px-3 py-4 text-center text-slate-400 text-sm'>Belum ada data grup.</td></tr>\";}return data.map(function(g){return '<tr><td>'+g.id+'</td><td>'+(g.title||'')+'</td><td>'+(g.type||'')+'</td><td>'+(g.updatedAt||'')+'</td></tr>';}).join('');}" +
    "function renderPrivateRows(data){if(!data||!data.length){return \"<tr><td colspan='4' class='px-3 py-4 text-center text-slate-400 text-sm'>Belum ada data private chat.</td></tr>\";}return data.map(function(g){return '<tr><td>'+g.id+'</td><td>'+(g.title||g.username||'')+'</td><td>'+(g.type||'')+'</td><td>'+(g.updatedAt||'')+'</td></tr>';}).join('');}" +
    "async function refreshChatTables(){try{var gRes=await fetch('/api/groups');var pRes=await fetch('/api/private');if(!gRes.ok||!pRes.ok){return;}var groups=await gRes.json();var priv=await pRes.json();var gBody=document.getElementById('group-body');var pBody=document.getElementById('private-body');if(gBody){gBody.innerHTML=renderGroupRows(groups);}if(pBody){pBody.innerHTML=renderPrivateRows(priv);}}catch(e){console.error('Gagal refresh tabel chat',e);}}" +
    "setInterval(refreshChatTables,7000);" +
    "window.addEventListener('load',refreshChatTables);" +
    "</script>" +
    "</body>" +
    "</html>";

  res.send(html);
});

// ====== API untuk aplikasi lain ======

// Semua chat (group + private)
app.get("/api/chats", function (req, res) {
  res.json(botModule.getGroups());
});

// Hanya group / supergroup
app.get("/api/groups", function (req, res) {
  var all = botModule.getGroups() || [];
  var onlyGroups = all.filter(function (g) {
    return (
      (typeof g.id === "number" && g.id < 0) ||
      (typeof g.id === "string" && g.id.indexOf("-") === 0) ||
      g.type === "group" ||
      g.type === "supergroup"
    );
  });
  res.json(onlyGroups);
});

// Hanya private chat
app.get("/api/private", function (req, res) {
  var all = botModule.getGroups() || [];
  var onlyPrivate = all.filter(function (g) {
    return (
      g.type === "private" ||
      (typeof g.id === "number" && g.id > 0) ||
      (typeof g.id === "string" && g.id.indexOf("-") !== 0)
    );
  });
  res.json(onlyPrivate);
});

// Kirim pesan dari aplikasi lain
app.post("/api/send", function (req, res) {
  var chatId = req.body.chatId;
  var text = req.body.text || "Pesan dari API";

  if (!chatId) {
    return res.status(400).json({ error: "chatId wajib diisi" });
  }

  botModule.bot
    .sendMessage(chatId, text)
    .then(function () {
      res.json({ ok: true, chatId: chatId, text: text });
    })
    .catch(function (err) {
      console.error("Gagal kirim pesan dari /api/send:", err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    });
});

// Form sederhana di halaman awal untuk create bot, lalu redirect kembali
app.post("/bots/create", function (req, res) {
  var token = req.body.token;

  if (!token) {
    return res.redirect("/"); // token kosong, abaikan dan kembali
  }

  fetchBotInfoFromToken(token)
    .then(function (info) {
      var data = {
        name: info.name,
        username: info.username,
        token: token,
      };
      db.createBot(data, function (err) {
        if (err) {
          console.error("DB createBot (form) error:", err);
        }
        res.redirect("/");
      });
    })
    .catch(function (err) {
      console.error("Gagal mengambil info bot dari token (form):", err);
      // Token tidak valid: kembali ke halaman utama dengan pesan error, tanpa menyimpan ke DB
      res.redirect(
        "/?error=" +
          encodeURIComponent(
            "Token Telegram tidak valid atau bot tidak ditemukan."
          )
      );
    });
});

// Hapus bot dari tombol di tabel halaman awal
app.post("/bots/:id/delete", function (req, res) {
  db.deleteBot(req.params.id, function (err) {
    if (err) {
      console.error("DB deleteBot (form) error:", err);
    }
    res.redirect("/");
  });
});

// ====== CRUD Bot di database SQLite ======

// GET semua bot
app.get("/api/bots", function (req, res) {
  db.allBots(function (err, rows) {
    if (err) {
      console.error("DB allBots error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
    res.json(rows);
  });
});

// GET satu bot by id
app.get("/api/bots/:id", function (req, res) {
  db.getBot(req.params.id, function (err, row) {
    if (err) {
      console.error("DB getBot error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
    if (!row) return res.status(404).json({ error: "Bot tidak ditemukan" });
    res.json(row);
  });
});

// POST buat bot baru
app.post("/api/bots", function (req, res) {
  var token = req.body.token;

  if (!token) {
    return res.status(400).json({ error: "token wajib diisi" });
  }

  fetchBotInfoFromToken(token)
    .then(function (info) {
      var data = {
        name: info.name || req.body.name,
        username: info.username || req.body.username,
        token: token,
      };
      db.createBot(data, function (err, row) {
        if (err) {
          console.error("DB createBot error:", err);
          return res.status(500).json({ error: err.message || String(err) });
        }
        res.status(201).json(row);
      });
    })
    .catch(function (err) {
      console.error("Gagal mengambil info bot dari token (API):", err);
      return res.status(400).json({
        error: "Token Telegram tidak valid atau bot tidak ditemukan.",
      });
    });
});

// PUT update bot (hanya update token, lalu sinkron nama & username dari Telegram)
app.put("/api/bots/:id", function (req, res) {
  var token = req.body.token;

  if (!token) {
    return res.status(400).json({ error: "token wajib diisi" });
  }

  fetchBotInfoFromToken(token)
    .then(function (info) {
      var data = {
        name: info.name || null,
        username: info.username || null,
        token: token,
      };
      db.updateBot(req.params.id, data, function (err, row) {
        if (err) {
          console.error("DB updateBot error:", err);
          return res.status(500).json({ error: err.message || String(err) });
        }
        if (!row) return res.status(404).json({ error: "Bot tidak ditemukan" });
        res.json(row);
      });
    })
    .catch(function (err) {
      console.error("Gagal mengambil info bot dari token (PUT):", err);
      return res.status(400).json({
        error: "Token Telegram tidak valid atau bot tidak ditemukan.",
      });
    });
});

// DELETE bot
app.delete("/api/bots/:id", function (req, res) {
  db.deleteBot(req.params.id, function (err) {
    if (err) {
      console.error("DB deleteBot error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
    res.json({ ok: true });
  });
});

// ====== CRUD Users via form (untuk halaman /users) ======

app.post("/users/create", requireAuth, function (req, res) {
  var username = (req.body.username || "").trim();
  var password = (req.body.password || "").trim();

  if (!username || !password) {
    return res.redirect(
      "/users?userError=" +
        encodeURIComponent("Username dan password wajib diisi.")
    );
  }

  db.createUser(
    {
      username: username,
      passwordHash: hashPassword(password),
    },
    function (err) {
      if (err) {
        console.error("DB createUser error:", err);
        return res.redirect(
          "/users?userError=" +
            encodeURIComponent(
              "Gagal menambah user. Mungkin username sudah dipakai."
            )
        );
      }
      res.redirect(
        "/users?userSuccess=" + encodeURIComponent("User berhasil ditambahkan.")
      );
    }
  );
});

app.post("/users/:id/update", requireAuthApi, function (req, res) {
  var id = req.params.id;
  var username = (req.body.username || "").trim();
  var password = (req.body.password || "").trim();

  console.log("Update user request:", {
    id: id,
    username: username,
    hasPassword: !!password,
  });

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username dan password wajib diisi." });
  }

  db.updateUser(
    id,
    {
      username: username,
      passwordHash: hashPassword(password),
    },
    function (err, row) {
      if (err) {
        console.error("DB updateUser error:", err);
        return res.status(500).json({ error: err.message || String(err) });
      }
      if (!row) {
        console.error("User not found:", id);
        return res.status(404).json({ error: "User tidak ditemukan." });
      }
      console.log("User updated successfully:", id);
      res.json({ ok: true });
    }
  );
});

app.post("/users/:id/delete", requireAuth, function (req, res) {
  var id = req.params.id;

  db.getUserByUsername("admin", function (err, adminUser) {
    if (err) {
      console.error("DB getUserByUsername error:", err);
      return res.redirect(
        "/users?userError=" + encodeURIComponent("Gagal menghapus user.")
      );
    }
    if (adminUser && String(adminUser.id) === String(id)) {
      return res.redirect(
        "/users?userError=" +
          encodeURIComponent("User admin tidak boleh dihapus.")
      );
    }

    db.deleteUser(id, function (delErr) {
      if (delErr) {
        console.error("DB deleteUser error:", delErr);
        return res.redirect(
          "/users?userError=" + encodeURIComponent("Gagal menghapus user.")
        );
      }
      res.redirect(
        "/users?userSuccess=" + encodeURIComponent("User berhasil dihapus.")
      );
    });
  });
});

// Terima form test dan kirim pesan via bot
app.post("/dashboard/test", function (req, res) {
  var chatId = req.body.chatId;
  var text = req.body.text || "Pesan test dari dashboard";

  if (!chatId) {
    return res.redirect("/dashboard?sendStatus=error");
  }

  botModule.bot
    .sendMessage(chatId, text)
    .then(function () {
      res.redirect("/dashboard?sendStatus=ok");
    })
    .catch(function (err) {
      console.error("Gagal kirim pesan dari dashboard:", err);
      res.redirect("/dashboard?sendStatus=error");
    });
});

var port = process.env.PORT || 3000;

var server = app.listen(port, function () {
  var host = server.address().address;
  var actualPort = server.address().port;

  // Jika host kosong atau "::", anggap saja localhost untuk tampilan log
  if (!host || host === "::" || host === "0.0.0.0") {
    host = "localhost";
  }

  console.log("Web server started at http://%s:%s", host, actualPort);
});
