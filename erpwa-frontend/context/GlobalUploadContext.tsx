"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { galleryAPI } from "@/lib/galleryApi";
import { processMedia } from "@/lib/mediaProcessor";
import { toast } from "react-toastify";

// --- Constants ---
const MAX_CONCURRENT_UPLOADS = 3;
const UPLOAD_TIMEOUT_MS = 60000; // 60 seconds timeout per file

// --- Types ---

export interface UploadFileItem {
    id: string; // unique ID for the file in this batch
    file: File;
    status: "pending" | "processing" | "success" | "error";
    error?: string;
    originalName: string; // Store name separately for reconstruction
    type: string;
}

export interface UploadBatch {
    id: string; // Batch ID
    files: UploadFileItem[];
    categoryId: string;
    subcategoryId: string;
    categoryName: string;
    subcategoryName: string;
    status: "pending" | "processing" | "completed" | "partial_error";
    progress: number;
    processedCount: number;
    totalCount: number;
    successCount: number;
    failedCount: number;
    createdAt: number;
}

interface UploadContextType {
    batches: UploadBatch[];
    addBatch: (
        categoryId: string,
        subcategoryId: string,
        categoryName: string,
        subcategoryName: string,
        files: File[]
    ) => void;
    clearCompleted: () => void;
    clearAll: () => void;
    removeBatch: (batchId: string) => void;
    retryBatch: (batchId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

// --- IndexedDB Helpers ---

const DB_NAME = "ErpWaUploads";
const STORE_NAME = "files";
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        // Check if indexedDB exists
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error("IndexedDB not supported"));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // Key is the file ID
            }
        };
    });
};

const storeFile = async (id: string, file: File) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(file, id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error("IndexedDB Store Error", err);
    }
};

const getFile = async (id: string): Promise<File | undefined> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result); // result is the File object
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("IndexedDB Get Error", err);
        return undefined;
    }
};

const removeFile = async (id: string) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("IndexedDB Delete Error", err);
    }
};

// --- Promise Timeout Helper ---
const withTimeout = <T,>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(msg)), ms);
        promise.then(res => {
            clearTimeout(timer);
            resolve(res);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
};

// --- Provider Component ---

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [batches, setBatches] = useState<UploadBatch[]>([]);
    const activeUploads = useRef(0);
    const processingFileIds = useRef(new Set<string>());
    const [isLoaded, setIsLoaded] = useState(false);

    // 1. Load state from localStorage on mount (Metadata only)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const saved = localStorage.getItem("upload_batches_meta");
        if (saved) {
            try {
                const parsed: UploadBatch[] = JSON.parse(saved);
                const rehdyrated = parsed.map(b => ({
                    ...b,
                    files: b.files.map(f => ({
                        ...f,
                        file: new File([""], f.originalName || "image.png", { type: f.type || "image/png" }),
                        status: f.status === 'processing' ? 'pending' : f.status
                    })),
                    status: b.status === 'processing' ? 'pending' : b.status
                })) as UploadBatch[];

                setBatches(rehdyrated);
            } catch (e) {
                console.error("Failed to load upload batches", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // 2. Save metadata to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        const metaToSave = batches.map(b => ({
            ...b,
            files: b.files.map(f => ({
                id: f.id,
                status: f.status,
                error: f.error,
                originalName: f.file.name,
                type: f.file.type,
            }))
        }));
        localStorage.setItem("upload_batches_meta", JSON.stringify(metaToSave));
    }, [batches, isLoaded]);

    // 3. Helper to add a batch
    const addBatch = useCallback(async (
        categoryId: string,
        subcategoryId: string,
        categoryName: string,
        subcategoryName: string,
        files: File[]
    ) => {
        const batchId = Date.now().toString();
        const fileItems: UploadFileItem[] = [];

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const fId = `${batchId}_${i}`;
            await storeFile(fId, f);

            fileItems.push({
                id: fId,
                file: f,
                status: "pending",
                originalName: f.name,
                type: f.type
            });
        }

        const newBatch: UploadBatch = {
            id: batchId,
            files: fileItems,
            categoryId,
            subcategoryId,
            categoryName,
            subcategoryName,
            status: "pending",
            progress: 0,
            processedCount: 0,
            totalCount: files.length,
            successCount: 0,
            failedCount: 0,
            createdAt: Date.now(),
        };

        setBatches(prev => [newBatch, ...prev]);
        toast.info(`Upload started for ${files.length} images`);
    }, []);

    // 4. Processing Logic (Concurrent)
    const processQueue = useCallback(async () => {
        if (activeUploads.current >= MAX_CONCURRENT_UPLOADS) return;

        // Find batch to process
        const batchIndex = batches.findIndex(b => b.status === "processing" || b.status === "pending");
        if (batchIndex === -1) return;

        const batch = batches[batchIndex];

        // Find next pending file not already processing in this cycle
        const pendingFileIndex = batch.files.findIndex(f =>
            f.status === "pending" && !processingFileIds.current.has(f.id)
        );

        // if no pending files, check if we need to complete the batch
        if (pendingFileIndex === -1) {
            const anyProcessing = batch.files.some(f => f.status === "processing");
            if (anyProcessing) return; // Wait for others to finish

            // Batch Finished
            setBatches(prev => {
                const next = [...prev];
                const b = next[batchIndex];
                if (b.status === 'completed' || b.status === 'partial_error') return next; // Already done

                const hasErrors = b.files.some(f => f.status === "error");
                b.files.forEach(f => removeFile(f.id)); // Cleanup DB

                next[batchIndex] = {
                    ...b,
                    status: hasErrors ? "partial_error" : "completed",
                    progress: 100
                };
                return next;
            });
            return;
        }

        // Increment concurrency counter
        activeUploads.current += 1;

        // Mark file & batch as processing
        const fileItem = batch.files[pendingFileIndex];
        processingFileIds.current.add(fileItem.id);

        setBatches(prev => {
            const next = [...prev];
            const b = { ...next[batchIndex], status: "processing" as const }; // Ensure batch is marked processing
            const f = [...b.files];
            f[pendingFileIndex] = { ...f[pendingFileIndex], status: "processing" };
            b.files = f;
            next[batchIndex] = b;
            return next;
        });

        try {
            // Retrieve REAL file
            let realFile = await getFile(fileItem.id);
            if (!realFile && fileItem.file.size > 0) realFile = fileItem.file;

            if (!realFile) {
                console.warn(`File ${fileItem.id} missing from storage.`);
                throw new Error("File lost (browser storage cleared)");
            }

            // Process & Upload with Timeout
            // 1. Process
            const { file: compressedFile } = await withTimeout(
                processMedia(realFile),
                UPLOAD_TIMEOUT_MS,
                "Image processing timed out"
            );

            const formData = new FormData();
            formData.append("category_id", batch.categoryId);
            if (batch.subcategoryId) formData.append("subcategory_id", batch.subcategoryId);
            formData.append("images", compressedFile);

            // 2. Upload
            const response = await withTimeout(
                galleryAPI.upload(formData),
                UPLOAD_TIMEOUT_MS,
                "Upload request timed out"
            );

            if (response.data?.success === false) {
                throw new Error(response.data?.error || "Upload failed");
            }

            // Success Update
            setBatches(prev => {
                const next = [...prev];
                // Note: Index might have shifted if batches removed? 
                // We rely on stable order and IDs. Ideally use ID lookup, but index is fast for now.
                // Re-find batch index to be safe (in case batches were reordered/removed concurrently? No, rare)
                const currentBatchIdx = next.findIndex(b => b.id === batch.id);
                if (currentBatchIdx === -1) return next;

                const b = { ...next[currentBatchIdx] };
                const f = [...b.files];
                const fIdx = f.findIndex(fi => fi.id === fileItem.id);
                if (fIdx === -1) return next;

                f[fIdx] = { ...f[fIdx], status: "success" };

                b.files = f;
                b.processedCount += 1;
                b.successCount += 1;
                b.progress = Math.round((b.processedCount / b.totalCount) * 100);

                next[currentBatchIdx] = b;
                return next;
            });

            await removeFile(fileItem.id);

        } catch (error: any) {
            const errMsg = error.message || "Unknown error";
            if (errMsg !== "File lost (browser storage cleared)") {
                console.error("Upload Error", error);
            }

            setBatches(prev => {
                const next = [...prev];
                const currentBatchIdx = next.findIndex(b => b.id === batch.id);
                if (currentBatchIdx === -1) return next;

                const b = { ...next[currentBatchIdx] };
                const f = [...b.files];
                const fIdx = f.findIndex(fi => fi.id === fileItem.id);
                if (fIdx === -1) return next;

                f[fIdx] = { ...f[fIdx], status: "error", error: errMsg };

                b.files = f;
                b.processedCount += 1;
                b.failedCount += 1;
                b.progress = Math.round((b.processedCount / b.totalCount) * 100);

                next[currentBatchIdx] = b;
                return next;
            });
        } finally {
            activeUploads.current -= 1;
            processingFileIds.current.delete(fileItem.id);
            // Recursion handled by useEffect
        }

    }, [batches]);

    // Trigger processing whenever batches change (and slots open)
    useEffect(() => {
        if (isLoaded && activeUploads.current < MAX_CONCURRENT_UPLOADS) {
            processQueue();
        }
    }, [batches, isLoaded, processQueue]);

    // Watchdog: Fallback checks every 2s to ensure queue doesn't stall if events are missed
    useEffect(() => {
        if (!isLoaded) return;
        const interval = setInterval(() => {
            if (activeUploads.current < MAX_CONCURRENT_UPLOADS) {
                processQueue();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isLoaded, processQueue]);


    const clearCompleted = useCallback(() => {
        setBatches(prev => prev.filter(b => b.status === "pending" || b.status === "processing"));
    }, []);

    const clearAll = useCallback(() => {
        setBatches([]);
        localStorage.removeItem("upload_batches_meta");
    }, []);

    const removeBatch = useCallback((id: string) => {
        setBatches(prev => prev.filter(b => b.id !== id));
    }, []);

    const retryBatch = useCallback((id: string) => {
        setBatches(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                status: "pending",
                files: b.files.map(f => f.status === "error" ? { ...f, status: "pending", error: undefined } : f),
            }
        }));
    }, []);

    return (
        <UploadContext.Provider value={{ batches, addBatch, clearCompleted, clearAll, removeBatch, retryBatch }}>
            {children}
        </UploadContext.Provider>
    );
}

export function useUpload() {
    const context = useContext(UploadContext);
    if (!context) throw new Error("useUpload must be used within UploadProvider");
    return context;
}
