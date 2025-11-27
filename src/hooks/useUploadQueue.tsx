import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from 'browser-image-compression';

export interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'compressing';
  speed: number;
  timeRemaining: number | null;
  error?: string;
  storagePath?: string;
  startTime?: number;
  pausedAt?: number;
  uploadedBytes?: number;
  originalSize?: number;
  compressedSize?: number;
}

export const useUploadQueue = (onUploadComplete: () => void, currentFolderId?: string | null) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const uploadIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processingRef = useRef(false);

  const compressFile = async (file: File): Promise<File> => {
    // Only compress images
    if (!file.type.startsWith('image/')) {
      return file;
    }

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      return new File([compressedFile], file.name, { type: file.type });
    } catch (error) {
      console.error('Compression failed:', error);
      return file; // Return original if compression fails
    }
  };

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    
    setTasks(currentTasks => {
      const uploadingTask = currentTasks.find(t => t.status === 'uploading' || t.status === 'compressing');
      if (uploadingTask) return currentTasks;

      const nextTask = currentTasks.find(t => t.status === 'pending');
      if (!nextTask) {
        processingRef.current = false;
        return currentTasks;
      }

      processingRef.current = true;
      // Start upload asynchronously
      setTimeout(() => startUpload(nextTask.id), 0);
      
      return currentTasks;
    });
  }, []);

  useEffect(() => {
    processQueue();
  }, [tasks, processQueue]);

  const addToQueue = useCallback((files: File[]) => {
    const newTasks: UploadTask[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'pending',
      speed: 0,
      timeRemaining: null,
      originalSize: file.size,
    }));

    setTasks(prev => [...prev, ...newTasks]);
  }, []);

  const startUpload = useCallback(async (taskId: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task || task.status === 'uploading') return prev;
      return prev.map(t => 
        t.id === taskId ? { ...t, status: 'compressing' as const } : t
      );
    });

    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Compress file if it's an image
      let fileToUpload = task.file;
      if (task.file.type.startsWith('image/')) {
        fileToUpload = await compressFile(task.file);
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, compressedSize: fileToUpload.size } : t
        ));
      }

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'uploading' as const, startTime: Date.now() } : t
      ));

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("You must be logged in to upload files");
      }

      const fileExt = task.file.name.split('.').pop();
      const storagePath = `${user.id}/${Date.now()}.${fileExt}`;

      const controller = new AbortController();
      abortControllers.current.set(taskId, controller);

      const startTime = Date.now();
      const fileSize = fileToUpload.size;

      const progressInterval = setInterval(() => {
        setTasks(prev => {
          const currentTask = prev.find(t => t.id === taskId);
          if (!currentTask || currentTask.status !== 'uploading') {
            clearInterval(progressInterval);
            return prev;
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const estimatedTotalTime = Math.max(2, fileSize / (500 * 1024));
          const progressPercent = Math.min(95, (elapsed / estimatedTotalTime) * 100);
          
          const bytesUploaded = (progressPercent / 100) * fileSize;
          const speed = bytesUploaded / elapsed;
          const remainingBytes = fileSize - bytesUploaded;
          const timeRemaining = remainingBytes / speed;

          return prev.map(t => 
            t.id === taskId 
              ? { ...t, progress: Math.round(progressPercent), speed, timeRemaining, uploadedBytes: bytesUploaded }
              : t
          );
        });
      }, 200);

      uploadIntervals.current.set(taskId, progressInterval);

      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(storagePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      clearInterval(progressInterval);
      uploadIntervals.current.delete(taskId);

      if (uploadError) throw uploadError;

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, progress: 100, timeRemaining: 0 } : t
      ));

      const { error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: task.file.name,
          size: fileToUpload.size,
          mime_type: task.file.type,
          storage_path: storagePath,
          folder_id: currentFolderId,
        });

      if (dbError) throw dbError;

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed' as const, storagePath } : t
      ));

      toast.success(`${task.file.name} uploaded successfully!`);
      onUploadComplete();
      
      processingRef.current = false;
      processQueue();

    } catch (error: any) {
      const interval = uploadIntervals.current.get(taskId);
      if (interval) {
        clearInterval(interval);
        uploadIntervals.current.delete(taskId);
      }

      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'failed' as const, error: error.message || "Upload failed" } 
          : t
      ));
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        toast.error(`Failed to upload ${task.file.name}`);
      }
      
      processingRef.current = false;
      processQueue();
    } finally {
      abortControllers.current.delete(taskId);
    }
  }, [tasks, onUploadComplete, currentFolderId, processQueue]);

  const pauseUpload = useCallback((taskId: string) => {
    const interval = uploadIntervals.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      uploadIntervals.current.delete(taskId);
    }

    const controller = abortControllers.current.get(taskId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(taskId);
    }

    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'paused' as const, pausedAt: Date.now() } : t
    ));
    
    processingRef.current = false;
  }, []);

  const resumeUpload = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'pending' as const } : t
    ));
    processingRef.current = false;
    processQueue();
  }, [processQueue]);

  const removeTask = useCallback((taskId: string) => {
    const interval = uploadIntervals.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      uploadIntervals.current.delete(taskId);
    }

    const controller = abortControllers.current.get(taskId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(taskId);
    }

    setTasks(prev => prev.filter(t => t.id !== taskId));
    processingRef.current = false;
    processQueue();
  }, [processQueue]);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'));
  }, []);

  return {
    tasks,
    addToQueue,
    pauseUpload,
    resumeUpload,
    removeTask,
    clearCompleted,
  };
};
