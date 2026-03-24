import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Cache toàn cục model AI để không phải tải lại mỗi lần mở popup xem tài liệu (tiết kiệm 20 giây mỗi lần)
let globalModelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export const preloadPhoneDetectorModel = () => {
    if (!globalModelPromise) {
        globalModelPromise = (async () => {
            console.log("Bat dau tai mo hinh AI trong nen...");
            await tf.ready();
            const model = await cocoSsd.load();
            console.log("Da tai xong mo hinh AI!");
            return model;
        })();
    }
    return globalModelPromise;
};

export function usePhoneDetector(enabled = true) {
    const [isPhoneDetected, setIsPhoneDetected] = useState(false);
    const [isLoadingAI, setIsLoadingAI] = useState(enabled);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameraGranted, setCameraGranted] = useState(!enabled); // Giả lập đã cấp quyền nếu không yêu cầu

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const requestAnimationFrameId = useRef<number | null>(null);
    const detectionCountRef = useRef(0);

    // Bắt đầu bật camera và load AI
    useEffect(() => {
        if (!enabled) {
            setIsLoadingAI(false);
            setCameraGranted(true);
            return;
        }

        let isMounted = true;

        // Hàm quét frame liên tục
        const detectFrame = async () => {
            if (!isMounted) return;
            if (!videoRef.current || !modelRef.current) return;

            // Nếu video bị dừng, không quét nữa
            if (videoRef.current.paused || videoRef.current.ended) return;

            try {
                // Quét hình ảnh từ video element
                const predictions = await modelRef.current.detect(videoRef.current);
                
                // Tìm xem có đối tượng 'cell phone' nào không (hạ mức độ chắc chắn xuống 40% để nhạy hơn)
                const phoneDetected = predictions.some(
                    p => p.class === 'cell phone' && p.score > 0.40
                );

                // Thuật toán Leaky Bucket Debounce: Không reset lập tức nếu lỡ mất 1 frame
                if (phoneDetected) {
                    detectionCountRef.current += 2; // Tăng nhanh nếu thấy
                } else {
                    detectionCountRef.current = Math.max(0, detectionCountRef.current - 1); // Giảm từ từ nếu không thấy
                }

                // Cập nhật state UI
                if (detectionCountRef.current >= 2) {
                    setIsPhoneDetected(true);
                    // Giới hạn không cho cộng dồn quá nhiều dẫn đến kẹt màn hình
                    if (detectionCountRef.current > 10) detectionCountRef.current = 10;
                } else if (detectionCountRef.current === 0) {
                    setIsPhoneDetected(false); // Khuất hẳn thì nhả
                }
            } catch (error) {
                console.error("Lỗi khi quét frame:", error);
            }

            // Lặp lại liên tiếp
            requestAnimationFrameId.current = requestAnimationFrame(() => detectFrame());
        };

        const initializeDetector = async () => {
            try {
                // 1. Xin quyền Camera đồng thời với 2. Load model AI (chạy song song để tiết kiệm thời gian)
                const [stream, model] = await Promise.all([
                    navigator.mediaDevices.getUserMedia({ video: true }),
                    preloadPhoneDetectorModel() // Dùng model cache sẵn
                ]);
                
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                modelRef.current = model;
                
                // 3. Tạo thẻ video ảo ẩn để stream hình ảnh cho AI đọc
                const videoElement = document.createElement('video');
                videoElement.srcObject = stream;
                videoElement.muted = true;
                videoElement.setAttribute('playsinline', 'true'); // Cần cho một số trình duyệt
                
                // Đét video vào DOM nhưng làm trong suốt để trình duyệt không ngắt frame
                videoElement.style.position = 'absolute';
                videoElement.style.opacity = '0';
                videoElement.style.pointerEvents = 'none';
                videoElement.style.width = '10px';
                videoElement.style.height = '10px';
                document.body.appendChild(videoElement);
                
                // Đợi video load xong metadata để lấy kích thước
                await videoElement.play();
                
                videoElement.width = videoElement.videoWidth || 640;
                videoElement.height = videoElement.videoHeight || 480;
                videoRef.current = videoElement;

                setCameraGranted(true);
                setIsLoadingAI(false);

                // Bắt đầu vòng lặp quét
                detectFrame();

            } catch (err: any) {
                console.error("Lỗi khởi tạo Camera hoặc AI:", err);
                if (!isMounted) return;
                setIsLoadingAI(false);
                setCameraGranted(false);
                setCameraError(`Hệ thống không thể khởi tạo: ${err.message || err.toString()}`);
            }
        };

        initializeDetector();

        // Cleanup function khi component unmount
        return () => {
            isMounted = false;
            if (requestAnimationFrameId.current) {
                cancelAnimationFrame(requestAnimationFrameId.current);
            }
            if (videoRef.current) {
                if (videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                }
                // Dọn rác thẻ video ngoài DOM
                if (document.body.contains(videoRef.current)) {
                    document.body.removeChild(videoRef.current);
                }
            }
        };
    }, []);

    return { isPhoneDetected, isLoadingAI, cameraError, cameraGranted };
}
