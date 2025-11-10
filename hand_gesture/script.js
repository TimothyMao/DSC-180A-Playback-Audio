const ANGLE_THRESHOLD = 15;
const SMOOTHING_WINDOW = 5;
const SPEED_CALCULATION_FRAMES = 10;
const ROTATION_SPEED_HISTORY_SIZE = 30;

let hands, camera;
let previousAngles = [];
let rotationHistory = [];
let frameTimestamps = [];
let currentRotation = 'none';
let rotationSpeed = 0;
let rotationSpeedHistory = [];
let gestureControlEnabled = true;
let targetSpeedMomentum = 1.0;

const audio1 = document.getElementById("audio1");
const audio2 = document.getElementById("audio2");
let audioContext;
let source1, source2;
let gainNode1, gainNode2;
let initialized = false;
let intervalId = null;
let currentSpeed = 1.0;
let filteredSpeed = 1.0;
let isPlaying = false;
let currentPosition = 0;
let filterAnimationId = null;
let wasNegative = false;
let speedChangeTimeout;
let positionUpdateInterval = null;
let lastFilteredSpeed = 1.0;
let speedChangeRate = 0;

const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const rotationText = document.getElementById('rotationText');
const currentDirection = document.getElementById('currentDirection');
const speedDisplayStat = document.getElementById('speedDisplay');
const fingerStatus = document.getElementById('fingerStatus');
const detectionStatus = document.getElementById('detectionStatus');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const mainContent = document.getElementById('mainContent');

const speedSlider = document.getElementById("speedControl");
const speedValue = document.getElementById("speedValue");
const targetSpeedDisplay = document.getElementById("targetSpeed");
const filteredSpeedSlider = document.getElementById("filteredSpeedControl");
const alphaInput = document.getElementById("alphaInput");
const playButton = document.getElementById("playButton");
const reversePlaybackSpeedInput = document.getElementById("reversePlaybackSpeed");
const seekBar = document.getElementById("seekBar");
const currentTimeDisplay = document.getElementById("currentTime");
const durationDisplay = document.getElementById("duration");
const audioFileInput = document.getElementById("audioFile");

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingMessage.style.display = 'none';

}

function hideLoading() {
    loadingMessage.style.display = 'none';
    mainContent.style.display = 'grid';
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        audio1.src = url;
        audio2.src = url;
        currentPosition = 0;
        audio1.load();
        audio2.load();
    }
});

async function initializeHands() {
    try {                
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
        hideLoading();

    } catch (error) {
        showError(`Error: ${error.message}. Please refresh the page and try again.`);
    }
}

function onResults(results) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
            {color: 'rgba(255, 255, 255, 0.3)', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, 
            {color: 'rgba(255, 255, 255, 0.5)', lineWidth: 1, radius: 2});
        
        highlightIndexFinger(landmarks);
        detectIndexFingerRotation(landmarks);
    } else {
        fingerStatus.textContent = '❌';
        resetRotationState();
    }
    
    canvasCtx.restore();
}

function highlightIndexFinger(landmarks) {
    const indexFingerPoints = [5, 6, 7, 8];
    
    for (let i = 0; i < indexFingerPoints.length - 1; i++) {
        const start = landmarks[indexFingerPoints[i]];
        const end = landmarks[indexFingerPoints[i + 1]];
        
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = '#00ff00';
        canvasCtx.lineWidth = 5;
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
    }
    
    indexFingerPoints.forEach((idx) => {
        const point = landmarks[idx];
        canvasCtx.beginPath();
        canvasCtx.fillStyle = '#00ff00';
        canvasCtx.arc(
            point.x * canvasElement.width,
            point.y * canvasElement.height,
            8,
            0,
            2 * Math.PI
        );
        canvasCtx.fill();
    });
    
    fingerStatus.textContent = '✅';
}

function detectIndexFingerRotation(landmarks) {
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const wrist = landmarks[0];
    
    const angle = calculateAngle(wrist, indexMCP, indexTip);
    
    previousAngles.push(angle);
    frameTimestamps.push(Date.now());
    
    if (previousAngles.length > SMOOTHING_WINDOW) {
        previousAngles.shift();
        frameTimestamps.shift();
    }
    
    if (previousAngles.length >= 2) {
        const angleDiff = calculateAngleDifference(
            previousAngles[previousAngles.length - 2],
            previousAngles[previousAngles.length - 1]
        );
        
        rotationHistory.push(angleDiff);
        if (rotationHistory.length > SPEED_CALCULATION_FRAMES) {
            rotationHistory.shift();
        }
        
        if (frameTimestamps.length >= 2) {
            const timeDiff = (frameTimestamps[frameTimestamps.length - 1] - 
                            frameTimestamps[0]) / 1000;
            const totalAngleChange = rotationHistory.reduce((sum, val) => sum + val, 0);
            const instantSpeed = totalAngleChange / timeDiff;

            rotationSpeedHistory.push(instantSpeed);
            if (rotationSpeedHistory.length > ROTATION_SPEED_HISTORY_SIZE) {
                rotationSpeedHistory.shift();
            }

            let weightedSum = 0;
            let weightTotal = 0;
            for (let i = 0; i < rotationSpeedHistory.length; i++) {
                const weight = i + 1;
                weightedSum += rotationSpeedHistory[i] * weight;
                weightTotal += weight;
            }
            rotationSpeed = weightedSum / weightTotal;
            
            speedDisplayStat.textContent = `${Math.round(Math.abs(rotationSpeed))}°/s`;
        }
        
        if (Math.abs(angleDiff) > ANGLE_THRESHOLD) {
            if (angleDiff > 0) {
                setRotation('counterclockwise');
            } else {
                setRotation('clockwise');
            }
        } else {
            const trend = rotationHistory.slice(-5).reduce((sum, val) => sum + val, 0);
            if (Math.abs(trend) > ANGLE_THRESHOLD) {
                setRotation(trend > 0 ? 'counterclockwise' : 'clockwise');
            }
        }

        updateSpeedFromGesture();
    }
}

function calculateAngle(p1, p2, p3) {
    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) * 180 / Math.PI;
    return angle;
}

function calculateAngleDifference(angle1, angle2) {
    let diff = angle2 - angle1;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
}

function setRotation(direction) {
    if (currentRotation === direction) return;
    
    currentRotation = direction;
    
    if (direction === 'clockwise') {
        rotationText.textContent = '↻ Clockwise';
        detectionStatus.style.background = 'rgba(74, 222, 128, 0.7)';
        currentDirection.innerHTML = '<span class="rotation-indicator arrow-cw clockwise">↻</span>';
        currentDirection.classList.add('clockwise');
        currentDirection.classList.remove('counterclockwise');
    } else if (direction === 'counterclockwise') {
        rotationText.textContent = '↺ Counter-clockwise';
        detectionStatus.style.background = 'rgba(248, 113, 113, 0.7)';
        currentDirection.innerHTML = '<span class="rotation-indicator arrow-ccw counterclockwise">↺</span>';
        currentDirection.classList.add('counterclockwise');
        currentDirection.classList.remove('clockwise');
    }
}

function resetRotationState() {
    currentRotation = 'none';
    rotationText.textContent = 'No Rotation';
    detectionStatus.style.background = 'rgba(0, 0, 0, 0.7)';
    currentDirection.innerHTML = '<span class="rotation-indicator">⊙</span>';
    currentDirection.classList.remove('clockwise', 'counterclockwise');
    previousAngles = [];
    rotationHistory = [];
    frameTimestamps = [];
    rotationSpeed = 0;
    rotationSpeedHistory = [];
    speedDisplayStat.textContent = '0°/s';
}

function updateSpeedFromGesture() {
    
    const maxRotationSpeed = 800;
    const speedRange = 6;
    const targetSpeedSmoothing = 0.03;
    const rotationDeadzone = 50;

    if (Math.abs(rotationSpeed) < rotationDeadzone) {
        currentSpeed = targetSpeedMomentum;
        speedSlider.value = currentSpeed;
        targetSpeedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
        return;
    }

    const normalizedSpeed = Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, rotationSpeed));
    const gestureIndicatedSpeed = -(normalizedSpeed / maxRotationSpeed) * speedRange;

    targetSpeedMomentum += (gestureIndicatedSpeed - targetSpeedMomentum) * targetSpeedSmoothing;

    const newSpeed = Math.max(-4.0, Math.min(2.0, targetSpeedMomentum));
    
    currentSpeed = newSpeed;
    speedSlider.value = newSpeed;
    targetSpeedDisplay.textContent = newSpeed.toFixed(2) + 'x';
    
    if (filterAnimationId) {
        cancelAnimationFrame(filterAnimationId);
    }
    updateFilteredSpeed();
}

function updateFilteredSpeed() {
    const alpha = parseFloat(alphaInput.value);
    const targetSpeed = currentSpeed;
    const prevFilteredSpeed = filteredSpeed;
    filteredSpeed = filteredSpeed - alpha * (filteredSpeed - targetSpeed);
    speedValue.textContent = filteredSpeed.toFixed(2) + 'x';
    filteredSpeedSlider.value = filteredSpeed;

    speedChangeRate = Math.abs(filteredSpeed - lastFilteredSpeed);
    lastFilteredSpeed = filteredSpeed;

    const crossedZero = (prevFilteredSpeed >= 0 && filteredSpeed < 0) || (prevFilteredSpeed < 0 && filteredSpeed >= 0);

    if (isPlaying && crossedZero) {
        clearTimeout(speedChangeTimeout);
        wasNegative = filteredSpeed < 0;

        if (filteredSpeed >= 0) {
            startForwardPlayback();
        } else {
            currentPosition = audio1.currentTime || currentPosition;
            startBackwardPlayback();
        }
    } else if (isPlaying && filteredSpeed < 0) {
        if (speedChangeRate < 0.05 && intervalId) {
            clearTimeout(speedChangeTimeout);
            speedChangeTimeout = setTimeout(() => {
                if (isPlaying && filteredSpeed < 0) {
                    startBackwardPlayback();
                }
                wasNegative = filteredSpeed < 0;
            }, 20);
        } else if (!intervalId) {
            startBackwardPlayback();
        }
    } else if (isPlaying && filteredSpeed >= 0) {
        audio1.playbackRate = Math.max(0.0625, filteredSpeed);
    }

    const diff = Math.abs(filteredSpeed - targetSpeed);
    if (diff > 0.001) {
        filterAnimationId = requestAnimationFrame(updateFilteredSpeed);
    } else {
        filteredSpeed = targetSpeed;
        speedValue.textContent = filteredSpeed.toFixed(2) + 'x';
        filteredSpeedSlider.value = filteredSpeed;
        filterAnimationId = null;
    }
}

audio1.addEventListener("loadedmetadata", () => {
    seekBar.max = audio1.duration;
    durationDisplay.textContent = formatTime(audio1.duration);
});

setInterval(() => {
    if (isPlaying) {
        currentTimeDisplay.textContent = formatTime(currentPosition);
        seekBar.value = currentPosition;
    }
}, 100);

seekBar.addEventListener("input", () => {
    currentPosition = parseFloat(seekBar.value);
    currentTimeDisplay.textContent = formatTime(currentPosition);
    if (filteredSpeed >= 0) {
        audio1.currentTime = currentPosition;
        audio2.currentTime = currentPosition;
    }
});

function initAudioContext() {
    if (!initialized) {
        audioContext = new AudioContext();
        source1 = audioContext.createMediaElementSource(audio1);
        source2 = audioContext.createMediaElementSource(audio2);
        gainNode1 = audioContext.createGain();
        gainNode2 = audioContext.createGain();
        source1.connect(gainNode1);
        source2.connect(gainNode2);
        gainNode1.connect(audioContext.destination);
        gainNode2.connect(audioContext.destination);
        gainNode1.gain.value = 1.0;
        gainNode2.gain.value = 1.0;
        initialized = true;
    }
}

function startBackwardPlayback() {
    if (intervalId) clearInterval(intervalId);

    const absSpeed = Math.abs(filteredSpeed);
    const chunkLength = 1.0;
    const jumpSize = 1.0;
    const updateInterval = Math.max(50, 1000 / absSpeed);
    const playbackSpeed = parseFloat(reversePlaybackSpeedInput.value);
    const windowDuration = 0.02;

    let useAudio1 = true;
    let timeout1 = null;
    let timeout2 = null;

    window.backwardTimeout1 = null;
    window.backwardTimeout2 = null;

    audio1.currentTime = currentPosition;
    audio1.playbackRate = playbackSpeed;
    gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode1.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + windowDuration);
    audio1.play();
    gainNode2.gain.value = 0;

    timeout1 = setTimeout(() => {
        gainNode1.gain.setValueAtTime(1.0, audioContext.currentTime);
        gainNode1.gain.linearRampToValueAtTime(0, audioContext.currentTime + windowDuration);
        setTimeout(() => audio1.pause(), windowDuration * 1000);
    }, (chunkLength - windowDuration) * 1000);
    window.backwardTimeout1 = timeout1;

    intervalId = setInterval(() => {
        if (!isPlaying) return;

        currentPosition = Math.max(0, currentPosition - jumpSize);

        const activeAudio = useAudio1 ? audio2 : audio1;
        const activeGain = useAudio1 ? gainNode2 : gainNode1;
        const activeTimeout = useAudio1 ? timeout2 : timeout1;

        if (activeTimeout) clearTimeout(activeTimeout);

        activeGain.gain.setValueAtTime(0, audioContext.currentTime);
        activeGain.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + windowDuration);

        activeAudio.currentTime = currentPosition;
        activeAudio.playbackRate = playbackSpeed;
        activeAudio.play();

        const newTimeout = setTimeout(() => {
            activeGain.gain.setValueAtTime(1.0, audioContext.currentTime);
            activeGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + windowDuration);
            setTimeout(() => activeAudio.pause(), windowDuration * 1000);
        }, (chunkLength - windowDuration) * 1000);

        if (useAudio1) {
            timeout2 = newTimeout;
            window.backwardTimeout2 = newTimeout;
        } else {
            timeout1 = newTimeout;
            window.backwardTimeout1 = newTimeout;
        }

        useAudio1 = !useAudio1;

        if (currentPosition <= 0) {
            stopPlayback();
        }
    }, updateInterval);
}

function stopBackwardPlayback() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (window.backwardTimeout1) {
        clearTimeout(window.backwardTimeout1);
        window.backwardTimeout1 = null;
    }
    if (window.backwardTimeout2) {
        clearTimeout(window.backwardTimeout2);
        window.backwardTimeout2 = null;
    }
    audio1.pause();
    audio2.pause();
}

function startForwardPlayback() {
    stopBackwardPlayback();
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
    }

    gainNode1.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode2.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode1.gain.value = 1.0;
    gainNode2.gain.value = 0;

    audio2.pause();
    audio2.currentTime = 0;

    audio1.currentTime = currentPosition;
    audio1.playbackRate = Math.max(0.0625, filteredSpeed);
    audio1.play();

    positionUpdateInterval = setInterval(() => {
        if (!isPlaying || filteredSpeed < 0) {
            clearInterval(positionUpdateInterval);
            positionUpdateInterval = null;
            return;
        }
        currentPosition = audio1.currentTime;
    }, 100);
}

function stopPlayback() {
    isPlaying = false;
    stopBackwardPlayback();
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
        positionUpdateInterval = null;
    }
    audio1.pause();
    audio2.pause();
}

playButton.addEventListener("click", () => {
    initAudioContext();

    if (isPlaying) {
        stopPlayback();
    } else {
        isPlaying = true;
        if (filteredSpeed < 0) {
            startBackwardPlayback();
        } else {
            startForwardPlayback();
        }
    }
});

speedSlider.addEventListener("input", () => {
    currentSpeed = parseFloat(speedSlider.value);
    targetSpeedMomentum = currentSpeed;
    targetSpeedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
    if (filterAnimationId) {
        cancelAnimationFrame(filterAnimationId);
    }
    updateFilteredSpeed();
});

audio1.addEventListener("ended", () => {
    if (filteredSpeed >= 0) {
        stopPlayback();
    }
});

reversePlaybackSpeedInput.addEventListener("input", () => {
    if (isPlaying && filteredSpeed < 0) {
        startBackwardPlayback();
    }
});

window.addEventListener('load', () => {
    setTimeout(() => {
        initializeHands();
    }, 1000);
});