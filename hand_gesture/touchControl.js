const TouchControl = {
    // Touch control statez
    isTouching: false,
    touchPoints: [],
    lastTapTime: 0,
    tapCount: 0,
    tapTimes: [],
    gestureMode: null,
    circleDirection: null,
    lastValidCircleSpeed: 0,
    lastCircleUpdateTime: 0,
    lastGestureTime: 0,
    decayTimeout: null,
    decayIntervalHandle: null,
    
    // Scroll mode state
    inputMode: 'tap',
    scrollHistory: [],
    lastScrollUpdateTime: 0,
    currentScrollDirection: null,
    touchScrollStartY: null,
    touchScrollStartTime: null,
    touchScrollLastY: null,
    touchScrollLastTime: null,
    scrollSessionStartTime: null,
    scrollDecayStartTimeout: null,
    speedDecayCountdownInterval: null,
    speedDecayCountdownTargetTime: null,
    smoothedScrollPlaybackSpeed: 1.0,
    lastScrollEventTime: 0,
    smoothedScrollSpeed: 0,
    
    // Constants
    TAP_WINDOW_MS: 2000,
    CIRCLE_POINTS_NEEDED: 7,
    CIRCLE_UPDATE_POINTS: 5,
    GESTURE_TIMEOUT_MS: 3000,
    DEFAULT_DECAY_SPEED: 0.5,
    CIRCLE_UPDATE_INTERVAL_MS: 100,
    
    SCROLL_HISTORY_WINDOW_MS: 200,
    SCROLL_UPDATE_INTERVAL_MS: 50,
    SCROLL_SMOOTHING: 0.3,
    MAX_SCROLL_SPEED: 2400,
    SCROLL_SENSITIVITY_FACTOR: 5,
    CORE_SCROLL_EASE_STRENGTH: 2.2,
    CORE_SCROLL_MAX_SPEED: 1.1,
    EXTREME_SCROLL_THRESHOLD: 0.9,
    SCROLL_PLAYBACK_SMOOTHING: 0.25,
    MAX_PLAYBACK_RATE: 4,
    SCROLL_STOP_DEBOUNCE_MS: 300,
    SCROLL_DECAY_MIN_DELAY_MS: 2000,
    SCROLL_DECAY_MAX_DELAY_MS: 8000,
    SCROLL_DECAY_MAX_SESSION_MS: 2000,
    
    // DOM elements
    touchControlArea: null,
    touchIndicator: null,
    inputModeToggle: null,
    inputModeLabel: null,
    leftZoneLabel: null,
    rightZoneLabel: null,
    baseBPMInput: null,
    gestureAmplitudeInput: null,
    decaySpeedInput: null,
    speedDecaySlider: null,
    speedDecayLabel: null,
    speedDecayGroup: null,
    
    // Reference to main script API
    mainScript: null,
    
    init(mainScriptRef) {
        this.mainScript = mainScriptRef;
        
        // Get DOM elements
        this.touchControlArea = document.getElementById('touch-control-area');
        this.touchIndicator = document.getElementById('touch-indicator');
        this.inputModeToggle = document.getElementById('input-mode-toggle');
        this.inputModeLabel = document.getElementById('input-mode-label');
        this.leftZoneLabel = document.getElementById('left-zone-label');
        this.rightZoneLabel = document.getElementById('right-zone-label');
        this.baseBPMInput = document.getElementById('1x-bpm');
        this.gestureAmplitudeInput = document.getElementById('gesture-amplitude');
        this.decaySpeedInput = document.getElementById('decay-speed');
        this.speedDecaySlider = document.getElementById('speed-decay-display');
        this.speedDecayLabel = document.getElementById('speed-decay-label');
        this.speedDecayGroup = document.getElementById('speed-decay-group');
        
        if (!this.touchControlArea) {
            console.warn('Touch control area not found');
            return;
        }
        
        this.setupEventListeners();
        this.updateInputModeLabels();
        this.updateSpeedDecayDisplay(this.SCROLL_DECAY_MIN_DELAY_MS);
        
        console.log('Touch control initialized');
    },
    
    setupEventListeners() {
        // Touch control area events
        this.touchControlArea.addEventListener('mousedown', this.handleTouchStart.bind(this));
        this.touchControlArea.addEventListener('mousemove', this.handleTouchMove.bind(this));
        this.touchControlArea.addEventListener('mouseup', this.handleTouchEnd.bind(this));
        this.touchControlArea.addEventListener('mouseleave', this.handleTouchEnd.bind(this));
        
        this.touchControlArea.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.touchControlArea.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.touchControlArea.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.touchControlArea.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
        
        this.touchControlArea.addEventListener('wheel', this.handleScroll.bind(this), { passive: false });
        
        // Input mode toggle
        if (this.inputModeToggle) {
            this.inputModeToggle.addEventListener('change', (event) => {
                this.inputMode = event.target.checked ? 'scroll' : 'tap';
                this.updateInputModeLabels();
                this.resetGestureState();
                this.setTargetSpeed(this.DEFAULT_DECAY_SPEED);
                this.updateSpeedDecayDisplay(this.SCROLL_DECAY_MIN_DELAY_MS);
            });
        }
        
        // Parameter change listeners
        if (this.gestureAmplitudeInput) {
            this.gestureAmplitudeInput.addEventListener('input', () => {
                const amplitude = parseFloat(this.gestureAmplitudeInput.value);
                // Update the amplitude in main script
                if (this.mainScript && this.mainScript.params) {
                    this.mainScript.params.filtering.gestureAmplitude = amplitude;
                }
            });
        }
    },
    
    resetGestureState() {
        this.touchPoints = [];
        this.scrollHistory = [];
        this.gestureMode = null;
        this.circleDirection = null;
        this.smoothedScrollSpeed = 0;
        this.scrollSessionStartTime = null;
        if (this.scrollDecayStartTimeout) {
            clearTimeout(this.scrollDecayStartTimeout);
            this.scrollDecayStartTimeout = null;
        }
        this.resetScrollPlaybackSmoothing(this.mainScript.navigationSpeed);
    },
    
    // ===== GESTURE DETECTION FUNCTIONS =====
    
    calculateAngle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    },
    
    detectCircleGesture() {
        if (this.touchPoints.length < this.CIRCLE_POINTS_NEEDED) return null;
        
        const recentPoints = this.touchPoints.slice(-Math.min(15, this.touchPoints.length));
        
        const centerX = recentPoints.reduce((sum, p) => sum + p.x, 0) / recentPoints.length;
        const centerY = recentPoints.reduce((sum, p) => sum + p.y, 0) / recentPoints.length;
        
        let totalAngleChange = 0;
        for (let i = 1; i < recentPoints.length; i++) {
            const angle1 = Math.atan2(recentPoints[i-1].y - centerY, recentPoints[i-1].x - centerX);
            const angle2 = Math.atan2(recentPoints[i].y - centerY, recentPoints[i].x - centerX);
            
            let angleDiff = angle2 - angle1;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            totalAngleChange += angleDiff;
        }
        
        const initialThreshold = Math.PI / 2;
        const continuationThreshold = Math.PI / 12;
        const threshold = this.circleDirection ? continuationThreshold : initialThreshold;
        
        if (this.circleDirection === 'clockwise' && totalAngleChange < -Math.PI / 2) {
            return 'counterclockwise';
        } else if (this.circleDirection === 'counterclockwise' && totalAngleChange > Math.PI / 2) {
            return 'clockwise';
        }
        
        if (totalAngleChange > threshold) {
            return 'clockwise';
        } else if (totalAngleChange < -threshold) {
            return 'counterclockwise';
        }
        
        return this.circleDirection;
    },
    
    calculateCircleSpeed() {
        if (this.touchPoints.length < 5) return 0;
        
        const pointsToUse = Math.min(20, Math.max(5, this.touchPoints.length));
        const recentPoints = this.touchPoints.slice(-pointsToUse);
        const timeSpan = (recentPoints[recentPoints.length - 1].time - recentPoints[0].time) / 1000;
        
        if (timeSpan < 0.05 || timeSpan === 0) return 0;
        
        const centerX = recentPoints.reduce((sum, p) => sum + p.x, 0) / recentPoints.length;
        const centerY = recentPoints.reduce((sum, p) => sum + p.y, 0) / recentPoints.length;
        
        let totalRadius = 0;
        for (const point of recentPoints) {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            totalRadius += Math.sqrt(dx * dx + dy * dy);
        }
        const avgRadius = totalRadius / recentPoints.length;
        
        if (avgRadius < 10 || avgRadius > 300) return 0;
        
        let totalArcLength = 0;
        for (let i = 1; i < recentPoints.length; i++) {
            const dx = recentPoints[i].x - recentPoints[i-1].x;
            const dy = recentPoints[i].y - recentPoints[i-1].y;
            totalArcLength += Math.sqrt(dx * dx + dy * dy);
        }
        
        const arcLengthPerSec = totalArcLength / timeSpan;
        const circumference = 2 * Math.PI * avgRadius;
        const rawRotationsPerSecond = arcLengthPerSec / circumference;
        const radiusScaleFactor = Math.sqrt(avgRadius / 80);
        const circleSpeed = rawRotationsPerSecond * radiusScaleFactor;
        
        if (circleSpeed > 0.08) {
            this.lastValidCircleSpeed = circleSpeed;
        }
        
        return circleSpeed > 0 ? circleSpeed : this.lastValidCircleSpeed;
    },
    
    calculateBPMFromTaps() {
        const now = Date.now();
        this.tapTimes = this.tapTimes.filter(time => now - time < this.TAP_WINDOW_MS);
        
        if (this.tapTimes.length < 2) return null;
        
        let totalInterval = 0;
        for (let i = 1; i < this.tapTimes.length; i++) {
            totalInterval += this.tapTimes[i] - this.tapTimes[i-1];
        }
        const avgInterval = totalInterval / (this.tapTimes.length - 1);
        
        return 60000 / avgInterval;
    },
    
    bpmToSpeed(bpm) {
        const baseBPM = parseFloat(this.baseBPMInput?.value || 60);
        const amplitude = this.mainScript.params.filtering.gestureAmplitude;
        const baseSpeed = Math.max(0.25, Math.min(4, bpm / baseBPM));
        return baseSpeed * amplitude;
    },
    
    circleSpeedToRewindSpeed(circleSpeed) {
        const maxRotationsPerSec = 4.0;
        const maxSpeed = -4.0;
        const minRotations = 0.08;
        const amplitude = this.mainScript.params.filtering.gestureAmplitude;
        
        if (!circleSpeed || isNaN(circleSpeed) || circleSpeed < minRotations) return 0;
        
        const mappedSpeed = (circleSpeed / maxRotationsPerSec) * Math.abs(maxSpeed);
        return -Math.min(Math.abs(maxSpeed), mappedSpeed) * amplitude;
    },
    
    circleSpeedToForwardSpeed(circleSpeed) {
        const maxRotationsPerSec = 4.0;
        const maxSpeed = 4.0;
        const minRotations = 0.08;
        const amplitude = this.mainScript.params.filtering.gestureAmplitude;
        
        if (!circleSpeed || isNaN(circleSpeed) || circleSpeed < minRotations) return 0;
        
        const forwardSpeed = (circleSpeed / maxRotationsPerSec) * maxSpeed;
        return Math.min(maxSpeed, forwardSpeed) * amplitude;
    },
    
    // ===== SCROLL MODE FUNCTIONS =====
    
    scrollSpeedToPlaybackSpeed(rawScrollSpeed) {
        if (!rawScrollSpeed) return 0;
        
        const amplitude = this.mainScript.params.filtering.gestureAmplitude;
        const normalizedSpeed = Math.min(1, Math.abs(rawScrollSpeed) / (this.MAX_SCROLL_SPEED * this.SCROLL_SENSITIVITY_FACTOR));
        
        const easedCore = Math.tanh(normalizedSpeed * this.CORE_SCROLL_EASE_STRENGTH);
        let playbackSpeed = easedCore * this.CORE_SCROLL_MAX_SPEED;
        
        if (normalizedSpeed > this.EXTREME_SCROLL_THRESHOLD) {
            const extremeFactor = (normalizedSpeed - this.EXTREME_SCROLL_THRESHOLD) / (1 - this.EXTREME_SCROLL_THRESHOLD);
            const extraSpeed = extremeFactor * (this.MAX_PLAYBACK_RATE - this.CORE_SCROLL_MAX_SPEED);
            playbackSpeed = this.CORE_SCROLL_MAX_SPEED + extraSpeed;
        }
        
        playbackSpeed = Math.min(this.MAX_PLAYBACK_RATE, Math.max(0, playbackSpeed)) * amplitude;
        
        return rawScrollSpeed > 0 ? playbackSpeed : -playbackSpeed;
    },
    
    calculateScrollSpeed() {
        const now = Date.now();
        this.scrollHistory = this.scrollHistory.filter(event => now - event.time < this.SCROLL_HISTORY_WINDOW_MS);
        
        if (this.scrollHistory.length < 2) {
            this.smoothedScrollSpeed = this.smoothedScrollSpeed * 0.9;
            return this.smoothedScrollSpeed;
        }
        
        const firstEvent = this.scrollHistory[0];
        const lastEvent = this.scrollHistory[this.scrollHistory.length - 1];
        const totalDelta = lastEvent.cumulativeDelta;
        const timeSpan = (lastEvent.time - firstEvent.time) / 1000;
        
        if (timeSpan === 0) return this.smoothedScrollSpeed;
        
        const rawSpeed = totalDelta / timeSpan;
        this.smoothedScrollSpeed = this.smoothedScrollSpeed + this.SCROLL_SMOOTHING * (rawSpeed - this.smoothedScrollSpeed);
        
        return this.smoothedScrollSpeed;
    },
    
    resetScrollPlaybackSmoothing(value) {
        this.smoothedScrollPlaybackSpeed = value;
    },
    
    setScrollPlaybackTarget(targetSpeed) {
        this.smoothedScrollPlaybackSpeed = this.smoothedScrollPlaybackSpeed + 
            this.SCROLL_PLAYBACK_SMOOTHING * (targetSpeed - this.smoothedScrollPlaybackSpeed);
        return this.smoothedScrollPlaybackSpeed;
    },
    
    applyScrollPlaybackSpeedTarget(targetSpeed) {
        const stabilizedSpeed = this.setScrollPlaybackTarget(targetSpeed);
        this.setTargetSpeed(stabilizedSpeed);
        return stabilizedSpeed;
    },
    
    updateSpeedDecayDisplay(delayMs) {
        const seconds = delayMs / 1000;
        const clampedSeconds = Math.max(0, Math.min(8, seconds));
        if (this.speedDecaySlider) {
            this.speedDecaySlider.value = clampedSeconds.toFixed(2);
        }
        if (this.speedDecayLabel) {
            this.speedDecayLabel.textContent = `${seconds.toFixed(2)}s`;
        }
    },
    
    calculateDecayDelay(sessionDurationMs = 0) {
        const normalizedDuration = Math.min(1, sessionDurationMs / this.SCROLL_DECAY_MAX_SESSION_MS);
        return this.SCROLL_DECAY_MIN_DELAY_MS +
            normalizedDuration * (this.SCROLL_DECAY_MAX_DELAY_MS - this.SCROLL_DECAY_MIN_DELAY_MS);
    },
    
    clearSpeedDecayCountdown(options = {}) {
        if (this.speedDecayCountdownInterval) {
            clearInterval(this.speedDecayCountdownInterval);
            this.speedDecayCountdownInterval = null;
        }
        this.speedDecayCountdownTargetTime = null;
        if (options.resetDisplay) {
            this.updateSpeedDecayDisplay(this.SCROLL_DECAY_MIN_DELAY_MS);
        }
    },
    
    startSpeedDecayCountdown(durationMs) {
        this.clearSpeedDecayCountdown();
        this.updateSpeedDecayDisplay(durationMs);
        if (durationMs <= 0) {
            this.startDecayToDefault(0);
            return;
        }
        this.speedDecayCountdownTargetTime = Date.now() + durationMs;
        this.speedDecayCountdownInterval = setInterval(() => {
            const remainingMs = Math.max(0, this.speedDecayCountdownTargetTime - Date.now());
            this.updateSpeedDecayDisplay(remainingMs);
            if (remainingMs <= 0) {
                this.clearSpeedDecayCountdown();
                this.startDecayToDefault(0);
            }
        }, 100);
    },
    
    registerScrollActivity() {
        const now = Date.now();
        const timeSinceLastEvent = now - this.lastScrollEventTime;
        const isNewSession = this.scrollSessionStartTime === null || timeSinceLastEvent > this.SCROLL_STOP_DEBOUNCE_MS;
        
        if (isNewSession) {
            this.scrollSessionStartTime = now;
            this.scrollHistory = [];
            this.smoothedScrollSpeed = 0;
            this.resetScrollPlaybackSmoothing(this.DEFAULT_DECAY_SPEED);
            if (this.inputMode === 'scroll') {
                this.setTargetSpeed(this.DEFAULT_DECAY_SPEED);
            }
        }
        this.lastScrollEventTime = now;
        if (this.decayTimeout) {
            clearTimeout(this.decayTimeout);
            this.decayTimeout = null;
        }
        if (this.decayIntervalHandle) {
            clearInterval(this.decayIntervalHandle);
            this.decayIntervalHandle = null;
        }
        if (this.scrollDecayStartTimeout) {
            clearTimeout(this.scrollDecayStartTimeout);
            this.scrollDecayStartTimeout = null;
        }
        this.clearSpeedDecayCountdown();
        const sessionDuration = this.scrollSessionStartTime ? now - this.scrollSessionStartTime : 0;
        const decayDelay = this.calculateDecayDelay(sessionDuration);
        this.updateSpeedDecayDisplay(decayDelay);
    },
    
    scheduleScrollDecayAfterInactivity() {
        if (this.scrollDecayStartTimeout) {
            clearTimeout(this.scrollDecayStartTimeout);
        }
        
        this.scrollDecayStartTimeout = setTimeout(() => {
            const now = Date.now();
            const sessionDuration = this.scrollSessionStartTime ? now - this.scrollSessionStartTime : 0;
            this.scrollSessionStartTime = null;
            this.scrollDecayStartTimeout = null;
            
            const decayDelay = this.calculateDecayDelay(sessionDuration);
            this.startSpeedDecayCountdown(decayDelay);
        }, this.SCROLL_STOP_DEBOUNCE_MS);
    },
    
    startDecayToDefault(customDelay = this.GESTURE_TIMEOUT_MS) {
        if (this.decayTimeout) {
            clearTimeout(this.decayTimeout);
        }
        if (this.decayIntervalHandle) {
            clearInterval(this.decayIntervalHandle);
            this.decayIntervalHandle = null;
        }
        
        this.decayTimeout = setTimeout(() => {
            const decayAlpha = parseFloat(this.decaySpeedInput?.value || 0.05);
            
            this.decayIntervalHandle = setInterval(() => {
                let nextTarget = this.mainScript.navigationSpeed;
                
                if (this.mainScript.navigationSpeed < 0) {
                    nextTarget = Math.min(this.DEFAULT_DECAY_SPEED, this.mainScript.navigationSpeed + decayAlpha);
                } else if (this.mainScript.navigationSpeed > this.DEFAULT_DECAY_SPEED) {
                    nextTarget = Math.max(this.DEFAULT_DECAY_SPEED, this.mainScript.navigationSpeed - decayAlpha);
                } else if (this.mainScript.navigationSpeed < this.DEFAULT_DECAY_SPEED) {
                    nextTarget = Math.min(this.DEFAULT_DECAY_SPEED, this.mainScript.navigationSpeed + decayAlpha);
                } else {
                    clearInterval(this.decayIntervalHandle);
                    this.decayIntervalHandle = null;
                }
                
                if (Math.abs(nextTarget - this.DEFAULT_DECAY_SPEED) < 0.01) {
                    nextTarget = this.DEFAULT_DECAY_SPEED;
                    clearInterval(this.decayIntervalHandle);
                    this.decayIntervalHandle = null;
                }
                
                this.setTargetSpeed(nextTarget);
            }, 100);
            
            this.gestureMode = null;
            this.circleDirection = null;
        }, customDelay);
    },
    
    // ===== TOUCH EVENT HANDLERS =====
    
    handleTouchControl(event) {
        event.preventDefault();
        
        const rect = this.touchControlArea.getBoundingClientRect();
        const x = (event.type.includes('touch') ? event.touches[0].clientX : event.clientX) - rect.left;
        const y = (event.type.includes('touch') ? event.touches[0].clientY : event.clientY) - rect.top;
        
        const now = Date.now();
        this.touchPoints.push({ x, y, time: now });
        this.touchPoints = this.touchPoints.filter(p => now - p.time < 2000);
        this.lastGestureTime = now;
        
        const direction = this.detectCircleGesture();
        
        if (direction) {
            const previousGestureMode = this.gestureMode;
            const previousCircleDirection = this.circleDirection;
            
            this.gestureMode = 'circle';
            this.circleDirection = direction;
            
            if (direction === 'counterclockwise' && 
                (previousGestureMode !== 'circle' || previousCircleDirection !== 'counterclockwise')) {
                this.setTargetSpeed(-0.7);
            }
            
            if (direction === 'clockwise' && 
                (previousGestureMode !== 'circle' || previousCircleDirection !== 'clockwise')) {
                this.setTargetSpeed(0.7);
            }
            
            this.tapTimes = [];
        }
        
        if (this.gestureMode === 'circle' && this.circleDirection === 'counterclockwise') {
            if (now - this.lastCircleUpdateTime > this.CIRCLE_UPDATE_INTERVAL_MS) {
                const circleSpeed = this.calculateCircleSpeed();
                const rewindSpeed = this.circleSpeedToRewindSpeed(circleSpeed);
                if (rewindSpeed !== 0) {
                    this.setTargetSpeed(rewindSpeed);
                }
                this.lastCircleUpdateTime = now;
            }
        } else if (this.gestureMode === 'circle' && this.circleDirection === 'clockwise') {
            if (now - this.lastCircleUpdateTime > this.CIRCLE_UPDATE_INTERVAL_MS) {
                const circleSpeed = this.calculateCircleSpeed();
                const forwardSpeed = this.circleSpeedToForwardSpeed(circleSpeed);
                if (forwardSpeed !== 0) {
                    this.setTargetSpeed(forwardSpeed);
                }
                this.lastCircleUpdateTime = now;
            }
        }
        
        // Update indicator
        if (this.touchIndicator) {
            this.touchIndicator.classList.add('active');
            this.touchIndicator.style.left = `${x - 30}px`;
            this.touchIndicator.style.top = `${y - 30}px`;
            
            if (this.gestureMode === 'circle' && this.circleDirection === 'counterclockwise') {
                const intensity = Math.abs(this.mainScript.navigationSpeed / 2.0);
                const red = Math.floor(255 * Math.max(0.4, intensity));
                this.touchIndicator.style.background = `rgba(${red}, 100, 100, 0.8)`;
            } else if (this.gestureMode === 'circle' && this.circleDirection === 'clockwise') {
                const intensity = Math.abs(this.mainScript.navigationSpeed / 2.0);
                const blue = Math.floor(255 * Math.max(0.4, intensity));
                this.touchIndicator.style.background = `rgba(100, 100, ${blue}, 0.8)`;
            } else if (this.gestureMode === 'tap') {
                this.touchIndicator.style.background = 'rgba(100, 255, 100, 0.8)';
            } else {
                this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
            }
        }
    },
    
    handleTouchStart(event) {
        if (this.mainScript.controlMode !== 'touch') return;
        
        this.isTouching = true;
        
        const rect = this.touchControlArea.getBoundingClientRect();
        const x = (event.type.includes('touch') ? event.touches[0].clientX : event.clientX) - rect.left;
        const y = (event.type.includes('touch') ? event.touches[0].clientY : event.clientY) - rect.top;
        const now = Date.now();
        
        if (this.inputMode === 'scroll') {
            event.preventDefault();
            this.touchScrollStartY = y;
            this.touchScrollStartTime = now;
            this.touchScrollLastY = y;
            this.touchScrollLastTime = now;
            this.scrollHistory = [];
            this.smoothedScrollSpeed = 0;
            this.currentScrollDirection = null;
            
            if (this.touchIndicator) {
                this.touchIndicator.classList.add('active');
                this.touchIndicator.style.left = `${x - 30}px`;
                this.touchIndicator.style.top = `${y - 30}px`;
                this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
            }
        } else {
            this.touchPoints = [];
            this.gestureMode = null;
            this.circleDirection = null;
            
            event.preventDefault();
            this.touchPoints.push({ x, y, time: now });
            
            if (this.touchIndicator) {
                this.touchIndicator.classList.add('active');
                this.touchIndicator.style.left = `${x - 30}px`;
                this.touchIndicator.style.top = `${y - 30}px`;
                this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
            }
        }
        
        this.startDecayToDefault();
    },
    
    handleTouchMove(event) {
        if (this.mainScript.controlMode !== 'touch') return;
        if (!this.isTouching) return;
        
        if (this.decayTimeout) {
            clearTimeout(this.decayTimeout);
            this.decayTimeout = null;
        }
        
        if (this.inputMode === 'tap') {
            this.handleTouchControl(event);
        } else if (this.inputMode === 'scroll') {
            event.preventDefault();
            const rect = this.touchControlArea.getBoundingClientRect();
            const y = (event.type.includes('touch') ? event.touches[0].clientY : event.clientY) - rect.top;
            const now = Date.now();
            
            if (this.touchScrollLastY !== null && this.touchScrollLastTime !== null) {
                const deltaY = this.touchScrollLastY - y;
                const deltaTime = now - this.touchScrollLastTime;
                
                if (deltaTime > 0) {
                    this.registerScrollActivity();
                    const normalizedDelta = -deltaY;
                    const newDirection = normalizedDelta > 0 ? 'down' : 'up';
                    
                    if (this.currentScrollDirection !== null && this.currentScrollDirection !== newDirection) {
                        this.scrollHistory = [];
                        this.smoothedScrollSpeed = 0;
                        this.resetScrollPlaybackSmoothing(this.mainScript.navigationSpeed);
                    }
                    
                    this.currentScrollDirection = newDirection;
                    
                    let cumulativeDelta = normalizedDelta;
                    if (this.scrollHistory.length > 0) {
                        cumulativeDelta = this.scrollHistory[this.scrollHistory.length - 1].cumulativeDelta + normalizedDelta;
                    }
                    
                    this.scrollHistory.push({
                        time: now,
                        delta: normalizedDelta,
                        cumulativeDelta: cumulativeDelta
                    });
                    
                    if (now - this.lastScrollUpdateTime > this.SCROLL_UPDATE_INTERVAL_MS) {
                        const calculatedSpeed = this.calculateScrollSpeed();
                        const playbackSpeed = this.scrollSpeedToPlaybackSpeed(calculatedSpeed);
                        const stabilizedSpeed = this.applyScrollPlaybackSpeedTarget(playbackSpeed);
                        this.lastScrollUpdateTime = now;
                        
                        if (this.touchIndicator) {
                            const indicatorY = Math.max(0, Math.min(rect.height - 60, y - 30));
                            this.touchIndicator.style.top = `${indicatorY}px`;
                            
                            if (stabilizedSpeed > 0) {
                                const intensity = Math.abs(stabilizedSpeed / 2.0);
                                const blue = Math.floor(255 * Math.max(0.4, intensity));
                                this.touchIndicator.style.background = `rgba(100, 100, ${blue}, 0.8)`;
                            } else if (stabilizedSpeed < 0) {
                                const intensity = Math.abs(stabilizedSpeed / 2.0);
                                const red = Math.floor(255 * Math.max(0.4, intensity));
                                this.touchIndicator.style.background = `rgba(${red}, 100, 100, 0.8)`;
                            } else {
                                this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
                            }
                        }
                        
                        this.lastGestureTime = now;
                    }
                }
            }
            
            this.touchScrollLastY = y;
            this.touchScrollLastTime = now;
            
            this.scheduleScrollDecayAfterInactivity();
        }
    },
    
    handleTouchEnd(event) {
        if (this.mainScript.controlMode !== 'touch') return;
        
        this.isTouching = false;
        const now = Date.now();
        
        if (this.inputMode === 'scroll') {
            this.touchScrollStartY = null;
            this.touchScrollStartTime = null;
            this.touchScrollLastY = null;
            this.touchScrollLastTime = null;
            this.currentScrollDirection = null;
        }
        
        if (this.inputMode === 'tap') {
            if (this.touchPoints.length > 0) {
                const firstPoint = this.touchPoints[0];
                const lastPoint = this.touchPoints[this.touchPoints.length - 1];
                const distance = Math.sqrt(
                    Math.pow(lastPoint.x - firstPoint.x, 2) + 
                    Math.pow(lastPoint.y - firstPoint.y, 2)
                );
                
                const touchDuration = now - firstPoint.time;
                
                if (distance < 30 && touchDuration < 200 && this.touchPoints.length < 5) {
                    if (this.decayTimeout) {
                        clearTimeout(this.decayTimeout);
                        this.decayTimeout = null;
                    }
                    
                    this.gestureMode = 'tap';
                    this.tapTimes.push(now);
                    
                    const bpm = this.calculateBPMFromTaps();
                    if (bpm) {
                        const speed = this.bpmToSpeed(bpm);
                        this.setTargetSpeed(speed);
                    }
                }
            }
        }
        
        this.touchPoints = [];
        
        if (this.touchIndicator) {
            this.touchIndicator.classList.remove('active');
            this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
        }
        
        if (this.inputMode === 'tap') {
            this.startDecayToDefault();
        }
    },
    
    handleScroll(event) {
        if (this.mainScript.controlMode !== 'touch') return;
        if (this.inputMode !== 'scroll') return;
        
        event.preventDefault();
        
        const now = Date.now();
        const deltaY = event.deltaY;
        if (deltaY === 0) return;
        
        this.registerScrollActivity();
        
        const newDirection = deltaY > 0 ? 'down' : 'up';
        
        if (this.currentScrollDirection !== null && this.currentScrollDirection !== newDirection) {
            this.scrollHistory = [];
            this.smoothedScrollSpeed = 0;
            this.resetScrollPlaybackSmoothing(this.mainScript.navigationSpeed);
        }
        
        this.currentScrollDirection = newDirection;
        
        let cumulativeDelta = deltaY;
        if (this.scrollHistory.length > 0) {
            cumulativeDelta = this.scrollHistory[this.scrollHistory.length - 1].cumulativeDelta + deltaY;
        }
        
        this.scrollHistory.push({
            time: now,
            delta: deltaY,
            cumulativeDelta: cumulativeDelta
        });
        
        if (now - this.lastScrollUpdateTime > this.SCROLL_UPDATE_INTERVAL_MS) {
            const scrollSpeed = this.calculateScrollSpeed();
            const playbackSpeed = this.scrollSpeedToPlaybackSpeed(scrollSpeed);
            const stabilizedSpeed = this.applyScrollPlaybackSpeedTarget(playbackSpeed);
            
            this.lastScrollUpdateTime = now;
            
            if (this.touchIndicator) {
                if (stabilizedSpeed > 0) {
                    const intensity = Math.abs(stabilizedSpeed / 2.0);
                    const blue = Math.floor(255 * Math.max(0.4, intensity));
                    this.touchIndicator.style.background = `rgba(100, 100, ${blue}, 0.8)`;
                } else if (stabilizedSpeed < 0) {
                    const intensity = Math.abs(stabilizedSpeed / 2.0);
                    const red = Math.floor(255 * Math.max(0.4, intensity));
                    this.touchIndicator.style.background = `rgba(${red}, 100, 100, 0.8)`;
                } else {
                    this.touchIndicator.style.background = 'rgba(255, 255, 255, 0.8)';
                }
            }
            
            if (this.decayTimeout) {
                clearTimeout(this.decayTimeout);
                this.decayTimeout = null;
            }
            
            this.lastGestureTime = now;
        }
        
        this.scheduleScrollDecayAfterInactivity();
    },
    
    // ===== INTERFACE WITH MAIN SCRIPT =====
    
    setTargetSpeed(value) {
        this.mainScript.navigationSpeed = this.mainScript.clamp(
            value,
            this.mainScript.params.navigation.minSpeed,
            this.mainScript.params.navigation.maxSpeed
        );
        this.mainScript.gestureTarget = this.mainScript.navigationSpeed;
        this.mainScript.speedBar.value = this.mainScript.navigationSpeed;
        this.mainScript.speedValue.textContent = this.mainScript.navigationSpeed.toFixed(2);
        
        this.mainScript.manuallyPaused = false;
        
        if (!this.mainScript.filterAnimationFrame) {
            this.mainScript.updateFilteredSpeed();
        }
    },
    
    updateInputModeLabels() {
        const bpmParameterGroup = document.getElementById('bpm-parameter-group');
        
        if (this.inputMode === 'scroll') {
            if (this.inputModeLabel) this.inputModeLabel.textContent = 'Scrolling';
            if (this.leftZoneLabel) this.leftZoneLabel.textContent = 'Up to Rewind ⬆️';
            if (this.rightZoneLabel) this.rightZoneLabel.textContent = 'Down for Forward ⬇️';
            
            if (bpmParameterGroup) {
                bpmParameterGroup.style.opacity = '0.3';
                bpmParameterGroup.style.pointerEvents = 'none';
            }
            if (this.speedDecayGroup) {
                this.speedDecayGroup.style.display = '';
            }
            this.updateSpeedDecayDisplay(this.SCROLL_DECAY_MIN_DELAY_MS);
            this.resetScrollPlaybackSmoothing(this.mainScript.navigationSpeed);
        } else {
            if (this.inputModeLabel) this.inputModeLabel.textContent = 'Tapping/Circling';
            if (this.leftZoneLabel) this.leftZoneLabel.textContent = 'Circles Rewind/Forward 🔄';
            if (this.rightZoneLabel) this.rightZoneLabel.textContent = 'Taps Forward';
            
            if (bpmParameterGroup) {
                bpmParameterGroup.style.opacity = '1';
                bpmParameterGroup.style.pointerEvents = 'auto';
            }
            if (this.speedDecayGroup) {
                this.speedDecayGroup.style.display = 'none';
            }
            this.clearSpeedDecayCountdown({ resetDisplay: true });
            this.resetScrollPlaybackSmoothing(this.mainScript.navigationSpeed);
        }
    },
    
    disable() {
        this.isTouching = false;
        this.resetGestureState();
        if (this.touchIndicator) {
            this.touchIndicator.classList.remove('active');
        }
        console.log('Touch control disabled');
    }
};

// Make it available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchControl;
}