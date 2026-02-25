import { useAtom } from "jotai";
import { useCallback, useRef } from "react";
import { previewUrlAtom } from "@/atoms/app";

export function useAudioPreview() {
  const [previewUrl, setPreviewUrl] = useAtom(previewUrlAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(
    (url: string) => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      if (previewUrl === url) {
        // Toggle off if same preview
        audioRef.current.pause();
        setPreviewUrl(null);
        return;
      }
      audioRef.current.src = url;
      audioRef.current.play();
      setPreviewUrl(url);

      audioRef.current.onended = () => setPreviewUrl(null);
    },
    [previewUrl, setPreviewUrl],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPreviewUrl(null);
  }, [setPreviewUrl]);

  return { previewUrl, play, stop };
}
