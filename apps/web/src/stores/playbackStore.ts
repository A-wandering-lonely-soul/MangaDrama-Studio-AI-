import { create } from 'zustand';

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  reset: () =>
    set({
      isPlaying: false,
      currentTime: 0
    })
}));
