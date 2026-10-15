import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(__dirname, 'data.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'));

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------- Util ---------- */
const iso = v => {
  if (!v) return '';
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0];
  return '';
};
const today = () => iso(new Date());

const emp_ = nip => {
  const n = String(nip || '').trim();
  const r = db.prepare('SELECT * FROM karyawan WHERE LOWER(nip)=LOWER(?)').get(n);
  if (!r) throw new Error('NIP tidak ditemukan di tabel karyawan: ' + (nip || '(kosong)'));
  return r;
};

const log_ = (kode, aksi, a, c, tgl, jt, link, ket) => {
  db.prepare(`INSERT INTO log_serah_terima
    (kode,aksi,nip_pihak,nama_pihak,divisi_pihak,wa_pihak,
     nip_petugas,nama_petugas,wa_petugas,
     tanggal,jatuh_tempo,link_bukti,keterangan)
    VALUES (?,?,?,?,?,?, ?,?,?, ?,?,?,?)`)
    .run(kode, aksi, a?.nip || '', a?.nama || '', a?.divisi || '', a?.wa || '',
         c?.nip || '', c?.nama || '', c?.wa || '', tgl, jt || '', link || '', ket || '');
};

const withTx = fn => db.transaction(fn)();

/* ---------- Dispatcher ---------- */
app.post('/api', async (req, res) => {
  const { fn, args = [] } = req.body || {};
  try {
    const handler = HANDLERS[fn];
    if (!handler) return res.status(404).json({ error: 'Unknown fn: ' + fn });
    const out = await handler(...args);
    res.json(out === undefined ? { ok: true } : out);
  } catch (e) {
    console.error(fn, e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

const HANDLERS = {
  getData() {
    return {
      docs: db.prepare('SELECT * FROM dokumen').all().map(r => ({
        kode: r.kode, nama: r.nama, jenis: r.jenis,
        tglUpdate: r.tgl_update || '', link: r.link || '', output: r.output || '',
        status: (r.status || 'ADA').toUpperCase(), pengaju: r.pengaju || '',
        tglPinjam: r.tgl_pinjam || '', jatuhTempo: r.jatuh_tempo || '',
        linkSerah: r.link_serah || '', divisi: r.divisi || '',
        tglExpired: r.tgl_expired || '', lokasi: r.lokasi || '',
        nip: r.nip || '', wa: r.wa || ''
      })),
      expired: db.prepare('SELECT * FROM dokumen_expired').all().map(r => ({
        kode: r.kode, nama: r.nama, jenis: r.jenis,
        tglUpdate: r.tgl_update || '', link: r.link || '',
        output: r.output || '', tglExpired: r.tgl_expired || ''
      })),
      history: db.prepare('SELECT * FROM riwayat').all().map(r => ({
        kode: r.kode, tgl: r.tgl || '', link: r.link || '',
        output: r.output || '', catatan: r.catatan || ''
      })),
      log: db.prepare('SELECT * FROM log_serah_terima').all().map(r => ({
        kode: r.kode, aksi: r.aksi, pengaju: r.nama_pihak || '',
        petugas: r.nama_petugas || '', tgl: r.tanggal || '',
        jatuhTempo: r.jatuh_tempo || '', link: r.link_bukti || ''
      })),
      karyawan: db.prepare('SELECT * FROM karyawan').all().map(r => ({
        nip: r.nip, nama: r.nama, divisi: r.divisi || '', wa: r.wa || ''
      }))
    };
  },

  uploadFile(name, mime, b64) {
    const buf = Buffer.from(b64, 'base64');
    const safe = name.replace(/[^\w.\-]+/g, '_');
    const fname = Date.now() + '_' + safe;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
    return '/uploads/' + fname;
  },

  saveDocument(p) {
    return withTx(() => {
      const kode = String(p.kode || '').trim();
      if (!kode || !p.nama || !p.jenis) throw new Error('Kode, nama, dan jenis dokumen wajib diisi.');
      const tgl = iso(p.tglUpdate) || today();
      const cur = db.prepare('SELECT * FROM dokumen WHERE kode=?').get(kode);

      if (p.mode === 'new' && cur) throw new Error('Kode sudah dipakai: ' + kode);
      if (p.mode === 'update' && !cur) throw new Error('Dokumen tidak ditemukan: ' + kode);

      let a, c;
      if (p.mode === 'new') {
        if (!p.linkBukti) throw new Error('Foto bukti penerimaan wajib dilampirkan.');
        a = emp_(p.nipPihak); c = emp_(p.nipDc);
        if (cur && !db.prepare('SELECT 1 FROM riwayat WHERE kode=?').get(kode)) {
          db.prepare('INSERT INTO riwayat(kode,tgl,link,output,catatan) VALUES (?,?,?,?,?)')
            .run(kode, cur.tgl_update, cur.link, cur.output, 'Versi sebelum aplikasi');
        }
      }

      if (cur) {
        db.prepare(`UPDATE dokumen SET
          nama=?, jenis=?, tgl_update=?, link=?, output=?,
          divisi=?, tgl_expired=?
          WHERE kode=?`)
          .run(p.nama, p.jenis, tgl, p.link || '', p.output || '', p.divisi || '', iso(p.tglExpired) || '', kode);
      } else {
        db.prepare(`INSERT INTO dokumen
          (kode,nama,jenis,tgl_update,link,output,status,divisi,tgl_expired)
          VALUES (?,?,?,?,?,?,'ADA',?,?)`)
          .run(kode, p.nama, p.jenis, tgl, p.link || '', p.output || '', p.divisi || '', iso(p.tglExpired) || '');
      }

      db.prepare('INSERT INTO riwayat(kode,tgl,link,output,catatan) VALUES (?,?,?,?,?)')
        .run(kode, tgl, p.link || '', p.output || '', p.catatan || (p.mode === 'new' ? 'Dokumen baru' : 'Pembaruan'));

      if (p.mode === 'new') log_(kode, 'TERIMA', a, c, tgl, '', p.linkBukti, p.catatan);
      if (p.markExpired) HANDLERS.archiveExpired(kode);
      return { ok: true };
    });
  },

  serahTerima(p) {
    return withTx(() => {
      const kode = String(p.kode || '').trim();
      const d = db.prepare('SELECT * FROM dokumen WHERE kode=?').get(kode);
      if (!d) throw new Error('Dokumen tidak ditemukan.');
      const stMap = { PINJAM: 'DIPINJAM', AMBIL: 'DIAMBIL', KEMBALI: 'ADA', STORAGE: 'ADA' };
      const st = stMap[p.aksi];
      if (!st) throw new Error('Aksi tidak dikenal.');
      if (!p.linkBukti) throw new Error('Foto bukti wajib dilampirkan.');
      const cur = (d.status || 'ADA').toUpperCase();
      if ((p.aksi === 'PINJAM' || p.aksi === 'AMBIL') && cur !== 'ADA')
        throw new Error('Dokumen sedang tidak tersedia (status: ' + cur + ').');
      const a = emp_(p.nipPihak), c = emp_(p.nipDc);
      const tgl = iso(p.tglPinjam) || today();

      if (p.aksi === 'STORAGE') {
        if (!String(p.lokasi || '').trim()) throw new Error('Lokasi simpan wajib diisi.');
        db.prepare('UPDATE dokumen SET lokasi=? WHERE kode=?').run(p.lokasi, kode);
        log_(kode, 'STORAGE', a, c, tgl, '', p.linkBukti, p.lokasi);
        return { ok: true };
      }

      const jt = p.aksi === 'PINJAM' ? (iso(p.jatuhTempo) || '') : '';
      if (p.aksi === 'PINJAM' && !jt) throw new Error('Jatuh tempo wajib diisi untuk peminjaman.');

      if (p.aksi === 'KEMBALI') {
        db.prepare(`UPDATE dokumen SET status='ADA', pengaju='', nip='', wa='',
          tgl_pinjam='', jatuh_tempo='', link_serah='' WHERE kode=?`).run(kode);
      } else {
        db.prepare(`UPDATE dokumen SET status=?, pengaju=?, nip=?, wa=?,
          tgl_pinjam=?, jatuh_tempo=?, link_serah=? WHERE kode=?`)
          .run(st, a.nama, a.nip, a.wa || '', tgl, jt, p.linkBukti, kode);
      }
      log_(kode, p.aksi, a, c, tgl, jt, p.linkBukti, '');
      return { ok: true };
    });
  },

  archiveExpired(kode) {
    return withTx(() => {
      const d = db.prepare('SELECT * FROM dokumen WHERE kode=?').get(kode);
      if (!d) return { ok: true };
      db.prepare(`INSERT INTO dokumen_expired
        (kode,nama,jenis,tgl_update,link,output,status,tgl_expired)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(d.kode, d.nama, d.jenis, d.tgl_update, d.link, d.output, 'EXPIRED', d.tgl_expired || today());
      db.prepare('DELETE FROM dokumen WHERE kode=?').run(kode);
      return { ok: true };
    });
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Register Legalitas jalan di http://localhost:' + PORT));