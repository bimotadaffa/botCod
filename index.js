const { Telegraf, Markup } = require('telegraf');
const { google } = require('googleapis');
const fs = require('fs');

// === Masukkan token bot Telegram langsung di sini (!!! JANGAN untuk produksi/real project) ===
const BOT_TOKEN = '7692117384:AAH5DcBMYcoVW-Dz-LeoXSD2HuZCGnIMxYw';

const bot = new Telegraf(BOT_TOKEN);

const fs = require('fs');
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync('credentials.json', process.env.GOOGLE_CREDENTIALS);
}


// ====== Google Sheets Auth
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // harus sama dengan file hasil tulis di atas!
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ====== Keyboard Menu Utama
const mainMenu = Markup.keyboard([
  ['🔍 Pencarian Berdasarkan Mitra FO', '🔎 Pencarian Berdasarkan DWS'],
  ['🗒️ Report Harian', '📊 Report WeCare'],
]).resize();

// ====== State sederhana per chat
const userState = {};

// ====== Handler /start & kembali ke menu utama
bot.start((ctx) => {
  userState[ctx.chat.id] = null;
  ctx.reply('Selamat datang di Bot Order!\n\nPilih menu:', mainMenu);
});
bot.hears('Kembali ke Menu Utama', (ctx) => {
  userState[ctx.chat.id] = null;
  ctx.reply('Kembali ke menu utama:', mainMenu);
});

// ====== Handler Menu 1
bot.hears('🔍 Pencarian Berdasarkan Mitra FO', (ctx) => {
  userState[ctx.chat.id] = 1;
  ctx.reply('Masukkan SITE ID yang ingin dicari atau tekan "Kembali ke Menu Utama".',
    Markup.keyboard([['Kembali ke Menu Utama']]).resize()
  );
});

// ====== Handler Menu 2
bot.hears('🔎 Pencarian Berdasarkan DWS', (ctx) => {
  userState[ctx.chat.id] = 2;
  ctx.reply('Masukkan SITE ID yang ingin dicari pada DWS.\nAtau tekan "Kembali ke Menu Utama".',
    Markup.keyboard([['Kembali ke Menu Utama']]).resize()
  );
});

// Handler input text
bot.on('text', async (ctx) => {
  if (
    userState[ctx.chat.id] === 1 &&
    ctx.message.text !== 'Kembali ke Menu Utama' &&
    !ctx.message.text.startsWith('/')
  ) {
    await cariDWS(ctx, ctx.message.text.trim());
  }
  if (
    userState[ctx.chat.id] === 2 &&
    ctx.message.text !== 'Kembali ke Menu Utama' &&
    !ctx.message.text.startsWith('/')
  ) {
    await cariDWS2(ctx, ctx.message.text.trim());
  }
});


// ====== Handler Menu 3
bot.hears('🗒️ Report Harian', (ctx) => {
  userState[ctx.chat.id] = 3;
  ctx.reply('Selamat telah masuk ke menu Report Harian.\nHanya saat ini saya ingin fokus ke menu pertama dulu.',
    Markup.keyboard([['Kembali ke Menu Utama']]).resize()
  );
});

// ====== Handler Menu 4
bot.hears('📊 Report WeCare', (ctx) => {
  userState[ctx.chat.id] = 4;
  ctx.reply('Selamat telah masuk ke menu Report WeCare.\nHanya saat ini saya ingin fokus ke menu pertama dulu.',
    Markup.keyboard([['Kembali ke Menu Utama']]).resize()
  );
});

// ====== Handler untuk input text di Menu 1 (Pencarian Berdasarkan Mitra FO, tapi logika tetap pencarian SITE ID)
bot.on('text', async (ctx) => {
  if (
    userState[ctx.chat.id] === 1 &&
    ctx.message.text !== 'Kembali ke Menu Utama' &&
    !ctx.message.text.startsWith('/')
  ) {
    await cariDWS(ctx, ctx.message.text.trim());
  }
});

// ====== Fungsi Pencarian DWS (mapping sudah sesuai kolom)
async function cariDWS(ctx, siteId) {
  try {
    const sheetId = '1mSBlivc4P3EuHqkI7qEVHMD-kyrttKWDJ84ANKVVRb0';
    const range = 'Rekap!A1:AD'; // Sesuaikan jika kolom lebih panjang
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return ctx.reply('Data tidak ditemukan.');

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const getColIdx = (label) => headers.findIndex(h => h.trim().toLowerCase() === label.trim().toLowerCase());

    const siteIdCol      = getColIdx('SITE ID');
    const regCol         = getColIdx('TREG');
    const mitraCol       = getColIdx('MITRA');
    const spCol          = getColIdx('KONTRAK');
    const nilaiKontrakCol= getColIdx('Nilai SP');
    const planFinishCol  = getColIdx('TARGET FI');
    const statusCol      = getColIdx('PROGRES');
    const galianCol      = getColIdx('PLAN GALIAN');
    const tiangCol       = getColIdx('PLAN TIANG');
    const kabelCol       = getColIdx('PLAN KABEL');
    const detailCol      = getColIdx('DETAIL PROGRESS/KETERANGAN');

    // Cek kolom wajib
    if ([siteIdCol, regCol, mitraCol, spCol, nilaiKontrakCol, planFinishCol, statusCol, galianCol, tiangCol, kabelCol, detailCol].includes(-1)) {
      ctx.reply('Beberapa kolom penting tidak ditemukan di sheet. Cek header sheet.');
      console.log('Headers:', headers);
      return;
    }

    // Cari baris berdasarkan SITE ID (case insensitive)
    const hasil = dataRows.filter(r =>
      (r[siteIdCol] || '').toString().toLowerCase() === siteId.toLowerCase()
    );

    if (hasil.length === 0) {
      ctx.reply('SITE ID tidak ditemukan.');
      return;
    }
    const r = hasil[0];
    const get = (col) => (col !== -1 && r[col] && r[col].toString().trim()) ? r[col] : '-';

    // PLAIN TEXT supaya aman, tidak perlu escape markdown
    let msg = 
      `Hasil Pencarian SITE ID: ${get(siteIdCol)}\n\n` +
      `REG: ${get(regCol)}\n` +
      `MITRA: ${get(mitraCol)}\n` +
      `SP: ${get(spCol)}\n` +
      `Nilai Kontrak: ${get(nilaiKontrakCol)}\n` +
      `Plan Finish: ${get(planFinishCol)}\n` +
      `Status Progress: ${get(statusCol)}\n` +
      `Galian: ${get(galianCol)}\n` +
      `Tiang: ${get(tiangCol)}\n` +
      `Kabel: ${get(kabelCol)}\n` +
      `Detail Progress: ${get(detailCol)}`;

    ctx.reply(msg, Markup.keyboard([['Kembali ke Menu Utama']]).resize());
  } catch (e) {
    ctx.reply('Terjadi error dalam pencarian.\n' + e.message);
    console.error('Error di cariDWS:', e);
  }
}

async function cariDWS2(ctx, siteId) {
  try {
    const sheetId = '15y855p6yZfMdpxRg6769LHRxBeQ_ImcATZtJPwDuc2M';
    const range = 'All Order!A1:AG';
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return ctx.reply('Data tidak ditemukan.');

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const getColIdx = (label) => headers.findIndex(h => h.trim().toLowerCase() === label.trim().toLowerCase());

    // Index kolom (tidak perlu wajib semua ada)
    const siteIdCol     = getColIdx('Site ID');
    const regTelkomCol  = getColIdx('Reg Telkom');
    const mitraCol      = getColIdx('Mitra');
    const realDeployCol = getColIdx('Real Deploy');
    const orderDateCol  = getColIdx('Order Date');
    const milestoneCol  = getColIdx('Milestone');
    const inhandDateCol = getColIdx('Inhand Date');
    const l0ReadyCol    = getColIdx('L0-Ready Date');
    const oaDateCol     = getColIdx('OA Date');
    const statusSLACol  = getColIdx('Status SLA');
    const finalCol      = getColIdx('Final');

    // Jika ada kolom tidak ditemukan, lanjut saja (isi log)
    const headerIndexes = {
      siteIdCol, regTelkomCol, mitraCol, realDeployCol, orderDateCol,
      milestoneCol, inhandDateCol, l0ReadyCol, oaDateCol, statusSLACol, finalCol
    };
    for (const [key, idx] of Object.entries(headerIndexes)) {
      if (idx === -1) {
        console.log(`WARNING: Kolom ${key} tidak ditemukan di header sheet!`);
      }
    }

    // Cari baris berdasarkan SITE ID
    const hasil = dataRows.filter(r =>
      (siteIdCol !== -1 && r[siteIdCol] || '').toString().toLowerCase() === siteId.toLowerCase()
    );

    if (hasil.length === 0) {
      ctx.reply('SITE ID tidak ditemukan.');
      return;
    }
    const r = hasil[0];

    // Helper agar kalau kosong atau index tidak ketemu jadi "-"
    const get = (idx) => (idx !== -1 && r[idx] && r[idx].trim()) ? r[idx] : '-';
    const fmtTanggal = (idx) => (idx !== -1 && r[idx] && r[idx].trim()) ? r[idx] : '-';

    let msg = 
      `SITE ID: ${get(siteIdCol)}\n` +
      `Reg Telkom: ${get(regTelkomCol)}\n` +
      `Mitra: ${get(mitraCol)}\n` +
      `Real Deploy: ${get(realDeployCol)}\n` +
      `Order Date: ${fmtTanggal(orderDateCol)}\n` +
      `Milestone: ${get(milestoneCol)}\n` +
      `Inhand Date: ${fmtTanggal(inhandDateCol)}\n` +
      `L0-Ready Date: ${fmtTanggal(l0ReadyCol)}\n` +
      `OA Date: ${fmtTanggal(oaDateCol)}\n` +
      `Status SLA: ${get(statusSLACol)}\n` +
      `Final: ${get(finalCol)}`;

    ctx.reply(msg, Markup.keyboard([['Kembali ke Menu Utama']]).resize());
  } catch (e) {
    ctx.reply('Terjadi error dalam pencarian DWS.\n' + e.message);
    console.error('Error di cariDWS2:', e);
  }
}


// ====== Jalankan bot
bot.launch();

