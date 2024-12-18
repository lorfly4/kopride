// db.js
const mysql = require("mysql2");

// Konfigurasi koneksi
const connection = mysql.createConnection({
  host: "localhost", // Ganti dengan host database Anda
  user: "root", // Ganti dengan username database Anda
  password: "", // Ganti dengan password database Anda
  database: "kopride", // Ganti dengan nama database Anda
});

// Menghubungkan ke database
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
    return;
  }
  console.log("Connected to the database as ID " + connection.threadId);
});

// Ekspor koneksi untuk digunakan di file lain
module.exports = connection;
