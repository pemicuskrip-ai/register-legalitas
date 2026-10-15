PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dokumen (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT UNIQUE NOT NULL,
  nama          TEXT NOT NULL,
  jenis         TEXT NOT NULL,
  tgl_update    TEXT,
  link          TEXT,
  output        TEXT,
  status        TEXT DEFAULT 'ADA',
  pengaju       TEXT DEFAULT '',
  tgl_pinjam    TEXT DEFAULT '',
  jatuh_tempo   TEXT DEFAULT '',
  link_serah    TEXT DEFAULT '',
  divisi        TEXT DEFAULT '',
  tgl_expired   TEXT DEFAULT '',
  lokasi        TEXT DEFAULT '',
  nip           TEXT DEFAULT '',
  wa            TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dokumen_expired (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT,
  nama          TEXT,
  jenis         TEXT,
  tgl_update    TEXT,
  link          TEXT,
  output        TEXT,
  status        TEXT DEFAULT 'EXPIRED',
  tgl_expired   TEXT
);

CREATE TABLE IF NOT EXISTS riwayat (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kode          TEXT NOT NULL,
  tgl           TEXT,
  link          TEXT,
  output        TEXT,
  catatan       TEXT,
  dicatat       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS log_serah_terima (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu         TEXT DEFAULT CURRENT_TIMESTAMP,
  kode          TEXT,
  aksi          TEXT,
  nip_pihak     TEXT, nama_pihak TEXT, divisi_pihak TEXT, wa_pihak TEXT,
  nip_petugas   TEXT, nama_petugas TEXT, wa_petugas TEXT,
  tanggal       TEXT, jatuh_tempo TEXT,
  link_bukti    TEXT, keterangan TEXT
);

CREATE TABLE IF NOT EXISTS karyawan (
  nip           TEXT PRIMARY KEY,
  nama          TEXT,
  divisi        TEXT,
  wa            TEXT
);

CREATE INDEX IF NOT EXISTS idx_dok_kode    ON dokumen(kode);
CREATE INDEX IF NOT EXISTS idx_dok_status  ON dokumen(status);
CREATE INDEX IF NOT EXISTS idx_riw_kode    ON riwayat(kode);
CREATE INDEX IF NOT EXISTS idx_log_kode    ON log_serah_terima(kode);