// ========== HAND RECOGNITION VARIABLES ==========
const SMOOTHING_WINDOW = 5;
const SPEED_CALCULATION_FRAMES = 10;

let hands, camera;
let selfieSegmentation; // For background blur
let segmentationResults = null; // Store segmentation mask
let previousAngles = [];
let rotationHistory = [];
let frameTimestamps = [];
let currentRotation = 'none';
let totalRotation = 0;
let rotationVelocity = 0;
let lastGestureTime = 0;
let gestureCooldown = 1000;
let lastHandDetectedTime = Date.now();
let lastActiveRotationTime = Date.now();
let handDetectionTimeout = 2000;
let handTimeoutTimer = null;
let isFingerDetected = false;

// Control mode variables
let controlMode = 'speed'; // 'distance', 'speed', or 'touch'
let velocityHistory = [];
let fingerVelocity = 0;

// Gesture control variables
let gestureControlEnabled = true;
let lastPalmState = false;
let gestureDebounceTime = 500;
let lastGestureToggleTime = 0;
let palmHoldStartTime = 0;
let palmHoldDuration = 300;
let isPalmHolding = false;

// Rotation gesture for play detection
let playGestureRotation = 0;
let playGestureStartTime = 0;
let playGestureActive = false;
let playGesturePreviousAngles = []; // Separate array for play gesture
const PLAY_GESTURE_THRESHOLD = 720; // ~2 full rotations (360° × 2)

// DOM elements for hand recognition
const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const rotationText = document.getElementById('rotationText');
const currentDirection = document.getElementById('currentDirection');
const angleDisplay = document.getElementById('angleDisplay');
const speedDisplay = document.getElementById('speedDisplay');
const fingerStatus = document.getElementById('fingerStatus');
const detectionStatus = document.getElementById('detectionStatus');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const handSection = document.getElementById('handSection');

// Volume control variables
let currentVolume = 1.0;
let volumeHistory = [];
const VOLUME_SMOOTHING_FRAMES = 5;
let lastVolumeUpdateTime = 0;
let volumeUpdateInterval = 100;

// Volume UI elements
const volumeStatus = document.getElementById('volumeStatus');
const volumeIcon = document.getElementById('volumeIcon');
const volumeText = document.getElementById('volumeText');

// Control mode toggle elements
const distanceModeRadio = document.getElementById('distanceMode');
const speedModeRadio = document.getElementById('speedMode');
const touchModeRadio = document.getElementById('touchMode');

// ========== AUDIO PLAYER VARIABLES ==========
const params = {
    playback: {
        clickBoostActive: false,
        alpha: 0.05,
        decay: 0.9,
        clickBoostDecay: 0.999,
        asymptoticDecay: 0.5,
        speed: 1.0,
    },
    navigation: {
        segmentDuration: 2.0,
        segmentStep: 1.5,
        segmentIntervalMs: 1200,
        maxActiveSources: 3,
        fadeDuration: 0.25,
        minSpeed: -4,
        maxSpeed: 4,
    },
    filtering: {
        alphaFinger: 0.01,
        alphaNoFinger: 0.001,
        driftTarget: 0.7,
        gestureAmplitude: 1.0,
    },
};

// Global variables for audio
let audioContext;
let audioBuffer;
let currentSource = null;
let isPlaying = false;
let manuallyPaused = false;
let navigationSpeed = 1.0;
let rawNavigationSpeed = 1.0;
let filteredSpeed = 1.0;
let gestureTarget = 0.7;
let previousGestureTarget = 0.7;
let filterAnimationFrame = null;
let startTime = 0;
let pauseTime = 0;
let animationFrame = null;
let scheduleTimeout = null;
let speedSmoothingHandle = null;
const speedState = {
    target: navigationSpeed,
    current: navigationSpeed,
    velocity: 0,
    boost: 0,
};
const activeSources = new Set();
let prevNavigationSpeed = 1.0;

// DOM elements for audio player
const audioFileInput = document.getElementById('audioFile');
const htmlAudioElement = document.getElementById('htmlAudioElement');
const controls = document.getElementById('controls');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const seekBar = document.getElementById('seekBar');
const speedBar = document.getElementById('speedBar');
const speedValue = document.getElementById('speedValue');
const filteredSpeedBar = document.getElementById('filteredSpeedBar');
const filteredSpeedValue = document.getElementById('filteredSpeedValue');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');
const loadDefaultBtn = document.getElementById('loadDefaultBtn');
const youtubeUrlInput = document.getElementById('youtubeUrlInput');
const loadYouTubeBtn = document.getElementById('loadYouTubeBtn');
const audioLoadingIndicator = document.getElementById('audioLoadingIndicator');
const htmlVideoElement = document.getElementById('htmlVideoElement');
const videoContainer = document.getElementById('videoContainer');

// Alpha control elements
const alphaFingerInput = document.getElementById('alphaFingerInput');
const alphaFingerValue = document.getElementById('alphaFingerValue');
const alphaNoFingerInput = document.getElementById('alphaNoFingerInput');
const alphaNoFingerValue = document.getElementById('alphaNoFingerValue');
const driftTargetInput = document.getElementById('driftTargetInput');
const driftTargetValue = document.getElementById('driftTargetValue');
const activeAlphaDisplay = document.getElementById('activeAlphaDisplay');
const alphaStateText = document.getElementById('alphaStateText');

// Amplitude control element
const amplitudeInput = document.getElementById('amplitudeInput');
const amplitudeValue = document.getElementById('amplitudeValue');

// Parameter control elements
const segmentDurationInput = document.getElementById('segmentDuration');
const segmentStepInput = document.getElementById('segmentStep');
const segmentIntervalInput = document.getElementById('segmentInterval');
const fadeDurationInput = document.getElementById('fadeDuration');
const effectiveStepDisplay = document.getElementById('effectiveStep');
const effectiveIntervalDisplay = document.getElementById('effectiveInterval');

const MIN_PLAYBACK_RATE = 0.0625;
const MAX_PLAYBACK_RATE = 16.0;

// ========== TRANSCRIPTION VARIABLES ==========
const transcribeBtn = document.getElementById('transcribeBtn');
const transcriptionStatus = document.getElementById('transcriptionStatus');
const transcriptionStatusText = document.getElementById('transcriptionStatusText');
const transcriptionResult = document.getElementById('transcriptionResult');
const transcriptionText = document.getElementById('transcriptionText');
const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
const TRANSCRIBE_API = 'http://localhost:3000/api/transcribe';

let currentTranscript = null;
let currentTranscriptWords = [];

function enableTranscription() {
    console.log('enableTranscription called!');
    console.log('transcribeBtn:', transcribeBtn);
    if (transcribeBtn) {
        transcribeBtn.disabled = false;
        console.log('Button enabled!');
    } else {
        console.log('transcribeBtn not found!');
    }
}

// ========== SMART SCRUB VARIABLES ==========
let smartScrubEnabled = false;
let smartScrubActive = false;
let isSmartScrubPaused = false;
let smartScrubTimer = null;
let informativeWords = [];
let allTranscriptWords = [];
let currentWordIndex = 0;
let manualThresholdPercentile = null;
let hasUserAdjustedThreshold = false;
let userIntervalMs = 0;
let wordPlaybackSpeed = 1.0;
let scrubStartSpeed = 1.9; // Forward smart scrub threshold
let bwScrubStartSpeed = 1.9; // Backward smart scrub threshold (absolute value)

const WORD_OVERLAP_MS = 100;
let wordHowl = null;
let wordHowlUrl = null;
let backwardSmartScrubTimer = null;
let bwNextWordIndex = 0;
const MAX_OVERLAP_SOURCES = 3;
let activeWordHowlIds = [];
const PRE_ROLL_SEC = 0.05;

// Smart scrub DOM elements
const smartScrubToggle = document.getElementById('smartScrubToggle');
const smartScrubControls = document.getElementById('smartScrubControls');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdLabel = document.getElementById('thresholdLabel');
const intervalSlider = document.getElementById('intervalSlider');
const intervalLabel = document.getElementById('intervalLabel');
const wordSpeedSlider = document.getElementById('wordSpeedSlider');
const wordSpeedLabel = document.getElementById('wordSpeedLabel');
const keywordDisplay = document.getElementById('keywordDisplay');
const pauseSmartScrubBtn = document.getElementById('pauseSmartScrubBtn');
const overlapSourcesSlider = document.getElementById('overlapSourcesSlider');
const overlapSourcesLabel = document.getElementById('overlapSourcesLabel');
const scrubStartSpeedSlider = document.getElementById('scrubStartSpeedSlider');
const scrubStartSpeedLabel = document.getElementById('scrubStartSpeedLabel');
const bwScrubStartSpeedSlider = document.getElementById('bwScrubStartSpeedSlider');
const bwScrubStartSpeedLabel = document.getElementById('bwScrubStartSpeedLabel');
const wordPlayer = document.getElementById('wordPlayer');

// Common words to filter out
const commonWords = new Set([
    "the", "and", "is", "in", "on", "it", "of", "to", "a", "an", "i", "you", 
    "that", "this", "he", "she", "they", "we", "for", "with", "as", "at", 
    "by", "from", "but", "or", "not", "be", "was", "were", "are", "have", 
    "has", "had", "do", "does", "did", "so", "if", "no", "yes", "all", "any",
    "there", "here", "when", "where", "what", "which", "who", "whom", "why", 
    "how", "my", "your", "his", "her", "its", "our", "their", "me", "him", 
    "them", "us", "one", "about", "like", "just", "more", "some", "out", "up", 
    "down", "now", "then", "also", "than", "too", "very", "can", "will", 
    "would", "should", "could", "may", "might", "must", "go", "get", "got"
]);

// ========== SMART SCRUB FUNCTIONS ==========

// Length & Rarity-based word scoring (from your transcription file)
function selectInformativeWordsTFIDF(words, speed = 1, overridePercentile = null) {
    if (!Array.isArray(words) || words.length === 0) return [];

    const alpha = /[a-z]/i;

    // Convert words to tokens and filter common words
    const tokens = words.map(w => ({
        text: (w.text || '').toLowerCase().replace(/[^a-z'\-]/gi, ''),
        start: w.start,
        end: w.end
    })).filter(w => w.text && alpha.test(w.text) && !commonWords.has(w.text));

    if (tokens.length === 0) return [];

    // Calculate frequency map
    const freq = new Map();
    for (const t of tokens) {
        freq.set(t.text, (freq.get(t.text) || 0) + 1);
    }

    // Helper: calculate median
    const median = (arr) => {
        if (!arr.length) return 0;
        const a = [...arr].sort((x, y) => x - y);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    };

    const lengths = tokens.map(t => t.text.length);
    const freqs = Array.from(freq.values());

    const medLen = Math.max(1, median(lengths));
    const medFreq = Math.max(1, median(freqs));

    const lenWeight = 1.15;
    const rarityWeight = 1.35;

    // Calculate scores for each unique word
    const wordScores = new Map();
    for (const [word, f] of freq.entries()) {
        const len = word.length;
        const lengthFactor = Math.pow(Math.max(0.6, len / medLen), lenWeight);
        const rarityRatio = medFreq / Math.max(1, f);
        const rarityFactor = Math.pow(Math.log1p(rarityRatio), rarityWeight);
        const raw = lengthFactor * rarityFactor;
        const score = Math.sqrt(raw);
        wordScores.set(word, score);
    }

    // Get all scores and sort
    const scores = Array.from(wordScores.values()).filter(v => isFinite(v) && v > 0);
    if (scores.length === 0) {
        return tokens.map(({ text, start, end }) => ({ text, start, end }));
    }
    scores.sort((a, b) => a - b);

    // Determine percentile threshold
    let p;
    if (overridePercentile !== null && overridePercentile >= 0.50 && overridePercentile <= 0.95) {
        p = overridePercentile;
    } else {
        // Auto-adjust based on speed
        const s = Math.max(1, Math.min(6, speed));
        p = 0.82 - 0.06 * (s - 2);
        p = Math.max(0.60, Math.min(0.88, p));
    }

    const idx = Math.floor(p * (scores.length - 1));
    const threshold = scores[idx];

    // Filter words by threshold and sort by time
    const informative = tokens
        .map(t => ({ ...t, score: wordScores.get(t.text) || 0 }))
        .filter(t => t.score >= threshold)
        .sort((a, b) => a.start - b.start);

    console.log(`Selected ${informative.length} informative words from ${words.length} total (threshold: ${(p * 100).toFixed(0)}th percentile)`);

    return informative.map(({ text, start, end }) => ({ text, start, end }));
}

function recalcInformative(resetIndexToCurrent = true) {
    if (allTranscriptWords.length === 0) return;
    
    const currentSpeed = Math.abs(filteredSpeed);
    informativeWords = selectInformativeWordsTFIDF(
        allTranscriptWords,
        currentSpeed,
        hasUserAdjustedThreshold ? manualThresholdPercentile : null
    );
    
    if (resetIndexToCurrent) {
        realignNextIndexTo(parseFloat(seekBar.value));
    }
    
    console.log(`Recalculated with speed ${currentSpeed.toFixed(2)}x: ${informativeWords.length} keywords`);
}

function realignNextIndexTo(timeSec) {
    currentWordIndex = 0;
    while (currentWordIndex < informativeWords.length && 
           informativeWords[currentWordIndex].start <= timeSec) {
        currentWordIndex++;
    }
}

function startSmartScrub() {
    if (informativeWords.length === 0 || !audioBuffer) {
        console.warn('Cannot start smart scrub: no keywords or audio buffer');
        return;
    }
    
    console.log('Starting smart scrub mode...');
    smartScrubActive = true;
    isSmartScrubPaused = false;
    htmlAudioElement.pause();
    if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
        htmlVideoElement.pause();
    }
    
    activeSources.forEach((source) => {
        try { source.stop(); } catch (e) {}
    });
    activeSources.clear();
    if (scheduleTimeout) {
        clearTimeout(scheduleTimeout);
        scheduleTimeout = null;
    }

    const currentTime = parseFloat(seekBar.value);
    const isReverse = filteredSpeed < 0;
    
    if (isReverse) {
        // Start from the word BEFORE current position
        currentWordIndex = informativeWords.length - 1;
        while (currentWordIndex >= 0 && 
               informativeWords[currentWordIndex].start >= currentTime) {
            currentWordIndex--;
        }
    } else {
        // Start from the word AFTER current position
        realignNextIndexTo(currentTime);
    }
    
    console.log(`Starting from keyword ${currentWordIndex}/${informativeWords.length} at time ${currentTime}s (reverse: ${isReverse})`);
    
    if (pauseSmartScrubBtn) {
        pauseSmartScrubBtn.style.display = 'inline-block';
        pauseSmartScrubBtn.textContent = 'Pause Smart Scrub';
    }
    if (keywordDisplay) {
        keywordDisplay.textContent = 'Smart scrub active...';
    }
    
    playNextKeyword();
}

function playNextKeyword() {
    if (!smartScrubActive) return;
    
    if (isSmartScrubPaused) {
        smartScrubTimer = setTimeout(playNextKeyword, 100);
        return;
    }
    const isReverse = filteredSpeed < 0;
    
    if (isReverse) {
        // Going backwards
        if (currentWordIndex < 0) {
            console.log('Reached beginning of keywords');
            stopSmartScrub();
            return;
        }
    } else {
        // Going forwards
        if (currentWordIndex >= informativeWords.length) {
            console.log('Reached end of keywords');
            stopSmartScrub();
            return;
        }
    }
    
    const word = informativeWords[currentWordIndex];

    const PRE_ROLL_SEC = 0.05;
    const POST_ROLL_SEC = 0.05;
    
    const startTime = word.start;
    const adjustedStartTime = Math.max(0, startTime - PRE_ROLL_SEC);
    
    let wordDurationMs;
    if (typeof word.end === 'number' && word.end > word.start) {
        wordDurationMs = (word.end - word.start) * 1000 + (PRE_ROLL_SEC + POST_ROLL_SEC) * 1000;
    } else {
        wordDurationMs = 400;
    }
    
    if (keywordDisplay) {
        keywordDisplay.textContent = word.text;
    }
    
    highlightWord(word);
    
    pauseTime = startTime;
    seekBar.value = startTime;
    currentTimeDisplay.textContent = formatTime(startTime);
    
    try {
        htmlAudioElement.currentTime = startTime;
        if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
            htmlVideoElement.currentTime = startTime;
        }
    } catch (e) {}

    playSmartWordSegment(adjustedStartTime, wordDurationMs);
    
    const getIntervalMs = () => {
        if (userIntervalMs !== null && userIntervalMs > 0) return userIntervalMs;
        const speed = Math.abs(filteredSpeed);
        return Math.max(0, 700 / Math.max(0.1, speed - 1.5));
    };
    
    const getOverlapMs = () => {
        const intervalMs = getIntervalMs();
        return Math.max(0, WORD_OVERLAP_MS * (1 - intervalMs / 500));
    };
    
    const gapMs = getIntervalMs();
    const overlapMs = getOverlapMs();
    const effectiveWaitMs = Math.max(50, (wordDurationMs + gapMs - overlapMs) / wordPlaybackSpeed);
    
    if (isReverse) {
        currentWordIndex--;  // Go backwards
    } else {
        currentWordIndex++;  // Go forwards
    }
    
    smartScrubTimer = setTimeout(playNextKeyword, effectiveWaitMs);
}

function stopSmartScrub() {
    console.log('Stopping smart scrub mode...');
    smartScrubActive = false;
    isSmartScrubPaused = false;
    
    if (smartScrubTimer) {
        clearTimeout(smartScrubTimer);
        smartScrubTimer = null;
    }
    
    // Stop all word players (check if pool exists first)
    if (wordPlayers && wordPlayers.length > 0) {
        wordPlayers.forEach(player => {
            try {
                player.pause();
            } catch (e) {}
        });
    }
    
    unhighlightAllWords();
    
    if (pauseSmartScrubBtn) {
        pauseSmartScrubBtn.style.display = 'none';
    }
    if (keywordDisplay) {
        keywordDisplay.textContent = 'No keyword playing';
    }
    
    // Resume normal playback if it should be playing
    if (isPlaying && !manuallyPaused) {
        const currentPos = parseFloat(seekBar.value);
        if (filteredSpeed >= 0) {
            htmlAudioElement.currentTime = currentPos;
            htmlAudioElement.playbackRate = Math.abs(filteredSpeed);
            htmlAudioElement.play().catch(() => {});
            
            if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
                htmlVideoElement.currentTime = currentPos;
                htmlVideoElement.playbackRate = Math.abs(filteredSpeed);
                htmlVideoElement.play().catch(() => {});
            }
        } else {
            playReverseChunk(currentPos);
        }
    }
}

function pauseSmartScrubPlayback() {
    if (!smartScrubActive) return;
    
    if (isSmartScrubPaused) {
        isSmartScrubPaused = false;
        if (pauseSmartScrubBtn) {
            pauseSmartScrubBtn.textContent = 'Pause Smart Scrub';
        }
        console.log('Smart scrub resumed');
    } else {
        isSmartScrubPaused = true;
        if (pauseSmartScrubBtn) {
            pauseSmartScrubBtn.textContent = 'Resume Smart Scrub';
        }
        console.log('Smart scrub paused');
    }
}

function highlightWord(word) {
    unhighlightAllWords();
    const wordElements = document.querySelectorAll('.transcript-word');
    wordElements.forEach(el => {
        const wordTime = parseFloat(el.getAttribute('data-time'));
        if (Math.abs(wordTime - word.start) < 0.1) {
            el.style.background = 'rgba(255, 215, 0, 0.6)';
            el.style.fontWeight = 'bold';
            el.style.transform = 'scale(1.05)';
        }
    });
}

function unhighlightAllWords() {
    const wordElements = document.querySelectorAll('.transcript-word');
    wordElements.forEach(el => {
        el.style.background = 'transparent';
        el.style.fontWeight = 'normal';
        el.style.transform = 'scale(1)';
    });
}

// ========== WORD PLAYER POOL (Web Audio API with gain nodes) ==========

const wordPlayers = [];
const wordPlayerGainNodes = [];
const wordPlayerMediaSources = [];
let wordPlayerPoolSize = 3;
let wordPlayerPoolIndex = 0;

function ensureWordPlayerPoolInitialized() {
    if (wordPlayers.length > 0) return;
    
    // Use the HTML word player element as the base
    if (wordPlayer) {
        wordPlayer.volume = 1.0;
        wordPlayer.muted = false;
        wordPlayer.preservesPitch = true;
        wordPlayer.mozPreservesPitch = true;
        wordPlayer.webkitPreservesPitch = true;
        wordPlayers.push(wordPlayer);
    } else {
        // Fallback: create a new audio element
        const initialPlayer = new Audio();
        initialPlayer.preservesPitch = true;
        initialPlayer.mozPreservesPitch = true;
        initialPlayer.webkitPreservesPitch = true;
        initialPlayer.volume = 1.0;
        wordPlayers.push(initialPlayer);
    }
}

function resizeWordPlayerPool(newSize) {
    const size = Math.max(1, Math.min(6, Math.floor(newSize || 3)));
    ensureWordPlayerPoolInitialized();
    while (wordPlayers.length < size) {
        const clone = wordPlayers[0].cloneNode();
        clone.preservesPitch = true;
        clone.mozPreservesPitch = true;
        clone.webkitPreservesPitch = true;
        wordPlayers.push(clone);
    }

    // Remove extra players
    while (wordPlayers.length > size) {
        const removed = wordPlayers.pop();
        const g = wordPlayerGainNodes.pop();
        const m = wordPlayerMediaSources.pop();
        try { if (m) m.disconnect(); } catch {}
        try { if (g) g.disconnect(); } catch {}
    }

    wordPlayerPoolSize = size;
    wordPlayerPoolIndex = wordPlayerPoolIndex % wordPlayerPoolSize;

    // Initialize Web Audio graph if needed
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Rewire gain/media sources for any newly added players
    if (audioContext && wordPlayerGainNodes.length < wordPlayers.length) {
        for (let idx = wordPlayerGainNodes.length; idx < wordPlayers.length; idx++) {
            const p = wordPlayers[idx];
            try {
                const g = audioContext.createGain();
                const m = audioContext.createMediaElementSource(p);
                m.connect(g);
                g.connect(audioContext.destination);
                g.gain.value = 0;
                wordPlayerGainNodes[idx] = g;
                wordPlayerMediaSources[idx] = m;
            } catch (e) {
                console.warn('Could not create media source for player', idx, e);
            }
        }
    }
}

function initWordPlayerPool() {
    if (wordPlayerGainNodes.length > 0) return; // Already initialized
    
    console.log('Initializing word player pool with Web Audio...');
    
    // Ensure audio context exists
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
    
    ensureWordPlayerPoolInitialized();
    resizeWordPlayerPool(wordPlayerPoolSize);
    
    console.log(`Word player pool initialized: ${wordPlayers.length} players`);
}

// ========== WORD PLAYBACK FUNCTIONS ==========

function playSmartWordSegment(startSec, durationMs) {
    // Try Howler first (smoothest), fallback to audio element
    if (playWordWithHowler(startSec, durationMs)) return true;
    return playWordWithAudioElement(startSec, durationMs);
}

function playWordWithHowler(startSec, durationMs) {
    if (!wordHowl || wordHowl.state() !== 'loaded') return false;

    try {
        const baseFadeMs = 180;
        const fadeMs = baseFadeMs / wordPlaybackSpeed;
        const actualDurationMs = durationMs / wordPlaybackSpeed;
        const seekTarget = Math.max(0, startSec - PRE_ROLL_SEC);

        const id = wordHowl.play();
        activeWordHowlIds.push(id);
        
        // Clean up old sources if too many
        if (activeWordHowlIds.length > MAX_OVERLAP_SOURCES) {
            const oldestId = activeWordHowlIds.shift();
            try {
                wordHowl.fade(wordHowl.volume(oldestId), 0, fadeMs, oldestId);
                setTimeout(() => { try { wordHowl.stop(oldestId); } catch {} }, fadeMs + 20);
            } catch {}
        }
        
        wordHowl.rate(wordPlaybackSpeed, id);
        wordHowl.volume(0, id);
        wordHowl.seek(seekTarget, id);
        wordHowl.fade(0, 1, fadeMs, id);

        setTimeout(() => {
            wordHowl.fade(1, 0, fadeMs, id);
        }, actualDurationMs);

        setTimeout(() => {
            try { wordHowl.stop(id); } catch {}
            activeWordHowlIds = activeWordHowlIds.filter(x => x !== id);
        }, actualDurationMs + fadeMs + 30);

        return true;
    } catch (e) {
        console.error('Howler playback error', e);
        return false;
    }
}

function playWordWithAudioElement(startSec, durationMs) {
    // Initialize if needed
    if (!audioContext || wordPlayerGainNodes.length === 0) {
        initWordPlayerPool();
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
    
    try {
        const idx = wordPlayerPoolIndex % wordPlayers.length;
        wordPlayerPoolIndex++;
        const player = wordPlayers[idx];
        const g = wordPlayerGainNodes[idx];

        if (!g) {
            console.warn('No gain node for player', idx);
            return false;
        }

        const baseFadeMs = 240;
        const minFadeMs = 12;
        const fadeInMs = Math.max(minFadeMs, baseFadeMs / wordPlaybackSpeed);
        const fadeOutMs = Math.max(minFadeMs, baseFadeMs / wordPlaybackSpeed);
        const fadeIn = fadeInMs / 1000;
        const fadeOut = fadeOutMs / 1000;
        const now = audioContext.currentTime;

        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
        
        player.preservesPitch = true;
        player.mozPreservesPitch = true;
        player.webkitPreservesPitch = true;
        player.playbackRate = wordPlaybackSpeed;

        const seekTarget = Math.max(0, startSec);
        player.pause();
        player.currentTime = seekTarget;

        const actualDurationMs = durationMs / wordPlaybackSpeed;
        const totalDurationMs = actualDurationMs + fadeInMs + fadeOutMs;

        const playPromise = player.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                const playNow = audioContext.currentTime;
                g.gain.cancelScheduledValues(playNow);
                g.gain.setValueAtTime(0, playNow);
                g.gain.linearRampToValueAtTime(1, playNow + fadeIn);

                const fadeStartTime = playNow + (actualDurationMs / 1000);
                g.gain.setValueAtTime(1, fadeStartTime);
                g.gain.linearRampToValueAtTime(0, fadeStartTime + fadeOut);
            }).catch(e => console.error('Failed to play word:', e));
        }

        if (player._wordTimeout) clearTimeout(player._wordTimeout);
        player._wordTimeout = setTimeout(() => {
            try {
                player.pause();
                g.gain.cancelScheduledValues(audioContext.currentTime);
                g.gain.setValueAtTime(0, audioContext.currentTime);
            } catch {}
            player._wordTimeout = null;
        }, totalDurationMs + 10);
        
        return true;
    } catch (e) {
        console.error('Error playing word with audio element:', e);
        return false;
    }
}

// ========== SMART SCRUB EVENT LISTENERS ==========

if (smartScrubToggle) {
    smartScrubToggle.addEventListener('change', (e) => {
        smartScrubEnabled = e.target.checked;
        console.log('Smart scrub mode:', smartScrubEnabled ? 'enabled' : 'disabled');
        
        if (!smartScrubEnabled && smartScrubActive) {
            stopSmartScrub();
        }
    });
}

if (thresholdSlider) {
    thresholdSlider.addEventListener('input', () => {
        const val = parseInt(thresholdSlider.value, 10);
        manualThresholdPercentile = val / 100;
        thresholdLabel.textContent = `${val}th percentile`;
        hasUserAdjustedThreshold = true;
        recalcInformative(false);
    });
}

if (intervalSlider) {
    intervalSlider.addEventListener('input', () => {
        const val = parseInt(intervalSlider.value, 10);
        userIntervalMs = val;
        intervalLabel.textContent = `${val}ms`;
    });
}

if (wordSpeedSlider) {
    wordSpeedSlider.addEventListener('input', () => {
        const val = parseFloat(wordSpeedSlider.value);
        wordPlaybackSpeed = val;
        wordSpeedLabel.textContent = `${val.toFixed(1)}x`;
    });
}

if (overlapSourcesSlider) {
    overlapSourcesSlider.addEventListener('input', () => {
        const val = Math.round(parseInt(overlapSourcesSlider.value, 10) || 1);
        overlapSourcesLabel.textContent = `${val}`;
        wordPlayerPoolSize = val;
        resizeWordPlayerPool(wordPlayerPoolSize);
        if (wordHowlUrl && wordPlayer) {
            wordPlayer.src = wordHowlUrl;
        }
    });
}

if (scrubStartSpeedSlider) {
    scrubStartSpeedSlider.addEventListener('input', () => {
        const val = parseFloat(scrubStartSpeedSlider.value);
        scrubStartSpeed = val - 0.1;
        scrubStartSpeedLabel.textContent = `${val.toFixed(1)}x`;
    });
}

if (bwScrubStartSpeedSlider) {
    bwScrubStartSpeedSlider.addEventListener('input', () => {
        const val = parseFloat(bwScrubStartSpeedSlider.value);
        bwScrubStartSpeed = Math.abs(val) - 0.1;
        bwScrubStartSpeedLabel.textContent = `${val.toFixed(1)}x`;
    });
}

if (pauseSmartScrubBtn) {
    pauseSmartScrubBtn.addEventListener('click', pauseSmartScrubPlayback);
}

// ========== TRANSCRIPTION FUNCTIONS ==========
async function transcribeAudio() {
    if (!htmlAudioElement.src) {
        alert('Please load an audio file first');
        return;
    }

    try {
        transcriptionStatus.style.display = 'block';
        transcriptionStatusText.textContent = 'Uploading and transcribing audio... This may take a few minutes.';
        transcribeBtn.disabled = true;
        transcriptionResult.style.display = 'none';

        const audioUrl = htmlAudioElement.src;
        
        // Check if it's a local blob URL or localhost URL
        if (audioUrl.startsWith('blob:') || audioUrl.includes('localhost')) {
            // For local/blob URLs, we need to upload the file data
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            
            // Create form data
            const formData = new FormData();
            formData.append('audio', blob, 'audio.mp3');
            
            const uploadResponse = await fetch('http://localhost:3000/api/transcribe-upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.error || 'Transcription failed');
            }

            const result = await uploadResponse.json();
            currentTranscript = result.text;
            currentTranscriptWords = result.words || [];
            
            displayTranscript(result.text, result.words);
            transcriptionResult.style.display = 'block';
            transcriptionStatus.style.display = 'none';
            
        } else {
            // For public URLs (YouTube, etc)
            const response = await fetch(TRANSCRIBE_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ audioUrl })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Transcription failed');
            }

            const result = await response.json();
            currentTranscript = result.text;
            currentTranscriptWords = result.words || [];
            
            displayTranscript(result.text, result.words);
            transcriptionResult.style.display = 'block';
            transcriptionStatus.style.display = 'none';
        }

    } catch (error) {
        console.error('Transcription error:', error);
        transcriptionStatusText.textContent = `Error: ${error.message}`;
        setTimeout(() => {
            transcriptionStatus.style.display = 'none';
        }, 5000);
    } finally {
        transcribeBtn.disabled = false;
    }
}

function displayTranscript(text, words) {
    if (!words || words.length === 0) {
        transcriptionText.innerHTML = `<p>${text}</p>`;
        return;
    }
    allTranscriptWords = words;
    
    // Calculate initial set of informative words
    const currentSpeed = Math.abs(filteredSpeed) || 1;
    informativeWords = selectInformativeWordsTFIDF(words, currentSpeed);
    
    console.log(`Calculated ${informativeWords.length} informative words from ${words.length} total`);
    
    // Show smart scrub controls
    if (smartScrubControls) {
        smartScrubControls.style.display = 'block';
        console.log('Smart scrub controls shown!');
    } else {
        console.error('smartScrubControls element not found!');
    }

    // Format with clickable timestamps
    let html = '<div style="white-space: pre-wrap;">';
    
    words.forEach((word, index) => {
        const startTime = (word.start).toFixed(2);
        const wordText = word.text || '';
        
        // Make each word clickable to seek to that position
        html += `<span class="transcript-word" data-time="${word.start}" style="cursor: pointer; padding: 2px; border-radius: 3px; transition: background 0.2s;" onmouseover="this.style.background='rgba(74,222,128,0.3)'" onmouseout="this.style.background='transparent'" onclick="seekToTime(${word.start})">${wordText}</span> `;
        
        // Add line break every ~15 words for readability
        if ((index + 1) % 15 === 0) {
            html += '<br>';
        }
    });
    
    html += '</div>';
    transcriptionText.innerHTML = html;
}

function seekToTime(timeInSeconds) {
    if (audioBuffer) {
        pauseTime = timeInSeconds;
        seekBar.value = timeInSeconds;
        currentTimeDisplay.textContent = formatTime(timeInSeconds);
        
        if (isPlaying) {
            stopPlayback();
            setTimeout(() => startPlayback(), 100);
        }
    }
}

// Make seekToTime globally available
window.seekToTime = seekToTime;

// Copy transcript to clipboard
if (copyTranscriptBtn) {
    copyTranscriptBtn.addEventListener('click', () => {
        if (currentTranscript) {
            navigator.clipboard.writeText(currentTranscript).then(() => {
                copyTranscriptBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyTranscriptBtn.textContent = '📋 Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard');
            });
        }
    });
}

// Event listener for transcribe button
if (transcribeBtn) {
    transcribeBtn.addEventListener('click', transcribeAudio);
}

// ========== AUDIO LOADING STATE MANAGEMENT ==========
function showAudioLoading(message = 'Loading audio...') {
    if (audioLoadingIndicator) {
        const loadingText = audioLoadingIndicator.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        audioLoadingIndicator.style.display = 'flex';
    }
    
    // Disable all input controls
    if (audioFileInput) audioFileInput.disabled = true;
    if (loadDefaultBtn) loadDefaultBtn.disabled = true;
    if (youtubeUrlInput) youtubeUrlInput.disabled = true;
    if (loadYouTubeBtn) loadYouTubeBtn.disabled = true;
}

function hideAudioLoading() {
    try {
        if (audioLoadingIndicator) {
            audioLoadingIndicator.style.display = 'none';
        }
        
        // Re-enable all input controls
        if (audioFileInput) audioFileInput.disabled = false;
        if (loadDefaultBtn) loadDefaultBtn.disabled = false;
        if (youtubeUrlInput) youtubeUrlInput.disabled = false;
        if (loadYouTubeBtn) loadYouTubeBtn.disabled = false;
    } catch (error) {
        console.error('Error hiding loading indicator:', error);
        // Force hide even if there's an error
        if (audioLoadingIndicator) {
            audioLoadingIndicator.style.display = 'none';
        }
    }
}

// Backend endpoint that should return audio for a given YouTube URL.
// You must implement this server-side (e.g. using yt-dlp) so that:
//   GET `${YOUTUBE_AUDIO_API}?url=<youtube-url>`
// returns either:
//   - raw audio (content-type: audio/*) or
//   - JSON: { audioUrl: "<direct-audio-url>" }
const YOUTUBE_AUDIO_API = 'http://localhost:3000/api/youtube-audio';
const YOUTUBE_VIDEO_API = 'http://localhost:3000/api/youtube-video';

// Create mainScriptAPI object for TouchControl
const mainScriptAPI = {
    // Variables
    get controlMode() { return controlMode; },
    get navigationSpeed() { return navigationSpeed; },
    set navigationSpeed(val) { navigationSpeed = val; },
    get gestureTarget() { return gestureTarget; },
    set gestureTarget(val) { gestureTarget = val; },
    get manuallyPaused() { return manuallyPaused; },
    set manuallyPaused(val) { manuallyPaused = val; },
    get filterAnimationFrame() { return filterAnimationFrame; },
    get params() { return params; },
    get isPlaying() { return isPlaying; },
    get audioBuffer() { return audioBuffer; },
    get filteredSpeed() { return filteredSpeed; },
    
    // DOM elements
    speedBar,
    speedValue,
    fingerStatus,
    filteredSpeedBar,
    filteredSpeedValue,
    seekBar,
    currentTimeDisplay,
    
    // Functions
    clamp,
    updateFilteredSpeed: () => updateFilteredSpeed(),
    setGestureTargetForDrift: () => setGestureTargetForDrift(),
    startPlayback: () => startPlayback(),
    pausePlayback: () => pausePlayback(),
    formatTime: (time) => formatTime(time)
};

// ========== HAND RECOGNITION FUNCTIONS ==========
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingMessage.style.display = 'none';
    console.error(message);
}

function hideLoading() {
    loadingMessage.style.display = 'none';
    handSection.style.display = 'block';
}

async function initializeHands() {
    try {
        console.log("Initializing MediaPipe Hands...");
        
        if (typeof Hands === 'undefined') {
            throw new Error('MediaPipe Hands library failed to load. Please check your internet connection.');
        }

        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,  // Increased from 0.5 for better detection
            minTrackingConfidence: 0.7    // Increased from 0.5 for smoother tracking at speed
        });

        hands.onResults(onResults);
        /*
        console.log("Initializing MediaPipe Selfie Segmentation...");
        
        if (typeof SelfieSegmentation === 'undefined') {
            console.warn('Selfie Segmentation not available, proceeding without background blur');
        } else {
            selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                }
            });

            selfieSegmentation.setOptions({
                modelSelection: 1, // 0 for general, 1 for landscape (better for upper body)
            });

            selfieSegmentation.onResults(onSegmentationResults);
        }
        */
        console.log("MediaPipe initialized, starting camera...");

        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility failed to load.');
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
                /*
                if (selfieSegmentation) {
                    await selfieSegmentation.send({image: videoElement});
                } */
            },
            width: 640,
            height: 480
        });

        await camera.start();
        camera.isStarted = true;
        console.log("Camera started successfully!");
        hideLoading();

    } catch (error) {
        console.error('Initialization error:', error);
        showError(`Error: ${error.message}. Please refresh the page and try again.`);
    }
}

function stopCamera() {
    if (camera && camera.isStarted) {
        const stream = videoElement.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        videoElement.srcObject = null;
        camera.isStarted = false;
        console.log("Camera stopped");
    }
}

async function restartCamera() {
    if (!camera || camera.isStarted) return;
    
    try {
        await camera.start();
        camera.isStarted = true;
        console.log("Camera restarted");
    } catch (error) {
        console.error('Error restarting camera:', error);
        showError(`Failed to restart camera: ${error.message}`);
    }
}

function onSegmentationResults(results) {
    // Store the segmentation mask for use in onResults
    segmentationResults = results;
}

function onResults(results) {
    if (controlMode === 'touch') {
        return;
    }
    
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let rightHandLandmarks = null;
    let leftHandLandmarks = null;
    
    // Identify left and right hands
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            const landmarks = results.multiHandLandmarks[i];
            
            if (handedness === 'Left') {
                rightHandLandmarks = landmarks;
            } else if (handedness === 'Right') {
                leftHandLandmarks = landmarks;
            }
        }
    }

    // Handle RIGHT hand (playback control)
    if (rightHandLandmarks) {
        isFingerDetected = true;
        lastHandDetectedTime = Date.now();
        
        if (handTimeoutTimer) {
            clearTimeout(handTimeoutTimer);
            handTimeoutTimer = null;
        }
        
        if (gestureControlEnabled) {
            detectPlayPauseGesture(rightHandLandmarks);
            
            if (!isPlaying) {
                detectPlayGesture(rightHandLandmarks);
            } else {
                if (playGestureActive) {
                    console.log(`[${controlMode}] Resetting play gesture - already playing`);
                    playGestureActive = false;
                    playGestureRotation = 0;
                    playGesturePreviousAngles = [];
                }
            }
        }
        
        highlightIndexFinger(rightHandLandmarks);

        if (controlMode === 'distance') {
            detectIndexFingerRotation(rightHandLandmarks);
        } else {
            detectFingerVelocity(rightHandLandmarks);
        }
    } else {
        isFingerDetected = false;
        fingerStatus.textContent = '❌';
        resetRotationState();
        
        isPalmHolding = false;
        palmHoldStartTime = 0;
        
        playGestureActive = false;
        playGestureRotation = 0;
        playGestureStartTime = 0;
        playGesturePreviousAngles = [];
        
        setGestureTargetForDrift();
        
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
        
        if (!handTimeoutTimer) {
            handTimeoutTimer = setTimeout(() => {
                handTimeoutTimer = null;
            }, handDetectionTimeout);
        }
    }
    
    // Handle LEFT hand (volume control)
    if (leftHandLandmarks) {
        detectVolumeGesture(leftHandLandmarks);
        highlightLeftHand(leftHandLandmarks);
        if (volumeStatus) {
            volumeStatus.style.display = 'block';
        }
    } else {
        if (volumeStatus) {
            volumeStatus.style.display = 'none';
        }
        volumeHistory = [];
    }
    
    canvasCtx.restore();
}

function highlightIndexFinger(landmarks) {
    const indexTip = landmarks[8];

    canvasCtx.beginPath();
    canvasCtx.fillStyle = '#00ff00';
    canvasCtx.arc(
        indexTip.x * canvasElement.width,
        indexTip.y * canvasElement.height,
        12,
        0,
        2 * Math.PI
    );
    canvasCtx.fill();
    
    fingerStatus.textContent = '✅';
}

function detectIndexFingerRotation(landmarks) {
    const indexTip = landmarks[8];
    const currentPos = { x: indexTip.x, y: indexTip.y };
    
    const MIN_MOVEMENT = 0.015;
    
    if (previousAngles.length > 0) {
        const lastPos = previousAngles[previousAngles.length - 1];
        const dx = currentPos.x - lastPos.x;
        const dy = currentPos.y - lastPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < MIN_MOVEMENT) {
            if (!manuallyPaused) {
                gestureTarget = navigationSpeed;
            }
            speedDisplay.textContent = '0°/s';
            rotationVelocity = 0;
            // Update filtered speed even when paused
            if (!filterAnimationFrame) {
                updateFilteredSpeed();
            }
            return;
        }
    }
    
    previousAngles.push(currentPos);
    frameTimestamps.push(Date.now());
    
    if (previousAngles.length > SMOOTHING_WINDOW) {
        previousAngles.shift();
        frameTimestamps.shift();
    }
    
    if (previousAngles.length < 3) return;
    
    let totalAngularVelocity = 0;
    let validSamples = 0;
    
    for (let i = 2; i < previousAngles.length; i++) {
        const p0 = previousAngles[i - 2];
        const p1 = previousAngles[i - 1];
        const p2 = previousAngles[i];
        
        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;
        
        const crossProduct = v1x * v2y - v1y * v2x;
        
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        if (mag1 > 0.01 && mag2 > 0.01) {
            const angularChange = crossProduct / (mag1 * mag2);
            totalAngularVelocity += angularChange;
            validSamples++;
        }
    }
    
    if (validSamples === 0) {
        speedDisplay.textContent = '0°/s';
        rotationVelocity = 0;
        if (!manuallyPaused) {
            gestureTarget = navigationSpeed;
        }
        // Update filtered speed even when paused
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
        return;
    }
    
    const avgAngularVelocity = totalAngularVelocity / validSamples;
    
    rotationHistory.push(avgAngularVelocity);
    if (rotationHistory.length > SPEED_CALCULATION_FRAMES) {
        rotationHistory.shift();
    }
    
    if (frameTimestamps.length >= 2) {
        const timeDiff = (frameTimestamps[frameTimestamps.length - 1] - 
                        frameTimestamps[0]) / 1000;
        
        if (timeDiff > 0) {
            const frameDuration = timeDiff / (frameTimestamps.length - 1);
            rotationVelocity = avgAngularVelocity / frameDuration;
            
            const VELOCITY_SCALE = 1000;
            const displaySpeed = Math.abs(rotationVelocity) * VELOCITY_SCALE;
            speedDisplay.textContent = `${Math.round(displaySpeed)}°/s`;
            
            totalRotation += avgAngularVelocity * 180 / Math.PI;
            angleDisplay.textContent = `${Math.round(totalRotation)}°`;
            
            if (Math.abs(rotationVelocity) > 0.12) {
                lastActiveRotationTime = Date.now();
                if (rotationVelocity < 0) {
                    setRotation('clockwise');
                    setGestureTargetFromRotation(1);
                } else {
                    setRotation('counterclockwise');
                    setGestureTargetFromRotation(-1);
                }
                
                if (!filterAnimationFrame) {
                    updateFilteredSpeed();
                }
            } else {
                if (!manuallyPaused) {
                    gestureTarget = navigationSpeed;
                }
                speedDisplay.textContent = '0°/s';
                rotationVelocity = 0;
                // Update filtered speed even when paused
                if (!filterAnimationFrame) {
                    updateFilteredSpeed();
                }
            }
        }
    }
    
    const recentTrend = rotationHistory.slice(-5).reduce((sum, val) => sum + val, 0);
    const DIRECTION_THRESHOLD = 0.08;
    
    if (Math.abs(recentTrend) > DIRECTION_THRESHOLD) {
        if (recentTrend > 0) {
            setRotation('counterclockwise');
        } else {
            setRotation('clockwise');
        }
    }
}

function setGestureTargetFromRotation(direction) {
    const baseIncrement = 0.05 * params.filtering.gestureAmplitude;
    const maxSpeed = params.navigation.maxSpeed;
    const minSpeed = params.navigation.minSpeed;

    const inDeadZone = rawNavigationSpeed > -1.0 && rawNavigationSpeed < 0.7;
    const speedIncrement = inDeadZone ? baseIncrement * 5 : baseIncrement;

    if (direction > 0) {
        rawNavigationSpeed = Math.min(rawNavigationSpeed + speedIncrement, maxSpeed);
    } else {
        rawNavigationSpeed = Math.max(rawNavigationSpeed - speedIncrement, minSpeed);
    }

    const newNavigationSpeed = applyDeadZoneMapping(rawNavigationSpeed);
    
    if (newNavigationSpeed !== navigationSpeed) {
        navigationSpeed = newNavigationSpeed;
        speedBar.value = navigationSpeed;
        speedValue.textContent = navigationSpeed.toFixed(2);
        gestureTarget = navigationSpeed;
        
        // Auto-start playback only if not manually paused
        if (!isPlaying && !manuallyPaused && audioBuffer) {
            startPlayback();
        }
        
        // Update filtered speed even when paused
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
    }
}

function setGestureTargetForDrift() {
    if (manuallyPaused) return;

    // Set the target for drifting
    if (filteredSpeed > 0) {
        gestureTarget = params.filtering.driftTarget;
    } else {
        gestureTarget = filteredSpeed;
    }
    
    // Snap input slider to current playback speed, then both will drift together
    navigationSpeed = filteredSpeed;
    rawNavigationSpeed = filteredSpeed;
    speedBar.value = navigationSpeed;
    speedValue.textContent = navigationSpeed.toFixed(2);
}

function detectFingerVelocity(landmarks) {
    const indexTip = landmarks[8];
    const currentPos = { x: indexTip.x, y: indexTip.y };
    const currentTime = Date.now();

    previousAngles.push(currentPos);
    frameTimestamps.push(currentTime);

    if (previousAngles.length > 6) {
        previousAngles.shift();
        frameTimestamps.shift();
    }

    if (previousAngles.length < 3) return;

    let signedArea = 0;
    for (let i = 0; i < previousAngles.length - 1; i++) {
        const p1 = previousAngles[i];
        const p2 = previousAngles[i + 1];
        signedArea += (p1.x * p2.y - p2.x * p1.y);
    }
    const pFirst = previousAngles[0];
    const pLast = previousAngles[previousAngles.length - 1];
    signedArea += (pLast.x * pFirst.y - pFirst.x * pLast.y);

    const SMOOTHING_ALPHA = 0.05;
    if (velocityHistory.length === 0) {
        velocityHistory.push(signedArea);
    } else {
        const prevSmoothed = velocityHistory[velocityHistory.length - 1];
        const smoothed = SMOOTHING_ALPHA * signedArea + (1 - SMOOTHING_ALPHA) * prevSmoothed;
        velocityHistory.push(smoothed);
        
        if (velocityHistory.length > 50) {
            velocityHistory.shift();
        }
    }

    const smoothedArea = -velocityHistory[velocityHistory.length - 1];
    const displaySpeed = Math.abs(smoothedArea) * 10000;
    speedDisplay.textContent = `${Math.round(displaySpeed)}°/s`;

    const MIN_ROTATION = 0.001;

    if (Math.abs(smoothedArea) < MIN_ROTATION) {
        if (!manuallyPaused) {
            gestureTarget = 0;
            navigationSpeed = 0;
            speedBar.value = 0;
            speedValue.textContent = '0.00';
        }

        rotationText.textContent = 'Hold Still';
        detectionStatus.style.background = 'rgba(100, 100, 100, 0.7)';
        currentDirection.innerHTML = '<span>⊙</span>';

        // Update filtered speed even when paused
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
    } else {
        if (!manuallyPaused) {
            const rotationVelocity = smoothedArea * 50;
            setGestureTargetFromVelocity(rotationVelocity);
        }

        if (smoothedArea > 0) {
            rotationText.textContent = '↻ Clockwise';
            detectionStatus.style.background = 'rgba(74, 222, 128, 0.7)';
            currentDirection.innerHTML = '<span style="color: #4ade80;">↻</span>';
        } else {
            rotationText.textContent = '↺ Counter-clockwise';
            detectionStatus.style.background = 'rgba(248, 113, 113, 0.7)';
            currentDirection.innerHTML = '<span style="color: #f87171;">↺</span>';
        }

        // Update filtered speed even when paused
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
    }
}

function setGestureTargetFromVelocity(velocity) {
    const VELOCITY_SCALE = 3 * params.filtering.gestureAmplitude;
    const maxSpeed = params.navigation.maxSpeed;
    const minSpeed = params.navigation.minSpeed;

    const targetSpeed = velocity * VELOCITY_SCALE;
    rawNavigationSpeed = clamp(targetSpeed, minSpeed, maxSpeed);

    navigationSpeed = applyDeadZoneMapping(rawNavigationSpeed);

    speedBar.value = navigationSpeed;
    speedValue.textContent = navigationSpeed.toFixed(2);

    gestureTarget = navigationSpeed;
    
    // Update filtered speed even when paused (for slider movement)
    if (!filterAnimationFrame) {
        updateFilteredSpeed();
    }
}

function setRotation(direction) {
    if (currentRotation === direction) return;

    currentRotation = direction;

    if (direction === 'clockwise') {
        rotationText.textContent = '↻ Clockwise';
        detectionStatus.style.background = 'rgba(74, 222, 128, 0.7)';
        currentDirection.innerHTML = '<span style="color: #4ade80;">↻</span>';
    } else if (direction === 'counterclockwise') {
        rotationText.textContent = '↺ Counter-clockwise';
        detectionStatus.style.background = 'rgba(248, 113, 113, 0.7)';
        currentDirection.innerHTML = '<span style="color: #f87171;">↺</span>';
    }
}

function resetRotationState() {
    currentRotation = 'none';
    rotationText.textContent = controlMode === 'distance' ? 'No Rotation' : 'Hold Still';
    detectionStatus.style.background = 'rgba(0, 0, 0, 0.7)';
    currentDirection.innerHTML = '<span>⊙</span>';
    previousAngles = [];
    rotationHistory = [];
    velocityHistory = [];
    frameTimestamps = [];
    totalRotation = 0;
    rotationVelocity = 0;
    fingerVelocity = 0;
    angleDisplay.textContent = '0°';
    speedDisplay.textContent = '0°/s';
    
    playGestureActive = false;
    playGestureRotation = 0;
    playGestureStartTime = 0;
    playGesturePreviousAngles = [];
}

function applyDeadZoneMapping(speed) {
    const DEAD_ZONE_MIN = -1.0;
    const DEAD_ZONE_MAX = 0.7;
    
    if (speed > DEAD_ZONE_MIN && speed < DEAD_ZONE_MAX) {
        return speed >= 0 ? DEAD_ZONE_MAX : DEAD_ZONE_MIN;
    }
    
    return speed;
}

function detectPlayPauseGesture(landmarks) {
    if (!gestureControlEnabled) return;
    
    const currentTime = Date.now();
    if (currentTime - lastGestureToggleTime < gestureDebounceTime) return;
    
    const isPalm = detectOpenPalm(landmarks);
    
    if (isPalm && !lastPalmState) {
        palmHoldStartTime = currentTime;
        isPalmHolding = true;
    } else if (isPalm && isPalmHolding) {
        const holdDuration = currentTime - palmHoldStartTime;
        
        if (holdDuration >= palmHoldDuration && isPlaying) {
            console.log('Gesture: Open palm held - Pausing playback');
            pausePlayback();
            lastGestureToggleTime = currentTime;
            isPalmHolding = false;
        }
    } else if (!isPalm) {
        isPalmHolding = false;
        palmHoldStartTime = 0;
    }
    
    lastPalmState = isPalm;
}

function detectPlayGesture(landmarks) {
    const indexTip = landmarks[8];
    const currentPos = { x: indexTip.x, y: indexTip.y };
    const currentTime = Date.now();
    
    if (!playGestureActive) {
        playGestureActive = true;
        playGestureRotation = 0;
        playGestureStartTime = currentTime;
        playGesturePreviousAngles = [];
        console.log(`[${controlMode}] Play gesture tracking started`);
    }
    
    playGesturePreviousAngles.push(currentPos);
    
    // Keep last 10 positions for better circular detection
    if (playGesturePreviousAngles.length > 10) {
        playGesturePreviousAngles.shift();
    }
    
    // Need at least 3 points to calculate rotation
    if (playGesturePreviousAngles.length >= 3) {
        let frameRotation = 0;
        let totalRotationDirection = 0; // Track if consistently clockwise or counterclockwise
        let validSamples = 0;
        
        // Use the same method as distance mode - calculate cross product of consecutive vectors
        for (let i = 2; i < playGesturePreviousAngles.length; i++) {
            const p0 = playGesturePreviousAngles[i - 2];
            const p1 = playGesturePreviousAngles[i - 1];
            const p2 = playGesturePreviousAngles[i];
            
            const v1x = p1.x - p0.x;
            const v1y = p1.y - p0.y;
            const v2x = p2.x - p1.x;
            const v2y = p2.y - p1.y;
            
            const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
            
            // Only count significant movements
            if (mag1 > 0.01 && mag2 > 0.01) {
                const crossProduct = v1x * v2y - v1y * v2x;
                const angularChange = crossProduct / (mag1 * mag2);
                const angleDegrees = angularChange * 180 / Math.PI; // Keep sign for direction check
                
                // Track direction consistency
                totalRotationDirection += Math.sign(angleDegrees);
                validSamples++;
                
                frameRotation += Math.abs(angleDegrees);
            }
        }
        
        // Check if motion is consistently in one direction (circular)
        // If all movements are in the same direction, validSamples will equal abs(totalRotationDirection)
        const directionConsistency = validSamples > 0 ? Math.abs(totalRotationDirection) / validSamples : 0;
        
        // Only count rotation if motion is consistently circular (>80% in same direction)
        if (directionConsistency > 0.8) {
            playGestureRotation += frameRotation;
            
            if (frameRotation > 5) {
                console.log(`[${controlMode}] Added ${frameRotation.toFixed(1)}° (total: ${playGestureRotation.toFixed(0)}°, consistency: ${(directionConsistency * 100).toFixed(0)}%)`);
            }
        } else {
            // Random movement detected - reset if consistency is too low
            if (frameRotation > 10 && directionConsistency < 0.5) {
                console.log(`[${controlMode}] Non-circular movement detected (consistency: ${(directionConsistency * 100).toFixed(0)}%), resetting`);
                playGestureRotation = 0;
            }
        }
        
        // Log progress every 360 degrees
        const currentFullRotations = Math.floor(playGestureRotation / 360);
        const prevRotations = Math.floor((playGestureRotation - frameRotation) / 360);
        if (currentFullRotations > prevRotations) {
            console.log(`[${controlMode}] Play gesture: ${currentFullRotations} rotation(s) completed (${playGestureRotation.toFixed(0)}°)`);
        }
    }
    
    if (playGestureRotation >= PLAY_GESTURE_THRESHOLD) {
        const gestureTime = currentTime - playGestureStartTime;
        const rotationCount = playGestureRotation / 360;
        
        // Ensure we have at least 2 full rotations
        if (rotationCount >= 2 && gestureTime < 5000) {
            console.log(`[${controlMode}] Gesture: ${rotationCount.toFixed(1)} rotations detected - Starting playback`);
            startPlayback();
            playGestureActive = false;
            playGestureRotation = 0;
            playGesturePreviousAngles = [];
            lastGestureToggleTime = currentTime;
        } else if (gestureTime >= 5000) {
            console.log(`[${controlMode}] Play gesture timeout - took too long (${gestureTime}ms)`);
            playGestureActive = false;
            playGestureRotation = 0;
            playGesturePreviousAngles = [];
        }
    }
    
    if (currentTime - playGestureStartTime > 5000) {
        console.log(`[${controlMode}] Play gesture timeout - resetting (total: ${playGestureRotation.toFixed(0)}°)`);
        playGestureActive = false;
        playGestureRotation = 0;
        playGesturePreviousAngles = [];
    }
}

function detectOpenPalm(landmarks) {
    const palmBase = landmarks[0];
    const wrist = landmarks[0];
    const middleBase = landmarks[9];
    
    const fingerTips = [
        landmarks[4],
        landmarks[8],
        landmarks[12],
        landmarks[16],
        landmarks[20]
    ];
    
    const palmDx = middleBase.x - wrist.x;
    const palmDy = middleBase.y - wrist.y;
    const palmSize = Math.sqrt(palmDx * palmDx + palmDy * palmDy);
    
    let extendedCount = 0;
    const OPEN_PALM_THRESHOLD = palmSize * 1.5;
    
    for (const tip of fingerTips) {
        const dx = tip.x - palmBase.x;
        const dy = tip.y - palmBase.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > OPEN_PALM_THRESHOLD) {
            extendedCount++;
        }
    }
    
    return extendedCount >= 4;
}

function highlightLeftHand(landmarks) {
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    
    const handY = (wrist.y + middleMCP.y) / 2;
    const MIN_Y = 0.2;
    const MAX_Y = 0.8;
    let mappedVolume = 1.0 - ((handY - MIN_Y) / (MAX_Y - MIN_Y));
    mappedVolume = clamp(mappedVolume, 0.0, 1.0);
    
    const centerX = wrist.x * canvasElement.width;
    const centerY = wrist.y * canvasElement.height;
    const radius = 40;
    
    // Save the current context state
    canvasCtx.save();
    
    // Background circle
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    canvasCtx.fill();
    
    // Progress arc
    canvasCtx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (mappedVolume * 2 * Math.PI);
    canvasCtx.arc(centerX, centerY, radius - 5, startAngle, endAngle, false);
    canvasCtx.lineWidth = 8;
    canvasCtx.lineCap = 'round';
    
    // Color based on volume level
    if (mappedVolume > 0.66) {
        canvasCtx.strokeStyle = '#4ade80'; // Green
    } else if (mappedVolume > 0.33) {
        canvasCtx.strokeStyle = '#fbbf24'; // Yellow
    } else {
        canvasCtx.strokeStyle = '#ef4444'; // Red
    }
    canvasCtx.stroke();
    
    // Volume percentage text - flip it to read correctly
    canvasCtx.translate(centerX, centerY); // Move to center
    canvasCtx.scale(-1, 1); // Flip horizontally to un-mirror the text
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = 'bold 20px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(Math.round(mappedVolume * 100) + '%', 0, 0);
    
    // Restore the context state
    canvasCtx.restore();
}

function detectVolumeGesture(landmarks) {
    // Use wrist (0) and middle finger MCP (9) to calculate hand height
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    
    // Calculate average y position (lower y = higher on screen)
    const handY = (wrist.y + middleMCP.y) / 2;
    
    // Smooth the volume over multiple frames
    volumeHistory.push(handY);
    if (volumeHistory.length > VOLUME_SMOOTHING_FRAMES) {
        volumeHistory.shift();
    }
    
    const currentTime = Date.now();
    if (currentTime - lastVolumeUpdateTime < volumeUpdateInterval) {
        return; // Throttle updates
    }
    lastVolumeUpdateTime = currentTime;
    
    // Calculate smoothed position
    const smoothedY = volumeHistory.reduce((sum, val) => sum + val, 0) / volumeHistory.length;
    
    // Map Y position to volume (0.0 to 1.0)
    // Y ranges from 0 (top) to 1 (bottom)
    // We want: top = high volume (1.0), bottom = low volume (0.0)
    const MIN_Y = 0.2;  // Top 20% of screen
    const MAX_Y = 0.8;  // Bottom 80% of screen
    
    let mappedVolume = 1.0 - ((smoothedY - MIN_Y) / (MAX_Y - MIN_Y));
    mappedVolume = clamp(mappedVolume, 0.0, 1.0);
    
    currentVolume = mappedVolume;
    
    // Apply volume to audio elements
    if (htmlAudioElement) {
        htmlAudioElement.volume = currentVolume;
    }
    if (htmlVideoElement) {
        htmlVideoElement.volume = currentVolume;
    }
    
    // Update UI
    updateVolumeDisplay();
}

function updateVolumeDisplay() {
    if (!volumeText || !volumeIcon) return;
    
    const volumePercent = Math.round(currentVolume * 100);
    volumeText.textContent = `${volumePercent}%`;
    
    // Update icon based on volume level
    if (currentVolume === 0) {
        volumeIcon.textContent = '🔇'; // Muted
    } else if (currentVolume < 0.33) {
        volumeIcon.textContent = '🔈'; // Low
    } else if (currentVolume < 0.67) {
        volumeIcon.textContent = '🔉'; // Medium
    } else {
        volumeIcon.textContent = '🔊'; // High
    }
}

// ========== AUDIO PLAYER FUNCTIONS ==========
audioContext = new (window.AudioContext || window.webkitAudioContext)();

speedBar.min = params.navigation.minSpeed;
speedBar.max = params.navigation.maxSpeed;
speedBar.value = navigationSpeed;
speedValue.textContent = navigationSpeed.toFixed(2);

segmentDurationInput.value = params.navigation.segmentDuration;
segmentStepInput.value = params.navigation.segmentStep;
segmentIntervalInput.value = params.navigation.segmentIntervalMs;
fadeDurationInput.value = params.navigation.fadeDuration;
updateEffectiveParams();

/**
 * Load audio from a URL into both the hidden HTML5 audio element
 * (for forward playback) and into an AudioBuffer (for reverse / chunked playback).
 */
async function loadAudioFromUrl(audioUrl, loadingMessage = 'Loading audio...', videoUrl = null) {
    showAudioLoading(loadingMessage);
    let loadingHidden = false;
    
    const ensureLoadingHidden = () => {
        if (!loadingHidden) {
            loadingHidden = true;
            hideAudioLoading();
        }
    };
    
    try {
        stopPlayback();
        audioFileInput.value = '';

        htmlAudioElement.src = audioUrl;
        htmlAudioElement.preservesPitch = true;
        htmlAudioElement.mozPreservesPitch = true;
        htmlAudioElement.webkitPreservesPitch = true;

        // Wait for basic metadata so duration is available for the HTML audio element
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                // Clean up event listeners
                htmlAudioElement.onloadedmetadata = null;
                htmlAudioElement.onerror = null;
                reject(new Error('Audio metadata loading timed out'));
            }, 30000); // 30 second timeout
            
            const cleanup = () => {
                clearTimeout(timeout);
                htmlAudioElement.onloadedmetadata = null;
                htmlAudioElement.onerror = null;
            };
            
            htmlAudioElement.onloadedmetadata = () => {
                cleanup();
                resolve();
            };
            htmlAudioElement.onerror = (e) => {
                cleanup();
                reject(new Error('Audio element failed to load'));
            };
        });

        // Fetch the audio data to decode into an AudioBuffer
        // For blob URLs, we need to fetch them differently
        let arrayBuffer;
        try {
            if (audioUrl.startsWith('blob:')) {
                // For blob URLs, fetch directly
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio data from blob (status ${response.status})`);
                }
                arrayBuffer = await response.arrayBuffer();
            } else {
                // For regular URLs, fetch normally
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio data (status ${response.status})`);
                }
                arrayBuffer = await response.arrayBuffer();
            }
            
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Initialize Howler for smart scrub word playback
            try {
                if (wordHowl) {
                    wordHowl.unload();
                    wordHowl = null;
                }
                if (wordHowlUrl) {
                    URL.revokeObjectURL(wordHowlUrl);
                    wordHowlUrl = null;
                }
                
                // Create blob URL for Howler
                const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                wordHowlUrl = URL.createObjectURL(blob);
                wordHowl = new Howl({
                    src: [wordHowlUrl],
                    html5: false,
                    preload: true,
                    onloaderror: (id, err) => console.error('Howler load error', err),
                    onplayerror: (id, err) => console.error('Howler play error', err)
                });
                
                // Initialize word player pool
                initWordPlayerPool();
                if (wordPlayer) {
                    wordPlayer.src = wordHowlUrl;
                }
                
                console.log('Howler and word player pool initialized for smart scrub');
            } catch (howlerError) {
                console.warn('Failed to initialize Howler (smart scrub may have degraded performance):', howlerError);
            }
        } catch (bufferError) {
            // If AudioBuffer creation fails, but the HTML audio element loaded successfully,
            // we can still use the audio element for playback (forward only)
            console.warn('Failed to create AudioBuffer (reverse playback may not work):', bufferError);
            
            // Use the HTML audio element's duration if available
            if (htmlAudioElement.duration && !isNaN(htmlAudioElement.duration) && htmlAudioElement.duration > 0) {
                // Audio element loaded successfully, continue with it
                // audioBuffer will be null, but forward playback will still work
                audioBuffer = null;
            } else {
                // Can't determine duration, this is a real error
                throw new Error('Failed to load audio: could not determine duration. ' + bufferError.message);
            }
        }

        // Use audioBuffer duration if available, otherwise use HTML audio element duration
        const duration = audioBuffer ? audioBuffer.duration : (htmlAudioElement.duration || 0);
        
        seekBar.max = duration;
        seekBar.value = 0;
        pauseTime = 0;

        durationDisplay.textContent = formatTime(duration);
        currentTimeDisplay.textContent = formatTime(0);

        controls.style.display = 'block';
        stopPlayback();
        
        // Load video if provided
        if (videoUrl && htmlVideoElement && videoContainer) {
            console.log('Loading video into element, URL:', videoUrl);
            try {
                htmlVideoElement.src = videoUrl;
                htmlVideoElement.load();
                
                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        cleanup();
                        reject(new Error('Video loading timed out'));
                    }, 30000);
                    
                    const cleanup = () => {
                        clearTimeout(timeout);
                        htmlVideoElement.onloadedmetadata = null;
                        htmlVideoElement.onerror = null;
                        htmlVideoElement.oncanplay = null;
                    };
                    
                    // Try multiple events to catch when video is ready
                    const onReady = () => {
                        cleanup();
                        console.log('Video ready, duration:', htmlVideoElement.duration);
                        resolve();
                    };
                    
                    htmlVideoElement.onloadedmetadata = onReady;
                    htmlVideoElement.oncanplay = onReady;
                    htmlVideoElement.onerror = (e) => {
                        cleanup();
                        console.error('Video element error:', e, htmlVideoElement.error);
                        reject(new Error('Video failed to load: ' + (htmlVideoElement.error?.message || 'Unknown error')));
                    };
                });
                
                // Show video container
                videoContainer.style.display = 'block';
                console.log('Video container displayed');
                
                // Disable all user interactions with video
                htmlVideoElement.controls = false;
                htmlVideoElement.disablePictureInPicture = true;
                
                // Prevent user from interacting with video
                htmlVideoElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Video is controlled by audio, not user clicks
                }, true);
                
                htmlVideoElement.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, true);
                
                htmlVideoElement.addEventListener('play', (e) => {
                    // Only allow play if audio is playing
                    if (!isPlaying) {
                        htmlVideoElement.pause();
                    }
                });
                
                htmlVideoElement.addEventListener('pause', (e) => {
                    // Only allow pause if audio is paused
                    if (isPlaying && !manuallyPaused) {
                        htmlVideoElement.play().catch(() => {});
                    }
                });
                
                // Sync video with audio
                syncVideoWithAudio();
            } catch (videoError) {
                console.error('Failed to load video (audio will still work):', videoError);
                // Hide video container if video failed to load
                if (videoContainer) {
                    videoContainer.style.display = 'none';
                }
            }
        } else {
            console.log('No video to load:', { videoUrl: !!videoUrl, htmlVideoElement: !!htmlVideoElement, videoContainer: !!videoContainer });
            // Hide video container if no video
            if (videoContainer) {
                videoContainer.style.display = 'none';
            }
        }
        
        // Try to update UI if handleFileLoaded is available (for file uploads)
        // For URLs, this might not be applicable, so wrap in try-catch
        try {
            // Extract filename from URL or use a default
            const urlParts = audioUrl.split('/');
            const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'Audio';
            if (typeof handleFileLoaded === 'function') {
                const duration = audioBuffer ? audioBuffer.duration : (htmlAudioElement.duration || 0);
                handleFileLoaded(fileName, duration);
            }
        } catch (uiError) {
            // Ignore UI update errors - audio is loaded successfully
            console.warn('UI update error (non-critical):', uiError);
        }
        
        // Hide loading indicator on success
        ensureLoadingHidden();
    } catch (error) {
        console.error('Error loading audio from URL:', error);
        // Hide loading indicator before showing error
        ensureLoadingHidden();
        alert('Failed to load audio from the provided URL.');
        throw error;
    } finally {
        // Always hide loading indicator as a final safeguard
        ensureLoadingHidden();
    }
}

audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showAudioLoading('Loading audio file...');

    try {
        stopPlayback();

        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Initialize Howler for smart scrub word playback
        try {
            if (wordHowl) {
                wordHowl.unload();
                wordHowl = null;
            }
            if (wordHowlUrl) {
                URL.revokeObjectURL(wordHowlUrl);
                wordHowlUrl = null;
            }
            
            // Create blob URL for Howler
            const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
            wordHowlUrl = URL.createObjectURL(blob);
            wordHowl = new Howl({
                src: [wordHowlUrl],
                html5: false,
                preload: true,
                onloaderror: (id, err) => console.error('Howler load error', err),
                onplayerror: (id, err) => console.error('Howler play error', err)
            });
            
            // Initialize word player pool
            initWordPlayerPool();
            if (wordPlayer) {
                wordPlayer.src = wordHowlUrl;
            }
            
            console.log('Howler and word player pool initialized for smart scrub');
        } catch (howlerError) {
            console.warn('Failed to initialize Howler (smart scrub may have degraded performance):', howlerError);
        }

        const fileURL = URL.createObjectURL(file);
        htmlAudioElement.src = fileURL;
        htmlAudioElement.preservesPitch = true;
        htmlAudioElement.mozPreservesPitch = true;
        htmlAudioElement.webkitPreservesPitch = true;

        seekBar.max = audioBuffer.duration;
        seekBar.value = 0;
        pauseTime = 0;

        durationDisplay.textContent = formatTime(audioBuffer.duration);
        currentTimeDisplay.textContent = formatTime(0);

        controls.style.display = 'block';
        
        // UPDATE: Use new function
        handleFileLoaded(file.name, audioBuffer.duration);
    } catch (error) {
        console.error('Error loading audio file:', error);
        alert('Failed to load audio file.');
    } finally {
        hideAudioLoading();
        // Reset file input so the same file can be selected again
        audioFileInput.value = '';
    }
});

loadDefaultBtn.addEventListener('click', async () => {
    try {
        const audioUrl = './around-the-world-in-80-days-chapter-10.mp3';
        await loadAudioFromUrl(audioUrl, 'Loading default audio...');
    } catch (error) {
        console.error('Error loading default audio:', error);
        alert('Failed to load default audio file.');
    }
});

if (loadYouTubeBtn && youtubeUrlInput) {
    loadYouTubeBtn.addEventListener('click', async () => {
        const rawUrl = youtubeUrlInput.value.trim();
        if (!rawUrl) {
            alert('Please paste a YouTube link first.');
            return;
        }

        // Basic sanity check – this does NOT validate all valid YouTube URLs
        if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(rawUrl)) {
            if (!confirm('This does not look like a YouTube URL. Try to load it anyway?')) {
                return;
            }
        }

        // Check if backend server is reachable first
        showAudioLoading('Checking backend connection...');
        try {
            const healthController = new AbortController();
            const healthTimeout = setTimeout(() => healthController.abort(), 5000); // 5 second timeout
            
            const healthCheck = await fetch(`${YOUTUBE_AUDIO_API.replace('/api/youtube-audio', '/api/health')}`, {
                method: 'GET',
                signal: healthController.signal
            });
            clearTimeout(healthTimeout);
            
            if (!healthCheck.ok) {
                throw new Error('Backend server is not responding correctly.');
            }
        } catch (healthError) {
            hideAudioLoading();
            if (healthError.name === 'AbortError') {
                alert('Backend server connection timed out. Please make sure:\n1. The server is running (node server.js)\n2. The server is accessible at http://localhost:3000');
            } else {
                alert('Cannot connect to backend server. Please make sure:\n1. The server is running (node server.js)\n2. The server is accessible at http://localhost:3000\n3. CORS is enabled on the server');
            }
            console.error('Backend health check failed:', healthError);
            return;
        }

        showAudioLoading('Fetching audio from YouTube...');

        try {
            stopPlayback();

            const apiUrl = `${YOUTUBE_AUDIO_API}?url=${encodeURIComponent(rawUrl)}`;
            
            // Fetch with timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
            
            let response;
            try {
                response = await fetch(apiUrl, {
                    signal: controller.signal
                });
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('Request timed out. The video might be too long or the server is taking too long to respond.');
                }
                throw new Error(`Network error: ${fetchError.message}. Make sure the backend server is running.`);
            }
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage = `Backend error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            showAudioLoading('Processing audio stream...');

            const contentType = response.headers.get('content-type') || '';
            let audioUrl;

            if (contentType.startsWith('audio/')) {
                try {
                    // Read the streaming response as a blob
                    const blob = await response.blob();
                    
                    // Check if blob is empty or invalid
                    if (blob.size === 0) {
                        throw new Error('Received empty audio stream from server.');
                    }
                    
                    audioUrl = URL.createObjectURL(blob);
                } catch (blobError) {
                    console.error('Error creating blob from stream:', blobError);
                    hideAudioLoading(); // Hide before throwing
                    throw new Error(`Failed to process audio stream: ${blobError.message}. The video might be too large or the stream was interrupted.`);
                }
            } else {
                try {
                    const data = await response.json();
                    if (!data || !data.audioUrl) {
                        hideAudioLoading(); // Hide before throwing
                        throw new Error('Backend did not return an audioUrl field.');
                    }
                    audioUrl = data.audioUrl;
                } catch (jsonError) {
                    console.error('Error parsing JSON response:', jsonError);
                    hideAudioLoading(); // Hide before throwing
                    throw new Error('Backend returned an unexpected response format.');
                }
            }

            // Hide the current loading indicator before loadAudioFromUrl shows its own
            hideAudioLoading();
            
            // Also fetch video in parallel
            showAudioLoading('Fetching video from YouTube...');
            let videoUrl = null;
            try {
                // Note: Server doesn't require API key for video endpoint, but we'll include it for consistency
                const videoApiUrl = `${YOUTUBE_VIDEO_API}?url=${encodeURIComponent(rawUrl)}`;
                console.log('Fetching video from:', videoApiUrl);
                console.log('Video API endpoint:', YOUTUBE_VIDEO_API);
                
                const videoController = new AbortController();
                const videoTimeout = setTimeout(() => {
                    videoController.abort();
                    console.error('Video fetch timed out after 5 minutes');
                }, 300000); // 5 minute timeout
                
                const videoResponse = await fetch(videoApiUrl, {
                    signal: videoController.signal
                });
                clearTimeout(videoTimeout);
                
                console.log('Video response received:', {
                    ok: videoResponse.ok,
                    status: videoResponse.status,
                    statusText: videoResponse.statusText
                });
                
                if (videoResponse.ok) {
                    const videoContentType = videoResponse.headers.get('content-type') || '';
                    console.log('Video content type:', videoContentType);
                    console.log('Video response status:', videoResponse.status);
                    console.log('Video response headers:', Object.fromEntries(videoResponse.headers.entries()));
                    
                    // Accept video content types (mp4, webm, etc.)
                    if (videoContentType.startsWith('video/') || videoContentType.includes('mp4') || videoContentType.includes('webm')) {
                        const videoBlob = await videoResponse.blob();
                        console.log('Video blob size:', videoBlob.size, 'bytes');
                        
                        if (videoBlob.size > 0) {
                            videoUrl = URL.createObjectURL(videoBlob);
                            console.log('Video URL created successfully:', videoUrl);
                        } else {
                            console.error('Video blob is empty - video download may have failed');
                        }
                    } else {
                        console.error('Video response is not a video type. Content-Type:', videoContentType);
                        // Try to read as blob anyway in case content-type is wrong
                        try {
                            const videoBlob = await videoResponse.blob();
                            console.log('Attempting to use response as video blob anyway, size:', videoBlob.size);
                            if (videoBlob.size > 1000) { // At least 1KB
                                videoUrl = URL.createObjectURL(videoBlob);
                                console.log('Video URL created from blob:', videoUrl);
                            }
                        } catch (blobError) {
                            console.error('Failed to create blob from response:', blobError);
                        }
                    }
                } else {
                    const errorText = await videoResponse.text().catch(() => 'Unknown error');
                    console.error('Video fetch failed with status:', videoResponse.status);
                    console.error('Error response:', errorText);
                }
            } catch (videoError) {
                console.error('Error fetching video (continuing with audio only):', videoError);
                console.error('Video error details:', {
                    name: videoError.name,
                    message: videoError.message,
                    stack: videoError.stack
                });
            }
            
            console.log('Final videoUrl value before passing to loadAudioFromUrl:', videoUrl);
            
            // loadAudioFromUrl will handle showing/hiding the loading indicator
            await loadAudioFromUrl(audioUrl, 'Loading YouTube audio...', videoUrl);
        } catch (error) {
            console.error('Error loading YouTube audio:', error);
            
            // Ensure loading indicator is hidden on error
            hideAudioLoading();
            
            let userMessage = 'Failed to load audio from YouTube.';
            if (error.message) {
                userMessage = error.message;
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                userMessage = 'Cannot connect to backend server. Make sure the server is running at http://localhost:3000';
            }
            
            alert(userMessage);
        }
    });
}

speedBar.addEventListener('input', (e) => {
    let newSpeed = clamp(parseFloat(e.target.value), params.navigation.minSpeed, params.navigation.maxSpeed);

    newSpeed = applyDeadZoneMapping(newSpeed);

    navigationSpeed = newSpeed;
    rawNavigationSpeed = newSpeed;
    speedValue.textContent = newSpeed.toFixed(2);

    gestureTarget = newSpeed;
    manuallyPaused = false;

    if (!filterAnimationFrame) {
        updateFilteredSpeed();
    }
});

alphaFingerInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.filtering.alphaFinger = clamp(value, 0.001, 1);
        alphaFingerValue.textContent = params.filtering.alphaFinger.toFixed(3);
        updateAlphaDisplay();
    }
});

alphaNoFingerInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.filtering.alphaNoFinger = clamp(value, 0.0001, 1);
        alphaNoFingerValue.textContent = params.filtering.alphaNoFinger.toFixed(4);
        updateAlphaDisplay();
    }
});

driftTargetInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.filtering.driftTarget = clamp(value, 0.1, 4);
        driftTargetValue.textContent = params.filtering.driftTarget.toFixed(2);
    }
});

amplitudeInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.filtering.gestureAmplitude = clamp(value, 0.1, 5);
        amplitudeValue.textContent = params.filtering.gestureAmplitude.toFixed(2);
    }
});

function updateAlphaDisplay() {
    const currentAlpha = isFingerDetected ? params.filtering.alphaFinger : params.filtering.alphaNoFinger;
    const decimals = currentAlpha < 0.001 ? 4 : 3;
    activeAlphaDisplay.textContent = currentAlpha.toFixed(decimals);
    
    if (isFingerDetected) {
        activeAlphaDisplay.style.color = '#4ade80';
        alphaStateText.textContent = 'Hand detected - Responsive mode';
        alphaStateText.style.color = '#4ade80';
    } else {
        activeAlphaDisplay.style.color = '#f87171';
        alphaStateText.textContent = 'Drifting - Slow mode';
        alphaStateText.style.color = '#f87171';
    }
}

function updateEffectiveParams() {
    const speed = Math.abs(filteredSpeed);
    const effectiveStep = params.navigation.segmentStep * speed;
    const effectiveInterval = (params.navigation.segmentIntervalMs / 1000) / speed;

    effectiveStepDisplay.textContent = effectiveStep.toFixed(2);
    effectiveIntervalDisplay.textContent = (effectiveInterval * 1000).toFixed(0);
}

segmentDurationInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.navigation.segmentDuration = value;
        updateEffectiveParams();
    }
});

segmentStepInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.navigation.segmentStep = value;
        updateEffectiveParams();
    }
});

segmentIntervalInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.navigation.segmentIntervalMs = value;
        updateEffectiveParams();
    }
});

fadeDurationInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
        params.navigation.fadeDuration = value;
    }
});

function updateFilteredSpeed() {
    if (controlMode === 'touch') {
        filteredSpeed = navigationSpeed;
        filteredSpeedBar.value = filteredSpeed;
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        
        if (isPlaying) {
            if ((prevNavigationSpeed < 0 && filteredSpeed >= 0) || 
                (prevNavigationSpeed >= 0 && filteredSpeed < 0)) {
                const currentPos = parseFloat(seekBar.value);
                pauseTime = currentPos;
                
                activeSources.forEach((source) => {
                    try { source.stop(); } catch (e) {}
                });
                activeSources.clear();
                if (scheduleTimeout) {
                    clearTimeout(scheduleTimeout);
                    scheduleTimeout = null;
                }
                htmlAudioElement.pause();
                
                prevNavigationSpeed = filteredSpeed;
                
                if (filteredSpeed < 0) {
                    playReverseChunk(pauseTime);
                } else {
                    playForwardNormal(pauseTime);
                }
            } else {
                applyFilteredSpeed();
                prevNavigationSpeed = filteredSpeed;
            }
        }
        return;
    }
    if (manuallyPaused) {
        if (filterAnimationFrame) {
            cancelAnimationFrame(filterAnimationFrame);
            filterAnimationFrame = null;
        }
        return;
    }

    const alpha = isFingerDetected ? params.filtering.alphaFinger : params.filtering.alphaNoFinger;
    updateAlphaDisplay();

    const previousTargetSign = Math.sign(previousGestureTarget);
    const currentTargetSign = Math.sign(gestureTarget);
    const targetCrossedDeadZone = (previousTargetSign !== 0 && currentTargetSign !== 0 && previousTargetSign !== currentTargetSign);
    
    // Check if this is a drift-to-target scenario (when finger is removed)
    const isDriftingToTarget = !isFingerDetected && gestureTarget === params.filtering.driftTarget;
    
    // Only treat as "jump" if it's an actual gesture change, not drifting
    const targetJumped = !isDriftingToTarget && Math.abs(gestureTarget - previousGestureTarget) > 1.5;
    
    if (targetCrossedDeadZone || targetJumped) {
        filteredSpeed = gestureTarget;
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        filteredSpeedBar.value = filteredSpeed;
        
        if (isPlaying) {
            const currentPos = parseFloat(seekBar.value);
            pauseTime = currentPos;
            
            activeSources.forEach((source) => {
                try { source.stop(); } catch (e) {}
            });
            activeSources.clear();
            if (scheduleTimeout) {
                clearTimeout(scheduleTimeout);
                scheduleTimeout = null;
            }
            htmlAudioElement.pause();
            
            prevNavigationSpeed = filteredSpeed;
            
            if (filteredSpeed < 0) {
                playReverseChunk(pauseTime);
            } else {
                playForwardNormal(pauseTime);
            }
        }
        
        previousGestureTarget = gestureTarget;
        
        if (filterAnimationFrame) {
            cancelAnimationFrame(filterAnimationFrame);
            filterAnimationFrame = null;
        }
        return;
    }
    
    const prevFilteredSpeed = filteredSpeed;
    filteredSpeed = filteredSpeed - alpha * (filteredSpeed - gestureTarget);
    
    const DEAD_ZONE_MIN = -1.0;
    const DEAD_ZONE_MAX = 0.7;
    let crossedDeadZone = false;
    if (filteredSpeed > DEAD_ZONE_MIN && filteredSpeed < DEAD_ZONE_MAX) {
        if (gestureTarget >= DEAD_ZONE_MAX) {
            filteredSpeed = DEAD_ZONE_MAX;
            crossedDeadZone = (prevFilteredSpeed < 0);
        } else if (gestureTarget <= DEAD_ZONE_MIN) {
            filteredSpeed = DEAD_ZONE_MIN;
            crossedDeadZone = (prevFilteredSpeed > 0);
        }
    }
    
    filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
    filteredSpeedBar.value = filteredSpeed;
    
    // If drifting (no finger detected), update input slider to match playback slider
    if (!isFingerDetected && !manuallyPaused) {
        navigationSpeed = filteredSpeed;
        speedBar.value = navigationSpeed;
        speedValue.textContent = navigationSpeed.toFixed(2);
    }
    
    if (crossedDeadZone && isPlaying) {
        const currentPos = parseFloat(seekBar.value);
        pauseTime = currentPos;
        
        activeSources.forEach((source) => {
            try { source.stop(); } catch (e) {}
        });
        activeSources.clear();
        if (scheduleTimeout) {
            clearTimeout(scheduleTimeout);
            scheduleTimeout = null;
        }
        htmlAudioElement.pause();
        
        prevNavigationSpeed = filteredSpeed;
        
        if (filteredSpeed < 0) {
            playReverseChunk(pauseTime);
        } else {
            playForwardNormal(pauseTime);
        }
    }
    
    if (isPlaying) {
        applyFilteredSpeed();
    }

    previousGestureTarget = gestureTarget;

    // Smart Scrub threshold checking
    if (smartScrubEnabled && isPlaying && !manuallyPaused && informativeWords.length > 0) {
        const absSpeed = Math.abs(filteredSpeed);
        const isForward = filteredSpeed >= 0;
        
        if (isForward && absSpeed > scrubStartSpeed && !smartScrubActive) {
            // Forward speed crossed threshold - activate smart scrub
            console.log('Activating forward smart scrub at speed:', filteredSpeed.toFixed(2));
            recalcInformative(true);
            startSmartScrub();
        } else if (!isForward && absSpeed > bwScrubStartSpeed && !smartScrubActive) {
            // Backward speed crossed threshold - activate smart scrub
            console.log('Activating backward smart scrub at speed:', filteredSpeed.toFixed(2));
            recalcInformative(true);
            startSmartScrub(); // Use same function, it handles reverse via filteredSpeed sign
        } else if (isForward && absSpeed <= scrubStartSpeed && smartScrubActive) {
            // Forward speed dropped below threshold - deactivate
            console.log('Deactivating forward smart scrub at speed:', filteredSpeed.toFixed(2));
            stopSmartScrub();
        } else if (!isForward && absSpeed <= bwScrubStartSpeed && smartScrubActive) {
            // Backward speed dropped below threshold - deactivate
            console.log('Deactivating backward smart scrub at speed:', filteredSpeed.toFixed(2));
            stopSmartScrub();
        }
    }

    const diff = Math.abs(gestureTarget - filteredSpeed);
    if (diff > 0.001) {
        filterAnimationFrame = requestAnimationFrame(updateFilteredSpeed);
    } else {
        filteredSpeed = gestureTarget;
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        filteredSpeedBar.value = filteredSpeed;
        if (isPlaying) {
            applyFilteredSpeed();
        }
        filterAnimationFrame = null;
    }
}

// Function to sync video with audio
function syncVideoWithAudio() {
    if (!htmlVideoElement || !htmlAudioElement) return;
    
    try {
        // Sync playback rate
        if (!htmlAudioElement.paused) {
            const targetPlaybackRate = Math.abs(filteredSpeed);
            const safePlaybackRate = clamp(targetPlaybackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE);
            htmlVideoElement.playbackRate = safePlaybackRate;
        }
        
        // Sync position (with small tolerance to avoid constant updates)
        const timeDiff = Math.abs(htmlVideoElement.currentTime - htmlAudioElement.currentTime);
        if (timeDiff > 0.1) {
            htmlVideoElement.currentTime = htmlAudioElement.currentTime;
        }
    } catch (error) {
        // Ignore sync errors
        console.warn('Video sync error:', error);
    }
}

function applyFilteredSpeed() {
    if (!isPlaying) return;

    if (filteredSpeed > 0 && htmlAudioElement && !htmlAudioElement.paused) {
        const targetPlaybackRate = Math.abs(filteredSpeed);
        const safePlaybackRate = clamp(targetPlaybackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE);
        htmlAudioElement.playbackRate = safePlaybackRate;
        
        // Sync video playback rate
        if (htmlVideoElement && !htmlVideoElement.paused) {
            htmlVideoElement.playbackRate = safePlaybackRate;
        }
    }

    updateEffectiveParams();
}

seekBar.addEventListener('input', (e) => {
    const newTime = parseFloat(e.target.value);
    pauseTime = newTime;
    currentTimeDisplay.textContent = formatTime(newTime);
    
    // Sync video position when seeking
    if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
        htmlVideoElement.currentTime = newTime;
    }
    
    if (isPlaying) {
        stopPlayback();
        setTimeout(() => startPlayback(), 100);
    }
});

playBtn.addEventListener('click', startPlayback);
pauseBtn.addEventListener('click', pausePlayback);

resetBtn.addEventListener('click', () => {
    stopPlayback();
    manuallyPaused = false;

    if (navigationSpeed < 0) {
        pauseTime = audioBuffer.duration;
        seekBar.value = audioBuffer.duration;
        currentTimeDisplay.textContent = formatTime(audioBuffer.duration);
    } else {
        pauseTime = 0;
        seekBar.value = 0;
        currentTimeDisplay.textContent = formatTime(0);
    }
});

function playForwardNormal(startPosition) {
    if (!audioBuffer || !isPlaying) return;

    htmlAudioElement.currentTime = startPosition;
    htmlAudioElement.playbackRate = Math.abs(filteredSpeed);
    htmlAudioElement.play();
    
    // Sync video
    if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
        htmlVideoElement.currentTime = startPosition;
        htmlVideoElement.playbackRate = Math.abs(filteredSpeed);
        htmlVideoElement.play().catch(err => {
            console.warn('Video play error:', err);
        });
    }

    htmlAudioElement.onended = () => {
        if (isPlaying) {
            stopPlayback();
            pauseTime = audioBuffer.duration;
            seekBar.value = audioBuffer.duration;
            currentTimeDisplay.textContent = formatTime(audioBuffer.duration);
            playBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
        }
    };

    updateForwardTimeDisplay();
}

function updateForwardTimeDisplay() {
    if (animationFrame) {
        clearTimeout(animationFrame);
        animationFrame = null;
    }

    const updateInterval = 50;
    const update = () => {
        if (!isPlaying || navigationSpeed < 0) return;

        const currentPos = htmlAudioElement.currentTime;
        seekBar.value = currentPos;
        currentTimeDisplay.textContent = formatTime(currentPos);
        
        // Sync video position
        if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
            try {
                const timeDiff = Math.abs(htmlVideoElement.currentTime - currentPos);
                if (timeDiff > 0.1) {
                    htmlVideoElement.currentTime = currentPos;
                }
            } catch (e) {
                // Ignore sync errors
            }
        }

        if (currentPos < audioBuffer.duration) {
            animationFrame = setTimeout(update, updateInterval);
        }
    };

    update();
}

function playReverseChunk(chunkEnd) {
    if (!audioBuffer || !isPlaying) return;

    const { segmentDuration, segmentStep, segmentIntervalMs, maxActiveSources, fadeDuration } = params.navigation;
    const chunkStart = Math.max(0, chunkEnd - segmentDuration);
    const chunkDuration = chunkEnd - chunkStart;
    const overlapSeconds = Math.max(segmentDuration - segmentStep, 0);
    const effectiveFade = Math.min(fadeDuration, overlapSeconds / 2, chunkDuration / 2);

    if (chunkDuration <= 0 || chunkEnd <= 0) {
        stopPlayback();
        pauseTime = 0;
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        return;
    }

    const startSample = Math.floor(chunkStart * audioBuffer.sampleRate);
    const endSample = Math.floor(chunkEnd * audioBuffer.sampleRate);
    const lengthSamples = Math.max(1, endSample - startSample);

    const chunkBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        lengthSamples,
        audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const chunkData = chunkBuffer.getChannelData(channel);

        const copyLength = Math.min(lengthSamples, originalData.length - startSample);
        for (let i = 0; i < copyLength; i++) {
            chunkData[i] = originalData[startSample + i];
        }

        const fadeSamples = Math.min(Math.floor(effectiveFade * audioBuffer.sampleRate), copyLength);
        if (fadeSamples > 1) {
            for (let i = 0; i < fadeSamples; i++) {
                const fadeProgress = (i + 1) / fadeSamples;
                const fadeInGain = Math.sin(fadeProgress * (Math.PI / 2));
                chunkData[i] *= fadeInGain;
                const fadeOutIndex = copyLength - 1 - i;
                if (fadeOutIndex >= 0 && fadeOutIndex < copyLength) {
                    const fadeOutProgress = (i + 1) / fadeSamples;
                    const fadeOutGain = Math.sin((1 - fadeOutProgress) * (Math.PI / 2));
                    chunkData[fadeOutIndex] *= Math.max(fadeOutGain, 0);
                }
            }
        }
    }

    const source = audioContext.createBufferSource();
    source.buffer = chunkBuffer;
    source.playbackRate.value = params.playback.speed;
    source.connect(audioContext.destination);

    currentSource = source;
    startTime = audioContext.currentTime;
    pauseTime = chunkStart;

    source.onended = () => {
        activeSources.delete(source);
    };
    activeSources.add(source);
    enforceMaxActiveSources(maxActiveSources);

    source.start(0);

    // Sync video to play the same chunk forward
    if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
        try {
            // Jump video to chunk start and play forward
            htmlVideoElement.currentTime = chunkStart;
            htmlVideoElement.playbackRate = params.playback.speed;
            htmlVideoElement.play().catch(err => {
                console.warn('Video play error in reverse chunk:', err);
            });
        } catch (e) {
            console.warn('Video sync error in reverse chunk:', e);
        }
    }

    updateChunkTimeDisplay(chunkStart, chunkEnd);

    const effectiveStep = segmentStep * Math.abs(filteredSpeed);
    const effectiveInterval = (segmentIntervalMs / 1000) / Math.abs(filteredSpeed);
    scheduleTimeout = setTimeout(() => {
        const nextPosition = Math.max(0, chunkEnd - effectiveStep);
        if (nextPosition <= 0) {
            stopPlayback();
            pauseTime = 0;
            seekBar.value = 0;
            currentTimeDisplay.textContent = formatTime(0);
            playBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            return;
        }
        playReverseChunk(nextPosition);
    }, effectiveInterval * 1000);
}

function updateChunkTimeDisplay(chunkStart, chunkEnd) {
    if (animationFrame) {
        clearTimeout(animationFrame);
        animationFrame = null;
    }
    const updateInterval = 50;
    const update = () => {
        if (!isPlaying) return;

        const elapsed = (audioContext.currentTime - startTime) * params.playback.speed;
        const currentPos = clamp(chunkStart + elapsed, 0, chunkEnd);

        seekBar.value = currentPos;
        currentTimeDisplay.textContent = formatTime(currentPos);
        
        // Sync video position to match the chunk playback
        if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
            try {
                const timeDiff = Math.abs(htmlVideoElement.currentTime - currentPos);
                if (timeDiff > 0.1) {
                    htmlVideoElement.currentTime = currentPos;
                }
                // Ensure video is playing at the correct speed
                if (htmlVideoElement.paused) {
                    htmlVideoElement.play().catch(() => {});
                }
                htmlVideoElement.playbackRate = params.playback.speed;
            } catch (e) {
                // Ignore sync errors
            }
        }

        if (currentPos > chunkStart && currentPos < chunkEnd) {
            animationFrame = setTimeout(update, updateInterval);
        }
    };

    update();
}

function startPlayback() {
    if (!audioBuffer) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    manuallyPaused = false;

    if (Math.abs(filteredSpeed) < 0.1) {
        const direction = Math.sign(navigationSpeed) || 1;
        filteredSpeed = direction * 0.5;
        navigationSpeed = filteredSpeed;
        rawNavigationSpeed = filteredSpeed;
        gestureTarget = filteredSpeed;
        speedValue.textContent = navigationSpeed.toFixed(2);
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        speedBar.value = navigationSpeed;
        filteredSpeedBar.value = filteredSpeed;
    }

    if (pauseTime <= 0 && filteredSpeed < 0) {
        filteredSpeed = Math.abs(filteredSpeed);
        navigationSpeed = filteredSpeed;
        rawNavigationSpeed = filteredSpeed;
        gestureTarget = filteredSpeed;
        speedValue.textContent = navigationSpeed.toFixed(2);
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        speedBar.value = navigationSpeed;
        filteredSpeedBar.value = filteredSpeed;
    }

    if (pauseTime >= audioBuffer.duration && filteredSpeed > 0) {
        pauseTime = 0;
        seekBar.value = 0;
        currentTimeDisplay.textContent = formatTime(0);
    }

    if (pauseTime <= 0 && filteredSpeed < 0) {
        pauseTime = audioBuffer.duration;
        seekBar.value = audioBuffer.duration;
        currentTimeDisplay.textContent = formatTime(audioBuffer.duration);
    }

    isPlaying = true;
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    prevNavigationSpeed = filteredSpeed;

    if (filteredSpeed < 0) {
        playReverseChunk(pauseTime);
    } else {
        playForwardNormal(pauseTime);
    }
}

function pausePlayback() {
    console.log(`[${controlMode}] pausePlayback called - setting manuallyPaused = true`);
    manuallyPaused = true;

    if (navigationSpeed > 0 && htmlAudioElement.currentTime > 0) {
        pauseTime = htmlAudioElement.currentTime;
    } else {
        pauseTime = parseFloat(seekBar.value);
    }

    stopPlayback();

    if (smartScrubActive) {
        stopSmartScrub();
    }
    
    // Pause video
    if (htmlVideoElement && videoContainer && videoContainer.style.display !== 'none') {
        htmlVideoElement.pause();
    }
    
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
}

function stopPlayback() {
    isPlaying = false;

    htmlAudioElement.pause();
    
    // Pause video
    if (htmlVideoElement) {
        htmlVideoElement.pause();
    }

    activeSources.forEach((source) => {
        try {
            source.stop();
        } catch (e) {}
    });
    activeSources.clear();
    currentSource = null;

    if (animationFrame) {
        clearTimeout(animationFrame);
        animationFrame = null;
    }

    if (scheduleTimeout) {
        clearTimeout(scheduleTimeout);
        scheduleTimeout = null;
    }

    if (speedSmoothingHandle) {
        cancelAnimationFrame(speedSmoothingHandle);
        speedSmoothingHandle = null;
    }

    if (filterAnimationFrame) {
        cancelAnimationFrame(filterAnimationFrame);
        filterAnimationFrame = null;
    }
}

function formatTime(time) {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function updateTargetNavigationSpeed(target) {
    target = clamp(target, params.navigation.minSpeed, params.navigation.maxSpeed);
    
    speedBar.value = target;
    navigationSpeed = target;
    speedValue.textContent = navigationSpeed.toFixed(2);
    speedState.target = target;
    
    gestureTarget = target;

    if (!filterAnimationFrame) {
        updateFilteredSpeed();
    }

    if (!isPlaying) {
        filteredSpeed = target;
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        filteredSpeedBar.value = filteredSpeed;
        speedState.current = target;
        speedState.velocity = 0;
        speedState.boost = 0;
        
        if (filterAnimationFrame) {
            cancelAnimationFrame(filterAnimationFrame);
            filterAnimationFrame = null;
        }
    }
}

function enforceMaxActiveSources(limit) {
    while (activeSources.size > limit) {
        const oldest = activeSources.values().next().value;
        if (!oldest) break;
        activeSources.delete(oldest);
        try {
            oldest.stop();
        } catch (e) {}
    }
}

distanceModeRadio.addEventListener('change', () => {
    if (distanceModeRadio.checked) {
        controlMode = 'distance';
        resetRotationState();
        
        handSection.style.display = 'block';
        const touchSection = document.getElementById('touchControlSection');
        if (touchSection) touchSection.style.display = 'none';
        
        restartCamera();
        
        if (typeof TouchControl !== 'undefined') {
            TouchControl.disable();
        }
        
        velocityHistory = [];
        fingerVelocity = 0;
    }
});

speedModeRadio.addEventListener('change', () => {
    if (speedModeRadio.checked) {
        controlMode = 'speed';
        resetRotationState();
        
        handSection.style.display = 'block';
        const touchSection = document.getElementById('touchControlSection');
        if (touchSection) touchSection.style.display = 'none';
        
        restartCamera();
        
        if (typeof TouchControl !== 'undefined') {
            TouchControl.disable();
        }
        
        velocityHistory = [];
        fingerVelocity = 0;
    }
});

if (touchModeRadio) {
    touchModeRadio.addEventListener('change', () => {
        if (touchModeRadio.checked) {
            controlMode = 'touch';
            resetRotationState();
            
            handSection.style.display = 'none';
            const touchSection = document.getElementById('touchControlSection');
            if (touchSection) touchSection.style.display = 'block';
            
            stopCamera();
            
            if (typeof TouchControl !== 'undefined') {
                TouchControl.init(mainScriptAPI);
            } else {
                console.warn('TouchControl module not loaded');
            }
        }
    });
}

window.addEventListener('load', () => {
    setTimeout(() => {
        if (controlMode !== 'touch') {
            initializeHands();
        }
        
        if (typeof TouchControl !== 'undefined' && touchModeRadio && touchModeRadio.checked) {
            TouchControl.init(mainScriptAPI);
        }
    }, 1000);
});

function handleFileLoaded(fileName, duration) {
    updateAudioInfoDisplay(fileName, duration);
    
    if (fileUploadModal) {
        fileUploadModal.classList.remove('active');
    }
    
    if (window.innerWidth <= 768) {
        if (uploadSection) {
            uploadSection.classList.add('file-loaded');
            uploadSection.style.display = 'none';
        }
        if (fileUploadBtn) {
            fileUploadBtn.classList.add('show');
        }
    }
    
    enableTranscription();
    initWordPlayerPool();
    
    // Initialize Howler for smooth word playback
    try {
        if (wordHowl) {
            wordHowl.unload();
            wordHowl = null;
        }
        if (wordHowlUrl) {
            URL.revokeObjectURL(wordHowlUrl);
            wordHowlUrl = null;
        }
        
        wordHowlUrl = htmlAudioElement.src;
        wordHowl = new Howl({
            src: [wordHowlUrl],
            html5: false,
            preload: true,
            onloaderror: (id, err) => console.error('Howler load error', err),
            onplayerror: (id, err) => console.error('Howler play error', err)
        });
        
        // Sync word players to same source
        wordPlayers.forEach(p => { p.src = wordHowlUrl; });
        
        console.log('Word playback initialized (Howler + audio pool)');
    } catch (e) {
        console.error('Failed to init word playback:', e);
    }
}


// ========== SETTINGS MODAL ==========
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const modalParametersContainer = document.getElementById('modalParametersContainer');


// Fullscreen toggle
const fullscreenToggle = document.getElementById('fullscreenToggle');
const fullscreenIcon = document.getElementById('fullscreenIcon');
const touchControlSection = document.getElementById('touchControlSection');

if (fullscreenToggle && touchControlSection) {
    fullscreenToggle.addEventListener('click', () => {
        touchControlSection.classList.toggle('fullscreen');
        
        // Update icon
        if (touchControlSection.classList.contains('fullscreen')) {
            fullscreenIcon.textContent = '⛶'; // Exit fullscreen icon (or use ✕)
        } else {
            fullscreenIcon.textContent = '⛶'; // Enter fullscreen icon
        }
    });
}

// Function to move parameters to modal
function updateModalParameters() {
    console.log('Control mode:', controlMode);
    
    modalParametersContainer.innerHTML = '';
    
    // Create a wrapper for better organization
    const wrapper = document.createElement('div');
    
    if (controlMode === 'touch') {
        // TOUCH MODE PARAMETERS
        const touchSection = document.createElement('div');
        touchSection.className = 'settings-section';
        touchSection.innerHTML = '<h3>Touch Mode Parameters</h3>';
        
        // Get ALL touch parameter groups
        const touchControlSection = document.getElementById('touchControlSection');
        if (touchControlSection) {
            const allTouchParams = touchControlSection.querySelectorAll('.touch-parameter-group');
            const speedDecayGroup = touchControlSection.querySelector('#speed-decay-group');
            
            console.log('Found touch parameter groups:', allTouchParams.length);
            
            // Clone each parameter group
            allTouchParams.forEach((group) => {
                const clone = group.cloneNode(true);
                clone.style.display = 'block';
                clone.style.opacity = '1';
                clone.style.pointerEvents = 'auto';
                
                // Sync all input values
                const inputs = clone.querySelectorAll('input');
                inputs.forEach(input => {
                    const originalInput = document.getElementById(input.id);
                    if (originalInput) {
                        input.value = originalInput.value;
                        
                        // Add event listener to sync back
                        input.addEventListener('input', (e) => {
                            originalInput.value = e.target.value;
                            originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                        });
                    }
                });
                
                touchSection.appendChild(clone);
            });
            
            // Add speed decay slider if in scroll mode
            if (speedDecayGroup && typeof TouchControl !== 'undefined' && TouchControl.inputMode === 'scroll') {
                const clone = speedDecayGroup.cloneNode(true);
                clone.style.display = 'block';
                
                const slider = clone.querySelector('#speed-decay-display');
                const label = clone.querySelector('#speed-decay-label');
                if (slider && TouchControl.speedDecaySlider) {
                    slider.value = TouchControl.speedDecaySlider.value;
                }
                if (label && TouchControl.speedDecayLabel) {
                    label.textContent = TouchControl.speedDecayLabel.textContent;
                }
                
                touchSection.appendChild(clone);
            }
        }
        
        wrapper.appendChild(touchSection);
        
    } else {
        // HAND GESTURE MODE PARAMETERS (distance or speed mode)
        
        // Alpha Section
        const alphaSection = document.querySelector('.alpha-section');
        if (alphaSection) {
            const clone = alphaSection.cloneNode(true);
            clone.style.display = 'block';
            clone.classList.add('settings-section');
            
            // Sync all inputs
            const inputs = clone.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                const originalInput = document.getElementById(input.id);
                if (originalInput) {
                    input.value = originalInput.value;
                    input.addEventListener('input', (e) => {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                }
            });
            
            wrapper.appendChild(clone);
        }
        
        // Navigation Parameters Section
        const paramsSection = document.querySelector('.params-section');
        if (paramsSection) {
            const clone = paramsSection.cloneNode(true);
            clone.style.display = 'block';
            clone.classList.add('settings-section');
            
            // Sync all inputs
            const inputs = clone.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                const originalInput = document.getElementById(input.id);
                if (originalInput) {
                    input.value = originalInput.value;
                    input.addEventListener('input', (e) => {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                }
            });
            
            wrapper.appendChild(clone);
        }
    }
    
    // If nothing was added, show a message
    if (wrapper.children.length === 0) {
        wrapper.innerHTML = '<p style="text-align: center; opacity: 0.7; padding: 20px;">No parameters available for this mode.</p>';
    }
    
    modalParametersContainer.appendChild(wrapper);
}

// Open modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        updateModalParameters();
        settingsModal.classList.add('active');
    });
}

// Close modal
if (closeSettings) {
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });
}

// Close on outside click
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (settingsModal && settingsModal.classList.contains('active')) {
            settingsModal.classList.remove('active');
        }
        if (fileUploadModal && fileUploadModal.classList.contains('active')) {
            fileUploadModal.classList.remove('active');
        }
    }
});

// Update modal when control mode changes
if (distanceModeRadio) distanceModeRadio.addEventListener('change', updateModalParameters);
if (speedModeRadio) speedModeRadio.addEventListener('change', updateModalParameters);
if (touchModeRadio) touchModeRadio.addEventListener('change', updateModalParameters);

// ========== FILE UPLOAD MODAL ==========
const fileUploadBtn = document.getElementById('fileUploadBtn');
const fileUploadModal = document.getElementById('fileUploadModal');
const closeFileUpload = document.getElementById('closeFileUpload');
const currentAudioInfo = document.getElementById('currentAudioInfo');
const audioFileName = document.getElementById('audioFileName');
const audioDuration = document.getElementById('audioDuration');
const uploadSection = document.querySelector('.audio-section .upload-section'); // FIX: Target the main upload section

// Function to update audio info display
function updateAudioInfoDisplay(fileName, duration) {
    if (currentAudioInfo && audioFileName && audioDuration) {
        audioFileName.textContent = `File: ${fileName}`;
        audioDuration.textContent = `Duration: ${formatTime(duration)}`;
        currentAudioInfo.style.display = 'block';
    }
}

// Open file upload modal
if (fileUploadBtn) {
    fileUploadBtn.addEventListener('click', () => {
        fileUploadModal.classList.add('active');
    });
}

// Close file upload modal
if (closeFileUpload) {
    closeFileUpload.addEventListener('click', () => {
        fileUploadModal.classList.remove('active');
    });
}

// Close on outside click
if (fileUploadModal) {
    fileUploadModal.addEventListener('click', (e) => {
        if (e.target === fileUploadModal) {
            fileUploadModal.classList.remove('active');
        }
    });
}

// Close on Escape key (update existing listener)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (settingsModal && settingsModal.classList.contains('active')) {
            settingsModal.classList.remove('active');
        }
        if (fileUploadModal && fileUploadModal.classList.contains('active')) {
            fileUploadModal.classList.remove('active');
        }
    }
});

// UPDATE: audioFileInput listener
audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    stopPlayback();

    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const fileURL = URL.createObjectURL(file);
    htmlAudioElement.src = fileURL;
    htmlAudioElement.preservesPitch = true;
    htmlAudioElement.mozPreservesPitch = true;
    htmlAudioElement.webkitPreservesPitch = true;

    seekBar.max = audioBuffer.duration;
    seekBar.value = 0;
    pauseTime = 0;

    durationDisplay.textContent = formatTime(audioBuffer.duration);
    currentTimeDisplay.textContent = formatTime(0);

    controls.style.display = 'block';
    
    handleFileLoaded(file.name, audioBuffer.duration);
});

// ADD: Handle window resize - restore proper state
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        // Desktop: always show upload section, hide button
        if (uploadSection) {
            uploadSection.classList.remove('file-loaded');
            uploadSection.style.display = ''; // Reset to default
        }
        if (fileUploadBtn) {
            fileUploadBtn.classList.remove('show');
        }
    } else {
        // Mobile: restore state if file was loaded
        if (audioBuffer) {
            if (uploadSection) {
                uploadSection.classList.add('file-loaded');
                uploadSection.style.display = 'none'; // FIX: Hide on mobile
            }
            if (fileUploadBtn) {
                fileUploadBtn.classList.add('show');
            }
        }
    }
});