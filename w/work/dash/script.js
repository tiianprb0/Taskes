// File: public_html/w/work/dash/script.js
// Deskripsi: Logika JavaScript untuk halaman dashboard Task Tracker.
// Perbaikan: Menambahkan logika untuk fitur archive, restore, dan status "Done" baru.
// Perbaikan: Menambahkan fitur upload gambar atau URL dan menampilkan gambar di laporan PDF.
// Perbaikan: Mengganti notifikasi bawaan browser dengan modal kustom dan menambahkan popup gambar.
// Perbaikan: Menambahkan margin di laporan PDF agar tidak terlalu rapat.
// Perbaikan: Menyesuaikan lebar kolom pada laporan PDF dan memperbesar ukuran font.
// Perbaikan: Fungsionalitas upload gambar diubah agar menyimpan file ke server dan menyimpan URL-nya.

// --- KONSTANTA ---
// Ganti dengan URL proxy PHP baru Anda
const APPS_SCRIPT_PROXY_URL = '../apps_script_proxy.php';
const PIN_MANAGER_URL = '../pin_manager.php'; // Path ke file pin_manager.php
const TASK_QUEUE_URL = '../task_queue.json'; // Mengambil data dari JSON lokal
const DATA_HANDLER_URL = '../data_handler.php'; // URL baru untuk handler data
const UPLOAD_HANDLER_URL = '../upload_handler.php'; // NEW: URL untuk file upload
const SESSION_KEY = 'loggedInUser';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 jam dalam milidetik

// Elemen DOM
const loggedInUsernameSpan = document.getElementById('loggedInUsername');
const logoutButton = document.getElementById('logoutButton');
const setPinDashboardText = document.getElementById('setPinDashboardText');
const allTasksTab = document.getElementById('allTasksTab');
const myTasksTab = document.getElementById('myTasksTab');
const archiveTasksText = document.getElementById('archiveTasksText');
const addTaskButton = document.getElementById('addTaskButton');
const generateReportButton = document.getElementById('generateReportButton');
const taskTableBody = document.getElementById('taskTableBody');
const dashboardContent = document.getElementById('dashboardContent');
const taskFormSection = document.getElementById('taskFormSection');
const modalTitle = document.getElementById('modalTitle');
const taskForm = document.getElementById('taskForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const mainFooter = document.getElementById('mainFooter');

// Input form modal (tugas)
const taskIdInput = document.getElementById('taskId');
const projectNameInput = document.getElementById('projectName');
const activityInput = document.getElementById('activity');
const platformSelect = document.getElementById('platform');
const otherPlatformGroup = document.getElementById('otherPlatformGroup');
const otherPlatformInput = document.getElementById('otherPlatformInput');
const workStatusSelect = document.getElementById('workStatus');
const finalTouchProgressGroup = document.getElementById('finalTouchProgressGroup');
const finalTouchProgressInput = document.getElementById('finalTouchProgress');
const finalTouchProgressValueSpan = document.getElementById('finalTouchProgressValue');
const approvalStatusSelect = document.getElementById('approvalStatus');
const notesInput = document.getElementById('notes');
const picTeamSelect = document.getElementById('picTeam');
const deadlineInput = document.getElementById('deadline');
const prioritySelect = document.getElementById('priority');

// Attachment DOM elements
const attachmentTypeRadios = document.querySelectorAll('input[name="attachment-type"]');
const attachmentUploadGroup = document.getElementById('attachment-upload-group');
const attachmentUrlGroup = document.getElementById('attachment-url-group');
const attachmentFileInput = document.getElementById('attachmentFile');
const attachmentLinkInput = document.getElementById('attachmentLink');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image-button');


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

// Elemen Modal Notifikasi Kustom
const customAlertModal = document.getElementById('customAlertModal');
const customAlertMessage = document.getElementById('customAlertMessage');
const customAlertOkButton = document.getElementById('customAlertOkButton');
const customConfirmModal = document.getElementById('customConfirmModal');
const customConfirmMessage = document.getElementById('customConfirmMessage');
const customConfirmOkButton = document.getElementById('customConfirmOkButton');
const customConfirmCancelButton = document.getElementById('customConfirmCancelButton');

// Elemen Modal Popup Gambar
const imagePopupModal = document.getElementById('imagePopupModal');
const imagePopupImage = document.getElementById('imagePopupImage');
const closeImagePopupModalButton = document.getElementById('closeImagePopupModalButton');


let allTasks = [];
let currentFilter = 'all';
let currentLoggedInUser = null;

let confirmCallback = null;

// --- FUNGSI NOTIFIKASI KUSTOM ---

/**
 * Menampilkan modal alert kustom.
 * @param {string} message - Pesan yang akan ditampilkan.
 */
function showCustomAlert(message) {
    customAlertMessage.textContent = message;
    customAlertModal.classList.add('active');
}

/**
 * Menampilkan modal konfirmasi kustom.
 * @param {string} message - Pesan konfirmasi yang akan ditampilkan.
 * @returns {Promise<boolean>} - Mengembalikan Promise yang resolve dengan true jika OK, false jika Batal.
 */
function showCustomConfirm(message) {
    return new Promise(resolve => {
        customConfirmMessage.textContent = message;
        customConfirmModal.classList.add('active');
        confirmCallback = resolve;
    });
}

/**
 * Menutup semua modal notifikasi kustom.
 */
function closeCustomModals() {
    customAlertModal.classList.remove('active');
    customConfirmModal.classList.remove('active');
    imagePopupModal.classList.remove('active');
}


// --- FUNGSI UTAMA ---

/**
 * Memeriksa status login pengguna. Jika tidak valid, redirect ke halaman login.
 */
async function checkLoginStatus() {
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (!storedSession) {
        window.location.href = '../index.html';
        return null;
    }

    const sessionData = JSON.parse(storedSession);
    const currentTime = new Date().getTime();

    if (currentTime - sessionData.loginTime >= SESSION_DURATION_MS) {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = '../index.html';
        return null;
    }

    sessionData.loginTime = currentTime;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

    loggedInUsernameSpan.textContent = sessionData.username;
    currentLoggedInUser = sessionData.username;
    return sessionData.username;
}

/**
 * Mengambil data tugas dari file JSON lokal, dengan penambahan cache-buster.
 */
async function fetchTasks() {
    console.log("Fetching tasks from local JSON...");
    showLoading();
    try {
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
        allTasks = result;
        renderTasks();
    } catch (error) {
        showCustomAlert('Terjadi kesalahan saat mengambil data tugas. Silakan coba lagi. Detail: ' + error.message);
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
    taskTableBody.innerHTML = '';
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
        taskTableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">Tidak ada tugas untuk ditampilkan.</td></tr>';
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
        if (task['Work Status'] === 'Final Touch' && task['Progress (%)']) {
            workStatusDisplay = `Final Touch (${task['Progress (%)']}%)`;
        }
        
        let attachmentButton = '-';
        if (task['Attachment Link']) {
            if (task['Attachment Link'].match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                attachmentButton = `<button class="button info-button view-attachment-button" data-type="image" data-link="${task['Attachment Link']}">Lihat Gambar</button>`;
            } else if (task['Attachment Link'].startsWith('http')) {
                attachmentButton = `<a href="${task['Attachment Link']}" target="_blank" class="button info-button" style="text-decoration: none;">Lihat Tautan</a>`;
            }
        }


        row.innerHTML = `
            <td>${task['Project Name'] || '-'}</td>
            <td>${task['Activity / Task'] || '-'}</td>
            <td>${formatMultiSelectDisplay(task['Platform'])}</td>
            <td><span class="status-badge ${getStatusBadgeClass(task['Work Status'])}">${workStatusDisplay}</span></td>
            <td><span class="status-badge ${getStatusBadgeClass(task['Approval Status'])}">${task['Approval Status'] || '-'}</span></td>
            <td>${formatMultiSelectDisplay(task['PIC / Team'])}</td>
            <td>${task['Deadline'] || '-'}</td>
            <td><span class="priority-badge ${getPriorityBadgeClass(task['Priority'])}">${task['Priority'] || '-'}</span></td>
            <td>${attachmentButton}</td>
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
        
        const viewButton = row.querySelector('.view-attachment-button');
        if (viewButton) {
            viewButton.addEventListener('click', (e) => {
                const link = e.target.dataset.link;
                if (link) {
                    imagePopupImage.src = link;
                    imagePopupModal.classList.add('active');
                }
            });
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
    
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '#';
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';

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
        
        const attachmentLink = taskData['Attachment Link'] || '';
        if (attachmentLink.match(/\.(jpeg|jpg|gif|png|webp)$/i) || attachmentLink.startsWith('data:image/')) {
            imagePreview.src = attachmentLink;
            imagePreviewContainer.style.display = 'flex';
        }

        if (attachmentLink.startsWith('http')) {
            document.querySelector('input[name="attachment-type"][value="url"]').checked = true;
            attachmentUploadGroup.style.display = 'none';
            attachmentUrlGroup.style.display = 'block';
            attachmentLinkInput.value = attachmentLink;
        } else {
            document.querySelector('input[name="attachment-type"][value="upload"]').checked = true;
            attachmentUploadGroup.style.display = 'block';
            attachmentUrlGroup.style.display = 'none';
        }


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
        taskForm.reset();
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
        
        otherPlatformGroup.style.display = 'none';
        finalTouchProgressGroup.style.display = 'none';
        document.querySelector('input[name="attachment-type"][value="upload"]').checked = true;
        attachmentUploadGroup.style.display = 'block';
        attachmentUrlGroup.style.display = 'none';
    }
}

/**
 * Menyembunyikan form tugas dan menampilkan dashboard.
 */
function hideTaskForm() {
    taskFormSection.style.display = 'none';
    dashboardContent.classList.remove('hidden');
    mainFooter.classList.remove('hidden');
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '#';
}

/**
 * Fungsi untuk mengarsipkan tugas.
 * @param {string} taskId - ID tugas yang akan diarsipkan.
 */
async function archiveTask(taskId) {
    const isConfirmed = await showCustomConfirm('Apakah Anda yakin ingin mengarsipkan tugas ini?');
    if (!isConfirmed) {
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
            showCustomAlert('Tugas berhasil diarsipkan!');
            fetchTasks();
        } else {
            showCustomAlert('Gagal mengarsipkan tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        showCustomAlert('Terjadi kesalahan saat mengarsipkan tugas. Silakan coba lagi. Detail: ' + error.message);
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
            showCustomAlert('Tugas berhasil dikembalikan!');
            fetchTasks(); 
            closeArchiveListModal();
        } else {
            showCustomAlert('Gagal mengembalikan tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        showCustomAlert('Terjadi kesalahan saat mengembalikan tugas. Silakan coba lagi. Detail: ' + error.message);
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
        showCustomAlert('Gagal memuat daftar arsip. Silakan coba lagi. Detail: ' + error.message);
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
        doc.setFontSize(22);
        doc.text(reportTitle, 10, 15);
        doc.setFontSize(11);
        doc.text(`Dibuat oleh: ${currentLoggedInUser}`, 10, 22);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 10, 27);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        let y = 35;

        const activeTasks = allTasks.filter(task =>
            task['Work Status'] !== 'Archived'
        );

        console.log("All tasks from spreadsheet:", allTasks);
        console.log("Active tasks for PDF report (filtered):", activeTasks);

        if (activeTasks.length === 0) {
            doc.text('Tidak ada tugas aktif untuk dilaporkan hari ini.', 10, y + 10);
        } else {
            const columnHeaders = [
                'Proyek', 'Aktivitas', 'Platform', 'Work Status', 'Approval Status', 'PIC / Tim', 'Batas Waktu', 'Prioritas', 'Lampiran'
            ];
            const finalColumnWidths = [40, 55, 30, 30, 30, 20, 20, 15, 20];

            doc.setFont('helvetica', 'bold');
            let currentX = 10;
            y += 10;
            columnHeaders.forEach((headerText, i) => {
                const headerLines = doc.splitTextToSize(headerText, finalColumnWidths[i] - 2);
                doc.text(headerLines, currentX, y);
                currentX += finalColumnWidths[i];
            });
            const maxHeaderHeight = columnHeaders.reduce((max, headerText, i) => {
                const lines = doc.splitTextToSize(headerText, finalColumnWidths[i] - 2);
                return Math.max(max, lines.length * (doc.getLineHeight() / doc.internal.scaleFactor));
            }, 0);

            y += maxHeaderHeight + 3;
            doc.line(10, y, doc.internal.pageSize.width - 10, y);
            y += 7;

            doc.setFont('helvetica', 'normal');

            const imgPromises = activeTasks.map(task => {
                const attachmentLink = task['Attachment Link'];
                if (attachmentLink && attachmentLink.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => resolve(img);
                        img.onerror = () => {
                            console.error(`Gagal memuat gambar dari URL: ${attachmentLink}`);
                            resolve(null);
                        };
                        img.src = attachmentLink;
                    });
                }
                return Promise.resolve(null);
            });

            const loadedImages = await Promise.all(imgPromises);

            for (let i = 0; i < activeTasks.length; i++) {
                const task = activeTasks[i];
                const attachmentLink = task['Attachment Link'] || '';
                const img = loadedImages[i];

                let currentX = 10;
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
                    task['Priority'] || '-'
                ];

                let imageHeight = 0;
                let imageWidth = 0;
                const rowPadding = 2;
                const textHeight = (doc.getLineHeight() / doc.internal.scaleFactor) * 2;
                let rowContentHeight = textHeight;

                if (img) {
                    imageWidth = 20;
                    imageHeight = img.height * (imageWidth / img.width);
                    rowContentHeight = Math.max(rowContentHeight, imageHeight);
                }

                const rowHeight = rowContentHeight + rowPadding * 2;

                if (y + rowHeight > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    y = 15;
                    doc.setFont('helvetica', 'bold');
                    let newX = 10;
                    columnHeaders.forEach((headerText, i) => {
                        doc.text(headerText, newX, y);
                        newX += finalColumnWidths[i];
                    });
                    y += 3;
                    doc.line(10, y, doc.internal.pageSize.width - 10, y);
                    y += 7;
                    doc.setFont('helvetica', 'normal');
                }

                currentX = 10;
                const linesPerCell = rowData.map((cellText, i) => doc.splitTextToSize(cellText, finalColumnWidths[i] - 2));

                linesPerCell.forEach((textLines, i) => {
                    const textY = y + rowPadding + ((rowContentHeight - (textLines.length * (doc.getLineHeight() / doc.internal.scaleFactor))) / 2);
                    doc.text(textLines, currentX, textY);
                    currentX += finalColumnWidths[i];
                });

                const attachmentColIndex = columnHeaders.indexOf('Lampiran');
                const attachmentX = 10 + finalColumnWidths.slice(0, attachmentColIndex).reduce((sum, width) => sum + width, 0);
                
                if (img) {
                    const imageY = y + rowPadding + ((rowContentHeight - imageHeight) / 2);
                    doc.addImage(img, 'JPEG', attachmentX + 2, imageY, imageWidth, imageHeight);
                } else if (attachmentLink.startsWith('http')) {
                    const linkText = 'Lihat';
                    doc.setTextColor(0, 0, 255);
                    const linkY = y + rowPadding + (rowContentHeight / 2);
                    doc.textWithLink(linkText, attachmentX + 2, linkY, { url: attachmentLink });
                    doc.setTextColor(0);
                } else {
                    const textY = y + rowPadding + (rowContentHeight / 2);
                    doc.text('-', attachmentX + 2, textY);
                }

                y += rowHeight;
                doc.line(10, y, doc.internal.pageSize.width - 10, y);
                y += 2;
            }
        }

        doc.save(`Daily_Report_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}.pdf`);
        showCustomAlert('Laporan PDF berhasil dibuat!');

    } catch (error) {
        showCustomAlert('Gagal membuat laporan PDF. Silakan coba lagi. Detail: ' + error.message);
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
            showCustomAlert(result.message);
            return true;
        } else {
            throw new Error(result.message || 'Gagal memperbarui data pengguna.');
        }
    } catch (error) {
        showCustomAlert('Terjadi kesalahan saat memperbarui PIN. Silakan coba lagi. Detail: ' + error.message);
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

// NEW: Event listeners for custom alert/confirm modals
customAlertOkButton.addEventListener('click', closeCustomModals);
customConfirmOkButton.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(true);
    }
    closeCustomModals();
});
customConfirmCancelButton.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(false);
    }
    closeCustomModals();
});

// NEW: Event listener for image popup modal
closeImagePopupModalButton.addEventListener('click', closeCustomModals);
imagePopupModal.addEventListener('click', (e) => {
    if (e.target === imagePopupModal) {
        closeCustomModals();
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

// NEW: Event listener for attachment type radio buttons
attachmentTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'upload') {
            attachmentUploadGroup.style.display = 'block';
            attachmentUrlGroup.style.display = 'none';
        } else {
            attachmentUploadGroup.style.display = 'none';
            attachmentUrlGroup.style.display = 'block';
        }
        // Clear inputs and hide preview when switching
        attachmentFileInput.value = '';
        attachmentLinkInput.value = '';
        imagePreviewContainer.style.display = 'none';
        imagePreview.src = '#';
    });
});

// NEW: Event listener for file input to show preview (now handles Base64 for preview only)
attachmentFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.src = '#';
        imagePreviewContainer.style.display = 'none';
    }
});

// NEW: Event listener for URL input to show preview
attachmentLinkInput.addEventListener('input', () => {
    const url = attachmentLinkInput.value;
    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.startsWith('http')) {
        imagePreview.src = url;
        imagePreviewContainer.style.display = 'flex';
    } else {
        imagePreview.src = '#';
        imagePreviewContainer.style.display = 'none';
    }
});

// NEW: Event listener to remove image
removeImageButton.addEventListener('click', () => {
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';
    imagePreview.src = '#';
    imagePreviewContainer.style.display = 'none';
    document.querySelector('input[name="attachment-type"][value="upload"]').checked = true;
    attachmentUploadGroup.style.display = 'block';
    attachmentUrlGroup.style.display = 'none';
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

    let finalAttachmentUrl = '';
    const selectedAttachmentType = document.querySelector('input[name="attachment-type"]:checked').value;
    
    showLoading();

    try {
        if (selectedAttachmentType === 'upload' && attachmentFileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('image', attachmentFileInput.files[0]);

            const uploadResponse = await fetch(UPLOAD_HANDLER_URL, {
                method: 'POST',
                body: formData
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.status === 'success') {
                finalAttachmentUrl = uploadResult.imageUrl;
            } else {
                throw new Error(uploadResult.message || 'Gagal mengunggah gambar.');
            }
        } else if (selectedAttachmentType === 'url' && attachmentLinkInput.value.trim() !== '') {
            finalAttachmentUrl = attachmentLinkInput.value.trim();
        }

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
            'Attachment Link': finalAttachmentUrl
        };
        
        if (workStatusSelect.value === 'Final Touch') {
            taskData['Progress (%)'] = finalTouchProgressInput.value;
        } else {
            taskData['Progress (%)'] = '';
        }

        if (!taskData['Activity / Task'] || !taskData['PIC / Team']) {
            showCustomAlert('Aktivitas dan PIC / Tim harus diisi.');
            return;
        }
        
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action, task: taskData })
        });
        
        const responseText = await response.text();
        console.log('Raw server response:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. Response: ${responseText}`);
        }

        const result = JSON.parse(responseText);

        if (result.status === 'success') {
            showCustomAlert('Tugas berhasil ' + (isEditing ? 'diperbarui' : 'ditambahkan') + '!');
            hideTaskForm();
            fetchTasks(); 
        } else {
            showCustomAlert('Gagal ' + (isEditing ? 'memperbarui' : 'menambahkan') + ' tugas: ' + result.message);
            console.error('API Error:', result.message);
        }
    } catch (error) {
        showCustomAlert('Terjadi kesalahan saat menyimpan tugas. Silakan coba lagi. Detail: ' + error.message);
        console.error('Submit error:', error);
    } finally {
        hideLoading();
    }
});
