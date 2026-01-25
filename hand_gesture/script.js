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
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,  // Increased from 0.5 for better detection
            minTrackingConfidence: 0.7    // Increased from 0.5 for smoother tracking at speed
        });

        hands.onResults(onResults);

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

        console.log("MediaPipe initialized, starting camera...");

        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility failed to load.');
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
                if (selfieSegmentation) {
                    await selfieSegmentation.send({image: videoElement});
                }
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
    
    // If we have segmentation results, apply background blur
    if (segmentationResults && segmentationResults.segmentationMask) {
        // Step 1: Draw the clear person first
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        // Step 2: Use the mask to keep only the person (cut out the person)
        canvasCtx.globalCompositeOperation = 'destination-in';
        canvasCtx.drawImage(segmentationResults.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
        
        // Step 3: Create blurred background on a temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasElement.width;
        tempCanvas.height = canvasElement.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw blurred version of the entire image
        tempCtx.filter = 'blur(20px)';
        tempCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        // Step 4: Draw blurred background behind the clear person
        canvasCtx.globalCompositeOperation = 'destination-over';
        canvasCtx.drawImage(tempCanvas, 0, 0);
        
        // Reset composite operation
        canvasCtx.globalCompositeOperation = 'source-over';
    } else {
        // No segmentation, just draw the image normally
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        isFingerDetected = true;
        lastHandDetectedTime = Date.now();
        
        if (handTimeoutTimer) {
            clearTimeout(handTimeoutTimer);
            handTimeoutTimer = null;
        }
        
        if (gestureControlEnabled) {
            // Check play/pause gestures for both modes
            detectPlayPauseGesture(landmarks);
            
            // Check play gesture when not playing (either never started or manually paused)
            if (!isPlaying) {
                detectPlayGesture(landmarks);
            } else {
                // Reset play gesture if playing
                if (playGestureActive) {
                    console.log(`[${controlMode}] Resetting play gesture - already playing`);
                    playGestureActive = false;
                    playGestureRotation = 0;
                    playGesturePreviousAngles = [];
                }
            }
        }
        
        highlightIndexFinger(landmarks);

        // Always detect rotation/velocity for control, regardless of play state
        if (controlMode === 'distance') {
            detectIndexFingerRotation(landmarks);
        } else {
            detectFingerVelocity(landmarks);
        }
    } else {
        isFingerDetected = false;
        fingerStatus.textContent = '❌';
        resetRotationState();
        
        // Reset motion prediction
        lastFingerTip = null;
        fingerVelocityX = 0;
        fingerVelocityY = 0;
        
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
    } catch (error) {
        console.error('Error loading default audio:', error);
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
        
        if (isPlaying && !manuallyPaused) {
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
    
    if (crossedDeadZone && isPlaying && !manuallyPaused) {
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
    
    if (isPlaying && !manuallyPaused) {
        applyFilteredSpeed();
    }

    previousGestureTarget = gestureTarget;

    const diff = Math.abs(gestureTarget - filteredSpeed);
    if (diff > 0.001) {
        filterAnimationFrame = requestAnimationFrame(updateFilteredSpeed);
    } else {
        filteredSpeed = gestureTarget;
        filteredSpeedValue.textContent = filteredSpeed.toFixed(2);
        filteredSpeedBar.value = filteredSpeed;
        if (isPlaying && !manuallyPaused) {
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
    console.log(`[${controlMode}] pausePlayback called - setting manuallyPaused = true`);
    manuallyPaused = true;

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