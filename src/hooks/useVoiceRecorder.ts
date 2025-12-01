import { useState, useRef, useCallback } from 'react';
import lamejs from 'lamejs';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearRecording: () => void;
  convertToMp3: (audioBlob: Blob) => Promise<Blob>;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      setRecordingTime(0);
      setAudioBlob(null);

      // Use mp3 or ogg if available, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioDuration(recordingTime);
        clearTimer();
        stopStream();
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }, [clearTimer, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    chunksRef.current = [];
    clearTimer();
    stopStream();
  }, [isRecording, clearTimer, stopStream]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioDuration(0);
    chunksRef.current = [];
  }, []);

  const convertToMp3 = useCallback(async (audioBlob: Blob): Promise<Blob> => {
    try {
      // Convert blob to audio buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio data
      const channels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const samples = audioBuffer.getChannelData(0); // Get first channel
      
      // Convert float32 to int16
      const buffer = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Encode to MP3
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
      const mp3Data: Uint8Array[] = [];
      const sampleBlockSize = 1152;
      
      for (let i = 0; i < buffer.length; i += sampleBlockSize) {
        const sampleChunk = buffer.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Create blob from Uint8Array parts
      const mp3Blob = new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
      return mp3Blob;
    } catch (error) {
      console.error('Error converting to MP3:', error);
      throw error;
    }
  }, []);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
    convertToMp3,
  };
}

export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
