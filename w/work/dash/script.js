// File: public_html/w/work/dash/script.js
// Deskripsi: Logika JavaScript untuk halaman dashboard Task Tracker yang diperbarui.
// Mengimplementasikan UI dari Dailish (list, filter, search, settings panel).

// --- KONSTANTA ---
const APPS_SCRIPT_PROXY_URL = '../apps_script_proxy.php';
const PIN_MANAGER_URL = '../pin_manager.php';
const DATA_HANDLER_URL = '../data_handler.php';
const UPLOAD_HANDLER_URL = '../upload_handler.php';
const SESSION_KEY = 'loggedInUser';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const THEME_KEY = 'appTheme';

// Elemen DOM
const usernameDisplay = document.getElementById('username-display');
const userAvatar = document.getElementById('user-avatar');
const logoutButton = document.getElementById('logoutButton');
const setPinDashboardText = document.getElementById('setPinDashboardText');
const archiveTasksText = document.getElementById('archiveTasksText');
const generateReportButton = document.getElementById('generateReportButton');
const addTaskButton = document.getElementById('addTaskButton');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const dashboardMainContent = document.getElementById('dashboard-main-content'); // Fix: Mengganti dashboardContent
const taskFormSection = document.getElementById('taskFormSection');
const modalTitle = document.getElementById('modalTitle');
const taskForm = document.getElementById('taskForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const hamburgerMenu = document.getElementById('hamburger-menu');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsButton = document.getElementById('close-settings');
const searchButton = document.getElementById('search-btn');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');

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
const cancelTaskButton = document.getElementById('cancelTaskButton');

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

// Filter control buttons
const filterAllButton = document.getElementById('filter-all');
const filterMyButton = document.getElementById('filter-my');
const themeLightButton = document.getElementById('theme-light');
const themeDarkButton = document.getElementById('theme-dark');

let allTasks = [];
let currentFilter = 'all';
let currentSort = 'default';
let currentSearch = '';
let currentLoggedInUser = null;
let confirmCallback = null;

// --- FUNGSI NOTIFIKASI KUSTOM ---
function showCustomAlert(message) {
    customAlertMessage.textContent = message;
    customAlertModal.classList.add('active');
}

function showCustomConfirm(message) {
    return new Promise(resolve => {
        customConfirmMessage.textContent = message;
        customConfirmModal.classList.add('active');
        confirmCallback = resolve;
    });
}

function closeCustomModals() {
    customAlertModal.classList.remove('active');
    customConfirmModal.classList.remove('active');
    imagePopupModal.classList.remove('active');
}

// --- FUNGSI TEMA ---
function setTheme(themeName) {
    localStorage.setItem(THEME_KEY, themeName);
    document.body.className = '';
    document.body.classList.add(themeName);
}
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light-mode';
    setTheme(savedTheme);
}

// --- FUNGSI UTAMA ---
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
    usernameDisplay.textContent = sessionData.username;
    userAvatar.textContent = sessionData.username[0].toUpperCase();
    currentLoggedInUser = sessionData.username;
    return sessionData.username;
}

async function fetchTasks() {
    console.log("Fetching tasks from local JSON...");
    showLoading();
    try {
        const url = `../task_queue.json?t=${new Date().getTime()}`;
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

function renderTasks() {
    console.log(`Rendering tasks with filter: ${currentFilter}, sort: ${currentSort}, search: ${currentSearch}`);
    taskList.innerHTML = '';
    
    let tasksToDisplay = allTasks.filter(task => task['Work Status'] !== 'Archived');

    // Menerapkan filter
    if (currentFilter === 'my') {
        tasksToDisplay = tasksToDisplay.filter(task => {
            if (task['PIC / Team']) {
                const picArray = task['PIC / Team'].split(',').map(p => p.trim());
                return picArray.includes(currentLoggedInUser);
            }
            return false;
        });
    }

    // Menerapkan pencarian
    if (currentSearch) {
        const searchTerm = currentSearch.toLowerCase();
        tasksToDisplay = tasksToDisplay.filter(task => {
            return Object.values(task).some(value => 
                String(value).toLowerCase().includes(searchTerm)
            );
        });
    }

    // Menerapkan pengurutan
    tasksToDisplay.sort((a, b) => {
        // Pinned tasks always on top
        const isPinnedA = a.isPinned ? 1 : 0;
        const isPinnedB = b.isPinned ? 1 : 0;
        if (isPinnedA !== isPinnedB) {
            return isPinnedB - isPinnedA;
        }

        if (currentSort === 'deadline') {
            const dateA = a['Deadline'] ? new Date(a['Deadline']) : new Date('9999-12-31');
            const dateB = b['Deadline'] ? new Date(b['Deadline']) : new Date('9999-12-31');
            return dateA - dateB;
        } else if (currentSort === 'priority') {
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            const priorityA = priorityOrder[a['Priority']] || 0;
            const priorityB = priorityOrder[b['Priority']] || 0;
            return priorityB - priorityA; // Descending order
        }
        return 0; // Default order
    });


    if (tasksToDisplay.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tasksToDisplay.forEach(task => {
        const taskItem = document.createElement('li');
        taskItem.className = `task-item ${task.isPinned ? 'pinned' : ''}`;
        taskItem.dataset.taskId = task['Task ID'];

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

        const taskStatusDisplay = task['Work Status'] === 'Final Touch' && task['Progress (%)']
                                 ? `${task['Work Status']} (${task['Progress (%)']}%)`
                                 : task['Work Status'] || '-';

        let attachmentButtonHtml = '';
        if (task['Attachment Link']) {
            if (task['Attachment Link'].match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                attachmentButtonHtml = `<button class="task-btn view-attachment-button" data-type="image" data-link="${task['Attachment Link']}"><i class="fas fa-image"></i></button>`;
            } else if (task['Attachment Link'].startsWith('http')) {
                attachmentButtonHtml = `<a href="${task['Attachment Link']}" target="_blank" class="task-btn" style="text-decoration: none;"><i class="fas fa-external-link-alt"></i></a>`;
            }
        }

        taskItem.innerHTML = `
            <div class="task-header">
                <div class="task-title-and-meta">
                    <div style="display:flex; align-items: center; gap: 0.5rem;">
                        <span class="task-title">${task['Activity / Task'] || '-'}</span>
                        <div class="task-actions">
                            <button class="task-btn pin-button" data-task-id="${task['Task ID']}">
                                <i class="${task.isPinned ? 'fas' : 'far'} fa-thumbtack"></i>
                            </button>
                            <button class="task-btn edit-button" data-task-id="${task['Task ID']}"><i class="fas fa-edit"></i></button>
                            <button class="task-btn archive-button" data-task-id="${task['Task ID']}"><i class="fas fa-box-archive"></i></button>
                        </div>
                    </div>
                    <div class="task-meta">
                        <div class="task-meta-item">
                            <span class="status-badge ${getStatusBadgeClass(task['Work Status'])}">${taskStatusDisplay}</span>
                        </div>
                        <div class="task-meta-item">
                             <span class="priority-badge ${getPriorityBadgeClass(task['Priority'])}"></span>
                        </div>
                        ${task['Deadline'] ? `<div class="task-meta-item"><i class="fas fa-calendar-alt"></i><span>${task['Deadline']}</span></div>` : ''}
                        ${attachmentButtonHtml ? `<div class="task-meta-item">${attachmentButtonHtml}</div>` : ''}
                        ${task.isPinned && task.pinnedBy ? `<div class="task-meta-item"><i class="fas fa-user-tag"></i><span>Disematkan oleh ${task.pinnedBy}</span></div>` : ''}
                    </div>
                </div>
            </div>
            <div class="task-details">
                <div class="task-details-content">
                    <p class="task-details-text"><strong>Proyek:</strong> ${task['Project Name'] || '-'}</p>
                    <p class="task-details-text"><strong>Platform:</strong> ${formatMultiSelectDisplay(task['Platform'])}</p>
                    <p class="task-details-text"><strong>Approval:</strong> <span class="status-badge ${getStatusBadgeClass(task['Approval Status'])}">${task['Approval Status'] || '-'}</span></p>
                    <p class="task-details-text"><strong>PIC:</strong> ${formatMultiSelectDisplay(task['PIC / Team'])}</p>
                    ${task['Notes'] ? `<p class="task-details-text"><strong>Catatan:</strong> ${task['Notes']}</p>` : ''}
                </div>
            </div>
        `;
        
        // Event listener untuk expand/collapse detail
        taskItem.querySelector('.task-header').addEventListener('click', (e) => {
            // Jangan expand/collapse jika mengklik tombol di dalam header
            if (e.target.closest('.task-actions') || e.target.closest('.task-btn')) {
                return;
            }
            taskItem.classList.toggle('expanded');
        });

        taskItem.querySelector('.edit-button').addEventListener('click', () => showTaskForm(task));
        taskItem.querySelector('.archive-button').addEventListener('click', (e) => {
            e.stopPropagation();
            archiveTask(task['Task ID']);
        });
        taskItem.querySelector('.pin-button').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinTask(task['Task ID']);
        });
        const viewButton = taskItem.querySelector('.view-attachment-button');
        if (viewButton) {
            viewButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const link = e.target.dataset.link || e.target.parentElement.dataset.link;
                if (link) {
                    imagePopupImage.src = link;
                    imagePopupModal.classList.add('active');
                }
            });
        }
        
        taskList.appendChild(taskItem);
    });
}

function showTaskForm(taskData = null) {
    taskForm.reset();
    finalTouchProgressGroup.style.display = 'none';
    otherPlatformGroup.style.display = 'none';
    otherPlatformInput.value = '';
    
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '#';
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';
    
    dashboardMainContent.style.display = 'none';
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

function hideTaskForm() {
    taskFormSection.style.display = 'none';
    dashboardMainContent.style.display = 'flex';
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '#';
}

async function archiveTask(taskId) {
    const isConfirmed = await showCustomConfirm('Apakah Anda yakin ingin mengarsipkan tugas ini?');
    if (!isConfirmed) return;

    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

async function restoreTask(taskId) {
    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

async function openArchiveListModal() {
    settingsPanel.classList.remove('active'); // Close settings panel
    showLoading();
    try {
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

function closeArchiveListModal() {
    archiveListModal.classList.remove('active');
}

async function generateDailyReportPdf() {
    settingsPanel.classList.remove('active'); // Close settings panel
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


function openSetPinDashboardModal() {
    dashboardNewPinInput.value = '';
    dashboardPinErrorMessage.textContent = '';
    setPinDashboardModal.classList.add('active');
}

function closeSetPinDashboardModal() {
    setPinDashboardModal.classList.remove('active');
}

function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

async function updateUserData(username, pin, firstLoginDone = null) {
    showLoading();
    try {
        const response = await fetch(PIN_MANAGER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

function togglePinTask(taskId) {
    console.log(`Attempting to toggle pin for task ID: ${taskId}`);
    const taskIndex = allTasks.findIndex(t => t['Task ID'] === taskId);
    if (taskIndex > -1) {
        const currentTask = allTasks[taskIndex];
        const isPinned = !currentTask.isPinned;
        currentTask.isPinned = isPinned;
        currentTask.pinnedBy = isPinned ? currentLoggedInUser : null;
        
        // Logika backend untuk update pin task
        console.log(`Task ${taskId} is now ${isPinned ? 'pinned' : 'unpinned'} by ${currentTask.pinnedBy}.`);
        console.warn('Backend update is required for this feature to be persistent across sessions.');

        // Update local data and re-render
        renderTasks();
    }
}


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    currentLoggedInUser = await checkLoginStatus();
    if (currentLoggedInUser) {
        fetchTasks();
    }
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '../index.html';
});

setPinDashboardText.addEventListener('click', openSetPinDashboardModal);
archiveTasksText.addEventListener('click', openArchiveListModal);

closePinDashboardModalButton.addEventListener('click', closeSetPinDashboardModal);
cancelDashboardPinButton.addEventListener('click', closeSetPinDashboardModal);
setPinDashboardModal.addEventListener('click', (e) => {
    if (e.target === setPinDashboardModal) {
        closeSetPinDashboardModal();
    }
});

closeArchiveListModalButton.addEventListener('click', closeArchiveListModal);
archiveListModal.addEventListener('click', (e) => {
    if (e.target === archiveListModal) {
        closeArchiveListModal();
    }
});

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

closeImagePopupModalButton.addEventListener('click', closeCustomModals);
imagePopupModal.addEventListener('click', (e) => {
    if (e.target === imagePopupModal) {
        closeCustomModals();
    }
});

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

// NEW: Event listeners untuk tema
themeLightButton.addEventListener('click', () => setTheme('light-mode'));
themeDarkButton.addEventListener('click', () => setTheme('dark-mode'));

// NEW: Event listeners untuk filter dan sort
filterAllButton.addEventListener('click', () => {
    currentFilter = 'all';
    searchInput.value = ''; // Reset search input
    currentSearch = ''; // Reset search term
    document.querySelectorAll('.filter-controls button').forEach(btn => btn.classList.remove('active'));
    filterAllButton.classList.add('active');
    renderTasks();
});

filterMyButton.addEventListener('click', () => {
    currentFilter = 'my';
    searchInput.value = ''; // Reset search input
    currentSearch = ''; // Reset search term
    document.querySelectorAll('.filter-controls button').forEach(btn => btn.classList.remove('active'));
    filterMyButton.classList.add('active');
    renderTasks();
});


sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTasks();
});

// NEW: Event listeners untuk search
searchButton.addEventListener('click', () => {
    searchBar.style.display = searchBar.style.display === 'block' ? 'none' : 'block';
    searchInput.focus();
});
searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderTasks();
});

// NEW: Event listeners untuk settings panel
hamburgerMenu.addEventListener('click', () => {
    settingsPanel.classList.add('active');
});
closeSettingsButton.addEventListener('click', () => {
    settingsPanel.classList.remove('active');
});
settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) {
        settingsPanel.classList.remove('active');
    }
});


addTaskButton.addEventListener('click', () => showTaskForm());
cancelTaskButton.addEventListener('click', hideTaskForm);
generateReportButton.addEventListener('click', generateDailyReportPdf);
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

finalTouchProgressInput.addEventListener('input', () => {
    finalTouchProgressValueSpan.textContent = finalTouchProgressInput.value;
});

platformSelect.addEventListener('change', () => {
    const selectedOptions = Array.from(platformSelect.options).filter(option => option.selected).map(option => option.value);
    if (selectedOptions.includes('Other')) {
        otherPlatformGroup.style.display = 'block';
    } else {
        otherPlatformGroup.style.display = 'none';
        otherPlatformInput.value = '';
    }
});

attachmentTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'upload') {
            attachmentUploadGroup.style.display = 'block';
            attachmentUrlGroup.style.display = 'none';
        } else {
            attachmentUploadGroup.style.display = 'none';
            attachmentUrlGroup.style.display = 'block';
        }
        attachmentFileInput.value = '';
        attachmentLinkInput.value = '';
        imagePreviewContainer.style.display = 'none';
        imagePreview.src = '#';
    });
});

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

removeImageButton.addEventListener('click', () => {
    attachmentFileInput.value = '';
    attachmentLinkInput.value = '';
    imagePreview.src = '#';
    imagePreviewContainer.style.display = 'none';
    document.querySelector('input[name="attachment-type"][value="upload"]').checked = true;
    attachmentUploadGroup.style.display = 'block';
    attachmentUrlGroup.style.display = 'none';
});


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
            hideLoading();
            return;
        }
        
        const response = await fetch(DATA_HANDLER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
