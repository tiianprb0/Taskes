/**
 * File: Code.gs
 * Description: Skrip Google Apps untuk berinteraksi dengan Google Spreadsheet.
 * Menyediakan endpoint API untuk membaca, menambah, memperbarui, dan mengarsipkan data tugas.
 */

// Nama sheet tempat data tugas berada
const SHEET_NAME = 'Active';
// Nama sheet untuk arsip tugas
const ARCHIVE_SHEET_NAME = 'Archive';

/**
 * Fungsi doGet: Menangani permintaan GET untuk membaca data dari spreadsheet.
 * Mengembalikan semua baris data sebagai JSON.
 */
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet dengan nama '${SHEET_NAME}' tidak ditemukan.`);
    }

    const range = sheet.getDataRange();
    const values = range.getValues();

    // Jika sheet kosong atau hanya ada header
    if (values.length <= 1) {
      output.setContent(JSON.stringify({ status: 'success', data: [] }));
      return output;
    }

    const headers = values[0]; // Baris pertama adalah header
    const data = [];

    // Iterasi dari baris kedua (indeks 1) untuk mendapatkan data
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObject = {};
      for (let j = 0; j < headers.length; j++) {
        rowObject[headers[j]] = row[j];
      }
      data.push(rowObject);
    }

    output.setContent(JSON.stringify({ status: 'success', data: data }));
    return output;

  } catch (error) {
    console.error("Error in doGet:", error.message);
    output.setContent(JSON.stringify({ status: 'error', message: error.message }));
    return output;
  }
}

/**
 * Fungsi doPost: Menangani permintaan POST untuk menambah, memperbarui, atau mengarsipkan data di spreadsheet.
 * Membutuhkan 'action' (add/update/archive) dan data dalam body permintaan.
 */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // Tangani preflight OPTIONS request secara eksplisit.
  if (e.parameter && e.parameter.method === 'OPTIONS') {
    return output;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet dengan nama '${SHEET_NAME}' tidak ditemukan.`);
    }

    // Pastikan request body ada dan bisa di-parse sebagai JSON
    if (!e.postData || !e.postData.contents) {
      throw new Error("Request body kosong atau tidak valid.");
    }

    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (!action) {
      throw new Error("Aksi (action) tidak ditentukan dalam permintaan.");
    }

    // Dapatkan semua header untuk menemukan indeks kolom
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (action === 'add') {
      return addTask(sheet, headers, requestData.task, output);
    } else if (action === 'update') {
      return updateTask(sheet, headers, requestData.task, output);
    } else if (action === 'archive') {
      return archiveTask(sheet, headers, requestData.taskId, output);
    } else {
      throw new Error("Aksi tidak dikenal: " + action);
    }

  } catch (error) {
    console.error("Error in doPost:", error.message);
    output.setContent(JSON.stringify({ status: 'error', message: error.message }));
    return output;
  }
}

/**
 * Fungsi pembantu untuk menambah tugas baru ke spreadsheet.
 * Mengisi Task ID dan Date secara otomatis.
 */
function addTask(sheet, headers, taskData, output) {
  const newRow = [];
  const taskId = Utilities.getUuid(); // Membuat ID unik
  const currentDate = new Date(); // Tanggal saat ini

  // Mengisi data sesuai urutan header
  headers.forEach(header => {
    if (header === 'Task ID') {
      newRow.push(taskId);
    } else if (header === 'Date') {
      newRow.push(currentDate.toLocaleDateString('en-US')); // Format tanggal, bisa disesuaikan
    } else if (header === 'Project Name') {
      if (taskData.hasOwnProperty('Project Name') && taskData['Project Name'].trim() !== '') {
        newRow.push(taskData['Project Name']);
      } else {
        newRow.push(`Project ${currentDate.toLocaleDateString('en-US')}`);
      }
    } else if (taskData.hasOwnProperty(header)) {
      newRow.push(taskData[header]);
    } else {
      newRow.push('');
    }
  });

  sheet.appendRow(newRow);
  output.setContent(JSON.stringify({ status: 'success', message: 'Tugas berhasil ditambahkan', taskId: taskId }));
  return output;
}

/**
 * Fungsi pembantu untuk memperbarui tugas yang sudah ada di spreadsheet.
 * Menggunakan Task ID untuk menemukan baris yang akan diperbarui.
 */
function updateTask(sheet, headers, taskData, output) {
  const taskIdToUpdate = taskData['Task ID'];
  if (!taskIdToUpdate) {
    throw new Error("Task ID diperlukan untuk memperbarui tugas.");
  }

  const values = sheet.getDataRange().getValues();
  let rowIndexToUpdate = -1;

  // Cari baris berdasarkan Task ID
  for (let i = 1; i < values.length; i++) {
    if (values[i][headers.indexOf('Task ID')] === taskIdToUpdate) {
      rowIndexToUpdate = i + 1; // +1 karena getRange menggunakan indeks 1-based
      break;
    }
  }

  if (rowIndexToUpdate === -1) {
    throw new Error(`Tugas dengan Task ID '${taskIdToUpdate}' tidak ditemukan.`);
  }

  // Perbarui nilai di baris yang ditemukan
  headers.forEach((header, colIndex) => {
    if (taskData.hasOwnProperty(header) && header !== 'Task ID' && header !== 'Date') {
      sheet.getRange(rowIndexToUpdate, colIndex + 1).setValue(taskData[header]);
    }
  });

  output.setContent(JSON.stringify({ status: 'success', message: 'Tugas berhasil diperbarui' }));
  return output;
}

/**
 * Fungsi untuk mengarsipkan tugas. Memindahkan baris tugas ke sheet 'Archive'.
 */
function archiveTask(sheet, headers, taskIdToArchive, output) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let archiveSheet = ss.getSheetByName(ARCHIVE_SHEET_NAME);

  // Buat sheet arsip jika belum ada
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(ARCHIVE_SHEET_NAME);
    // Salin header dari sheet utama ke sheet arsip
    const mainSheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
    archiveSheet.getRange(1, 1, 1, mainSheetHeaders[0].length).setValues(mainSheetHeaders);
  }

  const values = sheet.getDataRange().getValues();
  let rowIndexToDelete = -1;
  let rowToArchive = [];

  // Cari baris berdasarkan Task ID
  for (let i = 1; i < values.length; i++) {
    if (values[i][headers.indexOf('Task ID')] === taskIdToArchive) {
      rowIndexToDelete = i + 1; // +1 karena getRange menggunakan indeks 1-based
      rowToArchive = values[i];
      break;
    }
  }

  if (rowIndexToDelete === -1) {
    throw new Error(`Tugas dengan Task ID '${taskIdToArchive}' tidak ditemukan.`);
  }

  // Tambahkan baris ke sheet arsip
  archiveSheet.appendRow(rowToArchive);

  // Hapus baris dari sheet utama
  sheet.deleteRow(rowIndexToDelete);

  output.setContent(JSON.stringify({ status: 'success', message: 'Tugas berhasil diarsipkan.' }));
  return output;
}


/**
 * Fungsi untuk mengatur header kolom di spreadsheet secara otomatis.
 * Anda bisa menjalankan fungsi ini secara manual dari editor Apps Script
 * jika Anda membuat spreadsheet baru atau header terhapus.
 */
function setSpreadsheetHeaders() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet dengan nama '${SHEET_NAME}' tidak ditemukan.`);
    }

    const headers = [
      'Task ID',
      'Date',
      'Project Name',
      'Activity / Task',
      'Platform',
      'Work Status',
      'Approval Status',
      'Notes',
      'PIC / Team',
      'Deadline',
      'Priority',
      'Attachment Link',
      'Progress (%)' // Pastikan ini juga ada di header
    ];

    // Mengatur nilai header di baris pertama
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    Logger.log('Header spreadsheet berhasil diatur.');

  } catch (error) {
    console.error("Error setting headers:", error.message);
    Logger.log('Error setting headers: ' + error.message);
  }
}

// Fungsi dummy untuk menghindari error saat deployment jika tidak ada fungsi lain
function setup() {
  // Ini adalah fungsi dummy. Tidak perlu dijalankan secara manual.
}
