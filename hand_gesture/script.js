// ========== HAND RECOGNITION VARIABLES ==========
const SMOOTHING_WINDOW = 5;
const SPEED_CALCULATION_FRAMES = 10;

// Global state for face recognition to check camera status
window.HandCameraState = { isStarted: false };

let hands, camera;
let primaryHand = null;
let secondaryHand = null;
let primaryHandId = null;
let secondaryHandId = null;
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
let playGesturePreviousAngles = [];
const PLAY_GESTURE_THRESHOLD = 720;

// Volume control variables
let currentVolume = 1.0;
let volumeGestureActive = false;
const VOLUME_CHANGE_RATE = 0.02;

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
const audioLoadingIndicator = document.getElementById('audioLoadingIndicator');

// DOM elements for volume control
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
        touchAlpha: 0.01, 
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

// ========== HOWLER SCRUBBING VARIABLES ==========
let scrubHowl = null;
let scrubHowlUrl = null;
let isScrubbing = false;
let scrubSoundId = null;

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

const SMART_SCRUB_SPEED_THRESHOLD = 2.0;
const WORD_OVERLAP_MS = 100;
let wordHowl = null;
let wordHowlUrl = null;

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
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        console.log("MediaPipe Hands initialized, starting camera...");

        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility failed to load.');
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });

        await camera.start();
        camera.isStarted = true;
        window.HandCameraState.isStarted = true;
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
        window.HandCameraState.isStarted = false;
        console.log("Camera stopped");
    }
}

async function restartCamera() {
    if (!camera || camera.isStarted) return;
    
    try {
        await camera.start();
        camera.isStarted = true;
        window.HandCameraState.isStarted = true;
        console.log("Camera restarted");
    } catch (error) {
        console.error('Error restarting camera:', error);
        showError(`Failed to restart camera: ${error.message}`);
    }
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

    let currentHands = [];
    
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const handedness = results.multiHandedness[i].label;
            const landmarks = results.multiHandLandmarks[i];
            const handId = handedness;
            
            currentHands.push({ id: handId, landmarks: landmarks });
        }
    }
    
    if (currentHands.length === 0) {
        primaryHand = null;
        secondaryHand = null;
        primaryHandId = null;
        secondaryHandId = null;
    } else if (currentHands.length === 1) {
        const detectedHand = currentHands[0];
        
        if (primaryHandId === null) {
            primaryHandId = detectedHand.id;
            primaryHand = detectedHand.landmarks;
            secondaryHand = null;
            secondaryHandId = null;
        } else if (detectedHand.id === primaryHandId) {
            primaryHand = detectedHand.landmarks;
            secondaryHand = null;
            secondaryHandId = null;
        } else if (detectedHand.id === secondaryHandId) {
            secondaryHand = detectedHand.landmarks;
            primaryHand = null;
        } else {
            primaryHand = detectedHand.landmarks;
            primaryHandId = detectedHand.id;
            secondaryHand = null;
            secondaryHandId = null;
        }
    } else if (currentHands.length === 2) {
        if (primaryHandId === null) {
            primaryHandId = currentHands[0].id;
            secondaryHandId = currentHands[1].id;
            primaryHand = currentHands[0].landmarks;
            secondaryHand = currentHands[1].landmarks;
        } else {
            for (const hand of currentHands) {
                if (hand.id === primaryHandId) {
                    primaryHand = hand.landmarks;
                } else if (hand.id === secondaryHandId || secondaryHandId === null) {
                    secondaryHandId = hand.id;
                    secondaryHand = hand.landmarks;
                }
            }
        }
    }

    if (primaryHand) {
        isFingerDetected = true;
        lastHandDetectedTime = Date.now();
        
        if (handTimeoutTimer) {
            clearTimeout(handTimeoutTimer);
            handTimeoutTimer = null;
        }
        
        if (gestureControlEnabled) {
            detectPlayPauseGesture(primaryHand);
            
            if (!isPlaying) {
                detectPlayGesture(primaryHand);
            } else {
                if (playGestureActive) {
                    playGestureActive = false;
                    playGestureRotation = 0;
                    playGesturePreviousAngles = [];
                }
            }
        }
        
        highlightIndexFinger(primaryHand);

        if (controlMode === 'distance') {
            detectIndexFingerRotation(primaryHand);
        } else {
            detectFingerVelocity(primaryHand);
        }
    } else {
        isFingerDetected = false;
        fingerStatus.textContent = '❌';
        resetRotationState();
        
        isPalmHolding = false;
        palmHoldStartTime = 0;
        
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
    
    if (secondaryHand) {
        detectVolumeGesture(secondaryHand);
        highlightSecondaryHand(secondaryHand);
        if (volumeStatus) {
            volumeStatus.style.display = 'block';
        }
    } else {
        volumeGestureActive = false;
        if (volumeStatus) {
            volumeStatus.style.display = 'none';
        }
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
        10,
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
            if (!filterAnimationFrame && !manuallyPaused) {
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
        if (!filterAnimationFrame && !manuallyPaused) {
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
                if (!filterAnimationFrame && !manuallyPaused) {
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
    if (manuallyPaused) return;

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
        
        if (!filterAnimationFrame) {
            updateFilteredSpeed();
        }
    }
}

function setGestureTargetForDrift() {
    // FIX: Don't apply drift logic in touch mode
    if (manuallyPaused || controlMode === 'touch') return;

    if (filteredSpeed > 0) {
        gestureTarget = params.filtering.driftTarget;
    } else {
        gestureTarget = filteredSpeed;
    }

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

        if (!filterAnimationFrame && !manuallyPaused) {
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

        if (!filterAnimationFrame && !manuallyPaused) {
            updateFilteredSpeed();
        }
    }
}

function setGestureTargetFromVelocity(velocity) {
    if (manuallyPaused) return;

    const VELOCITY_SCALE = 3 * params.filtering.gestureAmplitude;
    const maxSpeed = params.navigation.maxSpeed;
    const minSpeed = params.navigation.minSpeed;

    const targetSpeed = velocity * VELOCITY_SCALE;
    rawNavigationSpeed = clamp(targetSpeed, minSpeed, maxSpeed);

    navigationSpeed = applyDeadZoneMapping(rawNavigationSpeed);

    speedBar.value = navigationSpeed;
    speedValue.textContent = navigationSpeed.toFixed(2);

    gestureTarget = navigationSpeed;
    
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

// ========== PLAY/PAUSE GESTURE DETECTION ==========
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
    }
    
    playGesturePreviousAngles.push(currentPos);
    
    if (playGesturePreviousAngles.length > 10) {
        playGesturePreviousAngles.shift();
    }
    
    if (playGesturePreviousAngles.length >= 3) {
        let frameRotation = 0;
        let totalRotationDirection = 0;
        let validSamples = 0;
        
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
            
            if (mag1 > 0.01 && mag2 > 0.01) {
                const crossProduct = v1x * v2y - v1y * v2x;
                const angularChange = crossProduct / (mag1 * mag2);
                const angleDegrees = angularChange * 180 / Math.PI;
                
                totalRotationDirection += Math.sign(angleDegrees);
                validSamples++;
                
                frameRotation += Math.abs(angleDegrees);
            }
        }
        
        const directionConsistency = validSamples > 0 ? Math.abs(totalRotationDirection) / validSamples : 0;
        
        if (directionConsistency > 0.8) {
            playGestureRotation += frameRotation;
        } else {
            if (frameRotation > 10 && directionConsistency < 0.5) {
                playGestureRotation = 0;
            }
        }
    }
    
    if (playGestureRotation >= PLAY_GESTURE_THRESHOLD) {
        const gestureTime = currentTime - playGestureStartTime;
        const rotationCount = playGestureRotation / 360;
        
        if (rotationCount >= 2 && gestureTime < 5000) {
            startPlayback();
            playGestureActive = false;
            playGestureRotation = 0;
            playGesturePreviousAngles = [];
            lastGestureToggleTime = currentTime;
        } else if (gestureTime >= 5000) {
            playGestureActive = false;
            playGestureRotation = 0;
            playGesturePreviousAngles = [];
        }
    }
    
    if (currentTime - playGestureStartTime > 5000) {
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

// Detect volume control gesture
function detectVolumeGesture(landmarks) {
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    const indexPIP = landmarks[6];
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const ringMCP = landmarks[13];
    const pinkyMCP = landmarks[17];
    
    const palmBase = landmarks[0];
    
    const indexExtendedUp = indexTip.y < indexPIP.y - 0.01 && indexTip.y < indexMCP.y - 0.01;
    const indexExtendedDown = indexTip.y > indexPIP.y + 0.01 && indexTip.y > indexMCP.y + 0.01;
    
    const getDistance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    
    const middleDistance = getDistance(middleTip, middleMCP);
    const ringDistance = getDistance(ringTip, ringMCP);
    const pinkyDistance = getDistance(pinkyTip, pinkyMCP);
    
    const CURLED_THRESHOLD = 0.10;
    
    const middleCurled = middleDistance < CURLED_THRESHOLD;
    const ringCurled = ringDistance < CURLED_THRESHOLD;
    const pinkyCurled = pinkyDistance < CURLED_THRESHOLD;
    
    const otherFingersCurled = middleCurled && ringCurled && pinkyCurled;
    
    if (!otherFingersCurled) {
        volumeGestureActive = false;
        return;
    }
    
    if (indexExtendedUp) {
        volumeGestureActive = true;
        currentVolume = clamp(currentVolume + VOLUME_CHANGE_RATE, 0.0, 1.0);
        
        if (htmlAudioElement) {
            htmlAudioElement.volume = currentVolume;
        }
        
        updateVolumeDisplay();
    } else if (indexExtendedDown) {
        volumeGestureActive = true;
        currentVolume = clamp(currentVolume - VOLUME_CHANGE_RATE, 0.0, 1.0);
        
        if (htmlAudioElement) {
            htmlAudioElement.volume = currentVolume;
        }
        
        updateVolumeDisplay();
    } else {
        volumeGestureActive = false;
    }
}

function highlightSecondaryHand(landmarks) {
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    
    const centerX = wrist.x * canvasElement.width;
    const centerY = wrist.y * canvasElement.height;
    const radius = 40;
    
    canvasCtx.save();
    
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    canvasCtx.fill();
    
    canvasCtx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (currentVolume * 2 * Math.PI);
    canvasCtx.arc(centerX, centerY, radius - 5, startAngle, endAngle, false);
    canvasCtx.lineWidth = 8;
    canvasCtx.lineCap = 'round';
    
    if (currentVolume > 0.66) {
        canvasCtx.strokeStyle = '#4ade80';
    } else if (currentVolume > 0.33) {
        canvasCtx.strokeStyle = '#fbbf24';
    } else {
        canvasCtx.strokeStyle = '#ef4444';
    }
    canvasCtx.stroke();
    
    canvasCtx.translate(centerX, centerY);
    canvasCtx.scale(-1, 1);
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = 'bold 20px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(Math.round(currentVolume * 100) + '%', 0, 0);
    
    canvasCtx.restore();
}

function updateVolumeDisplay() {
    if (!volumeText || !volumeIcon) return;
    
    const volumePercent = Math.round(currentVolume * 100);
    volumeText.textContent = `${volumePercent}%`;
    
    if (currentVolume === 0) {
        volumeIcon.textContent = '🔇';
    } else if (currentVolume < 0.33) {
        volumeIcon.textContent = '🔈';
    } else if (currentVolume < 0.67) {
        volumeIcon.textContent = '🔉';
    } else {
        volumeIcon.textContent = '🔊';
    }
}

// ========== HOWLER INITIALIZATION ==========
function initializeScrubHowler(audioUrl) {
    try {
        // Clean up old Howler instance
        if (scrubHowl) {
            scrubHowl.unload();
            scrubHowl = null;
        }
        if (scrubHowlUrl) {
            URL.revokeObjectURL(scrubHowlUrl);
            scrubHowlUrl = null;
        }
        
        scrubHowlUrl = audioUrl;
        scrubHowl = new Howl({
            src: [scrubHowlUrl],
            html5: false,
            preload: true,
            onloaderror: (id, err) => console.error('Howler scrub load error', err),
            onplayerror: (id, err) => console.error('Howler scrub play error', err)
        });
        
        console.log('Howler scrubbing initialized');
    } catch (e) {
        console.error('Failed to init Howler scrubbing:', e);
    }
}

// ========== SMART SCRUBBING FUNCTIONS ==========
function startScrubbing(seekTime) {
    if (!scrubHowl || scrubHowl.state() !== 'loaded') {
        console.warn('Howler not ready for scrubbing');
        return;
    }
    
    isScrubbing = true;
    
    // Play short preview at scrub position with Howler
    const PREVIEW_DURATION_MS = 200;
    const FADE_MS = 50;
    
    try {
        // Stop previous scrub sound
        if (scrubSoundId !== null) {
            scrubHowl.stop(scrubSoundId);
        }
        
        const id = scrubHowl.play();
        scrubSoundId = id;
        
        scrubHowl.seek(seekTime, id);
        scrubHowl.volume(0, id);
        scrubHowl.fade(0, 0.7, FADE_MS, id);
        
        // Fade out and stop after preview duration
        setTimeout(() => {
            if (scrubHowl && scrubSoundId === id) {
                scrubHowl.fade(0.7, 0, FADE_MS, id);
                setTimeout(() => {
                    try { scrubHowl.stop(id); } catch (e) {}
                }, FADE_MS + 10);
            }
        }, PREVIEW_DURATION_MS);
        
    } catch (e) {
        console.error('Scrubbing error:', e);
    }
}

function stopScrubbing() {
    isScrubbing = false;
    
    // Stop any active scrub sounds
    if (scrubHowl && scrubSoundId !== null) {
        try {
            scrubHowl.stop(scrubSoundId);
        } catch (e) {}
        scrubSoundId = null;
    }
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
    
    // Show smart scrub controls
    if (smartScrubControls) {
        smartScrubControls.style.display = 'block';
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
    
    // Initialize word Howler for smooth playback
    initializeWordHowler();
}

function initializeWordHowler() {
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
            onloaderror: (id, err) => console.error('Word Howler load error', err),
            onplayerror: (id, err) => console.error('Word Howler play error', err)
        });
    } catch (e) {
        console.error('Failed to init word Howler:', e);
    }
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

// ========== SMART SCRUB FUNCTIONS ==========

function selectInformativeWordsTFIDF(words, speed = 1, overridePercentile = null) {
    if (!Array.isArray(words) || words.length === 0) return [];

    const alpha = /[a-z]/i;

    const tokens = words.map(w => ({
        text: (w.text || '').toLowerCase().replace(/[^a-z'\-]/gi, ''),
        start: w.start,
        end: w.end
    })).filter(w => w.text && alpha.test(w.text) && !commonWords.has(w.text));

    if (tokens.length === 0) return [];

    const freq = new Map();
    for (const t of tokens) {
        freq.set(t.text, (freq.get(t.text) || 0) + 1);
    }

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

    const scores = Array.from(wordScores.values()).filter(v => isFinite(v) && v > 0);
    if (scores.length === 0) {
        return tokens.map(({ text, start, end }) => ({ text, start, end }));
    }
    scores.sort((a, b) => a - b);

    let p;
    if (overridePercentile !== null && overridePercentile >= 0.50 && overridePercentile <= 0.95) {
        p = overridePercentile;
    } else {
        const s = Math.max(1, Math.min(6, speed));
        p = 0.82 - 0.06 * (s - 2);
        p = Math.max(0.60, Math.min(0.88, p));
    }

    const idx = Math.floor(p * (scores.length - 1));
    const threshold = scores[idx];

    const informative = tokens
        .map(t => ({ ...t, score: wordScores.get(t.text) || 0 }))
        .filter(t => t.score >= threshold)
        .sort((a, b) => a.start - b.start);

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
}

function realignNextIndexTo(timeSec) {
    currentWordIndex = 0;
    while (currentWordIndex < informativeWords.length && 
           informativeWords[currentWordIndex].start <= timeSec) {
        currentWordIndex++;
    }
}

function startSmartScrub() {
    if (informativeWords.length === 0 || !audioBuffer) return;
    
    smartScrubActive = true;
    isSmartScrubPaused = false;
    htmlAudioElement.pause();
    
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
        currentWordIndex = informativeWords.length - 1;
        while (currentWordIndex >= 0 && 
               informativeWords[currentWordIndex].start >= currentTime) {
            currentWordIndex--;
        }
    } else {
        realignNextIndexTo(currentTime);
    }
    
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
        if (currentWordIndex < 0) {
            stopSmartScrub();
            return;
        }
    } else {
        if (currentWordIndex >= informativeWords.length) {
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
        currentWordIndex--;
    } else {
        currentWordIndex++;
    }
    
    smartScrubTimer = setTimeout(playNextKeyword, effectiveWaitMs);
}

function stopSmartScrub() {
    smartScrubActive = false;
    isSmartScrubPaused = false;
    
    if (smartScrubTimer) {
        clearTimeout(smartScrubTimer);
        smartScrubTimer = null;
    }
    
    unhighlightAllWords();
    
    if (pauseSmartScrubBtn) {
        pauseSmartScrubBtn.style.display = 'none';
    }
    if (keywordDisplay) {
        keywordDisplay.textContent = 'No keyword playing';
    }
    
    if (isPlaying && !manuallyPaused) {
        const currentPos = parseFloat(seekBar.value);
        if (filteredSpeed >= 0) {
            htmlAudioElement.currentTime = currentPos;
            htmlAudioElement.playbackRate = Math.abs(filteredSpeed);
            htmlAudioElement.play().catch(() => {});
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
    } else {
        isSmartScrubPaused = true;
        if (pauseSmartScrubBtn) {
            pauseSmartScrubBtn.textContent = 'Resume Smart Scrub';
        }
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

function playSmartWordSegment(startSec, durationMs) {
    if (playWordWithHowler(startSec, durationMs)) return true;
    return false;
}

function playWordWithHowler(startSec, durationMs) {
    if (!wordHowl || wordHowl.state() !== 'loaded') return false;

    try {
        const baseFadeMs = 180;
        const fadeMs = baseFadeMs;
        const actualDurationMs = durationMs;
        const PRE_ROLL_SEC = 0.05;
        const seekTarget = Math.max(0, startSec - PRE_ROLL_SEC);

        const id = wordHowl.play();
        
        wordHowl.rate(1.0, id);
        wordHowl.volume(0, id);
        wordHowl.seek(seekTarget, id);
        wordHowl.fade(0, 1, fadeMs, id);

        setTimeout(() => {
            wordHowl.fade(1, 0, fadeMs, id);
        }, actualDurationMs);

        setTimeout(() => {
            try { wordHowl.stop(id); } catch {}
        }, actualDurationMs + fadeMs + 30);

        return true;
    } catch (e) {
        return false;
    }
}

// Smart scrub event listeners
if (smartScrubToggle) {
    smartScrubToggle.addEventListener('change', (e) => {
        smartScrubEnabled = e.target.checked;
        
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

if (pauseSmartScrubBtn) {
    pauseSmartScrubBtn.addEventListener('click', pauseSmartScrubPlayback);
}

// Loading indicator functions
function showAudioLoading(message = 'Loading audio...') {
    if (audioLoadingIndicator) {
        const loadingText = audioLoadingIndicator.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        audioLoadingIndicator.style.display = 'flex';
    }
    
    if (audioFileInput) audioFileInput.disabled = true;
    if (loadDefaultBtn) loadDefaultBtn.disabled = true;
}

function hideAudioLoading() {
    if (audioLoadingIndicator) {
        audioLoadingIndicator.style.display = 'none';
    }
    
    if (audioFileInput) audioFileInput.disabled = false;
    if (loadDefaultBtn) loadDefaultBtn.disabled = false;
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

audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showAudioLoading('Loading audio file...');

    try {
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
        
        showFileUploadButton();
        
        if (fileUploadModal) {
            fileUploadModal.classList.remove('active');
        }
        
        initializeScrubHowler(fileURL);
        
        if (transcribeBtn) {
            transcribeBtn.disabled = false;
        }
        
        hideAudioLoading();
    } catch (error) {
        hideAudioLoading();
        alert('Failed to load audio file.');
    }
});

loadDefaultBtn.addEventListener('click', async () => {
    showAudioLoading('Loading default audio...');
    
    stopPlayback();
    audioFileInput.value = '';

    try {
        const audioUrl = './around-the-world-in-80-days-chapter-10.mp3';
        
        htmlAudioElement.src = audioUrl;
        htmlAudioElement.preservesPitch = true;
        htmlAudioElement.mozPreservesPitch = true;
        htmlAudioElement.webkitPreservesPitch = true;

        await new Promise((resolve, reject) => {
            htmlAudioElement.onloadedmetadata = resolve;
            htmlAudioElement.onerror = reject;
        });

        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        seekBar.max = audioBuffer.duration;
        seekBar.value = 0;
        pauseTime = 0;

        durationDisplay.textContent = formatTime(audioBuffer.duration);
        currentTimeDisplay.textContent = formatTime(0);

        controls.style.display = 'block';
        stopPlayback();
        
        initializeScrubHowler(audioUrl);
        
        if (transcribeBtn) {
            transcribeBtn.disabled = false;
        }
        
        showFileUploadButton();
        
        if (fileUploadModal) {
            fileUploadModal.classList.remove('active');
        }
        
        hideAudioLoading();
    } catch (error) {
        hideAudioLoading();
        alert('Failed to load default audio file.');
    }
});

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

function updateAlphaDisplay() {
    // Use touch alpha if in touch mode, otherwise use finger-detection based alpha
    const currentAlpha = controlMode === 'touch'
        ? params.filtering.touchAlpha
        : (isFingerDetected ? params.filtering.alphaFinger : params.filtering.alphaNoFinger);
    
    const decimals = currentAlpha < 0.001 ? 4 : 3;
    activeAlphaDisplay.textContent = currentAlpha.toFixed(decimals);
    
    if (controlMode === 'touch') {
        activeAlphaDisplay.style.color = '#a78bfa'; // Purple for touch mode
        alphaStateText.textContent = 'Touch mode - Fixed smoothing';
        alphaStateText.style.color = '#a78bfa';
    } else if (isFingerDetected) {
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
    if (manuallyPaused) {
        if (filterAnimationFrame) {
            cancelAnimationFrame(filterAnimationFrame);
            filterAnimationFrame = null;
        }
        return;
    }

    // In face recognition mode: slow down based on confusion level when finger not detected
    // Only apply confusion effect when speed is below 2.5x
    const faceRecognitionActive = window.FaceRecognitionState?.faceRecognitionEnabled === true;
    const speedBelowThreshold = Math.abs(filteredSpeed) < 2.5;
    if (faceRecognitionActive && !isFingerDetected && speedBelowThreshold) {
        const confusionLevel = window.FaceRecognitionState?.smoothed || 0;
        const sensitivity = window.FaceRecognitionState?.confusionSlowdownFactor || 1;
        const adjustedConfusion = Math.min(1, confusionLevel * sensitivity);

        // Smooth the confusion effect: rise quickly when confused, fall slowly when not
        const riseAlpha = 0.15;  // Fast response to confusion
        const fallAlpha = 0.02;  // Slow recovery when no longer confused
        if (adjustedConfusion > smoothedConfusionEffect) {
            smoothedConfusionEffect += riseAlpha * (adjustedConfusion - smoothedConfusionEffect);
        } else {
            smoothedConfusionEffect += fallAlpha * (adjustedConfusion - smoothedConfusionEffect);
        }

        // Calculate slowdown target: higher confusion = slower speed
        // At confusion 0: maintain current speed, at confusion 1: target 0.3x speed
        const minSlowdownTarget = 0.3;
        const slowdownTarget = filteredSpeed - (filteredSpeed - minSlowdownTarget) * smoothedConfusionEffect;

        // Apply slowdown if smoothed confusion effect is significant
        if (smoothedConfusionEffect > 0.05) {
            // Gradually drift toward slower speed based on smoothed confusion
            const slowdownAlpha = 0.015 * smoothedConfusionEffect;
            filteredSpeed = filteredSpeed - slowdownAlpha * (filteredSpeed - slowdownTarget);

            // Update displays
            filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
            filteredSpeedBar.value = filteredSpeed;
            applyFilteredSpeed();
        }

        updateAlphaDisplay();
        filterAnimationFrame = requestAnimationFrame(updateFilteredSpeed);
        return;
    }

    // Use touch alpha if in touch mode, otherwise use finger-detection based alpha
    const alpha = controlMode === 'touch'
        ? params.filtering.touchAlpha
        : (isFingerDetected ? params.filtering.alphaFinger : params.filtering.alphaNoFinger);
    updateAlphaDisplay();

    const previousTargetSign = Math.sign(previousGestureTarget);
    const currentTargetSign = Math.sign(gestureTarget);
    const targetCrossedDeadZone = (previousTargetSign !== 0 && currentTargetSign !== 0 && previousTargetSign !== currentTargetSign);
    
    // FIX: In touch mode, never consider it "drifting to target"
    const isDriftingToTarget = controlMode !== 'touch' && !isFingerDetected && gestureTarget === params.filtering.driftTarget;
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
    
    // FIX: Only sync sliders in hand gesture modes when drifting (no finger detected)
    // In touch mode, NEVER sync the input slider to filtered speed
    if (controlMode !== 'touch' && !isFingerDetected && !manuallyPaused) {
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

    // Smart scrub activation/deactivation based on speed
    if (smartScrubEnabled && isPlaying && !manuallyPaused && informativeWords.length > 0) {
        const speed = Math.abs(filteredSpeed);
        
        if (speed >= SMART_SCRUB_SPEED_THRESHOLD && !smartScrubActive) {
            recalcInformative(true);
            startSmartScrub();
        } else if (speed < SMART_SCRUB_SPEED_THRESHOLD && smartScrubActive) {
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

function applyFilteredSpeed() {
    if (!isPlaying) return;

    if (filteredSpeed > 0 && htmlAudioElement && !htmlAudioElement.paused) {
        const targetPlaybackRate = Math.abs(filteredSpeed);
        const safePlaybackRate = clamp(targetPlaybackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE);
        htmlAudioElement.playbackRate = safePlaybackRate;
    }

    updateEffectiveParams();
}

// Smart scrubbing with Howler - update seekBar event listeners
seekBar.addEventListener('input', (e) => {
    const newTime = parseFloat(e.target.value);
    pauseTime = newTime;
    currentTimeDisplay.textContent = formatTime(newTime);
    
    // Smart scrubbing with Howler
    if (scrubHowl && scrubHowl.state() === 'loaded') {
        startScrubbing(newTime);
    }
});

// Add mouseup/touchend to resume playback after scrubbing
seekBar.addEventListener('change', (e) => {
    const newTime = parseFloat(e.target.value);
    stopScrubbing();
    
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
    
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
}

function stopPlayback() {
    isPlaying = false;

    htmlAudioElement.pause();

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
        
        // Enable transcribe button if audio is already loaded
        if (transcribeBtn && htmlAudioElement.src && audioBuffer) {
            transcribeBtn.disabled = false;
        }
        
        // Attach parameter event listeners (must be done after DOM is loaded)
        if (alphaFingerInput) {
            alphaFingerInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    params.filtering.alphaFinger = clamp(value, 0.001, 1);
                    alphaFingerValue.textContent = params.filtering.alphaFinger.toFixed(3);
                    updateAlphaDisplay();
                }
            });
        }
        
        if (alphaNoFingerInput) {
            alphaNoFingerInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    params.filtering.alphaNoFinger = clamp(value, 0.0001, 1);
                    alphaNoFingerValue.textContent = params.filtering.alphaNoFinger.toFixed(4);
                    updateAlphaDisplay();
                }
            });
        }
        
        if (driftTargetInput) {
            driftTargetInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    params.filtering.driftTarget = clamp(value, 0.1, 4);
                    driftTargetValue.textContent = params.filtering.driftTarget.toFixed(2);
                }
            });
        }
        
        if (amplitudeInput) {
            amplitudeInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    params.filtering.gestureAmplitude = clamp(value, 0.1, 5);
                    amplitudeValue.textContent = params.filtering.gestureAmplitude.toFixed(2);
                }
            });
        }
    }, 1000);
});

// ========== MOBILE UI CONTROLS ==========

// Settings Modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const modalParametersContainer = document.getElementById('modalParametersContainer');

if (settingsBtn && settingsModal && closeSettings) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        
        // Move parameters to modal on mobile
        if (window.innerWidth <= 768) {
            // Clear any existing content first
            if (modalParametersContainer) {
                modalParametersContainer.innerHTML = '';
            }
            
            // Only show camera navigation params if NOT in touch mode
            if (controlMode !== 'touch') {
                const paramsSection = document.querySelector('.right-column .params-section');
                if (paramsSection && modalParametersContainer) {
                    modalParametersContainer.appendChild(paramsSection.cloneNode(true));
                }
                
                const alphaSection = document.querySelector('.right-column .alpha-section');
                if (alphaSection && modalParametersContainer) {
                    modalParametersContainer.appendChild(alphaSection.cloneNode(true));
                }
            }
            
            // If touch mode is active, include touch control parameters
            if (controlMode === 'touch') {
                const touchSection = document.getElementById('touchControlSection');
                if (touchSection) {
                    // Add a title
                    const touchTitle = document.createElement('h3');
                    touchTitle.style.cssText = 'color: #ffd700; margin: 0 0 15px 0;';
                    touchTitle.textContent = '👆 Touch Control Settings';
                    modalParametersContainer.appendChild(touchTitle);
                    
                    // Clone touch parameter groups (skip the toggle)
                    const touchParamGroups = touchSection.querySelectorAll('.touch-parameter-group');
                    touchParamGroups.forEach(group => {
                        const clonedGroup = group.cloneNode(true);
                        modalParametersContainer.appendChild(clonedGroup);
                        
                        // Re-attach input events
                        const input = clonedGroup.querySelector('input');
                        if (input) {
                            const originalInput = document.getElementById(input.id);
                            if (originalInput) {
                                input.addEventListener('input', (e) => {
                                    originalInput.value = e.target.value;
                                    originalInput.dispatchEvent(new Event('input'));
                                });
                            }
                        }
                    });
                    
                    // Clone speed decay group if in scroll mode
                    const speedDecayGroup = document.getElementById('speed-decay-group');
                    if (speedDecayGroup && TouchControl.inputMode === 'scroll') {
                        const clonedDecay = speedDecayGroup.cloneNode(true);
                        modalParametersContainer.appendChild(clonedDecay);
                        
                        // Re-attach slider event
                        const clonedSlider = clonedDecay.querySelector('#speed-decay-display');
                        if (clonedSlider) {
                            const originalSlider = document.getElementById('speed-decay-display');
                            if (originalSlider) {
                                clonedSlider.addEventListener('input', (e) => {
                                    originalSlider.value = e.target.value;
                                    originalSlider.dispatchEvent(new Event('input'));
                                });
                            }
                        }
                    }
                    
                    // Add touch alpha parameter
                    const touchAlphaGroup = document.createElement('div');
                    touchAlphaGroup.className = 'touch-parameter-group';
                    touchAlphaGroup.style.cssText = 'margin: 15px 0;';
                    touchAlphaGroup.innerHTML = `
                        <label for="modal-touch-alpha-input">Touch Smoothing (α):
                            <span id="modal-touch-alpha-value">${params.filtering.touchAlpha.toFixed(3)}</span>
                        </label>
                        <input 
                            type="number" 
                            id="modal-touch-alpha-input" 
                            value="${params.filtering.touchAlpha}" 
                            min="0.001" 
                            max="1" 
                            step="0.001"
                            style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white;"
                        >
                        <p class="param-desc" style="margin: 5px 0 0 0; font-size: 0.85em; opacity: 0.7;">Lower = smoother but slower response</p>
                    `;
                    modalParametersContainer.appendChild(touchAlphaGroup);
                    
                    // Re-attach touch alpha event
                    const modalTouchAlphaInput = touchAlphaGroup.querySelector('#modal-touch-alpha-input');
                    const modalTouchAlphaValue = touchAlphaGroup.querySelector('#modal-touch-alpha-value');
                    if (modalTouchAlphaInput) {
                        modalTouchAlphaInput.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.filtering.touchAlpha = clamp(value, 0.001, 1);
                                const touchAlphaInput = document.getElementById('touch-alpha-input');
                                const touchAlphaValue = document.getElementById('touch-alpha-value');
                                if (touchAlphaInput) touchAlphaInput.value = value;
                                if (touchAlphaValue) touchAlphaValue.textContent = value.toFixed(3);
                                if (modalTouchAlphaValue) modalTouchAlphaValue.textContent = value.toFixed(3);
                                updateAlphaDisplay();
                            }
                        });
                    }
                }
            }
            
            // Re-attach event listeners for cloned parameter elements (only if NOT touch mode)
            if (controlMode !== 'touch') {
                const modalParamsSection = modalParametersContainer.querySelector('.params-section');
                
                if (modalParamsSection) {
                    const modalSegmentDuration = modalParamsSection.querySelector('#segmentDuration');
                    const modalSegmentStep = modalParamsSection.querySelector('#segmentStep');
                    const modalSegmentInterval = modalParamsSection.querySelector('#segmentInterval');
                    const modalFadeDuration = modalParamsSection.querySelector('#fadeDuration');
                    
                    if (modalSegmentDuration) {
                        modalSegmentDuration.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.navigation.segmentDuration = value;
                                segmentDurationInput.value = value;
                                updateEffectiveParams();
                            }
                        });
                    }
                    
                    if (modalSegmentStep) {
                        modalSegmentStep.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.navigation.segmentStep = value;
                                segmentStepInput.value = value;
                                updateEffectiveParams();
                            }
                        });
                    }
                    
                    if (modalSegmentInterval) {
                        modalSegmentInterval.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.navigation.segmentIntervalMs = value;
                                segmentIntervalInput.value = value;
                                updateEffectiveParams();
                            }
                        });
                    }
                    
                    if (modalFadeDuration) {
                        modalFadeDuration.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.navigation.fadeDuration = value;
                                fadeDurationInput.value = value;
                            }
                        });
                    }
                }
                
                const modalAlphaSection = modalParametersContainer.querySelector('.alpha-section');
                
                if (modalAlphaSection) {
                    const modalAlphaFinger = modalAlphaSection.querySelector('#alphaFingerInput');
                    const modalAlphaNoFinger = modalAlphaSection.querySelector('#alphaNoFingerInput');
                    const modalDriftTarget = modalAlphaSection.querySelector('#driftTargetInput');
                    const modalAmplitude = modalAlphaSection.querySelector('#amplitudeInput');
                    
                    if (modalAlphaFinger) {
                        modalAlphaFinger.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.filtering.alphaFinger = clamp(value, 0.001, 1);
                                alphaFingerInput.value = value;
                                alphaFingerValue.textContent = params.filtering.alphaFinger.toFixed(3);
                                updateAlphaDisplay();
                            }
                        });
                    }
                    
                    if (modalAlphaNoFinger) {
                        modalAlphaNoFinger.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.filtering.alphaNoFinger = clamp(value, 0.0001, 1);
                                alphaNoFingerInput.value = value;
                                alphaNoFingerValue.textContent = params.filtering.alphaNoFinger.toFixed(4);
                                updateAlphaDisplay();
                            }
                        });
                    }
                    
                    if (modalDriftTarget) {
                        modalDriftTarget.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.filtering.driftTarget = clamp(value, 0.1, 4);
                                driftTargetInput.value = value;
                                driftTargetValue.textContent = params.filtering.driftTarget.toFixed(2);
                            }
                        });
                    }
                    
                    if (modalAmplitude) {
                        modalAmplitude.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                                params.filtering.gestureAmplitude = clamp(value, 0.1, 5);
                                amplitudeInput.value = value;
                                amplitudeValue.textContent = params.filtering.gestureAmplitude.toFixed(2);
                            }
                        });
                    }
                }
            }
        }
    });
    
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        // Clear modal content
        if (modalParametersContainer) {
            modalParametersContainer.innerHTML = '';
        }
    });
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
            if (modalParametersContainer) {
                modalParametersContainer.innerHTML = '';
            }
        }
    });
}

// File Upload Button and Modal
const fileUploadBtn = document.getElementById('fileUploadBtn');
const fileUploadModal = document.getElementById('fileUploadModal');
const closeFileUpload = document.getElementById('closeFileUpload');
const uploadSection = document.querySelector('.upload-section');

// Show file upload button when audio is loaded
function showFileUploadButton() {
    if (fileUploadBtn) {
        fileUploadBtn.classList.add('show');
    }
    
    // Hide the upload section in main view ONLY on mobile
    if (uploadSection && window.innerWidth <= 768) {
        uploadSection.classList.add('file-loaded');
    }
    
    // Update modal sections
    if (modalUploadSection) {
        modalUploadSection.style.display = 'none';
    }
    
    if (currentAudioInfo && audioBuffer) {
        currentAudioInfo.style.display = 'block';
        
        const audioFileName = document.getElementById('audioFileName');
        const audioDuration = document.getElementById('audioDuration');
        
        if (audioFileName) {
            const fileName = audioFileInput.files[0]?.name || 'Audio File';
            audioFileName.textContent = `File: ${fileName}`;
        }
        
        if (audioDuration) {
            audioDuration.textContent = `Duration: ${formatTime(audioBuffer.duration)}`;
        }
    }
}

// Hide file upload button
function hideFileUploadButton() {
    if (fileUploadBtn) {
        fileUploadBtn.classList.remove('show');
    }
    
    // Only remove file-loaded class if on mobile
    if (uploadSection && window.innerWidth <= 768) {
        uploadSection.classList.remove('file-loaded');
    }
}

// Hide file upload button
function hideFileUploadButton() {
    if (fileUploadBtn) {
        fileUploadBtn.classList.remove('show');
    }
    
    if (uploadSection) {
        uploadSection.classList.remove('file-loaded');
    }
}

if (fileUploadBtn && fileUploadModal && closeFileUpload) {
    fileUploadBtn.addEventListener('click', () => {
        fileUploadModal.classList.add('active');
        
        // Update current audio info if available
        if (audioBuffer) {
            const currentAudioInfo = document.getElementById('currentAudioInfo');
            const audioFileName = document.getElementById('audioFileName');
            const audioDuration = document.getElementById('audioDuration');
            
            if (currentAudioInfo) {
                currentAudioInfo.style.display = 'block';
            }
            
            if (audioFileName) {
                const fileName = audioFileInput.files[0]?.name || 'Default Audio';
                audioFileName.textContent = `File: ${fileName}`;
            }
            
            if (audioDuration) {
                audioDuration.textContent = `Duration: ${formatTime(audioBuffer.duration)}`;
            }
        }
    });
    
    closeFileUpload.addEventListener('click', () => {
        fileUploadModal.classList.remove('active');
    });
    
    // Close modal when clicking outside
    fileUploadModal.addEventListener('click', (e) => {
        if (e.target === fileUploadModal) {
            fileUploadModal.classList.remove('active');
        }
    });
}

// Change Audio button - show upload options again
const changeAudioBtn = document.getElementById('changeAudioBtn');
const modalUploadSection = document.getElementById('modalUploadSection');
const currentAudioInfo = document.getElementById('currentAudioInfo');

if (changeAudioBtn) {
    changeAudioBtn.addEventListener('click', () => {
        if (modalUploadSection) {
            modalUploadSection.style.display = 'block';
        }
        if (currentAudioInfo) {
            currentAudioInfo.style.display = 'none';
        }
    });
}

// YouTube button handler (if it exists in your code)
const loadYouTubeBtn = document.getElementById('loadYouTubeBtn');
const youtubeUrlInput = document.getElementById('youtubeUrlInput');

if (loadYouTubeBtn && youtubeUrlInput) {
    loadYouTubeBtn.addEventListener('click', async () => {
        const url = youtubeUrlInput.value.trim();
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }

        loadYouTubeBtn.disabled = true;
        loadYouTubeBtn.textContent = 'Loading...';
        
        try {
            // Your existing YouTube loading logic here
            // After successful load:
            showFileUploadButton();
            
            if (fileUploadModal) {
                fileUploadModal.classList.remove('active');
            }
            
            youtubeUrlInput.value = '';
            
        } catch (error) {
            console.error('Error loading YouTube audio:', error);
            alert('Failed to load audio from YouTube. Please try again.');
        } finally {
            loadYouTubeBtn.disabled = false;
            loadYouTubeBtn.textContent = 'Load from YouTube';
        }
    });
}

// Fullscreen Toggle for Touch Control
const fullscreenToggle = document.getElementById('fullscreenToggle');
const touchControlSection = document.getElementById('touchControlSection');
const fullscreenIcon = document.getElementById('fullscreenIcon');

if (fullscreenToggle && touchControlSection) {
    fullscreenToggle.addEventListener('click', () => {
        const isFullscreen = touchControlSection.classList.contains('fullscreen');
        
        if (isFullscreen) {
            // Exit fullscreen
            touchControlSection.classList.remove('fullscreen');
            if (fullscreenIcon) {
                fullscreenIcon.textContent = '⛶';
            }
        } else {
            // Enter fullscreen
            touchControlSection.classList.add('fullscreen');
            if (fullscreenIcon) {
                fullscreenIcon.textContent = '⛶'; // Or use a different icon like '✕'
            }
        }
    });
}