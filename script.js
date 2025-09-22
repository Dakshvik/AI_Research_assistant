document.addEventListener('DOMContentLoaded', function() {
    // --- Element Selectors ---
    const elements = {
        researchQuestion: document.getElementById('researchQuestion'),
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('fileInput'),
        generateBtn: document.getElementById('generateBtn'),
        reportTitle: document.getElementById('reportTitle'),
        reportContent: document.getElementById('reportContent'),
        questionsCount: document.getElementById('questionsCount'),
        reportsCount: document.getElementById('reportsCount'),
        dataCount: document.getElementById('dataCount'),
        historyList: document.getElementById('historyList'),
        emptyHistoryMessage: document.getElementById('emptyHistoryMessage'),
        reportCard: document.getElementById('reportCard'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn')
    };

    // --- State Management ---
    let files = [];
    let isLoading = false;
    let state = {
        reportHistory: [],
        questionsAsked: 0,
        reportsGenerated: 0
    };

    // --- INITIALIZATION ---
    function init() {
        for (const key in elements) {
            if (!elements[key]) {
                console.error(`Initialization Error: HTML element with ID '${key}' not found.`);
                return;
            }
        }
        setupEventListeners();
        loadStateFromStorage();
    }

    // --- LOCAL STORAGE & STATE ---
    function loadStateFromStorage() {
        state.reportHistory = JSON.parse(localStorage.getItem('smartResearchHistory')) || [];
        state.questionsAsked = parseInt(localStorage.getItem('questionsAskedCount')) || 0;
        state.reportsGenerated = parseInt(localStorage.getItem('reportsGeneratedCount')) || 0;
        updateDashboardUI();
        renderHistory();
        const latestReport = state.reportHistory[0];
        if (latestReport) {
            displayReport(latestReport.html, latestReport.question);
        }
    }

    function saveStateToStorage() {
        localStorage.setItem('smartResearchHistory', JSON.stringify(state.reportHistory));
        localStorage.setItem('questionsAskedCount', state.questionsAsked);
        localStorage.setItem('reportsGeneratedCount', state.reportsGenerated);
    }

    function clearAllState() {
        if (confirm("Are you sure you want to clear all report history and reset usage counts? This cannot be undone.")) {
            localStorage.clear();
            state = { reportHistory: [], questionsAsked: 0, reportsGenerated: 0 };
            updateDashboardUI();
            renderHistory();
            elements.reportTitle.textContent = 'Generated Report';
            elements.reportContent.innerHTML = `<i class="fas fa-file-alt text-5xl mb-4"></i><p>Your report will appear here.</p>`;
            elements.reportContent.className = 'min-h-64 flex flex-col items-center justify-center text-slate-400';
        }
    }
    
    // --- UI RENDERING ---
    function renderHistory() {
        elements.historyList.innerHTML = '';
        elements.emptyHistoryMessage.style.display = state.reportHistory.length === 0 ? 'block' : 'none';
        state.reportHistory.forEach((report, index) => {
            const li = document.createElement('li');
            li.className = 'text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-md cursor-pointer truncate transition-colors';
            li.textContent = report.question;
            li.title = report.question;
            li.dataset.index = index;
            li.addEventListener('click', () => {
                const selectedReport = state.reportHistory[index];
                if (selectedReport) {
                    displayReport(selectedReport.html, selectedReport.question);
                    elements.reportTitle.scrollIntoView({ behavior: 'smooth' });
                }
            });
            elements.historyList.appendChild(li);
        });
    }

    function updateDashboardUI() {
        elements.questionsCount.textContent = state.questionsAsked;
        elements.reportsCount.textContent = state.reportsGenerated;
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        elements.generateBtn.addEventListener('click', handleGenerate);
        elements.clearHistoryBtn.addEventListener('click', clearAllState);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            const bodyEl = document.body;
            const dropEl = elements.dropzone;
            [bodyEl, dropEl].forEach(el => el.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false));
        });
        ['dragenter', 'dragover'].forEach(eventName => elements.dropzone.addEventListener(eventName, () => elements.dropzone.classList.add('drag-over'), false));
        ['dragleave', 'drop'].forEach(eventName => elements.dropzone.addEventListener(eventName, () => elements.dropzone.classList.remove('drag-over'), false));
        elements.dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files), false);
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => handleFiles(e.target.files), false);
    }

    function handleFiles(fileList) {
        files = Array.from(fileList);
        const fileNames = files.map(f => f.name).join(', ');
        const dropzoneText = elements.dropzone.querySelector('p');
        dropzoneText.innerHTML = files.length > 0 ? fileNames : `Drag & drop or <span class="font-semibold text-blue-600">browse</span>`;
    }

    // --- CORE API LOGIC ---
    async function handleGenerate() {
        const question = elements.researchQuestion.value.trim();
        if (!question || isLoading) return;

        isLoading = true;
        updateUIState();
        state.questionsAsked++;
        saveStateToStorage();
        updateDashboardUI();

        try {
            // *** NEW: Call our own secure function ***
            const response = await fetch('/.netlify/functions/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'An unknown API error occurred.' }));
                throw new Error(errorData.error?.message || errorData.message);
            }

            const result = await response.json();
            const candidate = result.candidates && result.candidates[0];

            if (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
                const reportHtml = candidate.content.parts[0].text;
                const newReport = { question, html: reportHtml, timestamp: new Date().toISOString() };
                state.reportHistory.unshift(newReport);
                if (state.reportHistory.length > 10) state.reportHistory.pop();
                
                state.reportsGenerated++;
                saveStateToStorage();
                
                displayReport(reportHtml, question);
                renderHistory();
                updateDashboardUI();
            } else {
                if (candidate && candidate.finishReason === 'SAFETY') throw new Error('Response blocked for safety reasons.');
                throw new Error('Invalid response structure from the API.');
            }

        } catch (error) {
            console.error('Error generating report:', error);
            showError(`Failed to generate report: ${error.message}`);
            state.questionsAsked--; // Roll back the question count on failure
            saveStateToStorage();
            updateDashboardUI();
        } finally {
            isLoading = false;
            updateUIState();
        }
    }

    // --- UI DISPLAY & HELPERS ---
    function displayReport(htmlContent, question) {
        elements.reportTitle.textContent = `Report: "${question}"`;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        tempDiv.querySelectorAll('a').forEach(link => {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });
        elements.reportContent.innerHTML = tempDiv.innerHTML;
        elements.reportContent.className = 'prose max-w-none';
    }

    function showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message bg-red-100 border-l-4 border-red-400 text-red-700 p-4 mb-6 rounded-lg';
        errorElement.textContent = message;
        elements.reportCard.insertBefore(errorElement, elements.reportCard.firstChild);
    }
    
    function updateUIState() {
        elements.generateBtn.disabled = isLoading;
        elements.researchQuestion.disabled = isLoading;
        elements.fileInput.disabled = isLoading;
        elements.generateBtn.innerHTML = isLoading ? `<i class="fas fa-spinner animate-spin mr-2"></i><span>Generating...</span>` : `<i class="fas fa-file-alt mr-2"></i><span>Generate Smart Report</span>`;
        if (isLoading) {
            elements.reportContent.innerHTML = `<div class="w-full space-y-4"><div class="skeleton h-6 w-3/4"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-5/6"></div><div class="h-4"></div><div class="skeleton h-6 w-1/2"></div><div class="skeleton h-4 w-full"></div></div>`;
            elements.reportContent.className = 'min-h-64';
        }
    }
    
    // --- MOCK LIVE DATA ---
    setInterval(() => {
        const currentCount = parseInt(elements.dataCount.textContent);
        if (currentCount < 1000) {
            const increment = Math.floor(Math.random() * 5) + 1;
            elements.dataCount.textContent = currentCount + increment;
        }
    }, 5000);

    // Start the application
    init();
});

