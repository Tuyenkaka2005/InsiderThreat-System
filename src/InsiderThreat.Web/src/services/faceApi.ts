import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs';

let modelsLoaded = false;

// Load models from public/models directory
export const loadFaceApiModels = async () => {
    if (modelsLoaded) return true;

    const MODEL_URL = '/models';

    // In ESM builds, faceapi may be the namespace or have a default export
    const api = (faceapi as any).default || faceapi;

    try {
        // ===== BACKEND INITIALIZATION =====
        // Try WebGL first, then WASM, then fallback to CPU
        const backends = ['webgl', 'cpu'];
        let backendReady = false;

        for (const backend of backends) {
            try {
                await tf.setBackend(backend);
                await tf.ready();
                console.log(`[FaceAPI] ✅ Using TensorFlow.js backend: ${backend}`);
                backendReady = true;
                break;
            } catch (e) {
                console.warn(`[FaceAPI] ⚠️ Backend "${backend}" failed, trying next...`);
            }
        }

        if (!backendReady) {
            console.error('[FaceAPI] ❌ No TensorFlow.js backend available');
            return false;
        }

        // ===== MODEL LOADING =====
        if (!api?.nets?.ssdMobilenetv1) {
            console.error('❌ FaceAPI nets.ssdMobilenetv1 is missing.');
            return false;
        }

        console.log('[FaceAPI] Loading models from:', MODEL_URL);

        await Promise.all([
            api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        modelsLoaded = true;
        console.log('✅ Face API Models Loaded');
        return true;
    } catch (error) {
        console.error('❌ Error loading Face API models:', error);
        return false;
    }
};

// Detect face and extract descriptor
export const detectFace = async (videoOrImage: HTMLVideoElement | HTMLImageElement) => {
    const api = (faceapi as any).default || faceapi;

    const detection = await api.detectSingleFace(videoOrImage)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection;
};
