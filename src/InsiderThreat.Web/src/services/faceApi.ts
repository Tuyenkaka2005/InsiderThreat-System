import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs';

let modelsLoaded = false;
let modelLoadPromise: Promise<boolean> | null = null;

// Load models from public/models directory
export const loadFaceApiModels = async () => {
    if (modelsLoaded) return true;
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
        const MODEL_URL = '/models';
        const api = (faceapi as any).default || faceapi;

        try {
            // Speed up backend init
            if (tf.getBackend() !== 'webgl') {
                try {
                    await tf.setBackend('webgl');
                    await tf.ready();
                } catch (e) {
                    await tf.setBackend('cpu');
                }
            }

            // tiny_face_detector is ~200KB. ssd_mobilenetv1 is ~6MB.
            await Promise.all([
                api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);

            modelsLoaded = true;
            console.log('[FaceAPI] ✅ Models loaded');
            return true;
        } catch (error) {
            console.error('[FaceAPI] ❌ Error loading models:', error);
            modelLoadPromise = null;
            return false;
        }
    })();

    return modelLoadPromise;
};


// Get consistent detector options
export const getFaceDetectorOptions = () => {
    const api = (faceapi as any).default || faceapi;
    return new api.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5
    });
};

// Detect face and extract descriptor
export const detectFace = async (videoOrImage: HTMLVideoElement | HTMLImageElement) => {
    const api = (faceapi as any).default || faceapi;
    const options = getFaceDetectorOptions();

    const detection = await api.detectSingleFace(videoOrImage, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection;
};


