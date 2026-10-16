// Spotify Web Playback SDK loader and the small slice of its types we use.
// The SDK script is allowed by the CSP (script-src https://sdk.scdn.co, frame-src https://sdk.scdn.co).

export type SdkTrack = {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

export type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SdkTrack | null };
};

type SdkError = { message: string };

export type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getCurrentState(): Promise<SdkState | null>;
  addListener(event: "ready" | "not_ready", cb: (e: { device_id: string }) => void): boolean;
  addListener(event: "player_state_changed", cb: (state: SdkState | null) => void): boolean;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    cb: (e: SdkError) => void,
  ): boolean;
};

type SdkNamespace = {
  Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => SdkPlayer;
};

declare global {
  interface Window {
    Spotify?: SdkNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
let loading: Promise<SdkNamespace> | null = null;

export function loadSpotifySdk(): Promise<SdkNamespace> {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  loading ??= new Promise<SdkNamespace>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => (window.Spotify ? resolve(window.Spotify) : reject(new Error("SDK missing")));
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load the Spotify player. Check the internet connection."));
    };
    document.body.appendChild(script);
  });
  return loading;
}
