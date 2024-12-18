const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const path = require("path");
const session = require("express-session"); // Import express-session
const db = require("./db"); // Import the database connection

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload()); // Middleware untuk file upload
app.use(express.static(path.join(__dirname, "public")));
app.use("/img", express.static(path.join(__dirname, "views", "img"))); // Folder gambar

// Setup session
app.use(
  session({
    secret: "rahasia", // Ganti dengan kunci rahasia Anda
    resave: false,
    saveUninitialized: true,
  })
);

// Set View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Route Halaman Daftar
app.get("/daftar", (req, res) => {
  res.render("daftar");
});

// Landing Page
app.get("/", (req, res) => {
  res.render("index");
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// API Login
app.post("/login", (req, res) => {
  const { nama, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE nama = ? AND password = ? LIMIT 1",
    [nama, password],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Gagal login" });
      }

      if (rows.length === 0) {
        return res.status(401).json({ error: "Nama atau password salah" });
      }

      const user = rows[0];
      req.session.userId = user.id; // Simpan ID pengguna di sesi

      res.redirect("/landing"); // Redirect ke halaman profil setelah login
    }
  );
});

// Route untuk halaman landing
app.get("/landing", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];
      res.render("landing", { users: user }); // Kirim data pengguna ke template
    }
  );
});

// Handle Registrasi
app.post("/daftar", (req, res) => {
  // Debug log untuk memantau data
  console.log("Request Body:", req.body);
  console.log("Request Files:", req.files);

  // Validasi jika file tidak diunggah
  if (!req.files || !req.files.foto) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { nomor_keanggotaan, nama, divisi, password } = req.body;
  const file = req.files.foto;

  // Nama dan lokasi file
  const fotoName = Date.now() + "_" + file.name; // Tambah timestamp agar nama unik
  const fotoPath = path.join(__dirname, "public", "img", fotoName);

  // Pindahkan file ke lokasi tujuan
  file.mv(fotoPath, (err) => {
    if (err) {
      console.error("File Upload Error:", err.message);
      return res.status(500).json({ error: "Failed to upload file." });
    }

    // Simpan data ke database
    db.query(
      "INSERT INTO users (nomor_keanggotaan, nama, divisi, password, foto) VALUES (?, ?, ?, ?, ?)",
      [nomor_keanggotaan, nama, divisi, password, `/img/${fotoName}`],
      (err, results) => {
        if (err) {
          console.error("Database Error:", err.message);
          return res.status(500).json({ error: "Failed to save user." });
        }
        console.log("User  Registered:", results);
        res.render("login"); // Redirect ke halaman login setelah registrasi
      }
    );
  });
});

// Route untuk menampilkan halaman profil
app.get("/profil", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];
      res.render("profil", { users: user }); // Render halaman profil dengan data pengguna
    }
  );
});

// Route untuk logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal logout" });
    }
    res.redirect("/"); // Redirect ke halaman utama setelah logout
  });
});

app.get("/peminjaman", (req, res) => {
  console.log("Query Parameters:", req.query);

  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const DateYear = req.query.DateYear || currentYear;
  const DateMonth = req.query.DateMonth || currentMonth;

  if (
    isNaN(DateYear) ||
    isNaN(DateMonth) ||
    DateMonth < 1 ||
    DateMonth > 12
  ) {
    return res
      .status(400)
      .json({ error: "Invalid or missing DateYear or DateMonth" });
  }

  // Ambil data pengguna
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Failed to retrieve user data." });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = rows[0];

      // Periksa jumlah peminjaman untuk DateYear dan DateMonth tertentu
      db.query(
        "SELECT COUNT(*) as count FROM peminjaman WHERE DateYear = ? AND DateMonth = ?",
        [DateYear, DateMonth],
        (err, result) => {
          if (err) {
            return res
              .status(500)
              .json({ error: "Failed to query loan data from database." });
          }

          const count = result[0].count;

          // Jika data berjumlah 3 atau lebih, tolak akses
          if (count >= 3) {
            return res.render("landing", {
              users: user, // Kirim data pengguna
              message: `Peminjaman untuk bulan ${DateMonth} tahun ${DateYear} sudah mencapai batas maksimum (3 peminjaman).`,
            });
          }

          // Tampilkan halaman peminjaman
          res.render("peminjaman", { users: user });
        }
      );
    }
  );
});


// API untuk memasukan data ke dalam database
app.post("/peminjaman", (req, res) => {
  const {
    id,
    nomor_keanggotaan,
    nama,
    divisi,
    pinjaman,
    cicilan,
    cicilan_perbulan,
    tanggal,
  } = req.body;

  if (
    !id ||
    !nomor_keanggotaan ||
    !nama ||
    !divisi ||
    !pinjaman ||
    !cicilan ||
    !cicilan_perbulan ||
    !tanggal
  ) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const tanggalObj = new Date(tanggal);
  const dateDay = String(tanggalObj.getDate()).padStart(2, "0"); // dd
  const DateMonth = String(tanggalObj.getMonth() + 1).padStart(2, "0"); // mm
  const DateYear = tanggalObj.getFullYear(); // yyyy

  const fullDate = `${dateDay}-${DateMonth}-${DateYear}`;

  // Simpan data ke database
  db.query(
    "INSERT INTO peminjaman (nomor_keanggotaan, nama, divisi, pinjaman, cicilan, cicilan_perbulan, tanggal, DateMonth, DateYear, userID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      nomor_keanggotaan,
      nama,
      divisi,
      pinjaman,
      cicilan,
      cicilan_perbulan,
      fullDate,
      DateMonth,
      DateYear,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Gagal menyimpan data" });
      }

      console.log("Data berhasil disimpan:", results);

      // Redirect dengan parameter success=true
      res.redirect("/landing?success=true");
    }
  );
});

// Menjalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
