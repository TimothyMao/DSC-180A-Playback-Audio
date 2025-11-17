// ========== HAND RECOGNITION VARIABLES ==========
const SMOOTHING_WINDOW = 5;
const SPEED_CALCULATION_FRAMES = 10;

let hands, camera;
let previousAngles = [];
let rotationHistory = [];
let frameTimestamps = [];
let currentRotation = 'none';
let totalRotation = 0;
let rotationVelocity = 0;
let lastGestureTime = 0;
let gestureCooldown = 1000; // ms between gesture actions
let lastHandDetectedTime = Date.now();
let lastActiveRotationTime = Date.now(); // Track when hand was last actively rotating
let handDetectionTimeout = 2000; // ms without hand before speed reset
let handTimeoutTimer = null;

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

// ========== SIDEBAR VARIABLES ==========
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');

// ========== AUDIO PLAYER VARIABLES ==========
// Playback parameters
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
};

// Global variables for audio
let audioContext;
let audioBuffer;
let currentSource = null;
let isPlaying = false;
let navigationSpeed = 1.0;
let filteredSpeed = 1.0;    // Smoothed speed value using exponential filtering
let filterAlpha = 0.01;     // Alpha parameter for exponential smoothing (lower = smoother)
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
const alphaInput = document.getElementById('alphaInput');
const alphaValue = document.getElementById('alphaValue');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');
const loadDefaultBtn = document.getElementById('loadDefaultBtn');

// Parameter control elements
const segmentDurationInput = document.getElementById('segmentDuration');
const segmentStepInput = document.getElementById('segmentStep');
const segmentIntervalInput = document.getElementById('segmentInterval');
const fadeDurationInput = document.getElementById('fadeDuration');
const effectiveStepDisplay = document.getElementById('effectiveStep');
const effectiveIntervalDisplay = document.getElementById('effectiveInterval');

// HTMLMediaElement playback rate limits (browser-specific but generally supported)
const MIN_PLAYBACK_RATE = 0.0625; // Most browsers support this minimum
const MAX_PLAYBACK_RATE = 16.0;    // Most browsers support this maximum

// ========== SIDEBAR FUNCTIONS ==========
function openSidebar() {
    if (sidebar) {
        sidebar.classList.add('open');
    }
}

function closeSidebar() {
    if (sidebar) {
        sidebar.classList.remove('open');
    }
}

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Check if elements exist before adding event listeners
if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', closeSidebar);
}

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

// Initialize MediaPipe Hands
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
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
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
        console.log("Camera started successfully!");
        hideLoading();

    } catch (error) {
        console.error('Initialization error:', error);
        showError(`Error: ${error.message}. Please refresh the page and try again.`);
    }
}

// Process hand detection results
function onResults(results) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Hand detected - update timestamp and clear timeout
        lastHandDetectedTime = Date.now();
        // Update active rotation time whenever hand is detected (even if not rotating)
        // This ensures the timer resets when hand reappears
        if (handTimeoutTimer) {
            clearTimeout(handTimeoutTimer);
            handTimeoutTimer = null;
        }
        
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
            {color: 'rgba(255, 255, 255, 0.3)', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks,
            {color: 'rgba(255, 255, 255, 0.5)', lineWidth: 1, radius: 2});
        
        highlightIndexFinger(landmarks);
        detectIndexFingerRotation(landmarks);
        detectGestures(landmarks);
    } else {
        fingerStatus.textContent = '❌';
        resetRotationState();
        
        // Drift towards 0.7x when hand is not detected (only for positive speeds)
        driftTowardsDefaultSpeed();
        
        // No hand detected - just clear the timeout
        // Don't reset speed automatically anymore since we have drift
        if (!handTimeoutTimer) {
            handTimeoutTimer = setTimeout(() => {
                // Just clear the timer, don't reset speed
                handTimeoutTimer = null;
            }, handDetectionTimeout);
        }
    }
    
    canvasCtx.restore();
}

// Highlight only the fingertip (landmark 8)
function highlightIndexFinger(landmarks) {
    const indexTip = landmarks[8]; // Only the fingertip

    // Draw just the fingertip as a green dot
    canvasCtx.beginPath();
    canvasCtx.fillStyle = '#00ff00';
    canvasCtx.arc(
        indexTip.x * canvasElement.width,
        indexTip.y * canvasElement.height,
        10, // Slightly larger since it's the only point
        0,
        2 * Math.PI
    );
    canvasCtx.fill();
    
    fingerStatus.textContent = '✅';
}

// Detect rotation using only fingertip position (circular motion detection)
function detectIndexFingerRotation(landmarks) {
    const indexTip = landmarks[8];
    const currentPos = { x: indexTip.x, y: indexTip.y };
    
    // Minimum movement threshold to reduce noise
    const MIN_MOVEMENT = 0.015;
    
    if (previousAngles.length > 0) {
        const lastPos = previousAngles[previousAngles.length - 1];
        const dx = currentPos.x - lastPos.x;
        const dy = currentPos.y - lastPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if hand barely moved
        if (distance < MIN_MOVEMENT) {
            // Only drift when hand IS detected but not moving much (only for positive speeds)
            driftTowardsDefaultSpeed();
            return;
        }
    }
    
    previousAngles.push(currentPos);
    frameTimestamps.push(Date.now());
    
    if (previousAngles.length > SMOOTHING_WINDOW) {
        previousAngles.shift();
        frameTimestamps.shift();
    }
    
    // Need at least 3 points to detect rotation
    if (previousAngles.length < 3) return;
    
    // Calculate angular velocity using cross products of movement vectors
    let totalAngularVelocity = 0;
    let validSamples = 0;
    
    for (let i = 2; i < previousAngles.length; i++) {
        const p0 = previousAngles[i - 2];
        const p1 = previousAngles[i - 1];
        const p2 = previousAngles[i];
        
        // Movement vectors
        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;
        
        // Cross product determines rotation direction
        // Positive = counterclockwise, Negative = clockwise
        const crossProduct = v1x * v2y - v1y * v2x;
        
        // Vector magnitudes
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        // Only count significant movements
        if (mag1 > 0.01 && mag2 > 0.01) {
            const angularChange = crossProduct / (mag1 * mag2);
            totalAngularVelocity += angularChange;
            validSamples++;
        }
    }
    
    if (validSamples === 0) {
        // Only drift when hand IS detected but motion isn't significant (only for positive speeds)
        driftTowardsDefaultSpeed();
        return;
    }
    
    const avgAngularVelocity = totalAngularVelocity / validSamples;
    
    rotationHistory.push(avgAngularVelocity);
    if (rotationHistory.length > SPEED_CALCULATION_FRAMES) {
        rotationHistory.shift();
    }
    
    // Calculate rotation velocity over time
    if (frameTimestamps.length >= 2) {
        const timeDiff = (frameTimestamps[frameTimestamps.length - 1] - 
                        frameTimestamps[0]) / 1000;
        
        if (timeDiff > 0) {
            const totalAngularChange = rotationHistory.reduce((sum, val) => sum + val, 0);
            rotationVelocity = totalAngularChange / timeDiff;
            
            // Scale for display
            const VELOCITY_SCALE = 1000;
            const displaySpeed = Math.abs(rotationVelocity) * VELOCITY_SCALE;
            speedDisplay.textContent = `${Math.round(displaySpeed)}°/s`;
            
            // Update total rotation for display
            totalRotation += avgAngularVelocity * 180 / Math.PI;
            angleDisplay.textContent = `${Math.round(totalRotation)}°`;
            
            // Update last active rotation time if significant rotation
            if (Math.abs(rotationVelocity) > 0.12) {
                lastActiveRotationTime = Date.now();
                // Map rotation velocity to playback direction
                if (rotationVelocity < 0) {
                    setRotation('clockwise');
                    adjustPlaybackDirection(1); // Forward
                } else {
                    setRotation('counterclockwise');
                    adjustPlaybackDirection(-1); // Backward
                }
            } else {
                // If rotation is very small, start drifting towards default (only for positive speeds)
                driftTowardsDefaultSpeed();
            }
        }
    }
    
    // Determine rotation direction
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

// Gradually drift speed towards default (0.7x) when hand is idle
// Only applies to forward playback - reverse speeds stay stable
function driftTowardsDefaultSpeed() {
    const DEFAULT_SPEED = 0.7;
    const DRIFT_RATE = 0.003; // Even slower drift rate
    
    // Only drift if we're in forward direction (positive speed)
    if (navigationSpeed > 0) {
        // Only drift if we're not already at the target
        if (Math.abs(navigationSpeed - DEFAULT_SPEED) > 0.01) {
            // Gradually move towards default speed
            const newSpeed = navigationSpeed + (DEFAULT_SPEED - navigationSpeed) * DRIFT_RATE;
            updateTargetNavigationSpeed(newSpeed);
        }
    }
    // If navigationSpeed is negative (reverse), do nothing - maintain reverse speed
}

function detectGestures(landmarks) {
    const now = Date.now();
    if (now - lastGestureTime < gestureCooldown) return;

    // Detect open palm (all fingers extended)
    const isPalmOpen = detectOpenPalm(landmarks);
    if (isPalmOpen) {
        togglePlayPause();
        lastGestureTime = now;
        return;
    }

    // Detect swipe gestures for sidebar control
    const swipe = detectSwipe(landmarks);
    if (swipe && sidebar) {
        if (swipe === 'left') {
            openSidebar();
        } else if (swipe === 'right') {
            closeSidebar();
        }
        lastGestureTime = now;
    }
}

function detectOpenPalm(landmarks) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const indexTip = landmarks[8];
    const indexMcp = landmarks[5];
    const middleTip = landmarks[12];
    const middleMcp = landmarks[9];
    const ringTip = landmarks[16];
    const ringMcp = landmarks[13];
    const pinkyTip = landmarks[20];
    const pinkyMcp = landmarks[17];

    return (thumbTip.y < thumbMcp.y && 
            indexTip.y < indexMcp.y && 
            middleTip.y < middleMcp.y && 
            ringTip.y < ringMcp.y && 
            pinkyTip.y < pinkyMcp.y);
}

function detectSwipe(landmarks) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    
    const handCenterX = (wrist.x + indexTip.x) / 2;
    
    if (handCenterX < 0.3) {
        return 'right';
    } else if (handCenterX > 0.7) {
        return 'left';
    }
    
    return null;
}

function adjustPlaybackDirection(direction) {
    if (!audioBuffer) return;
    
    // Get current direction (handling zero speed case)
    const currentDirection = navigationSpeed < 0 ? -1 : (navigationSpeed > 0 ? 1 : 0);
    
    // If direction is changing (and we're not at zero)
    if (currentDirection !== 0 && currentDirection !== direction) {
        // Smoothly decelerate towards zero instead of jumping to new direction
        const decelerationRate = 0.15;
        const newSpeed = navigationSpeed * (1 - decelerationRate);
        
        // Once we're very close to zero, switch direction and start accelerating
        if (Math.abs(newSpeed) < 0.1) {
            // Start in new direction with small speed
            updateTargetNavigationSpeed(direction * 0.1);
        } else {
            // Continue decelerating
            updateTargetNavigationSpeed(newSpeed);
        }
        return;
    }
    
    // Same direction or starting from zero - gradual speed increase
    const speedIncrement = 0.05;
    const maxSpeed = direction * 4;
    let newSpeed;
    
    if (direction > 0) {
        newSpeed = Math.min(navigationSpeed + speedIncrement, maxSpeed);
    } else {
        newSpeed = Math.max(navigationSpeed - speedIncrement, maxSpeed);
    }
    
    updateTargetNavigationSpeed(newSpeed);
}

function adjustPlaybackSpeed(delta) {
    if (!audioBuffer) return;
    
    const newSpeed = clamp(navigationSpeed + delta, params.navigation.minSpeed, params.navigation.maxSpeed);
    updateTargetNavigationSpeed(newSpeed);
}

function resetSpeedToNormal() {
    if (!audioBuffer) return;
    updateTargetNavigationSpeed(1.0);
}

function togglePlayPause() {
    if (!audioBuffer) return;
    
    if (isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
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
    rotationText.textContent = 'No Rotation';
    detectionStatus.style.background = 'rgba(0, 0, 0, 0.7)';
    currentDirection.innerHTML = '<span>⊙</span>';
    previousAngles = [];
    rotationHistory = [];
    frameTimestamps = [];
    totalRotation = 0;
    rotationVelocity = 0;
    angleDisplay.textContent = '0°';
    speedDisplay.textContent = '0°/s';
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
});

loadDefaultBtn.addEventListener('click', async () => {
    stopPlayback();
    audioFileInput.value = '';

    const duration = 5;
    const sampleRate = 44100;
    const frequency = 440;

    const buffer = audioContext.createBuffer(2, duration * sampleRate, sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.min(t * 2, 1, (duration - t) * 2);
            data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
        }
    }

    audioBuffer = buffer;

    const wavBuffer = bufferToWave(buffer, buffer.length);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const fileURL = URL.createObjectURL(blob);
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
    stopPlayback();
});

function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return buffer;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

speedBar.addEventListener('input', (e) => {
    let newSpeed = clamp(parseFloat(e.target.value), params.navigation.minSpeed, params.navigation.maxSpeed);

    navigationSpeed = newSpeed;
    speedValue.textContent = newSpeed.toFixed(2);

    if (!filterAnimationFrame) {
        updateFilteredSpeed();
    }
});

alphaInput.addEventListener('input', (e) => {
    filterAlpha = clamp(parseFloat(e.target.value), 0.001, 1);
    alphaValue.textContent = filterAlpha.toFixed(3);
});

function updateEffectiveParams() {
    const speed = Math.abs(filteredSpeed);
    const effectiveStep = params.navigation.segmentStep * speed;
    const effectiveInterval = (params.navigation.segmentIntervalMs / 1000) / speed;

    effectiveStepDisplay.textContent = effectiveStep.toFixed(2);
    effectiveIntervalDisplay.textContent = (effectiveInterval * 1000).toFixed(0);
}

segmentDurationInput.addEventListener('input', (e) => {
    params.navigation.segmentDuration = parseFloat(e.target.value);
    updateEffectiveParams();
});

segmentStepInput.addEventListener('input', (e) => {
    params.navigation.segmentStep = parseFloat(e.target.value);
    updateEffectiveParams();
});

segmentIntervalInput.addEventListener('input', (e) => {
    params.navigation.segmentIntervalMs = parseFloat(e.target.value);
    updateEffectiveParams();
});

fadeDurationInput.addEventListener('input', (e) => {
    params.navigation.fadeDuration = parseFloat(e.target.value);
});

function updateFilteredSpeed() {
    const targetSpeed = navigationSpeed;
    const oldFilteredSpeed = filteredSpeed;

    const targetDirection = Math.sign(targetSpeed);
    const currentDirection = Math.sign(filteredSpeed);
    
    // Use constant alpha for consistent filtering rate
    const effectiveAlpha = filterAlpha;

    filteredSpeed = filteredSpeed - effectiveAlpha * (filteredSpeed - targetSpeed);

    filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
    filteredSpeedBar.value = filteredSpeed;

    const newDirection = Math.sign(filteredSpeed);
    
    // Detect if we're about to cross zero (direction change imminent)
    const aboutToCrossZero = (currentDirection !== 0 && targetDirection !== 0 && 
                              currentDirection !== targetDirection && 
                              Math.abs(filteredSpeed) < 0.2);
    
    // Check if we've crossed zero (direction change happened)
    const crossedZero = (currentDirection !== 0 && newDirection !== 0 && currentDirection !== newDirection);
    
    if ((aboutToCrossZero || crossedZero) && isPlaying) {
        // Direction change - switch playback modes
        const currentPos = parseFloat(seekBar.value);
        pauseTime = currentPos;
        
        // Determine which mode we should be in based on target direction
        const shouldBeReverse = targetDirection < 0;
        const currentlyReverse = oldFilteredSpeed < 0;
        
        if (shouldBeReverse !== currentlyReverse) {
            // Need to switch modes
            if (currentlyReverse) {
                // Was reverse, switching to forward
                // Stop reverse chunks
                activeSources.forEach((source) => {
                    try { source.stop(); } catch (e) {}
                });
                activeSources.clear();
                if (scheduleTimeout) {
                    clearTimeout(scheduleTimeout);
                    scheduleTimeout = null;
                }
                // Jump to minimum forward speed to avoid zero
                filteredSpeed = Math.max(0.15, Math.abs(filteredSpeed));
                prevNavigationSpeed = filteredSpeed;
                playForwardNormal(pauseTime);
            } else {
                // Was forward, switching to reverse
                htmlAudioElement.pause();
                // Jump to minimum reverse speed to avoid zero
                filteredSpeed = -Math.max(0.15, Math.abs(filteredSpeed));
                prevNavigationSpeed = filteredSpeed;
                playReverseChunk(pauseTime);
            }
        }
    } else if (isPlaying) {
        // Same direction - just update speed
        applyFilteredSpeed();
    }

    const diff = Math.abs(targetSpeed - filteredSpeed);
    if (diff > 0.001) {
        filterAnimationFrame = requestAnimationFrame(updateFilteredSpeed);
    } else {
        filteredSpeed = targetSpeed;
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

seekBar.addEventListener('input', (e) => {
    const newTime = parseFloat(e.target.value);
    pauseTime = newTime;
    currentTimeDisplay.textContent = formatTime(newTime);
    
    if (isPlaying) {
        stopPlayback();
        setTimeout(() => startPlayback(), 100);
    }
});

playBtn.addEventListener('click', startPlayback);
pauseBtn.addEventListener('click', pausePlayback);

resetBtn.addEventListener('click', () => {
    stopPlayback();
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

    // Allow playback at any speed (even very low speeds during transitions)
    // No minimum speed check here

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
    if (navigationSpeed > 0 && htmlAudioElement.currentTime > 0) {
        pauseTime = htmlAudioElement.currentTime;
    } else {
        pauseTime = parseFloat(seekBar.value);
    }

    stopPlayback();
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

function stepSpeedSmoothing() {
    const { alpha, decay, clickBoostActive, clickBoostDecay, asymptoticDecay } = params.playback;
    const { minSpeed, maxSpeed } = params.navigation;
    const diff = speedState.target - speedState.current;

    speedState.velocity = (speedState.velocity + diff * alpha) * decay;

    if (clickBoostActive) {
        speedState.boost = speedState.boost * clickBoostDecay + diff * alpha;
        speedState.velocity += speedState.boost * asymptoticDecay;
    } else {
        speedState.boost = 0;
    }

    speedState.current = clamp(speedState.current + speedState.velocity, minSpeed, maxSpeed);
    navigationSpeed = speedState.current;
    speedValue.textContent = navigationSpeed.toFixed(2);

    if (Math.abs(diff) < 0.001 && Math.abs(speedState.velocity) < 0.001) {
        speedState.current = clamp(speedState.target, minSpeed, maxSpeed);
        navigationSpeed = speedState.current;
        speedValue.textContent = navigationSpeed.toFixed(2);
        speedSmoothingHandle = null;
        return;
    }

    speedSmoothingHandle = requestAnimationFrame(stepSpeedSmoothing);
}

// ========== INITIALIZATION ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        initializeHands();
    }, 1000);
});
