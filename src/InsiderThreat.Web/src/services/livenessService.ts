/**
 * Liveness Detection Service
 * Uses face-api.js 68-point landmarks to detect:
 * - Eye blinks (EAR - Eye Aspect Ratio)
 * - Head turns (Pose estimation via nose/jaw landmarks)
 * - Smiles (Mouth aspect ratio)
 * 
 * Implements Challenge-Response pattern to prevent photo/video spoofing.
 */

import * as faceapi from '@vladmandic/face-api';

// =============================================
// Types
// =============================================

export type ChallengeType = 'blink' | 'turn_left' | 'turn_right' | 'smile';

export interface LivenessChallenge {
    type: ChallengeType;
    instruction: string; // Localization key
    instructionDefault: string; // Default Vietnamese text
    completed: boolean;
}

export interface LivenessResult {
    passed: boolean;
    challenges: LivenessChallenge[];
    descriptor: Float32Array | null;
    failReason?: string;
}

// =============================================
// Constants
// =============================================

// EAR threshold: below this means eye is closed
const EAR_THRESHOLD = 0.22;
// How many consecutive frames the eyes must be closed to count as a blink
const BLINK_CLOSED_FRAMES = 2;
// Head turn angle threshold in degrees (nose offset ratio)
const TURN_THRESHOLD = 0.12;
// Smile threshold (mouth width/height ratio)
const SMILE_THRESHOLD = 3.2;

// =============================================
// Landmark Point Helpers
// =============================================

interface Point {
    x: number;
    y: number;
}

/**
 * Calculate Euclidean distance between two 2D points
 */
function distance(a: Point, b: Point): number {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * Calculate Eye Aspect Ratio (EAR) from 6 landmark points
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * 
 * Points layout for right eye (left eye is mirrored):
 *     p2  p3
 *  p1        p4
 *     p6  p5
 */
function calculateEAR(eyePoints: Point[]): number {
    if (eyePoints.length < 6) return 1.0;
    const [p1, p2, p3, p4, p5, p6] = eyePoints;
    const vertical1 = distance(p2, p6);
    const vertical2 = distance(p3, p5);
    const horizontal = distance(p1, p4);
    if (horizontal === 0) return 1.0;
    return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Calculate head pose (yaw) from nose and jaw landmarks
 * Returns a value where:
 *  - Negative = head turned left
 *  - Positive = head turned right
 *  - Near 0 = facing forward
 */
function calculateYaw(landmarks: Point[]): number {
    // Nose tip: point 30
    // Left jaw: point 0
    // Right jaw: point 16
    if (landmarks.length < 31) return 0;

    const noseTip = landmarks[30];
    const leftJaw = landmarks[0];
    const rightJaw = landmarks[16];

    const faceWidth = distance(leftJaw, rightJaw);
    if (faceWidth === 0) return 0;

    const noseCenterX = (leftJaw.x + rightJaw.x) / 2;
    const noseOffset = (noseTip.x - noseCenterX) / faceWidth;

    return noseOffset; // Range roughly -0.3 to 0.3
}

/**
 * Calculate smile ratio from mouth landmarks
 * Mouth width / mouth height — wider = more smiling
 */
function calculateSmileRatio(landmarks: Point[]): number {
    if (landmarks.length < 68) return 0;

    // Outer mouth: points 48-59
    // Left corner: 48, Right corner: 54
    // Top lip: 51, Bottom lip: 57
    const leftCorner = landmarks[48];
    const rightCorner = landmarks[54];
    const topLip = landmarks[51];
    const bottomLip = landmarks[57];

    const mouthWidth = distance(leftCorner, rightCorner);
    const mouthHeight = distance(topLip, bottomLip);

    if (mouthHeight === 0) return 0;
    return mouthWidth / mouthHeight;
}

// =============================================
// Challenge Pool
// =============================================

const CHALLENGE_POOL: Omit<LivenessChallenge, 'completed'>[] = [
    {
        type: 'blink',
        instruction: 'liveness.blink',
        instructionDefault: '👁️ Vui lòng chớp mắt 2 lần',
    },
    {
        type: 'turn_left',
        instruction: 'liveness.turn_left',
        instructionDefault: '↩️ Vui lòng quay đầu sang trái',
    },
    {
        type: 'turn_right',
        instruction: 'liveness.turn_right',
        instructionDefault: '↪️ Vui lòng quay đầu sang phải',
    },
    {
        type: 'smile',
        instruction: 'liveness.smile',
        instructionDefault: '😊 Vui lòng mỉm cười',
    },
];

/**
 * Generate a random set of challenges (2 challenges)
 */
export function generateChallenges(count: number = 2): LivenessChallenge[] {
    const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(c => ({ ...c, completed: false }));
}

// =============================================
// Liveness Detector Class
// =============================================

export class LivenessDetector {
    private blinkCount = 0;
    private wasEyeClosed = false;
    private eyeClosedFrames = 0;
    private challengeStartTime = 0;
    private readonly timeoutMs: number;

    constructor(timeoutMs: number = 8000) {
        this.timeoutMs = timeoutMs;
    }

    /**
     * Reset state for a new challenge
     */
    reset(): void {
        this.blinkCount = 0;
        this.wasEyeClosed = false;
        this.eyeClosedFrames = 0;
        this.challengeStartTime = Date.now();
    }

    /**
     * Check if the current challenge has timed out
     */
    isTimedOut(): boolean {
        return Date.now() - this.challengeStartTime > this.timeoutMs;
    }

    /**
     * Get remaining time in ms
     */
    getRemainingTime(): number {
        return Math.max(0, this.timeoutMs - (Date.now() - this.challengeStartTime));
    }

    /**
     * Process a single frame and check if the given challenge is completed
     * Returns true if the challenge condition is met
     */
    processFrame(
        landmarks: faceapi.FaceLandmarks68,
        challengeType: ChallengeType
    ): boolean {
        const points = landmarks.positions.map(p => ({ x: p.x, y: p.y }));

        switch (challengeType) {
            case 'blink':
                return this.checkBlink(points);
            case 'turn_left':
                return this.checkTurnLeft(points);
            case 'turn_right':
                return this.checkTurnRight(points);
            case 'smile':
                return this.checkSmile(points);
            default:
                return false;
        }
    }

    private checkBlink(points: Point[]): boolean {
        // Left eye: points 36-41, Right eye: points 42-47
        const leftEye = points.slice(36, 42);
        const rightEye = points.slice(42, 48);

        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2;

        if (avgEAR < EAR_THRESHOLD) {
            this.eyeClosedFrames++;
            if (this.eyeClosedFrames >= BLINK_CLOSED_FRAMES && !this.wasEyeClosed) {
                this.wasEyeClosed = true;
            }
        } else {
            if (this.wasEyeClosed) {
                // Eye reopened after being closed → count as 1 blink
                this.blinkCount++;
                this.wasEyeClosed = false;
                console.log(`[Liveness] Blink detected! Count: ${this.blinkCount}`);
            }
            this.eyeClosedFrames = 0;
        }

        return this.blinkCount >= 2; // Need 2 blinks
    }

    private checkTurnLeft(points: Point[]): boolean {
        const yaw = calculateYaw(points);
        // Video is mirrored, so turning left in real life = negative yaw
        return yaw < -TURN_THRESHOLD;
    }

    private checkTurnRight(points: Point[]): boolean {
        const yaw = calculateYaw(points);
        // Video is mirrored, so turning right in real life = positive yaw
        return yaw > TURN_THRESHOLD;
    }

    private checkSmile(points: Point[]): boolean {
        const ratio = calculateSmileRatio(points);
        return ratio > SMILE_THRESHOLD;
    }
}
