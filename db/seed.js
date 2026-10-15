import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const iso = d => new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const addDays = (base, n) => { const d = new Date(base+'T00:00:00'); d.setDate(d.getDate()+n); return iso(d); };
const today = iso(new Date());

// Karyawan
const empIns = db.prepare('INSERT OR IGNORE INTO karyawan(nip,nama,divisi,wa) VALUES (?,?,?,?)');
[['1001','Faiz Rahman','YNH','081234567801'],
 ['1002','Bayu Prasetyo','NHPB','081234567802'],
 ['2001','Rina Wulandari','QC Building Management','081234567803']].forEach(r=>empIns.run(...r));

// Dokumen — sama persis dgn MOCK di HTML lama
const docs = [
  {kode:'NHPW/SK LEGALITAS/2021/11',nama:'SK MENKUMHAM PENDIRIAN PT. NUR HAMDALAH PRIMA WISATA 2017, TERBARU 2021',jenis:'SK LEGALITAS',divisi:'NHPW',tgl_update:addDays(today,-156),output:'SK MENKUMHAM PERUBAHAN KEDUA PT. NUR HAMDALAH PRIMA WISATA'},
  {kode:'YNH/AKTA/2019/4',nama:'AKTA PENDIRIAN YAYASAN NURUL HAYAT',jenis:'AKTA',divisi:'YNH',tgl_update:addDays(today,-210),output:'Akta pendirian dan perubahan terakhir'},
  {kode:'YNH/SERTIFIKAT LEGALITAS/2022/9',nama:'SERTIFIKAT ISO 9001:2015',jenis:'SERTIFIKAT LEGALITAS',divisi:'YNH',tgl_update:addDays(today,-40),output:'Sertifikat ISO manajemen mutu',tgl_expired:addDays(today,45)},
  {kode:'NHPB/SERTIFIKAT LEGALITAS/2023/12',nama:'SERTIFIKAT HALAL PRODUK AQIQAH',jenis:'SERTIFIKAT LEGALITAS',divisi:'NHPB',tgl_update:addDays(today,-300),output:'Sertifikat halal produk',tgl_expired:addDays(today,-12)},
  {kode:'YNH/IZIN LAZ/2020/2',nama:'IZIN OPERASIONAL LAZ',jenis:'IZIN LAZ',divisi:'YNH',tgl_update:addDays(today,-90),output:'SK izin LAZ',tgl_expired:addDays(today,200)},
  {kode:'SURABAYA/AMBULANCE APV /L 1227 DU',nama:'BPKB AMBULANCE APV L 1227 DU',jenis:'BPKB MOBIL',divisi:'YNH',tgl_update:addDays(today,-540),output:'',status:'DIPINJAM',pengaju:'Faiz',tgl_pinjam:addDays(today,-12),jatuh_tempo:addDays(today,-4)},
  {kode:'SURABAYA/GRANDMAX AQIQAH/L 1457 QV',nama:'BPKB GRANDMAX AQIQAH L 1457 QV',jenis:'BPKB MOBIL',divisi:'NHPB',tgl_update:addDays(today,-540),output:'',status:'DIPINJAM',pengaju:'Bayu',tgl_pinjam:addDays(today,-3),jatuh_tempo:addDays(today,4)},
  {kode:'SURABAYA/MIO/W 4935 BT',nama:'BPKB MIO W 4935 BT',jenis:'BPKB MOTOR',divisi:'YNH',tgl_update:addDays(today,-540)},
  {kode:'SURABAYA/WULING AQIQAH/L 1421 ACE',nama:'BPKB WULING AQIQAH L 1421 ACE',jenis:'BPKB MOBIL',divisi:'NHPB',tgl_update:addDays(today,-540)},
  {kode:'NHPU/IJIN OPERASIONAL/2022/3',nama:'IZIN OPERASIONAL NUR HAMDALAH PILAR UTAMA',jenis:'IJIN OPERASIONAL',divisi:'NHPU',tgl_update:addDays(today,-120),output:'Izin operasional usaha',tgl_expired:addDays(today,320)},
  {kode:'SBY/MOUM/HISANA/03/22',nama:'MOU MITRA GERAI HISANA PAMEKASAN 2',jenis:'MOU MITRA',divisi:'NHPB',tgl_update:addDays(today,-200),output:'Perjanjian, diperpanjang otomatis'},
  {kode:'YKH/SURAT PERMOHONAN/2024/1',nama:'SURAT PERMOHONAN IZIN LEMBAGA',jenis:'SURAT PERMOHONAN',divisi:'YKH',tgl_update:addDays(today,-60),output:'Surat permohonan'},
  {kode:'BMI/AKTA/2021/5',nama:'AKTA PERUBAHAN BERKAH MELIMPAH INDONESIA',jenis:'AKTA',divisi:'BMI',tgl_update:addDays(today,-250),output:'Akta perubahan anggaran dasar'},
  {kode:'YNH/IZIN PENDIRIAN/2018/1',nama:'IZIN PENDIRIAN YAYASAN',jenis:'IZIN PENDIRIAN',divisi:'YNH',tgl_update:addDays(today,-400),output:'Izin pendirian'}
];
const docIns = db.prepare(`INSERT OR IGNORE INTO dokumen
  (kode,nama,jenis,divisi,tgl_update,link,output,status,pengaju,tgl_pinjam,jatuh_tempo,tgl_expired)
  VALUES (@kode,@nama,@jenis,@divisi,@tgl_update,@link,@output,@status,@pengaju,@tgl_pinjam,@jatuh_tempo,@tgl_expired)`);
docs.forEach(d=>docIns.run({
  kode:d.kode, nama:d.nama, jenis:d.jenis, divisi:d.divisi,
  tgl_update:d.tgl_update,
  link:'https://drive.google.com/file/d/'+Buffer.from(d.kode).toString('base64').slice(0,14)+'/view',
  output:d.output||'', status:d.status||'ADA',
  pengaju:d.pengaju||'', tgl_pinjam:d.tgl_pinjam||'', jatuh_tempo:d.jatuh_tempo||'',
  tgl_expired:d.tgl_expired||''
}));

// Riwayat — 1 versi per dokumen + contoh multi-versi
const hisIns = db.prepare('INSERT INTO riwayat(kode,tgl,link,output,catatan) VALUES (?,?,?,?,?)');
docs.forEach(d=>hisIns.run(d.kode,d.tgl_update,'https://drive.google.com/file/d/mock-'+Buffer.from(d.kode).toString('base64').slice(0,8)+'/view',d.output||'','Data awal'));
hisIns.run('YNH/AKTA/2019/4',addDays(today,-340),'https://drive.google.com/file/d/mock-d/view','Akta pendirian awal','Dokumen awal');
hisIns.run('YNH/AKTA/2019/4',addDays(today,-75),'https://drive.google.com/file/d/mock-c/view','Akta pendirian (sebelum perubahan)','Sebelum perubahan');
hisIns.run('NHPW/SK LEGALITAS/2021/11',addDays(today,-400),'https://drive.google.com/file/d/mock-a/view','SK MENKUMHAM PENDIRIAN PT. NUR HAMDALAH PRIMA WISATA','Dokumen awal');

// Expired
const expIns = db.prepare('INSERT INTO dokumen_expired(kode,nama,jenis,tgl_update,link,output,tgl_expired) VALUES (?,?,?,?,?,?,?)');
expIns.run('NHPW/SERTIFIKAT LEGALITAS//2012/3','SERTIFIKAT LOGO KBIH','SERTIFIKAT LEGALITAS',addDays(today,-900),'https://drive.google.com/drive/folders/mock1','Sertifikat merk logo Haji Umroh NH expired 2022',addDays(today,-1400));
expIns.run('SBY/MOUM/PERTAMINA/07/2019','MOU PERTAMINA 1 JUZ 1 LITER','MOU MITRA',addDays(today,-880),'https://drive.google.com/drive/folders/mock2','MOU dengan Pertamina dan sudah expired',addDays(today,-700));
expIns.run('YNH/SURAT KETERANGAN/2018/3','SURAT KETERANGAN TERDAFTAR DINSOS','SURAT KETERANGAN',addDays(today,-900),'https://drive.google.com/drive/folders/mock3','Suket terdaftar Dinsos expired 2023 (hanya softfile)',addDays(today,-600));

// Log
db.prepare(`INSERT INTO log_serah_terima
  (kode,aksi,nip_pihak,nama_pihak,tanggal,jatuh_tempo)
  VALUES (?,?,?,?,?,?)`)
  .run('SURABAYA/AMBULANCE APV /L 1227 DU','PINJAM','1001','Faiz',addDays(today,-12),addDays(today,-4));

console.log('Seed selesai. Baris dokumen:', db.prepare('SELECT COUNT(*) c FROM dokumen').get().c);
db.close();