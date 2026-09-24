/**
 * IFS Quizmaster — Active Recall AI Employee
 * Methodology: Recall Ladder (Recognize -> Recall -> Explain -> Elaborate)
 */

class IFSQuizmasterApp {
  constructor() {
    this.kb = null;
    this.currentView = 'session';
    this.audioEnabled = false;
    this.synth = window.speechSynthesis || null;
    
    // User Settings & Profile
    this.settings = this.loadSettings();
    
    // Progress Data (localStorage)
    this.progress = this.loadProgress();
    
    // Review Queue (Spaced Repetition)
    this.reviewQueue = this.loadReviewQueue();
    
    // Current Session State
    this.session = {
      active: false,
      topic: null,
      mode: 'full', // 'full', 'quiz', 'cloze', 'flash', 'saq', 'mains'
      step: 'primer', // 'primer', 'mcq', 'cloze', 'flash', 'saq', 'mains', 'wrapup'
      mcqIndex: 0,
      clozeIndex: 0,
      flashIndex: 0,
      saqIndex: 0,
      mainsIndex: 0,
      mcqCorrectCount: 0,
      mcqTotalAttempted: 0,
      sessionReviewsAdded: 0,
      againCards: []
    };

    // Chat History
    this.chatHistory = this.loadChatHistory();

    this.init();
  }

  async init() {
    this.bindEvents();
    this.applyTheme(this.settings.theme || 'dark');
    this.updateLiveHeaderMetrics();

    // Check first-time intake
    if (!this.settings.intakeCompleted) {
      document.getElementById('intakeModal').classList.add('open');
    }

    // Load Knowledge Base
    try {
      const resp = await fetch('data/ifs_knowledge_base.json');
      this.kb = await resp.json();
      this.renderSyllabusMatrix();
      this.renderReviewQueueView();
      this.renderAnkiExportView();
      this.renderReportDashboard();
    } catch (err) {
      console.error('Failed to load IFS knowledge base:', err);
    }
  }

  // --- SETTINGS & LOCAL STORAGE MANAGEMENT ---
  loadSettings() {
    const defaultSettings = {
      examDate: '2026-11-20',
      monthsPreset: '5',
      prepLevel: 'intermediate',
      sessionPacing: '45',
      aiProvider: 'builtin',
      apiKey: '',
      personaRigor: 'strict',
      weakTopics: 'Weed management, Pteridophyte steles, Soil chemistry',
      theme: 'dark',
      intakeCompleted: false
    };
    try {
      const stored = localStorage.getItem('ifs_quizmaster_settings');
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  }

  saveSettingsToStorage() {
    localStorage.setItem('ifs_quizmaster_settings', JSON.stringify(this.settings));
  }

  loadProgress() {
    const defaultProgress = {
      topicsMastery: {}, // topicId -> { level: 1-4, isWeak: bool, mcqAccuracy: 0, lastPracticed: date }
      streakDays: 1,
      lastStreakDate: new Date().toISOString().split('T')[0],
      totalMcqAnswered: 0,
      totalMcqCorrect: 0,
      totalFlashcardsGraded: 0,
      mainsAnswersEvaluated: 0
    };
    try {
      const stored = localStorage.getItem('ifs_quizmaster_progress');
      return stored ? { ...defaultProgress, ...JSON.parse(stored) } : defaultProgress;
    } catch {
      return defaultProgress;
    }
  }

  saveProgressToStorage() {
    localStorage.setItem('ifs_quizmaster_progress', JSON.stringify(this.progress));
  }

  loadReviewQueue() {
    try {
      const stored = localStorage.getItem('ifs_quizmaster_review_queue');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveReviewQueueToStorage() {
    localStorage.setItem('ifs_quizmaster_review_queue', JSON.stringify(this.reviewQueue));
  }

  loadChatHistory() {
    try {
      const stored = localStorage.getItem('ifs_quizmaster_chat');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveChatHistoryToStorage() {
    localStorage.setItem('ifs_quizmaster_chat', JSON.stringify(this.chatHistory));
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Nav Items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
    });

    // Voice Toggle
    document.getElementById('btnSpeechToggle').addEventListener('click', () => {
      this.audioEnabled = !this.audioEnabled;
      document.getElementById('btnSpeechToggle').textContent = this.audioEnabled ? '🔊' : '🔇';
      document.getElementById('btnSpeechToggle').style.borderColor = this.audioEnabled ? 'var(--accent-emerald)' : 'var(--border-color)';
    });

    // Settings Modal
    document.getElementById('btnOpenSettings').addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btnCloseSettings').addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('settingAIProvider').addEventListener('change', (e) => {
      document.getElementById('apiKeyGroup').style.display = e.target.value === 'builtin' ? 'none' : 'block';
    });

    // Reset Progress Data
    document.getElementById('btnResetAllData').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all your study history, review queue, and accuracy metrics?')) {
        // Remove only this app's keys so the MCQ drill (mcq/, key "ifosmcq_v1") keeps its progress.
        Object.keys(localStorage).filter(k => k.startsWith('ifs_quizmaster_')).forEach(k => localStorage.removeItem(k));
        location.reload();
      }
    });

    // Custom Topic Modal
    document.getElementById('btnAddNewCustomTopic').addEventListener('click', () => {
      document.getElementById('customTopicModal').classList.add('open');
    });
    document.getElementById('btnCloseCustomTopic').addEventListener('click', () => {
      document.getElementById('customTopicModal').classList.remove('open');
    });
    document.getElementById('btnCancelCustomTopic').addEventListener('click', () => {
      document.getElementById('customTopicModal').classList.remove('open');
    });

    // Quick Command Pills
    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const cmd = pill.getAttribute('data-cmd');
        document.getElementById('commandInput').value = cmd;
        this.handleCommandSubmit();
      });
    });

    // Session controls
    document.getElementById('btnStartMCQFromPrimer')?.addEventListener('click', () => this.startMCQRound());
    document.getElementById('btnNextMCQ')?.addEventListener('click', () => this.advanceMCQ());
    document.getElementById('btnCheckCloze')?.addEventListener('click', () => this.checkCloze());
    document.getElementById('btnClozeHint')?.addEventListener('click', () => this.showClozeHint());
    document.getElementById('btnRevealCloze')?.addEventListener('click', () => this.revealClozeAnswer());
    document.getElementById('btnNextCloze')?.addEventListener('click', () => this.advanceCloze());

    // Flashcard 3D flip
    document.getElementById('flashCardInner')?.addEventListener('click', () => this.flipFlashcard());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.session.active && this.session.step === 'flash' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.flipFlashcard();
      }
    });

    // SAQ & Mains Word Counters
    document.getElementById('saqInputText')?.addEventListener('input', (e) => {
      const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
      document.getElementById('saqWordCount').textContent = words;
    });
    document.getElementById('btnEvaluateSAQ')?.addEventListener('click', () => this.evaluateSAQAnswer());
    document.getElementById('btnNextSAQ')?.addEventListener('click', () => this.advanceSAQ());

    document.getElementById('mainsInputText')?.addEventListener('input', (e) => {
      const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
      document.getElementById('mainsWordCount').textContent = words;
    });
    document.getElementById('btnEvaluateMains')?.addEventListener('click', () => this.evaluateMainsAnswer());
    document.getElementById('btnFinishSession')?.addEventListener('click', () => this.finishSession());

    // Review banner
    document.getElementById('btnStartDueReview')?.addEventListener('click', () => this.startDueReviewSession());
    document.getElementById('btnInterleavedReview')?.addEventListener('click', () => this.startInterleavedReview());
    document.getElementById('btnLaunchFullReviewDeck')?.addEventListener('click', () => this.startDueReviewSession());

    // Wrapup actions
    document.getElementById('btnRestartTopic')?.addEventListener('click', () => {
      if (this.session.topic) this.startTopicSession(this.session.topic.id);
    });
    document.getElementById('btnNextTopicFromMatrix')?.addEventListener('click', () => this.switchView('matrix'));

    // Anki export actions
    document.getElementById('btnCopyAnkiText')?.addEventListener('click', () => this.copyAnkiText());
    document.getElementById('btnDownloadAnkiFile')?.addEventListener('click', () => this.downloadAnkiFile());
    document.querySelectorAll('input[name="ankiFormatOption"]').forEach(r => {
      r.addEventListener('change', () => this.renderAnkiExportView());
    });

    // Paper filter in Matrix
    document.getElementById('matrixPaperFilter')?.addEventListener('change', (e) => {
      this.filterMatrixByPaper(e.target.value);
    });

    // Cross-Optional Link Explore button
    document.getElementById('btnQuickLink')?.addEventListener('click', () => {
      document.getElementById('commandInput').value = 'Link: Nitrogen metabolism + INM';
      this.handleCommandSubmit();
    });

    // Progress JSON Export
    document.getElementById('btnExportProgressJSON')?.addEventListener('click', () => this.exportProgressJSON());
  }

  // --- THEME & LIVE METRICS ---
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.settings.theme = theme;
    this.saveSettingsToStorage();
    document.getElementById('btnThemeToggle').textContent = theme === 'dark' ? '🌓' : '☀️';
  }

  updateLiveHeaderMetrics() {
    // Days remaining
    const examDate = new Date(this.settings.examDate || '2026-11-20');
    const today = new Date();
    const diffDays = Math.max(0, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
    document.getElementById('countdownDays').textContent = diffDays;

    // Accuracy
    const acc = this.progress.totalMcqAnswered > 0
      ? Math.round((this.progress.totalMcqCorrect / this.progress.totalMcqAnswered) * 100)
      : 0;
    document.getElementById('accuracyValue').textContent = `${acc}%`;

    // Streak
    document.getElementById('streakCount').textContent = this.progress.streakDays;

    // Due Review Count
    const now = new Date();
    const dueItems = this.reviewQueue.filter(item => new Date(item.nextReviewDate) <= now);
    document.getElementById('dueCount').textContent = dueItems.length;
    document.getElementById('badgeReviewCount').textContent = dueItems.length;

    // Due banner
    const banner = document.getElementById('reviewDueBanner');
    if (dueItems.length > 0) {
      banner.style.display = 'flex';
      document.getElementById('bannerDueCount').textContent = dueItems.length;
    } else {
      banner.style.display = 'none';
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (activeNav) activeNav.classList.add('active');

    const panel = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (panel) panel.classList.add('active');

    if (viewName === 'matrix') this.renderSyllabusMatrix();
    if (viewName === 'reviews') this.renderReviewQueueView();
    if (viewName === 'anki') this.renderAnkiExportView();
    if (viewName === 'report') this.renderReportDashboard();
  }

  // --- TTS SPEECH ENGINE ---
  speak(text) {
    if (!this.audioEnabled || !this.synth) return;
    this.synth.cancel();
    const clean = text.replace(/[*_#`]/g, '');
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    this.synth.speak(utter);
  }

  // --- COMMAND PARSER ---
  handleCommandSubmit() {
    const input = document.getElementById('commandInput');
    const rawCmd = input.value.trim();
    if (!rawCmd) return;
    input.value = '';

    this.executeCommand(rawCmd);
  }

  executeCommand(cmd) {
    const lower = cmd.toLowerCase();

    // 1. Session: [topic]
    if (lower.startsWith('session:')) {
      const topicQuery = cmd.substring(8).trim();
      this.launchSessionByQuery(topicQuery, 'full');
      return;
    }

    // 2. Quiz: [topic], [n]
    if (lower.startsWith('quiz:')) {
      const parts = cmd.substring(5).trim().split(',');
      const topicQuery = parts[0].trim();
      this.launchSessionByQuery(topicQuery, 'quiz');
      return;
    }

    // 3. Cloze: [topic]
    if (lower.startsWith('cloze:')) {
      const topicQuery = cmd.substring(6).trim();
      this.launchSessionByQuery(topicQuery, 'cloze');
      return;
    }

    // 4. Flash: [topic]
    if (lower.startsWith('flash:')) {
      const topicQuery = cmd.substring(6).trim();
      this.launchSessionByQuery(topicQuery, 'flash');
      return;
    }

    // 5. SAQ: [topic]
    if (lower.startsWith('saq:')) {
      const topicQuery = cmd.substring(4).trim();
      this.launchSessionByQuery(topicQuery, 'saq');
      return;
    }

    // 6. Mains: [topic]
    if (lower.startsWith('mains:')) {
      const topicQuery = cmd.substring(6).trim();
      this.launchSessionByQuery(topicQuery, 'mains');
      return;
    }

    // 7. Review
    if (lower === 'review') {
      this.startDueReviewSession();
      return;
    }

    // 8. Report
    if (lower === 'report') {
      this.switchView('report');
      return;
    }

    // 9. Anki export: [topic]
    if (lower.startsWith('anki export:')) {
      this.switchView('anki');
      return;
    }

    // 10. Link: [Botany] + [Agri]
    if (lower.startsWith('link:')) {
      this.displayCrossOptionalLink(cmd.substring(5).trim());
      return;
    }

    // 11. Mnemonic: [topic]
    if (lower.startsWith('mnemonic:')) {
      this.displayMnemonics(cmd.substring(9).trim());
      return;
    }

    // 12. Plan
    if (lower === 'plan') {
      this.generateStudyPlan();
      return;
    }

    // 13. Fallback: treat as conversational prompt
    this.switchView('chat');
    this.addChatMessage('user', cmd);
    this.generateChatResponse(cmd);
  }

  // --- TOPIC LOOKUP & SESSION LAUNCH ---
  findTopicByQuery(query) {
    if (!this.kb) return null;
    const cleanQuery = query.toLowerCase().replace(/[^\w\s]/gi, '').trim();

    for (const mod of this.kb.modules) {
      for (const topic of mod.topics) {
        const cleanName = topic.name.toLowerCase().replace(/[^\w\s]/gi, '');
        if (cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName) || topic.id.toLowerCase() === cleanQuery) {
          return { ...topic, subject: mod.subject, paper: mod.paper };
        }
      }
    }
    const firstMod = this.kb.modules[0];
    return { ...firstMod.topics[0], subject: firstMod.subject, paper: firstMod.paper };
  }

  launchSessionByQuery(topicQuery, mode) {
    const topic = this.findTopicByQuery(topicQuery);
    if (!topic) {
      alert(`Topic '${topicQuery}' not found in syllabus knowledge base. Showing all available topics in Matrix.`);
      this.switchView('matrix');
      return;
    }
    this.startTopicSession(topic.id, mode);
  }

  startTopicSession(topicId, mode = 'full') {
    this.switchView('session');
    
    let topicData = null;
    for (const mod of this.kb.modules) {
      const found = mod.topics.find(t => t.id === topicId);
      if (found) {
        topicData = { ...found, subject: mod.subject, paper: mod.paper };
        break;
      }
    }
    if (!topicData) return;

    this.session = {
      active: true,
      topic: topicData,
      mode: mode,
      step: mode === 'full' ? 'primer' : mode,
      mcqIndex: 0,
      clozeIndex: 0,
      flashIndex: 0,
      saqIndex: 0,
      mainsIndex: 0,
      mcqCorrectCount: 0,
      mcqTotalAttempted: 0,
      sessionReviewsAdded: 0,
      againCards: []
    };

    // Update UI headers
    document.getElementById('currentTopicTitle').innerHTML = `🌿 ${topicData.name}`;
    document.getElementById('currentTopicSubtitle').textContent = `${topicData.subject} ${topicData.paper} | PYQ Weightage: ${topicData.pyq_weightage} (${topicData.pyq_years ? topicData.pyq_years.join(', ') : 'Frequent'})`;
    document.getElementById('badgeSessionState').textContent = `In Progress (${mode.toUpperCase()})`;
    document.getElementById('sessionEmptyState').style.display = 'none';

    this.updateLadderStepUI(this.session.step);

    if (mode === 'full') {
      this.renderPrimerStep();
    } else if (mode === 'quiz') {
      this.startMCQRound();
    } else if (mode === 'cloze') {
      this.startClozeRound();
    } else if (mode === 'flash') {
      this.startFlashRound();
    } else if (mode === 'saq') {
      this.startSAQRound();
    } else if (mode === 'mains') {
      this.startMainsRound();
    }
  }

  updateLadderStepUI(step) {
    document.querySelectorAll('.ladder-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-indicator').forEach((ind, i) => {
      ind.className = `step-indicator step-${i + 1}`;
    });

    const badge = document.getElementById('currentStageBadge');
    if (step === 'primer') {
      badge.textContent = '📋 Primer Notes';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
    } else if (step === 'mcq') {
      badge.textContent = 'Level 1: Recognize (MCQ)';
      badge.style.background = 'rgba(59, 130, 246, 0.2)';
      badge.style.color = '#60a5fa';
      document.getElementById('ladderStep1').classList.add('active');
      document.querySelector('#ladderStep1 .step-indicator').className = 'step-indicator step-active-1';
    } else if (step === 'cloze' || step === 'flash') {
      badge.textContent = 'Level 2: Recall (Active Retrieval)';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#34d399';
      document.getElementById('ladderStep2').classList.add('active');
      document.querySelector('#ladderStep2 .step-indicator').className = 'step-indicator step-active-2';
    } else if (step === 'saq') {
      badge.textContent = 'Level 3: Explain (Short Answer)';
      badge.style.background = 'rgba(245, 158, 11, 0.2)';
      badge.style.color = '#fbbf24';
      document.getElementById('ladderStep3').classList.add('active');
      document.querySelector('#ladderStep3 .step-indicator').className = 'step-indicator step-active-3';
    } else if (step === 'mains') {
      badge.textContent = 'Level 4: Elaborate (Mains 15M)';
      badge.style.background = 'rgba(139, 92, 246, 0.2)';
      badge.style.color = '#c4b5fd';
      document.getElementById('ladderStep4').classList.add('active');
      document.querySelector('#ladderStep4 .step-indicator').className = 'step-indicator step-active-4';
    }
  }

  hideAllSessionSections() {
    ['primerSection', 'mcqSection', 'clozeSection', 'flashSection', 'saqSection', 'mainsSection', 'wrapupSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // --- STEP 1: PRIMER ---
  renderPrimerStep() {
    this.hideAllSessionSections();
    const section = document.getElementById('primerSection');
    section.style.display = 'block';

    const list = document.getElementById('primerContentList');
    list.innerHTML = '';

    const bullets = this.session.topic.primer || [
      "Key scientific concepts, classification, and definitions.",
      "Botanical names and physiological mechanisms."
    ];

    bullets.forEach(b => {
      const li = document.createElement('li');
      li.innerHTML = b.replace(/\*(.*?)\*/g, '<em>$1</em>');
      list.appendChild(li);
    });

    this.speak("Here is your 5-minute primer. Read the core classifications and when ready, launch the MCQ recognition round.");
  }

  // --- STEP 2: LEVEL 1 RECOGNIZE (MCQs) ---
  startMCQRound() {
    this.session.step = 'mcq';
    this.session.mcqIndex = 0;
    this.updateLadderStepUI('mcq');
    this.renderCurrentMCQ();
  }

  renderCurrentMCQ() {
    this.hideAllSessionSections();
    const section = document.getElementById('mcqSection');
    section.style.display = 'flex';

    const mcqs = this.session.topic.mcqs || [];
    if (this.session.mcqIndex >= mcqs.length) {
      this.evaluateMCQRoundOutcome();
      return;
    }

    const current = mcqs[this.session.mcqIndex];
    document.getElementById('mcqCounter').textContent = `MCQ ${this.session.mcqIndex + 1} of ${mcqs.length}`;
    
    const badge = document.getElementById('mcqDiffBadge');
    badge.textContent = `[${current.difficulty || 'MEDIUM'}]`;
    badge.className = `difficulty-badge diff-${(current.difficulty || 'medium').toLowerCase()}`;

    document.getElementById('mcqQuestionText').innerHTML = current.question.replace(/\*(.*?)\*/g, '<em>$1</em>');

    const optionsGrid = document.getElementById('mcqOptionsGrid');
    optionsGrid.innerHTML = '';

    const explBox = document.getElementById('mcqExplanationBox');
    explBox.className = 'mcq-explanation-card';
    explBox.style.display = 'none';

    current.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = opt.replace(/\*(.*?)\*/g, '<em>$1</em>');
      btn.addEventListener('click', () => this.handleMCQOptionClick(opt, current, btn));
      optionsGrid.appendChild(btn);
    });

    this.speak(current.question);
  }

  handleMCQOptionClick(selectedOpt, qData, clickedBtn) {
    const isCorrect = selectedOpt.startsWith(qData.answer) || selectedOpt.trim().startsWith(qData.answer);
    
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.classList.add('disabled');
      if (btn.innerHTML.includes(qData.answer)) {
        btn.classList.add('correct');
      }
    });

    this.session.mcqTotalAttempted++;
    this.progress.totalMcqAnswered++;

    const explBox = document.getElementById('mcqExplanationBox');
    const resHeader = document.getElementById('mcqResultHeader');

    if (isCorrect) {
      clickedBtn.classList.add('correct');
      this.session.mcqCorrectCount++;
      this.progress.totalMcqCorrect++;
      resHeader.innerHTML = '✅ <span style="color:#34d399;">Correct! Clean Retrieval.</span>';
      explBox.classList.remove('fail');
      this.speak("Correct! Clean retrieval.");
    } else {
      clickedBtn.classList.add('incorrect');
      resHeader.innerHTML = `❌ <span style="color:#f87171;">Incorrect. Correct answer is <strong>${qData.answer}</strong></span>`;
      explBox.classList.add('fail');
      
      this.addToReviewQueue({
        id: qData.id,
        topicId: this.session.topic.id,
        topicName: this.session.topic.name,
        type: 'MCQ',
        question: qData.question,
        answer: qData.answer + ' ' + (qData.options.find(o => o.startsWith(qData.answer)) || ''),
        rationale: qData.rationale,
        memory_hook: qData.memory_hook
      });
      this.session.sessionReviewsAdded++;
      this.speak("Incorrect. Review the distractor breakdown and memory hook.");
    }

    document.getElementById('mcqRationaleText').innerHTML = `<strong>Why this is right:</strong> ${qData.rationale.replace(/\*(.*?)\*/g, '<em>$1</em>')}`;
    document.getElementById('mcqDistractorText').innerHTML = `<strong>Distractor Breakdown:</strong> ${qData.distractor_breakdown || 'Distractors built from adjacent processes.'}`;
    document.getElementById('mcqMemoryHookText').textContent = qData.memory_hook || 'Associate key terms with functional mechanism.';

    explBox.style.display = 'block';
    this.saveProgressToStorage();
    this.updateLiveHeaderMetrics();
  }

  advanceMCQ() {
    this.session.mcqIndex++;
    this.renderCurrentMCQ();
  }

  evaluateMCQRoundOutcome() {
    const acc = this.session.mcqTotalAttempted > 0
      ? Math.round((this.session.mcqCorrectCount / this.session.mcqTotalAttempted) * 100)
      : 100;

    if (acc < 70) {
      alert(`⚠️ Active Recall Alert: Your MCQ Recognition accuracy was ${acc}% (< 70% Mastery Threshold).\n\nTopic flagged as WEAK. According to IFS methodology, we will practice Cloze Deletions and Spaced Flashcards next to strengthen foundational facts before attempting full Mains writing!`);
      this.flagTopicAsWeak(this.session.topic.id);
    }

    if (this.session.mode === 'quiz') {
      this.finishSession();
    } else {
      this.startClozeRound();
    }
  }

  // --- STEP 3: LEVEL 2 RECALL (CLOZE DELETIONS) ---
  startClozeRound() {
    this.session.step = 'cloze';
    this.session.clozeIndex = 0;
    this.updateLadderStepUI('cloze');
    this.renderCurrentCloze();
  }

  renderCurrentCloze() {
    this.hideAllSessionSections();
    const section = document.getElementById('clozeSection');
    section.style.display = 'block';

    const clozes = this.session.topic.cloze || [];
    if (this.session.clozeIndex >= clozes.length) {
      if (this.session.mode === 'cloze') {
        this.finishSession();
      } else {
        this.startFlashRound();
      }
      return;
    }

    const current = clozes[this.session.clozeIndex];
    document.getElementById('clozeCounter').textContent = `Cloze Card ${this.session.clozeIndex + 1} of ${clozes.length}`;

    const parts = current.text.split('______');
    const container = document.getElementById('clozeSentenceText');
    container.innerHTML = `
      ${parts[0].replace(/\*(.*?)\*/g, '<em>$1</em>')}
      <input type="text" id="clozeInlineInput" class="cloze-input-inline" placeholder="???" autocomplete="off">
      ${parts[1] ? parts[1].replace(/\*(.*?)\*/g, '<em>$1</em>') : ''}
    `;

    document.getElementById('clozeRevealBox').style.display = 'none';
    document.getElementById('clozeInlineInput').focus();
    document.getElementById('clozeAnkiSyntax').textContent = current.anki_format || current.text;

    this.speak(parts[0] + " blank " + (parts[1] || ''));
  }

  checkCloze() {
    const clozes = this.session.topic.cloze || [];
    const current = clozes[this.session.clozeIndex];
    const input = document.getElementById('clozeInlineInput');
    const userVal = input.value.trim().toLowerCase();
    const targetVal = current.answer.toLowerCase();

    const revealBox = document.getElementById('clozeRevealBox');
    const statusText = document.getElementById('clozeStatusText');
    const details = document.getElementById('clozeAnswerDetails');

    if (userVal === targetVal || (targetVal.includes(userVal) && userVal.length >= 4)) {
      statusText.innerHTML = '✅ Exact Term Recalled!';
      statusText.style.color = '#34d399';
      input.style.borderColor = '#10b981';
      input.style.color = '#34d399';
      details.innerHTML = `Answer: <strong>${current.answer}</strong>`;
      this.speak("Exact term recalled! Excellent.");
    } else {
      statusText.innerHTML = `❌ Missing Fact. Expected: <strong>${current.answer}</strong>`;
      statusText.style.color = '#f87171';
      input.style.borderColor = '#ef4444';
      input.style.color = '#f87171';
      details.innerHTML = `Keep this exact term in active memory.`;
      
      this.addToReviewQueue({
        id: current.id,
        topicId: this.session.topic.id,
        topicName: this.session.topic.name,
        type: 'Cloze',
        question: current.text,
        answer: current.answer,
        hint: current.hint
      });
      this.session.sessionReviewsAdded++;
    }

    revealBox.style.display = 'block';
  }

  showClozeHint() {
    const clozes = this.session.topic.cloze || [];
    const current = clozes[this.session.clozeIndex];
    alert(`💡 CLOZE HINT: ${current.hint || 'Check botanical classifications and Latin binomial roots.'}`);
  }

  revealClozeAnswer() {
    const clozes = this.session.topic.cloze || [];
    const current = clozes[this.session.clozeIndex];
    const input = document.getElementById('clozeInlineInput');
    input.value = current.answer;
    this.checkCloze();
  }

  advanceCloze() {
    this.session.clozeIndex++;
    this.renderCurrentCloze();
  }

  // --- STEP 4: LEVEL 2 RECALL (3D FLASHCARDS) ---
  startFlashRound() {
    this.session.step = 'flash';
    this.session.flashIndex = 0;
    this.updateLadderStepUI('flash');
    this.renderCurrentFlashcard();
  }

  renderCurrentFlashcard() {
    this.hideAllSessionSections();
    const section = document.getElementById('flashSection');
    section.style.display = 'block';

    const cards = this.session.topic.flashcards || [];
    if (this.session.flashIndex >= cards.length) {
      if (this.session.againCards.length > 0) {
        alert(`🔁 Resurfacing ${this.session.againCards.length} cards rated 'AGAIN' in this session to enforce immediate consolidation!`);
        this.session.topic.flashcards.push(...this.session.againCards);
        this.session.againCards = [];
      } else {
        if (this.session.mode === 'flash') {
          this.finishSession();
        } else {
          this.startSAQRound();
        }
        return;
      }
    }

    const current = cards[this.session.flashIndex];
    document.getElementById('flashCounter').textContent = `Flashcard ${this.session.flashIndex + 1} of ${cards.length}`;

    const inner = document.getElementById('flashCardInner');
    inner.classList.remove('is-flipped');
    document.getElementById('flashRatingRow').style.display = 'none';

    document.getElementById('flashFrontText').innerHTML = current.front.replace(/\*(.*?)\*/g, '<em>$1</em>');
    document.getElementById('flashBackText').innerHTML = `
      ${current.back.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}
      <br><br>
      <span style="color:var(--accent-gold); font-size:0.85rem;">💡 <strong>Memory Hook:</strong> ${current.memory_hook || ''}</span>
    `;

    this.speak(current.front);
  }

  flipFlashcard() {
    const inner = document.getElementById('flashCardInner');
    inner.classList.toggle('is-flipped');
    if (inner.classList.contains('is-flipped')) {
      document.getElementById('flashRatingRow').style.display = 'grid';
      const cards = this.session.topic.flashcards || [];
      const current = cards[this.session.flashIndex];
      this.speak(current.back);
    }
  }

  rateFlashcard(rating) {
    this.progress.totalFlashcardsGraded++;
    const cards = this.session.topic.flashcards || [];
    const current = cards[this.session.flashIndex];

    if (rating === 'again') {
      this.session.againCards.push(current);
      this.addToReviewQueue({
        id: current.id,
        topicId: this.session.topic.id,
        topicName: this.session.topic.name,
        type: 'Flashcard',
        front: current.front,
        back: current.back,
        intervalDays: 0
      });
      this.session.sessionReviewsAdded++;
    } else {
      const intervals = { hard: 1, good: 3, easy: 7 };
      this.addToReviewQueue({
        id: current.id,
        topicId: this.session.topic.id,
        topicName: this.session.topic.name,
        type: 'Flashcard',
        front: current.front,
        back: current.back,
        intervalDays: intervals[rating]
      });
    }

    this.saveProgressToStorage();
    this.updateLiveHeaderMetrics();
    this.session.flashIndex++;
    this.renderCurrentFlashcard();
  }

  // --- STEP 5: LEVEL 3 EXPLAIN (SAQ ROUND) ---
  startSAQRound() {
    this.session.step = 'saq';
    this.session.saqIndex = 0;
    this.updateLadderStepUI('saq');
    this.renderCurrentSAQ();
  }

  renderCurrentSAQ() {
    this.hideAllSessionSections();
    const section = document.getElementById('saqSection');
    section.style.display = 'block';

    const saqs = this.session.topic.saqs || [];
    if (this.session.saqIndex >= saqs.length) {
      if (this.session.mode === 'saq') {
        this.finishSession();
      } else {
        this.startMainsRound();
      }
      return;
    }

    const current = saqs[this.session.saqIndex];
    document.getElementById('saqCounter').textContent = `Short Answer Question (${current.marks} Marks)`;
    document.getElementById('saqMarksBadge').textContent = `${current.marks} Marks (30-100 Words)`;
    document.getElementById('saqQuestionText').innerHTML = current.question.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    document.getElementById('saqInputText').value = '';
    document.getElementById('saqWordCount').textContent = '0';
    document.getElementById('saqEvaluationBox').style.display = 'none';

    this.speak(current.question);
  }

  evaluateSAQAnswer() {
    const saqs = this.session.topic.saqs || [];
    const current = saqs[this.session.saqIndex];
    const text = document.getElementById('saqInputText').value.trim();
    if (!text || text.split(/\s+/).length < 5) {
      alert("Please write at least 15-20 technical words to receive meaningful active recall feedback!");
      return;
    }

    const keywords = current.scoring_keywords || [];
    let hits = [];
    let misses = [];

    keywords.forEach(kw => {
      const reg = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (reg.test(text)) {
        hits.push(kw);
      } else {
        misses.push(kw);
      }
    });

    const scoreRatio = (hits.length / Math.max(1, keywords.length));
    const awarded = (scoreRatio * current.marks).toFixed(1);

    document.getElementById('saqScoreNumber').textContent = `${awarded} / ${current.marks}`;
    const statusEl = document.getElementById('saqScoreStatus');
    if (scoreRatio >= 0.75) {
      statusEl.textContent = 'HIGH SCORING ANSWER';
      statusEl.style.color = '#34d399';
    } else if (scoreRatio >= 0.5) {
      statusEl.textContent = 'ADEQUATE FACT RECALL';
      statusEl.style.color = '#fbbf24';
    } else {
      statusEl.textContent = 'KEYWORD DEFICIT';
      statusEl.style.color = '#f87171';
    }

    const cloud = document.getElementById('saqKeywordsCloud');
    cloud.innerHTML = '';
    hits.forEach(k => {
      const pill = document.createElement('span');
      pill.className = 'kw-pill kw-found';
      pill.innerHTML = `✓ ${k}`;
      cloud.appendChild(pill);
    });
    misses.forEach(k => {
      const pill = document.createElement('span');
      pill.className = 'kw-pill kw-missing';
      pill.innerHTML = `✗ ${k}`;
      cloud.appendChild(pill);
    });

    document.getElementById('saqGapFeedback').innerHTML = `
      <strong>Gap Analysis:</strong> ${current.gap_guidance || 'Incorporate all missed technical keywords shown in red above.'}
    `;

    document.getElementById('saqModelAnswerContent').innerHTML = current.model_answer.replace(/\*(.*?)\*/g, '<em>$1</em>');
    document.getElementById('saqEvaluationBox').style.display = 'block';
  }

  advanceSAQ() {
    this.session.saqIndex++;
    this.renderCurrentSAQ();
  }

  // --- STEP 6: LEVEL 4 ELABORATE (MAINS 15M PRACTICE) ---
  startMainsRound() {
    this.session.step = 'mains';
    this.session.mainsIndex = 0;
    this.updateLadderStepUI('mains');
    this.renderCurrentMains();
  }

  renderCurrentMains() {
    this.hideAllSessionSections();
    const section = document.getElementById('mainsSection');
    section.style.display = 'block';

    const mainsList = this.session.topic.mains || [];
    if (this.session.mainsIndex >= mainsList.length) {
      this.finishSession();
      return;
    }

    const current = mainsList[this.session.mainsIndex];
    document.getElementById('mainsQuestionText').innerHTML = current.question.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    const banner = document.getElementById('mainsDiagramBanner');
    if (current.diagram_required) {
      banner.style.display = 'flex';
      document.getElementById('mainsDiagramGuidanceText').innerHTML = current.diagram_guidance || 'Include labeled schematic diagram with anatomical callouts.';
    } else {
      banner.style.display = 'none';
    }

    document.getElementById('mainsInputText').value = '';
    document.getElementById('mainsWordCount').textContent = '0';
    document.getElementById('mainsEvaluationBox').style.display = 'none';

    this.speak("Mains descriptive practice. Remember: in IFS Mains, structured subheadings and labeled diagrams earn top marks.");
  }

  evaluateMainsAnswer() {
    const text = document.getElementById('mainsInputText').value.trim();
    if (text.length < 50) {
      alert("Please write a substantiated answer to run the 6-dimension Mains evaluator.");
      return;
    }

    const current = this.session.topic.mains[this.session.mainsIndex];
    const rubric = this.scoreMainsDescriptive(text, current);

    document.getElementById('mainsScoreNumber').textContent = `${rubric.totalScore} / ${current.marks || 15}`;
    document.getElementById('mainsScoreStatus').textContent = rubric.gradeText;

    const grid = document.getElementById('mainsRubricGrid');
    grid.innerHTML = `
      <div class="rubric-item">
        <div class="rubric-label">1. Length & Depth</div>
        <div class="rubric-val">${rubric.depthScore} / 3</div>
      </div>
      <div class="rubric-item">
        <div class="rubric-label">2. Binomials & Facts</div>
        <div class="rubric-val">${rubric.factsScore} / 4</div>
      </div>
      <div class="rubric-item">
        <div class="rubric-label">3. Balance & Nuance</div>
        <div class="rubric-val">${rubric.balanceScore} / 2</div>
      </div>
      <div class="rubric-item">
        <div class="rubric-label">4. Indian Agro Context</div>
        <div class="rubric-val">${rubric.indiaScore} / 2</div>
      </div>
      <div class="rubric-item">
        <div class="rubric-label">5. Structure & Headings</div>
        <div class="rubric-val">${rubric.structScore} / 2</div>
      </div>
      <div class="rubric-item">
        <div class="rubric-label">6. Flow & Diagram Ref</div>
        <div class="rubric-val">${rubric.flowScore} / 2</div>
      </div>
    `;

    document.getElementById('mainsModelAnswerContent').innerHTML = current.model_answer.replace(/\*(.*?)\*/g, '<em>$1</em>');
    document.getElementById('mainsEvaluationBox').style.display = 'block';

    this.progress.mainsAnswersEvaluated++;
    this.markTopicMastered(this.session.topic.id);
  }

  scoreMainsDescriptive(text) {
    let depth = text.length > 500 ? 3 : text.length > 250 ? 2 : 1;
    let facts = /[A-Z][a-z]+ [a-z]+|\b(pathogen|spore|cell|cycle|enzyme|carboxylase|rubisco|nitrogen|soil|acid|potassium|gypsum|fertilizer)\b/i.test(text) ? 4 : 2;
    let balance = /\b(however|whereas|conversely|on the other hand|while|comparison|advantage|limitation)\b/i.test(text) ? 2 : 1;
    let india = /\b(india|indian|tropical|kharif|rabi|punjab|haryana|gangetic|icar|scheme|farmer)\b/i.test(text) ? 2 : 1;
    let structure = (text.match(/(\n\s*\n|###|\d+\.|\*)/g) || []).length >= 3 ? 2 : 1;
    let flow = /\b(therefore|thus|consequently|as a result|in conclusion|diagram|figure)\b/i.test(text) ? 2 : 1;

    let total = Math.min(15, depth + facts + balance + india + structure + flow);
    let grade = total >= 12 ? '✨ TOP PERCENTILE' : total >= 9 ? '👍 SOLID IFS STANDARD' : '🎯 NEEDS FACT DENSITY';

    return {
      depthScore: depth,
      factsScore: facts,
      balanceScore: balance,
      indiaScore: india,
      structScore: structure,
      flowScore: flow,
      totalScore: total,
      gradeText: grade
    };
  }

  markTopicMastered(topicId) {
    if (!this.progress.topicsMastery[topicId]) {
      this.progress.topicsMastery[topicId] = {};
    }
    this.progress.topicsMastery[topicId].level = 4;
    this.progress.topicsMastery[topicId].lastPracticed = new Date().toISOString();
    this.saveProgressToStorage();
  }

  flagTopicAsWeak(topicId) {
    if (!this.progress.topicsMastery[topicId]) {
      this.progress.topicsMastery[topicId] = {};
    }
    this.progress.topicsMastery[topicId].isWeak = true;
    this.saveProgressToStorage();
  }

  // --- STEP 7: SESSION WRAP-UP ---
  finishSession() {
    this.hideAllSessionSections();
    const section = document.getElementById('wrapupSection');
    section.style.display = 'block';

    const acc = this.session.mcqTotalAttempted > 0
      ? Math.round((this.session.mcqCorrectCount / this.session.mcqTotalAttempted) * 100)
      : 100;

    document.getElementById('wrapupTopicName').textContent = this.session.topic.name;
    document.getElementById('wrapupAccuracy').textContent = `${acc}%`;
    document.getElementById('wrapupReviewAdded').textContent = `+${this.session.sessionReviewsAdded}`;
    document.getElementById('wrapupMasteryStatus').textContent = acc >= 70 ? 'Level 4 (Mastered)' : 'Level 2 (Weak Flagged)';
    document.getElementById('badgeSessionState').textContent = 'Completed';

    const tipsList = document.getElementById('wrapupTipsList');
    tipsList.innerHTML = `
      <li><strong>Examiner Tip 1:</strong> Always underline or italicize Latin names (e.g. <em>Xanthomonas citri</em>, <em>Cocos nucifera</em>).</li>
      <li><strong>Examiner Tip 2:</strong> When answering agricultural questions, quote official ICAR / Soil Health Card benchmarks for high marks.</li>
      <li><strong>Examiner Tip 3:</strong> Review your scheduled ${this.session.sessionReviewsAdded} cards tomorrow morning to consolidate retention.</li>
    `;

    this.speak("Session complete! You climbed the Recall Ladder. Check your wrap-up metrics and review queue.");
  }

  // --- SPACED REPETITION ENGINE (ANKI SM-2 SIMULATION) ---
  addToReviewQueue(item) {
    const existingIndex = this.reviewQueue.findIndex(q => q.id === item.id);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (item.intervalDays || 1));

    const queueItem = {
      ...item,
      addedDate: new Date().toISOString(),
      nextReviewDate: nextDate.toISOString()
    };

    if (existingIndex >= 0) {
      this.reviewQueue[existingIndex] = queueItem;
    } else {
      this.reviewQueue.push(queueItem);
    }
    this.saveReviewQueueToStorage();
    this.updateLiveHeaderMetrics();
  }

  startDueReviewSession() {
    const now = new Date();
    const due = this.reviewQueue.filter(item => new Date(item.nextReviewDate) <= now);
    if (due.length === 0) {
      alert("✨ Excellent! Your Review Queue has 0 due cards right now. You are fully up to date!");
      return;
    }

    alert(`Starting Spaced Review session with ${due.length} due items!`);
    this.switchView('session');
    
    const firstDue = due[0];
    this.startTopicSession(firstDue.topicId, 'flash');
  }

  startInterleavedReview() {
    if (this.reviewQueue.length === 0) {
      alert("No review cards in queue. Launch any topic to build your spaced repetition deck!");
      return;
    }
    alert(`🔀 Interleaved Review Mode: Shuffling Botany and Agriculture concepts to train rapid context-switching for the exam hall!`);
    this.switchView('session');
    const randomCard = this.reviewQueue[Math.floor(Math.random() * this.reviewQueue.length)];
    this.startTopicSession(randomCard.topicId, 'flash');
  }

  // --- SYLLABUS MATRIX VIEW ---
  renderSyllabusMatrix() {
    const grid = document.getElementById('topicMatrixGrid');
    if (!grid || !this.kb) return;
    grid.innerHTML = '';

    let count = 0;
    this.kb.modules.forEach(mod => {
      mod.topics.forEach(topic => {
        count++;
        const mastery = this.progress.topicsMastery[topic.id] || {};
        const isWeak = mastery.isWeak || (mastery.mcqAccuracy && mastery.mcqAccuracy < 70);
        const level = mastery.level || 1;

        const tile = document.createElement('div');
        tile.className = `topic-tile ${isWeak ? 'weak' : ''}`;
        tile.innerHTML = `
          <div>
            <div class="topic-tile-header">
              <span class="topic-name">${topic.name}</span>
              <span class="badge-tag" style="background:${isWeak ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color:${isWeak ? '#f87171' : '#34d399'};">
                ${isWeak ? '⚠️ WEAK' : `L${level} RECALL`}
              </span>
            </div>
            <div class="topic-paper">${mod.subject} ${mod.paper} • PYQ: ${topic.pyq_weightage}</div>
          </div>

          <div class="topic-stats-row">
            <span>MCQs: ${topic.mcqs ? topic.mcqs.length : 0}</span>
            <span>Cloze: ${topic.cloze ? topic.cloze.length : 0}</span>
            <span>Flash: ${topic.flashcards ? topic.flashcards.length : 0}</span>
            <span>Mains: ${topic.mains ? topic.mains.length : 0}</span>
          </div>

          <div class="topic-actions">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="window.app.startTopicSession('${topic.id}', 'full')">
              🚀 Full Ladder
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.app.startTopicSession('${topic.id}', 'quiz')">
              🎯 Quiz
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.app.startTopicSession('${topic.id}', 'flash')">
              🃏 Flash
            </button>
          </div>
        `;
        grid.appendChild(tile);
      });
    });

    document.getElementById('badgeTopicsCount').textContent = count;
  }

  filterMatrixByPaper(filterVal) {
    document.querySelectorAll('.topic-tile').forEach(tile => {
      const paperText = tile.querySelector('.topic-paper').textContent;
      if (filterVal === 'all' || paperText.includes(filterVal)) {
        tile.style.display = 'flex';
      } else {
        tile.style.display = 'none';
      }
    });
  }

  // --- REVIEW QUEUE VIEW ---
  renderReviewQueueView() {
    const container = document.getElementById('reviewItemsListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (this.reviewQueue.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:10px;">🎉</div>
          <h3>Review Queue is Completely Clean!</h3>
          <p>Any cards you miss or rate 'Again' during active sessions will automatically queue here.</p>
        </div>
      `;
      return;
    }

    this.reviewQueue.forEach((item, index) => {
      const card = document.createElement('div');
      card.style.background = 'var(--bg-card)';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = '8px';
      card.style.padding = '14px 18px';
      card.style.marginBottom = '10px';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';

      const isDue = new Date(item.nextReviewDate) <= new Date();

      card.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span class="badge-tag" style="background:rgba(59, 130, 246, 0.2); color:#60a5fa;">${item.type}</span>
            <strong style="font-size:0.92rem;">${item.topicName || 'IFS Topic'}</strong>
            ${isDue ? '<span class="badge-tag" style="background:rgba(245, 158, 11, 0.2); color:#fbbf24;">DUE NOW</span>' : ''}
          </div>
          <div style="font-size:0.85rem; color:var(--text-secondary); max-width:650px;">
            ${(item.question || item.front || '').substring(0, 110)}...
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="window.app.startTopicSession('${item.topicId}', 'flash')">Drill</button>
          <button class="btn btn-outline btn-sm" onclick="window.app.removeReviewItem(${index})">✕</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  removeReviewItem(index) {
    this.reviewQueue.splice(index, 1);
    this.saveReviewQueueToStorage();
    this.renderReviewQueueView();
    this.updateLiveHeaderMetrics();
  }

  // --- ANKI EXPORT ENGINE ---
  renderAnkiExportView() {
    const preview = document.getElementById('ankiExportPreview');
    if (!preview || !this.kb) return;

    const format = document.querySelector('input[name="ankiFormatOption"]:checked')?.value || 'cloze';
    let output = `# IFS Mains Active Recall Export (${format.toUpperCase()})\n# Generated by IFS Quizmaster AI Employee\n# Paste directly into Anki Import dialog\n\n`;

    this.kb.modules.forEach(mod => {
      mod.topics.forEach(t => {
        if (format === 'cloze') {
          (t.cloze || []).forEach(c => {
            output += `${c.anki_format}\t${mod.subject}::${mod.paper}::${t.name.replace(/\s+/g, '_')}\n`;
          });
        } else {
          (t.flashcards || []).forEach(f => {
            output += `${f.front}\t${f.back.replace(/\n/g, '<br>')}\t${mod.subject}::${mod.paper}::${t.name.replace(/\s+/g, '_')}\n`;
          });
        }
      });
    });

    preview.textContent = output;
  }

  copyAnkiText() {
    const text = document.getElementById('ankiExportPreview').textContent;
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Anki cards copied to clipboard! Open Anki -> File -> Import and paste!");
    });
  }

  downloadAnkiFile() {
    const text = document.getElementById('ankiExportPreview').textContent;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IFS_Quizmaster_Deck_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- MASTERY REPORT DASHBOARD ---
  renderReportDashboard() {
    if (!this.kb) return;

    let totalTopics = 0;
    let masteredCount = 0;
    let weakCount = 0;
    let botMastered = 0, botTotal = 0;
    let agriMastered = 0, agriTotal = 0;

    const weakList = document.getElementById('reportWeakTopicsList');
    weakList.innerHTML = '';

    this.kb.modules.forEach(mod => {
      mod.topics.forEach(t => {
        totalTopics++;
        if (mod.subject === 'Botany') botTotal++;
        if (mod.subject === 'Agriculture') agriTotal++;

        const m = this.progress.topicsMastery[t.id] || {};
        if (m.level === 4) {
          masteredCount++;
          if (mod.subject === 'Botany') botMastered++;
          if (mod.subject === 'Agriculture') agriMastered++;
        }
        if (m.isWeak) {
          weakCount++;
          const item = document.createElement('div');
          item.style.background = 'rgba(239, 68, 68, 0.1)';
          item.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          item.style.padding = '8px 14px';
          item.style.borderRadius = '6px';
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.innerHTML = `
            <span><strong>${t.name}</strong> (${mod.subject} ${mod.paper})</span>
            <button class="btn btn-primary btn-sm" onclick="window.app.startTopicSession('${t.id}', 'quiz')">Re-quiz Now</button>
          `;
          weakList.appendChild(item);
        }
      });
    });

    if (weakCount === 0) {
      weakList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No topics currently flagged weak. Keep practicing to maintain above 70% accuracy!</div>';
    }

    document.getElementById('reportMasteredCount').textContent = `${masteredCount} / ${totalTopics}`;
    document.getElementById('reportWeakCount').textContent = weakCount;
    
    const acc = this.progress.totalMcqAnswered > 0
      ? Math.round((this.progress.totalMcqCorrect / this.progress.totalMcqAnswered) * 100)
      : 0;
    document.getElementById('reportAccuracyVal').textContent = `${acc}%`;
    document.getElementById('reportRetentionVal').textContent = `${Math.min(100, Math.round(acc * 1.05))}%`;

    const botPct = botTotal > 0 ? Math.round((botMastered / botTotal) * 100) : 0;
    const agriPct = agriTotal > 0 ? Math.round((agriMastered / agriTotal) * 100) : 0;

    document.getElementById('reportBotanyBarVal').textContent = `${botPct}% (${botMastered}/${botTotal})`;
    document.getElementById('reportBotanyProgressBar').style.width = `${botPct}%`;

    document.getElementById('reportAgriBarVal').textContent = `${agriPct}% (${agriMastered}/${agriTotal})`;
    document.getElementById('reportAgriProgressBar').style.width = `${agriPct}%`;
  }

  // --- CROSS-OPTIONAL LINKS ---
  displayCrossOptionalLink(query) {
    if (!this.kb || !this.kb.cross_optional_links) return;
    const links = this.kb.cross_optional_links;
    const link = links[0];

    this.switchView('chat');
    this.addChatMessage('user', `Link: ${query || link.title}`);
    
    const msg = `
      <strong>🔗 IFS Cross-Optional Integration Strategy</strong><br>
      <strong>${link.title}</strong><br><br>
      <strong>🌿 Botany Conceptual Foundation:</strong><br>${link.botany_concept}<br><br>
      <strong>🌾 Agriculture Agronomic Application:</strong><br>${link.agri_concept}<br><br>
      <strong>🎯 Scoring Strategy in IFS Mains:</strong><br>${link.integrated_answer_strategy}
    `;
    this.addChatMessage('assistant', msg);
    this.speak(link.integrated_answer_strategy);
  }

  // --- MNEMONICS ---
  displayMnemonics(topic) {
    this.switchView('chat');
    this.addChatMessage('user', `Mnemonic: ${topic}`);

    const mnemonics = [
      "🌿 **C4 Photosynthesis Kranz Anatomy:** *'PEPc in Mesophyll cooks Malic Acid; RuBisCO in Bundle Sheath makes Sugar.'*",
      "🌾 **Puccinia 5 Stages:** *'0-Pycnia, 1-Aecia (Barberry), 2-Uredinia, 3-Telia (Wheat), 4-Basidia (Airborne haploids).'*",
      "🔬 **Stelar Evolution (HASD):** *'Haplostele ➔ Actinostele ➔ Solenostele ➔ Dictyostele.'*",
      "🌾 **Indian Seed Tags:** *'Breeder is GOLD, Foundation is WHITE, Certified is BLUE (Azure), Truthful is GREEN.'*",
      "🧪 **C2 Photorespiration Organelles (CPM):** *'Chloroplast ➔ Peroxisome ➔ Mitochondrion.'*"
    ];

    const reply = `
      <strong>🧠 High-Yield Active Recall Mnemonics:</strong><br><br>
      ${mnemonics.join('<br><br>')}
    `;
    this.addChatMessage('assistant', reply);
  }

  // --- STUDY PLAN GENERATOR ---
  generateStudyPlan() {
    this.switchView('chat');
    this.addChatMessage('user', 'Plan');

    const months = parseInt(this.settings.monthsPreset || '5');
    const hours = this.settings.sessionPacing === '20' ? 2 : this.settings.sessionPacing === '60' ? 6 : 4;

    const plan = `
      <strong>📅 IFS Mains Preparation Strategy (${months} Months Horizon | ${hours}h Daily)</strong><br><br>
      • <strong>Morning Active Recall Block (90 min):</strong> Clear Daily Review Queue (Anki SM-2 spaced repetition) + 1 Full Session (Primer + 10 MCQs + Cloze).<br>
      • <strong>Midday Production Block (120 min):</strong> Level 3 SAQ keyword drills (30-100 words) across Botany and Agriculture.<br>
      • <strong>Evening Elaborate Block (90 min):</strong> Write 2 Mains answers (with compulsory diagrams) against 7-minute timers.<br>
      • <strong>Weekly Sunday Mandate:</strong> Export Anki deck via <code>Anki export: [topics]</code> and re-test topics with &lt;70% accuracy.
    `;
    this.addChatMessage('assistant', plan);
  }

  // --- CHAT CONVERSATION ENGINE ---
  handleChatSubmit() {
    const input = document.getElementById('chatTextInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    this.addChatMessage('user', text);
    this.generateChatResponse(text);
  }

  addChatMessage(role, html) {
    const stream = document.getElementById('chatMessagesStream');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = role === 'assistant' ? `<strong>IFS Quizmaster:</strong><br>${html}` : html;
    stream.appendChild(bubble);
    stream.scrollTop = stream.scrollHeight;

    this.chatHistory.push({ role, html, timestamp: new Date().toISOString() });
    this.saveChatHistoryToStorage();
  }

  async generateChatResponse(userText) {
    if (this.settings.aiProvider !== 'builtin' && this.settings.apiKey) {
      await this.callExternalLLM(userText);
      return;
    }

    const lower = userText.toLowerCase();
    let reply = "";

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('ready')) {
      reply = "Welcome back, Officer! What topic are we drilling today? Say <code>Session: Endosperm</code>, <code>Quiz: Photosynthesis</code>, or <code>Review</code> to clear today's due cards.";
    } else if (lower.includes('weak') || lower.includes('accuracy')) {
      reply = `According to your telemetry: MCQ Accuracy is <strong>${document.getElementById('accuracyValue').textContent}</strong>, with <strong>${this.reviewQueue.length}</strong> items in your Review Queue. Would you like me to launch an interleaved review session?`;
    } else if (lower.includes('botany') || lower.includes('paper 1')) {
      reply = "Botany Paper I highest-yield topics: Cryptogam steles, Plant Pathology (TMV, Puccinia, Xanthomonas), Anomalous secondary growth (*Dracaena*, *Boerhavia*), and Embryology (Endosperm types). Type <code>Session: [topic]</code> to start!";
    } else if (lower.includes('agri') || lower.includes('agriculture')) {
      reply = "Agriculture high-yield topics: Integrated Nutrient Management (INM), Weed resistance (*Phalaris minor*), Seed certification tag standards, and IPM Economic Threshold Levels. Type <code>Session: [topic]</code> to climb the ladder!";
    } else {
      reply = `I have logged your request: "<em>${userText}</em>". As your active recall AI Employee, I enforce testing over passive reading. Would you like me to launch a <strong>5-question diagnostic MCQ sprint</strong> on this topic?`;
    }

    this.addChatMessage('assistant', reply);
  }

  async callExternalLLM(userPrompt) {
    const stream = document.getElementById('chatMessagesStream');
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble assistant';
    loadingBubble.innerHTML = '<em>Consulting AI model with IFS Quizmaster prompt...</em>';
    stream.appendChild(loadingBubble);
    stream.scrollTop = stream.scrollHeight;

    try {
      let endpoint = '';
      let headers = { 'Content-Type': 'application/json' };
      let body = {};

      const systemPrompt = "You are 'IFS Quizmaster', an expert AI tutor designed to help crack the Indian Forest Service (IFS) Mains Examination with Botany and Agriculture optionals using a TEST-FIRST, ACTIVE RECALL methodology. You test first, keep explanations 2-4 lines, bold scoring keywords, and enforce the 4-level Recall Ladder.";

      if (this.settings.aiProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${this.settings.apiKey}`;
        body = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        };
      } else if (this.settings.aiProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${this.settings.apiKey}`;
        body = {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        };
      } else {
        loadingBubble.remove();
        this.addChatMessage('assistant', "External provider API configured. Ready to generate active recall sets.");
        return;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      loadingBubble.remove();

      const reply = data.choices && data.choices[0] ? data.choices[0].message.content : "Received response from model.";
      this.addChatMessage('assistant', reply.replace(/\n/g, '<br>'));
      this.speak(reply);
    } catch (err) {
      loadingBubble.remove();
      this.addChatMessage('assistant', `⚠️ API Connection error: ${err.message}. Reverting to built-in knowledge base.`);
    }
  }

  // --- SETTINGS MODAL & INTAKE WIZARD ---
  openSettingsModal() {
    document.getElementById('settingExamDate').value = this.settings.examDate || '2026-11-20';
    document.getElementById('settingMonthsPreset').value = this.settings.monthsPreset || '5';
    document.getElementById('settingPrepLevel').value = this.settings.prepLevel || 'intermediate';
    document.getElementById('settingSessionPacing').value = this.settings.sessionPacing || '45';
    document.getElementById('settingAIProvider').value = this.settings.aiProvider || 'builtin';
    document.getElementById('settingAPIKey').value = this.settings.apiKey || '';
    document.getElementById('settingPersonaRigor').value = this.settings.personaRigor || 'strict';
    document.getElementById('settingWeakTopicsInput').value = this.settings.weakTopics || '';
    document.getElementById('apiKeyGroup').style.display = this.settings.aiProvider === 'builtin' ? 'none' : 'block';

    document.getElementById('settingsModal').classList.add('open');
  }

  closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('open');
  }

  saveSettings() {
    this.settings.examDate = document.getElementById('settingExamDate').value;
    this.settings.monthsPreset = document.getElementById('settingMonthsPreset').value;
    this.settings.prepLevel = document.getElementById('settingPrepLevel').value;
    this.settings.sessionPacing = document.getElementById('settingSessionPacing').value;
    this.settings.aiProvider = document.getElementById('settingAIProvider').value;
    this.settings.apiKey = document.getElementById('settingAPIKey').value.trim();
    this.settings.personaRigor = document.getElementById('settingPersonaRigor').value;
    this.settings.weakTopics = document.getElementById('settingWeakTopicsInput').value.trim();

    this.saveSettingsToStorage();
    this.closeSettingsModal();
    this.updateLiveHeaderMetrics();
    alert("✅ AI Employee settings saved successfully! Your active recall parameters have updated.");
  }

  completeIntake() {
    this.settings.monthsPreset = document.getElementById('intakeMonths').value;
    this.settings.prepLevel = document.getElementById('intakeLevel').value;
    this.settings.sessionPacing = document.getElementById('intakeSession').value;
    this.settings.weakTopics = document.getElementById('intakeWeakTopics').value;
    this.settings.intakeCompleted = true;
    this.saveSettingsToStorage();

    document.getElementById('intakeModal').classList.remove('open');
    this.updateLiveHeaderMetrics();
    alert("🎯 IFS Quizmaster initialized! Launching Session 1 on high-yield topic: Embryology & Endosperm Types.");
    this.startTopicSession('bot_p1_embryo');
  }

  saveCustomTopic() {
    const title = document.getElementById('custTopicTitle').value.trim();
    const paper = document.getElementById('custTopicPaper').value;
    const notes = document.getElementById('custTopicNotes').value.trim();
    if (!title || !notes) return;

    const bullets = notes.split('\n').filter(Boolean);
    const newTopic = {
      id: 'cust_' + Date.now(),
      name: title,
      pyq_weightage: 'Custom Module',
      primer: bullets,
      mcqs: [
        {
          id: 'mcq_' + Date.now(),
          difficulty: 'MEDIUM',
          type: 'single_choice',
          question: `Regarding ${title}, which statement correctly reflects core principles?`,
          options: [
            `(a) ${bullets[0] || 'Key principle A'}`,
            `(b) Inverted incorrect distractor B`,
            `(c) Alternate incorrect option C`,
            `(d) None of the above`
          ],
          answer: '(a)',
          rationale: `Verified directly from your custom notes: ${bullets[0] || 'Core fact.'}`,
          memory_hook: `Recall anchor: ${title}`
        }
      ],
      cloze: [
        {
          id: 'clz_' + Date.now(),
          text: bullets[0] ? bullets[0].replace(/\b([A-Za-z]{4,})\b/, '______') : `Key fact in ${title} is ______.`,
          answer: 'verified',
          hint: 'From custom notes'
        }
      ],
      flashcards: [
        {
          id: 'fl_' + Date.now(),
          front: `Define key mechanisms of ${title}.`,
          back: bullets.slice(0, 3).join('\n')
        }
      ],
      saqs: [
        {
          id: 'saq_' + Date.now(),
          marks: 5,
          question: `Explain the fundamental importance of ${title} for IFS examination. (60-80 words)`,
          scoring_keywords: title.toLowerCase().split(' ').filter(w => w.length > 3),
          model_answer: bullets.join('. ')
        }
      ],
      mains: [
        {
          id: 'mains_' + Date.now(),
          marks: 15,
          diagram_required: true,
          diagram_guidance: `Draw annotated schematic illustrating ${title}.`,
          question: `Critically examine ${title} and assess its practical application in forestry/agricultural systems. (250 words / 15 Marks)`,
          model_answer: bullets.join('\n\n')
        }
      ]
    };

    const targetMod = this.kb.modules.find(m => m.subject === (paper.includes('Botany') ? 'Botany' : 'Agriculture')) || this.kb.modules[0];
    targetMod.topics.push(newTopic);

    document.getElementById('customTopicModal').classList.remove('open');
    this.renderSyllabusMatrix();
    alert(`✅ Custom Topic '${title}' ingested! Complete Recall Ladder generated.`);
    this.startTopicSession(newTopic.id);
  }

  exportProgressJSON() {
    const data = {
      settings: this.settings,
      progress: this.progress,
      reviewQueue: this.reviewQueue,
      chatHistory: this.chatHistory,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IFS_Quizmaster_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new IFSQuizmasterApp();
});
