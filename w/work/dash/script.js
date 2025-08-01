// File: public_html/w/work/dash/script.js
// Deskripsi: Logika JavaScript untuk halaman dashboard Task Tracker.
// Perbaikan: Menambahkan logika untuk fitur archive, restore, dan status "Done" baru.

// --- KONSTANTA ---
// Ganti dengan URL proxy PHP baru Anda
const APPS_SCRIPT_PROXY_URL = '../apps_script_proxy.php';
const PIN_MANAGER_URL = '../pin_manager.php'; // Path ke file pin_manager.php
const TASK_QUEUE_URL = '../task_queue.json'; // Mengambil data dari JSON lokal
const DATA_HANDLER_URL = '../data_handler.php'; // URL baru untuk handler data
const SESSION_KEY = 'loggedInUser';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 jam dalam milidetik

// Elemen DOM
const loggedInUsernameSpan = document.getElementById('loggedInUsername');
const logoutButton = document.getElementById('logoutButton');
const setPinDashboardText = document.getElementById('setPinDashboardText'); // Mengubah dari button ke span/text
const allTasksTab = document.getElementById('allTasksTab');
const myTasksTab = document.getElementById('myTasksTab');
const archiveTasksText = document.getElementById('archiveTasksText'); // New Archive Text Link
const addTaskButton = document.getElementById('addTaskButton');
const generateReportButton = document.getElementById('generateReportButton'); // New Generate Report Button
const taskTableBody = document.getElementById('taskTableBody');
const dashboardContent = document.getElementById('dashboardContent'); // Konten dashboard utama
const taskFormSection = document.getElementById('taskFormSection'); // Bagian form tambah/edit tugas
const modalTitle = document.getElementById('modalTitle');
const taskForm = document.getElementById('taskForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const mainFooter = document.getElementById('mainFooter'); // Referensi ke elemen footer

// Input form modal (tugas)
const taskIdInput = document.getElementById('taskId');
const projectNameInput = document.getElementById('projectName');
const activityInput = document.getElementById('activity');
const platformSelect = document.getElementById('platform');
const otherPlatformGroup = document.getElementById('otherPlatformGroup'); // Group untuk input 'Other'
const otherPlatformInput = document.getElementById('otherPlatformInput'); // Input 'Other'
const workStatusSelect = document.getElementById('workStatus');
const finalTouchProgressGroup = document.getElementById('finalTouchProgressGroup'); // Group untuk slider Final Touch
const finalTouchProgressInput = document.getElementById('finalTouchProgress'); // Slider Final Touch
const finalTouchProgressValueSpan = document.getElementById('finalTouchProgressValue'); // Span untuk menampilkan nilai slider
const approvalStatusSelect = document.getElementById('approvalStatus');
const notesInput = document.getElementById('notes');
const picTeamSelect = document.getElementById('picTeam');
const deadlineInput = document.getElementById('deadline');
const prioritySelect = document.getElementById('priority');
const attachmentLinkInput = document.getElementById('attachmentLink');

// Elemen modal Set/Change PIN dari Dashboard
const setPinDashboardModal = document.getElementById('setPinDashboardModal');
const closePinDashboardModalButton = document.getElementById('closePinDashboardModalButton');
const dashboardNewPinInput = document.getElementById('dashboardNewPin');
const saveDashboardPinButton = document.getElementById('saveDashboardPinButton');
const cancelDashboardPinButton = document.getElementById('cancelDashboardPinButton');
const dashboardPinErrorMessage = document.getElementById('dashboardPinErrorMessage');

// Elemen modal Arsip Tugas
const archiveListModal = document.getElementById('archiveListModal');
const closeArchiveListModalButton = document.getElementById('closeArchiveListModalButton');
const archivedProjectsList = document.getElementById('archivedProjectsList');


let allTasks = []; // Menyimpan semua data tugas yang diambil dari spreadsheet
let currentFilter = 'all'; // 'all', 'my', atau 'archive'
let currentLoggedInUser = null; // Menyimpan nama pengguna yang sedang login

// --- FUNGSI UTAMA ---

/**
 * Memeriksa status login pengguna. Jika tidak valid, redirect ke halaman login.
 */
async function checkLoginStatus() {
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (!storedSession) {
        window.location.href = '../index.html'; // Redirect ke halaman login
        return null;
    }

    const sessionData = JSON.parse(storedSession);
    const currentTime = new Date().getTime();

    if (currentTime - sessionData.loginTime >= SESSION_DURATION_MS) {
        // Sesi kadaluarsa
        localStorage.removeItem(SESSION_KEY);
        window.location.href = '../index.html';
        return null;
    }

    // Sesi masih aktif, perbarui waktu login untuk memperpanjang sesi
    sessionData.loginTime = currentTime;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

    loggedInUsernameSpan.textContent = sessionData.username;
    currentLoggedInUser = sessionData.username; // Simpan nama user yang login
    return sessionData.username;
}

/**
 * Mengambil data tugas dari file JSON lokal, dengan penambahan cache-buster.
 */
async function fetchTasks() {
    console.log("Fetching tasks from local JSON...");
    showLoading();
    try {
        // Menambahkan timestamp sebagai query parameter untuk mencegah caching browser
        const url = `${TASK_QUEUE_URL}?t=${new Date().getTime()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Fetch tasks failed with status: ${response.status}`);
            if (response.status === 404) {
                allTasks = [];
                renderTasks();
                return;
            }
            const responseText = await response.text();
            if (response.status === 200 && responseText.trim() === '[]') {
                allTasks = [];
                renderTasks();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}.`);
        }
        const result = await response.json();
        allTasks = result; // Data langsung dari JSON
        renderTasks();
    } catch (error) {
        window.alert('Terjadi kesalahan saat mengambil data tugas. Silakan coba lagi. Detail: ' + error.message);
        console.error('Fetch error:', error);
    } finally {
        hideLoading();
    }
}

/**
 * Merender (menampilkan) tugas ke dalam tabel berdasarkan filter saat ini.
 */
function renderTasks() {
    console.log(`Rendering tasks with filter: ${currentFilter}`);
    taskTableBody.innerHTML = ''; // Bersihkan tabel
    let tasksToDisplay = [];

    if (currentFilter === 'all') {
        tasksToDisplay = allTasks.filter(task => task['Work Status'] !== 'Archived');
    } else if (currentFilter === 'my') {
        tasksToDisplay = allTasks.filter(task => {
            if (task['PIC / Team'] && task['Work Status'] !== 'Archived') {
                const picArray = task['PIC / Team'].split(',').map(p => p.trim());
                return picArray.includes(currentLoggedInUser);
            }
            return false;
        });
    }

    if (tasksToDisplay.length === 0) {
        taskTableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">Tidak ada tugas untuk ditampilkan.</td></tr>';
        return;
    }

    tasksToDisplay.sort((a, b) => {
        const dateA = new Date(a['Deadline']);
        const dateB = new Date(b['Deadline']);
        return dateA - dateB;
    });


    tasksToDisplay.forEach(task => {
        const row = taskTableBody.insertRow();
        row.dataset.taskId = task['Task ID'];

        const getStatusBadgeClass = (status) => {
            switch (status) {
                case 'Editing': return 'editing';
                case 'Take Konten': return 'take-konten';
                case 'Final Touch': return 'final-touch';
                // Perbaikan: Tambahkan status Done
                case 'Done': return 'done';
                case 'On Hold': return 'on-hold';
                case 'Archived': return 'archived';
                case 'Approved': return 'approved';
                case 'To Be Announced (TBA)': return 'to-be-announced';
                case 'Revised': return 'revised';
                default: return '';
            }
        };

        const getPriorityBadgeClass = (priority) => {
            switch (priority) {
                case 'High': return 'high';
                case 'Medium': return 'medium';
                case 'Low': return 'low';
                default: return '';
            }
        };

        const formatMultiSelectDisplay = (value) => {
            if (!value) return '-';
            const items = value.split(',').map(item => item.trim());
            return items.length > 0 ? items.join(', ') : '-';
        };

        let workStatusDisplay = task['Work Status'] || '-';
        // Perbaikan: Pastikan Final Touch selalu menampilkan progress
        if (task['Work Status'] === 'Final Touch' && task['Progress (%)']) {
            workStatusDisplay = `Final Touch (${task['Progress (%)']}%)`;
        }


        row.innerHTML = `
            <td>${task['Project Name'] || '-'}</td>
            <td>${task['Activity / Task'] || '-'}</td>
            <td>${formatMultiSelectDisplay(task['Platform'])}</td>
            <td><span class="status-badge ${getStatusBadgeClass(task['Work Status'])}">${workStatusDisplay}</span></td>
            <td><span class="status-badge ${getStatusBadgeClass(task['Approval Status'])}">${task['Approval Status'] || '-'}</span></td>
            <td>${task['Notes'] || '-'}</td>
            <td>${formatMultiSelectDisplay(task['PIC / Team'])}</td>
            <td>${task['Deadline'] || '-'}</td>
            <td><span class="priority-badge ${getPriorityBadgeClass(task['Priority'])}">${task['Priority'] || '-'}</span></td>
            <td>${task['Attachment Link'] ? `<a href="${task['Attachment Link']}" target="_blank" class="info-button" style="text-decoration: none; padding: 5px 10px; font-size: 0.8em;">Lihat</a>` : '-'}</td>
            <td class="actions">
                <button class="button secondary-button edit-button" data-task-id="${task['Task ID']}">Edit</button>
                ${task['Work Status'] !== 'Archived' ? `<button class="button danger-button archive-button" data-task-id="${task['Task ID']}">Archive</button>` : ''}
            </td>
        `;

        row.querySelector('.edit-button').addEventListener('click', () => showTaskForm(task));
        const archiveButton = row.querySelector('.archive-button');
        if (archiveButton) {
            archiveButton.addEventListener('click', () => archiveTask(task['Task ID']));
        }
    });
}

/**
 * Membuka form untuk menambah atau mengedit tugas (menggantikan modal).
 * @param {Object} taskData - Data tugas yang akan diedit (opsional, untuk mode edit).
 */
function showTaskForm(taskData = null) {
    taskForm.reset();
    finalTouchProgressGroup.style.display = 'none';
    otherPlatformGroup.style.display = 'none';
    otherPlatformInput.value = '';

    dashboardContent.classList.add('hidden');
    mainFooter.classList.add('hidden');
    taskFormSection.style.display = 'block';

    if (taskData) {
        modalTitle.textContent = 'Edit Tugas';
        taskIdInput.value = taskData['Task ID'];
        projectNameInput.value = taskData['Project Name'] || '';
        activityInput.value = taskData['Activity / Task'] || '';
        notesInput.value = taskData['Notes'] || '';
        deadlineInput.value = taskData['Deadline'] ? new Date(taskData['Deadline']).toISOString().split('T')[0] : '';
        prioritySelect.value = taskData['Priority'] || 'Low';
        attachmentLinkInput.value = taskData['Attachment Link'] || '';

        workStatusSelect.value = taskData['Work Status'] || 'Editing';
        if (workStatusSelect.value === 'Final Touch') {
            finalTouchProgressGroup.style.display = 'block';
            finalTouchProgressInput.value = taskData['Progress (%)'] || 0;
            finalTouchProgressValueSpan.textContent = finalTouchProgressInput.value;
        }

        approvalStatusSelect.value = taskData['Approval Status'] || 'To Be Announced (TBA)';

        if (taskData['Platform']) {
            const platforms = taskData['Platform'].split(',').map(p => p.trim());
            Array.from(platformSelect.options).forEach(option => {
                option.selected = platforms.includes(option.value);
            });
            if (platforms.includes('Other')) {
                otherPlatformGroup.style.display = 'block';
                const nonDefaultPlatforms = platforms.filter(p => !Array.from(platformSelect.options).map(o => o.value).includes(p));
                if (nonDefaultPlatforms.length > 0) {
                    otherPlatformInput.value = nonDefaultPlatforms.join(', ');
                }
            }
        } else {
            Array.from(platformSelect.options).forEach(option => option.selected = false);
        }

        if (taskData['PIC / Team']) {
            const pics = taskData['PIC / Team'].split(',').map(p => p.trim());
            Array.from(picTeamSelect.options).forEach(option => {
                option.selected = pics.includes(option.value);
            });
        } else {
            Array.from(picTeamSelect.options).forEach(option => option.selected = false);
        }

    } else {
        modalTitle.textContent = 'Tambah Tugas Baru';
        taskIdInput.value = '';
        projectNameInput.value = '';
        activityInput.value = '';
        notesInput.value = '';
        deadlineInput.value = '';
        workStatusSelect.value = 'Editing';
        approvalStatusSelect.value = 'To Be Announced (TBA)';
        prioritySelect.value = 'Low';
        Array.from(picTeamSelect.options).forEach(option => {
            option.selected = (option.value === currentLoggedInUser);
        });
        Array.from(platformSelect.options).forEach(option => option.selected = false);
    }
}

/**
 * Menyembunyikan form tugas dan menampilkan dashboard.
 */
function hideTaskForm() {
    taskFormSection.style.display = 'none';
    dashboardContent.classList.remove('hidden');
    mainFooter.classList.remove('hidden');
}

/**
 * Fungsi untuk mengarsipkan tugas.
 * @param {string} taskId - ID tugas yang akan diarsipkan.
 */
async function archiveTask(taskId) {
    // Menggunakan modal kustom sebagai pengganti `confirm`
    if (!window.confirm('Apakah Anda yakin ingin mengarsipkan tugas ini?')) {
        return;
    }

    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'archive', taskId: taskId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            window.alert('Tugas berhasil diarsipkan!');
            fetchTasks();
        } else {
            window.alert('Gagal mengarsipkan tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        window.alert('Terjadi kesalahan saat mengarsipkan tugas. Silakan coba lagi. Detail: ' + error.message);
        console.error('Archive error:', error);
    } finally {
        hideLoading();
    }
}

/**
 * Fungsi untuk mengembalikan tugas dari arsip.
 * @param {string} taskId - ID tugas yang akan dikembalikan.
 */
async function restoreTask(taskId) {
    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'restore', taskId: taskId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            window.alert('Tugas berhasil dikembalikan!');
            // Panggil lagi fetchTasks untuk memperbarui daftar aktif
            fetchTasks(); 
            // Tutup modal arsip setelah berhasil
            closeArchiveListModal();
        } else {
            window.alert('Gagal mengembalikan tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        window.alert('Terjadi kesalahan saat mengembalikan tugas. Silakan coba lagi. Detail: ' + error.message);
        console.error('Restore error:', error);
    } finally {
        hideLoading();
    }
}


/**
 * Membuka modal daftar arsip.
 */
async function openArchiveListModal() {
    showLoading();
    try {
        // Perbaikan: Lakukan panggilan ke data_handler.php untuk mengambil data arsip dari Apps Script.
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'getArchivedTasks' })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }
        
        const result = await response.json();

        archivedProjectsList.innerHTML = '';
        if (result.status === 'success' && result.data && result.data.length > 0) {
            const ul = document.createElement('ul');
            result.data.forEach(task => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${task['Project Name'] || 'Proyek Tanpa Nama'} - ${task['Activity / Task'] || 'Tanpa Aktivitas'}</span>
                    <button class="button secondary-button restore-button" data-task-id="${task['Task ID']}">Kembalikan</button>
                `;
                ul.appendChild(li);
                li.querySelector('.restore-button').addEventListener('click', () => restoreTask(task['Task ID']));
            });
            archivedProjectsList.appendChild(ul);
        } else {
            archivedProjectsList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Tidak ada tugas yang diarsipkan.</p>';
        }
        archiveListModal.classList.add('active');
    } catch (error) {
        window.alert('Gagal memuat daftar arsip. Silakan coba lagi. Detail: ' + error.message);
        console.error('Archive list error:', error);
    } finally {
        hideLoading();
    }
}

/**
 * Menutup modal daftar arsip.
 */
function closeArchiveListModal() {
    archiveListModal.classList.remove('active');
}


/**
 * Fungsi untuk membuat laporan harian dalam format PDF.
 */
async function generateDailyReportPdf() {
    showLoading();
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        const today = new Date();
        const formattedDate = today.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const reportTitle = `Laporan Tugas Harian - ${formattedDate}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(reportTitle, 10, 15);
        doc.setFontSize(7);
        doc.text(`Dibuat oleh: ${currentLoggedInUser}`, 10, 22);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 10, 27);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);

        let y = 40;

        const activeTasks = allTasks.filter(task =>
            task['Work Status'] !== 'Archived'
        );

        console.log("All tasks from spreadsheet:", allTasks);
        console.log("Active tasks for PDF report (filtered):", activeTasks);

        if (activeTasks.length === 0) {
            doc.text('Tidak ada tugas aktif untuk dilaporkan hari ini.', 10, y + 10);
        } else {
            const columnHeaders = [
                'Proyek', 'Aktivitas', 'Platform', 'Work Status', 'Approval Status', 'PIC / Tim', 'Batas Waktu', 'Catatan', 'Lampiran'
            ];
            const finalColumnWidths = [25, 45, 25, 25, 25, 25, 20, 60, 17];

            doc.setFont('helvetica', 'bold');
            let currentX = 10;
            columnHeaders.forEach((headerText, i) => {
                const headerLines = doc.splitTextToSize(headerText, finalColumnWidths[i] - 2);
                doc.text(headerLines, currentX, y);
                currentX += finalColumnWidths[i];
            });
            const maxHeaderHeight = columnHeaders.reduce((max, headerText, i) => { // Perbaikan: Ganti maxH menjadi max
                const lines = doc.splitTextToSize(headerText, finalColumnWidths[i] - 2);
                return Math.max(max, lines.length * (doc.getLineHeight() / doc.internal.scaleFactor));
            }, 0);

            y += maxHeaderHeight + 3;
            doc.line(10, y, doc.internal.pageSize.width - 10, y);
            y += 7;

            doc.setFont('helvetica', 'normal');
            activeTasks.forEach((task, index) => {
                currentX = 10;
                const taskStatusDisplay = task['Work Status'] +
                                          (task['Work Status'] === 'Final Touch' && task['Progress (%)']
                                           ? ` (${task['Progress (%)']}%)` : '');

                let formattedDeadline = task['Deadline'] || '-';
                if (task['Deadline']) {
                    const dateObj = new Date(task['Deadline']);
                    if (!isNaN(dateObj.getTime())) {
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        formattedDeadline = `${day}/${month}`;
                    }
                }

                const rowData = [
                    task['Project Name'] || '-',
                    task['Activity / Task'] || '-',
                    task['Platform'] || '-',
                    taskStatusDisplay,
                    task['Approval Status'] || '-',
                    task['PIC / Team'] || '-',
                    formattedDeadline,
                    task['Notes'] || '-'
                ];

                let maxHeight = 0;
                const linesPerCell = rowData.map((cellText, i) => {
                    const textLines = doc.splitTextToSize(cellText, finalColumnWidths[i] - 2);
                    maxHeight = Math.max(maxHeight, textLines.length);
                    return textLines;
                });

                const rowHeight = maxHeight * (doc.getLineHeight() / doc.internal.scaleFactor) + 2;


                if (y + rowHeight > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    y = 15;
                    doc.setFont('helvetica', 'bold');
                    currentX = 10;
                    columnHeaders.forEach((headerText, i) => {
                        doc.text(headerText, currentX, y);
                        currentX += finalColumnWidths[i];
                    });
                    y += 3;
                    doc.line(10, y, doc.internal.pageSize.width - 10, y);
                    y += 7;
                    doc.setFont('helvetica', 'normal');
                }

                currentX = 10;
                linesPerCell.forEach((textLines, i) => {
                    doc.text(textLines, currentX, y);
                    currentX += finalColumnWidths[i];
                });

                if (task['Attachment Link']) {
                    const linkText = 'Lihat';
                    const attachmentColIndex = columnHeaders.indexOf('Lampiran');
                    const linkX = 10 + finalColumnWidths.slice(0, attachmentColIndex).reduce((sum, width) => sum + width, 0);
                    const linkY = y;
                    doc.setTextColor(0, 0, 255);
                    doc.textWithLink(linkText, linkX, linkY, { url: task['Attachment Link'] });
                    doc.setTextColor(0);
                }

                y += rowHeight;
            });
        }

        doc.save(`Daily_Report_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}.pdf`);
        window.alert('Laporan PDF berhasil dibuat!');

    } catch (error) {
        window.alert('Gagal membuat laporan PDF. Silakan coba lagi. Detail: ' + error.message);
        console.error('PDF generation error:', error);
    } finally {
        hideLoading();
    }
}


/**
 * Membuka modal untuk mengatur/mengubah PIN.
 */
function openSetPinDashboardModal() {
    dashboardNewPinInput.value = '';
    dashboardPinErrorMessage.textContent = '';
    setPinDashboardModal.classList.add('active');
}

/**
 * Menutup modal mengatur/mengubah PIN.
 */
function closeSetPinDashboardModal() {
    setPinDashboardModal.classList.remove('active');
}

/**
 * Menampilkan overlay loading.
 */
function showLoading() {
    loadingOverlay.classList.add('active');
}

/**
 * Menyembunyikan overlay loading.
 */
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Fungsi untuk memperbarui data pengguna via pin_manager.php
async function updateUserData(username, pin, firstLoginDone = null) {
    showLoading();
    try {
        const response = await fetch(PIN_MANAGER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updatePin',
                username: username,
                pin: pin,
                firstLoginDone: firstLoginDone
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }
        const result = await response.json();
        if (result.status === 'success') {
            window.alert(result.message);
            return true;
        } else {
            throw new Error(result.message || 'Gagal memperbarui data pengguna.');
        }
    } catch (error) {
        window.alert('Terjadi kesalahan saat memperbarui PIN. Silakan coba lagi. Detail: ' + error.message);
        console.error('Error updating user data:', error);
        return false;
    } finally {
        hideLoading();
    }
}


// --- EVENT LISTENERS ---

// Saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    currentLoggedInUser = await checkLoginStatus();
    if (currentLoggedInUser) {
        fetchTasks();
    }
});

// Logout
logoutButton.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '../index.html';
});

// Buka modal Set/Ubah PIN dari footer (sekarang teks)
setPinDashboardText.addEventListener('click', openSetPinDashboardModal);

// Buka modal Arsip Tugas dari footer
archiveTasksText.addEventListener('click', openArchiveListModal);


// Tutup modal Set/Ubah PIN
closePinDashboardModalButton.addEventListener('click', closeSetPinDashboardModal);
cancelDashboardPinButton.addEventListener('click', closeSetPinDashboardModal);
setPinDashboardModal.addEventListener('click', (e) => {
    if (e.target === setPinDashboardModal) {
        closeSetPinDashboardModal();
    }
});

// Tutup modal Arsip Tugas
closeArchiveListModalButton.addEventListener('click', closeArchiveListModal);
archiveListModal.addEventListener('click', (e) => {
    if (e.target === archiveListModal) {
        closeArchiveListModal();
    }
});


// Simpan PIN dari dashboard
saveDashboardPinButton.addEventListener('click', async () => {
    const newPin = dashboardNewPinInput.value.trim();
    dashboardPinErrorMessage.textContent = '';

    if (newPin && (newPin.length !== 4 || !/^\d+$/.test(newPin))) {
        dashboardPinErrorMessage.textContent = 'PIN harus 4 digit angka, atau kosongkan untuk menghapus.';
        return;
    }

    const pinToSave = newPin === '' ? null : newPin;

    const success = await updateUserData(currentLoggedInUser, pinToSave);
    if (success) {
        closeSetPinDashboardModal();
    }
});


// Tab switching
allTasksTab.addEventListener('click', () => {
    allTasksTab.classList.add('active');
    myTasksTab.classList.remove('active');
    currentFilter = 'all';
    fetchTasks();
});

myTasksTab.addEventListener('click', () => {
    myTasksTab.classList.add('active');
    allTasksTab.classList.remove('active');
    currentFilter = 'my';
    fetchTasks();
});


// Buka form tambah tugas
addTaskButton.addEventListener('click', () => showTaskForm());

// Tombol Batal di form tugas
document.getElementById('cancelTaskButton').addEventListener('click', hideTaskForm);

// Tombol Generate Report
generateReportButton.addEventListener('click', generateDailyReportPdf);


// Event listener untuk Work Status agar slider Final Touch muncul/sembunyi
workStatusSelect.addEventListener('change', () => {
    const selectedValue = workStatusSelect.value;
    if (selectedValue === 'Final Touch') {
        finalTouchProgressGroup.style.display = 'block';
    } else {
        finalTouchProgressGroup.style.display = 'none';
        if (finalTouchProgressInput.value !== '0') {
            finalTouchProgressInput.value = 0;
            finalTouchProgressValueSpan.textContent = 0;
        }
    }
});

// Event listener untuk slider Final Touch
finalTouchProgressInput.addEventListener('input', () => {
    finalTouchProgressValueSpan.textContent = finalTouchProgressInput.value;
});

// Event listener untuk Platform agar input 'Other' muncul/sembunyi
platformSelect.addEventListener('change', () => {
    const selectedOptions = Array.from(platformSelect.options).filter(option => option.selected).map(option => option.value);
    if (selectedOptions.includes('Other')) {
        otherPlatformGroup.style.display = 'block';
    } else {
        otherPlatformGroup.style.display = 'none';
        otherPlatformInput.value = '';
    }
});


// Submit form tambah/edit tugas
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isEditing = taskIdInput.value !== '';
    const action = isEditing ? 'update' : 'add';

    const selectedPlatforms = Array.from(platformSelect.options).filter(option => option.selected).map(option => option.value);
    let platformValue = selectedPlatforms.join(', ');
    if (selectedPlatforms.includes('Other') && otherPlatformInput.value.trim() !== '') {
        platformValue += `, ${otherPlatformInput.value.trim()}`;
    }

    const selectedPICs = Array.from(picTeamSelect.options).filter(option => option.selected).map(option => option.value);
    const picTeamValue = selectedPICs.join(', ');

    const taskData = {
        'Task ID': taskIdInput.value,
        'Project Name': projectNameInput.value.trim(),
        'Activity / Task': activityInput.value.trim(),
        'Platform': platformValue,
        'Work Status': workStatusSelect.value,
        'Approval Status': approvalStatusSelect.value,
        'Notes': notesInput.value.trim(),
        'PIC / Team': picTeamValue,
        'Deadline': deadlineInput.value,
        'Priority': prioritySelect.value,
        'Attachment Link': attachmentLinkInput.value.trim()
    };
    
    // Debugging: Log data tugas yang akan dikirim
    console.log('Action:', action);
    console.log('Task data to be sent:', taskData);


    if (workStatusSelect.value === 'Final Touch') {
        taskData['Progress (%)'] = finalTouchProgressInput.value;
    } else {
        taskData['Progress (%)'] = '';
    }


    if (!taskData['Activity / Task'] || !taskData['PIC / Team']) {
        window.alert('Aktivitas dan PIC / Tim harus diisi.');
        return;
    }

    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action, task: taskData })
        });
        
        // Debugging: Log respons mentah dari server
        const responseText = await response.text();
        console.log('Raw server response:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. Response: ${responseText}`);
        }

        const result = JSON.parse(responseText); // Parse manual jika response.text() sudah diambil

        if (result.status === 'success') {
            window.alert('Tugas berhasil ' + (isEditing ? 'diperbarui' : 'ditambahkan') + '!');
            hideTaskForm();
            // Panggil fetchTasks() lagi untuk memuat ulang data terbaru
            fetchTasks(); 
        } else {
            window.alert('Gagal ' + (isEditing ? 'memperbarui' : 'menambahkan') + ' tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        window.alert('Terjadi kesalahan saat menyimpan tugas. Silakan coba lagi. Detail: ' + error.message);
        console.error('Submit error:', error);
    } finally {
        // PERBAIKAN PENTING: Pastikan loading overlay disembunyikan
        hideLoading();
    }
});
