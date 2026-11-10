/*
 * MODE DEMO — backend tiruan di memori browser, hanya aktif jika URL diakhiri "?demo".
 * Dipakai untuk melihat/menguji tampilan tanpa menyentuh Google Sheets.
 * Login demo: admin / admin123  atau  operator / op123. Data hilang saat halaman dimuat ulang.
 */
(function () {
  const db = {
    users: [
      { username: 'admin', password: 'admin123', name: 'Administrator System', role: 'Admin' },
      { username: 'operator', password: 'op123', name: 'Operator Gudang', role: 'Operator' }
    ],
    master: {
      pelanggan: [['15', 'PT. MESITECHMITRA'], ['22', 'PT. TOMORI ENERGI'], ['31', 'PT. SINAR BAJA']],
      warna: [['11', 'ROYAL BLUE'], ['12', 'ORANGE HI-VIS'], ['13', 'NAVY']],
      ukuran: [['12', 'S'], ['13', 'M'], ['14', 'L'], ['15', 'XL'], ['16', 'XXL']]
    },
    po: [
      { noPO: '0001/MMP-PO/TOMORI/X-26', idPelanggan: '15', tglPO: '2026-10-02', mop: 'MCTG/26/13048', tglProduksi: '2026-10-20', tglKirim: '', status: 'Pending' },
      { noPO: '0007/TME-PO/XI-26', idPelanggan: '22', tglPO: '2026-11-01', mop: 'MCTG/26/13102', tglProduksi: '2026-11-12', tglKirim: '', status: 'Pending' },
      { noPO: '0003/SBJ-PO/IX-26', idPelanggan: '31', tglPO: '2026-09-14', mop: 'MCTG/26/12990', tglProduksi: '2026-09-30', tglKirim: '2026-10-05', status: 'Exported' }
    ],
    items: [
      ['0001/MMP-PO/TOMORI/X-26', 'COVERALL FRC NOMEX IIIA', '11', '13', 6],
      ['0001/MMP-PO/TOMORI/X-26', 'COVERALL FRC NOMEX IIIA', '11', '14', 8],
      ['0001/MMP-PO/TOMORI/X-26', 'COVERALL FRC NOMEX IIIA', '11', '15', 4],
      ['0001/MMP-PO/TOMORI/X-26', 'COVERALL FRC NOMEX IIIA', '12', '14', 5],
      ['0007/TME-PO/XI-26', 'SHIRT FRC LONG SLEEVE', '13', '13', 3],
      ['0007/TME-PO/XI-26', 'SHIRT FRC LONG SLEEVE', '13', '14', 3],
      ['0003/SBJ-PO/IX-26', 'PANTS FRC CARGO', '13', '14', 4]
    ].map(r => ({ noPO: r[0], deskripsi: r[1], idWarna: r[2], idUkuran: r[3], qtyTarget: r[4] })),
    logs: [],
    qr: [],
    sessions: {}
  };
  for (let i = 1; i <= 80; i++) {
    const code = 'ITM-' + String(i).padStart(5, '0');
    db.qr.push({ batch: 'B26-' + String(Math.ceil(i / 20)).padStart(3, '0'), item: code, url: 'https://qr.example.com/v/' + code });
  }
  const seedLog = (noPO, n, itemIdx) => {
    const it = db.items.filter(x => x.noPO === noPO)[itemIdx];
    for (let i = 0; i < n; i++) {
      const q = db.qr[db.logs.length];
      db.logs.push({ noPO, item: q.item, batch: q.batch, deskripsi: it.deskripsi, idWarna: it.idWarna, idUkuran: it.idUkuran, url: q.url });
    }
  };
  seedLog('0001/MMP-PO/TOMORI/X-26', 6, 0); seedLog('0001/MMP-PO/TOMORI/X-26', 5, 1); seedLog('0001/MMP-PO/TOMORI/X-26', 2, 3);
  seedLog('0003/SBJ-PO/IX-26', 4, 0);

  const fail = msg => { const e = new Error(msg); e.isUser = true; return e; };
  const key = (a, b, c) => [a, b, c].join('\u0001');
  const lookup = () => {
    const out = {};
    Object.keys(db.master).forEach(t => out[t] = db.master[t].map((r, i) => ({ id: r[0], name: r[1], rowIndex: i + 2 })));
    return out;
  };
  const statusFor = (t, s) => t > 0 && s >= t ? 'Completed' : s > 0 ? 'In Progress' : 'Pending';
  const findPO = noPO => { const po = db.po.find(p => p.noPO === noPO); if (!po) throw fail("PO '" + noPO + "' tidak ditemukan."); return po; };
  const counts = noPO => { const c = {}; db.logs.filter(l => l.noPO === noPO).forEach(l => { const k = key(l.deskripsi, l.idWarna, l.idUkuran); c[k] = (c[k] || 0) + 1; }); return c; };
  function details(noPO) {
    const po = findPO(noPO), c = counts(noPO);
    let tt = 0, ts = 0;
    const items = db.items.filter(i => i.noPO === noPO).map(i => {
      const sc = c[key(i.deskripsi, i.idWarna, i.idUkuran)] || 0;
      tt += i.qtyTarget; ts += sc;
      return { deskripsi: i.deskripsi, idWarna: i.idWarna, idUkuran: i.idUkuran, qtyTarget: i.qtyTarget, qtyScanned: sc, isComplete: sc >= i.qtyTarget };
    });
    if (po.status !== 'Exported') po.status = statusFor(tt, ts);
    return Object.assign({}, po, { totalTarget: tt, totalScanned: ts, items });
  }
  const activePO = () => db.po.map(p => details(p.noPO)).filter(p => p.status !== 'Exported').map(p => ({ noPO: p.noPO, idPelanggan: p.idPelanggan, status: p.status }));
  const users = () => db.users.map(u => ({ username: u.username, name: u.name, role: u.role }));
  const dmy = (s, label) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); if (!m) throw fail(label + ' tidak valid.'); return m[3] + '-' + m[2] + '-' + m[1]; };
  function normItems(list) {
    if (!list || !list.length) throw fail('Minimal harus ada satu baris item.');
    return list.map(i => ({ deskripsi: i.deskripsi.trim(), idWarna: String(i.idWarna).trim(), idUkuran: String(i.idUkuran).trim(), qtyTarget: parseInt(i.qtyTarget, 10) }));
  }
  function verify(noPO, url) {
    url = String(url).trim();
    const q = db.qr.find(x => x.url === url);
    if (!q) throw fail("REJECT: QR '" + url.slice(0, 70) + "' TIDAK TERDAFTAR!");
    const dup = db.logs.find(l => l.item === q.item);
    if (dup) throw fail("DUPLIKAT: Item '" + q.item + "' SUDAH PERNAH DI-SCAN pada PO " + dup.noPO + '!');
    const d = details(noPO);
    if (d.status === 'Exported') throw fail('PO ' + noPO + ' sudah di-export dan terkunci.');
    const options = d.items.filter(i => i.qtyScanned < i.qtyTarget).map(i => Object.assign({ sisa: i.qtyTarget - i.qtyScanned }, i));
    if (!options.length) throw fail('INFO: Seluruh item PO ' + noPO + ' sudah 100% komplit!');
    return { itemCode: q.item, batchCode: q.batch, scannedURL: url, options };
  }

  const admin = ['listPO', 'savePO', 'getPOForEdit', 'updatePO', 'deletePO', 'exportPO', 'addMaster', 'updateMaster', 'deleteMaster', 'listUsers', 'saveUser', 'updateUser', 'deleteUser'];
  const actions = {
    login(s, u, p) {
      const user = db.users.find(x => x.username === String(u).trim().toLowerCase() && x.password === String(p).trim());
      if (!user) throw fail('Username atau password salah!');
      const token = 'demo-' + Math.random().toString(36).slice(2);
      db.sessions[token] = { username: user.username, name: user.name, role: user.role };
      return { token, user: db.sessions[token], lookup: lookup(), activePO: activePO() };
    },
    logout(s, token) { delete db.sessions[token]; return true; },
    bootstrap(s) { return { user: s, lookup: lookup(), activePO: activePO() }; },
    getActivePO() { return activePO(); },
    getPODetails(s, noPO) { return details(noPO); },
    verifyScan(s, noPO, url) { return verify(noPO, url); },
    confirmScan(s, noPO, url, desc, w, u) {
      const v = verify(noPO, url);
      const opt = v.options.find(o => key(o.deskripsi, o.idWarna, o.idUkuran) === key(desc, w, u));
      if (!opt) throw fail('Kuota item tersebut sudah penuh atau item tidak ada di PO. Scan ulang.');
      db.logs.push({ noPO, item: v.itemCode, batch: v.batchCode, deskripsi: desc, idWarna: w, idUkuran: u, url: v.scannedURL });
      return { message: 'BERHASIL: ' + v.itemCode, itemCode: v.itemCode, item: { deskripsi: desc, idWarna: w, idUkuran: u }, poDetails: details(noPO) };
    },
    listPO() {
      return db.po.map(p => { const d = details(p.noPO); return Object.assign({}, p, { status: d.status, totalTarget: d.totalTarget, totalScanned: d.totalScanned, lines: d.items.length, percent: d.totalTarget ? Math.min(100, Math.round(d.totalScanned / d.totalTarget * 100)) : 0 }); });
    },
    savePO(s, p) {
      if (db.po.some(x => x.noPO === p.noPO.trim())) throw fail("Nomor PO '" + p.noPO + "' sudah terdaftar!");
      const items = normItems(p.items);
      db.po.push({ noPO: p.noPO.trim(), idPelanggan: p.idPelanggan, tglPO: dmy(p.tglPO, 'Tanggal PO'), mop: p.mop, tglProduksi: dmy(p.tglProduksi, 'Tanggal Produksi'), tglKirim: '', status: 'Pending' });
      items.forEach(i => db.items.push(Object.assign({ noPO: p.noPO.trim() }, i)));
      return { message: "Master PO '" + p.noPO + "' berhasil disimpan!" };
    },
    getPOForEdit(s, noPO) { const d = details(noPO); return { poInfo: d, items: d.items }; },
    updatePO(s, p) {
      const po = findPO(p.noPO), c = counts(p.noPO), items = normItems(p.items);
      Object.keys(c).forEach(k => {
        const it = items.find(i => key(i.deskripsi, i.idWarna, i.idUkuran) === k);
        if (!it) throw fail('Item "' + k.split('\u0001')[0] + '" sudah memiliki scan, tidak boleh dihapus atau diubah spesifikasinya.');
        if (it.qtyTarget < c[k]) throw fail('QTY target tidak boleh kurang dari jumlah ter-scan (' + c[k] + ').');
      });
      Object.assign(po, { idPelanggan: p.idPelanggan, tglPO: dmy(p.tglPO, 'Tanggal PO'), mop: p.mop, tglProduksi: dmy(p.tglProduksi, 'Tanggal Produksi') });
      db.items = db.items.filter(i => i.noPO !== p.noPO).concat(items.map(i => Object.assign({ noPO: p.noPO }, i)));
      return { message: "PO '" + p.noPO + "' berhasil diperbarui!" };
    },
    deletePO(s, noPO) {
      findPO(noPO);
      db.po = db.po.filter(p => p.noPO !== noPO); db.items = db.items.filter(i => i.noPO !== noPO); db.logs = db.logs.filter(l => l.noPO !== noPO);
      return { message: "PO '" + noPO + "' beserta log scan berhasil dihapus!" };
    },
    exportPO(s, noPO, tgl) {
      const po = findPO(noPO), kirim = dmy(tgl, 'Tanggal Kirim');
      const rows = db.logs.filter(l => l.noPO === noPO).map(l => [l.item, po.idPelanggan, po.tglPO, noPO, po.mop, kirim, po.tglProduksi, l.idWarna, l.idUkuran, l.deskripsi, l.batch]);
      if (!rows.length) throw fail('Belum ada data scan untuk PO ini!');
      po.tglKirim = kirim; po.status = 'Exported';
      return { filename: 'import_' + noPO.replace(/[/\\?%*:|"<>]/g, '_') + '.xlsx', headers: ['item_code', 'id_pelanggan', 'tanggal_PO', 'nomor_po', 'nomor_mop', 'tanggal_kirim', 'tanggal_produksi', 'id_warna', 'id_ukuran', 'deskripsi', 'batch_id'], rows };
    },
    addMaster(s, type, id, name) {
      if (db.master[type].some(r => r[0] === id)) throw fail("ID '" + id + "' sudah dipakai.");
      db.master[type].push([id, name]); return { message: 'Data master berhasil ditambahkan!', lookup: lookup() };
    },
    updateMaster(s, type, row, orig, id, name) { db.master[type][row - 2] = [id, name]; return { message: 'Data master berhasil diperbarui!', lookup: lookup() }; },
    deleteMaster(s, type, row) { db.master[type].splice(row - 2, 1); return { message: 'Data master berhasil dihapus!', lookup: lookup() }; },
    listUsers() { return users(); },
    saveUser(s, u) {
      if (db.users.some(x => x.username === u.username)) throw fail("Username '" + u.username + "' sudah digunakan!");
      db.users.push({ username: u.username, password: u.password, name: u.name, role: u.role });
      return { message: "User '" + u.username + "' berhasil ditambahkan!", users: users() };
    },
    updateUser(s, u) {
      const x = db.users.find(y => y.username === u.username);
      x.name = u.name; x.role = u.role; if (u.password) x.password = u.password;
      return { message: 'Data user berhasil diperbarui!', users: users() };
    },
    deleteUser(s, username) {
      if (username === s.username) throw fail('Anda tidak dapat menghapus akun yang sedang dipakai login.');
      db.users = db.users.filter(x => x.username !== username);
      return { message: 'User berhasil dihapus!', users: users() };
    }
  };

  window.COA_MOCK = function (req) {
    return new Promise(resolve => setTimeout(() => {
      try {
        const fn = actions[req.action];
        let session = null;
        if (req.action !== 'login') {
          session = db.sessions[req.token];
          if (!session) return resolve({ ok: false, code: 'AUTH', error: 'Sesi berakhir. Silakan login kembali.' });
          if (admin.indexOf(req.action) !== -1 && session.role !== 'Admin') return resolve({ ok: false, code: 'FORBIDDEN', error: 'Akses ditolak: fitur ini khusus Admin.' });
        }
        resolve({ ok: true, data: JSON.parse(JSON.stringify(fn.apply(null, [session].concat(req.args || [])))) });
      } catch (e) {
        resolve({ ok: false, code: e.isUser ? 'USER' : 'SERVER', error: e.message });
      }
    }, 220));
  };
  /** QR contoh berikutnya yang belum pernah di-scan (untuk tombol "QR contoh"). */
  window.COA_MOCK.sampleQR = function () {
    const used = {}; db.logs.forEach(l => used[l.item] = 1);
    const q = db.qr.find(x => !used[x.item]);
    return q ? q.url : '';
  };
})();
