import * as faceapi from 'face-api.js';

// Helper to handle import structure (sometimes inside default)
const getFaceApi = () => {
    const api = faceapi as any;

    // Log the structure to help debugging
    console.log('FaceAPI Import:', api);
    if (api && typeof api === 'object') {
        console.log('FaceAPI keys:', Object.keys(api));
        if (api.default) {
            console.log('FaceAPI Default Keys:', Object.keys(api.default));
        }
        if (api.nets) {
            console.log('FaceAPI Nets Keys:', Object.keys(api.nets));
        }
    }

    if (api.nets) return api;
    if (api.default && api.default.nets) return api.default;

    console.warn('Could not find faceapi.nets in import!');
    return api;
};

// Load models from public/models directory
export const loadFaceApiModels = async () => {
    const MODEL_URL = '/models';
    const api = getFaceApi();

    if (!api || !api.nets) {
        console.error('❌ FaceAPI nets object is missing. Import failed.');
        return false;
    }

    if (!api.nets.ssdMobilenetv1) {
        console.error('❌ ssdMobilenetv1 is missing from api.nets');
        if (api.nets) console.log('Available nets:', Object.keys(api.nets));
        return false;
    }

    try {
        console.log('Loading FaceAPI models from:', MODEL_URL);

        await Promise.all([
            api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        console.log('✅ Face API Models Loaded');
        return true;
    } catch (error) {
        console.error('❌ Error loading Face API models:', error);
        return false;
    }
};

// Detect face and extract descriptor
export const detectFace = async (videoOrImage: HTMLVideoElement | HTMLImageElement) => {
    const api = getFaceApi();
    // Detect single face with landmarks and descriptor
    const detection = await api.detectSingleFace(videoOrImage)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection;
};
