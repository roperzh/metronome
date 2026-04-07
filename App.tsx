import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import { useEffect, useRef, useState, useCallback } from "react";

const MIN_BPM = 20;
const MAX_BPM = 300;
const BEATS_PER_MEASURE = 4;

export default function App() {
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);

  const clickSound = useRef<Audio.Sound | null>(null);
  const accentSound = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    async function loadSounds() {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound: click } = await Audio.Sound.createAsync(
        require("./assets/click.wav")
      );
      const { sound: accent } = await Audio.Sound.createAsync(
        require("./assets/click-accent.wav")
      );
      clickSound.current = click;
      accentSound.current = accent;
    }
    loadSounds();

    return () => {
      clickSound.current?.unloadAsync();
      accentSound.current?.unloadAsync();
    };
  }, []);

  const playBeat = useCallback(async () => {
    const beat = beatRef.current;
    setCurrentBeat(beat);

    const sound = beat === 0 ? accentSound.current : clickSound.current;
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }

    beatRef.current = (beat + 1) % BEATS_PER_MEASURE;
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    beatRef.current = 0;
    playBeat();
    intervalRef.current = setInterval(playBeat, (60 / bpm) * 1000);
    setPlaying(true);
  }, [bpm, playBeat]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPlaying(false);
    setCurrentBeat(-1);
    beatRef.current = 0;
  }, []);

  // Restart interval when BPM changes while playing
  useEffect(() => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(playBeat, (60 / bpm) * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bpm, playing, playBeat]);

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.min(MAX_BPM, Math.max(MIN_BPM, prev + delta)));
  };

  const handleTap = () => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    // Reset if last tap was more than 2 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);

    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapBpm = Math.round(60000 / avgInterval);
      setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, tapBpm)));
    }

    // Keep only last 8 taps
    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current = tapTimesRef.current.slice(-8);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.title}>METRONOME</Text>

      {/* Beat indicators */}
      <View style={styles.beatRow}>
        {Array.from({ length: BEATS_PER_MEASURE }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.beatDot,
              currentBeat === i && styles.beatDotActive,
              i === 0 && currentBeat === 0 && styles.beatDotAccent,
            ]}
          />
        ))}
      </View>

      {/* BPM display */}
      <Text style={styles.bpm}>{bpm}</Text>
      <Text style={styles.bpmLabel}>BPM</Text>

      {/* BPM controls */}
      <View style={styles.bpmControls}>
        <TouchableOpacity
          style={styles.bpmBtn}
          onPress={() => adjustBpm(-5)}
        >
          <Text style={styles.bpmBtnText}>-5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bpmBtn}
          onPress={() => adjustBpm(-1)}
        >
          <Text style={styles.bpmBtnText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bpmBtn}
          onPress={() => adjustBpm(1)}
        >
          <Text style={styles.bpmBtnText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bpmBtn}
          onPress={() => adjustBpm(5)}
        >
          <Text style={styles.bpmBtnText}>+5</Text>
        </TouchableOpacity>
      </View>

      {/* Play/Stop button */}
      <TouchableOpacity
        style={[styles.playBtn, playing && styles.playBtnActive]}
        onPress={playing ? stop : start}
      >
        <Text style={styles.playBtnText}>{playing ? "STOP" : "START"}</Text>
      </TouchableOpacity>

      {/* Tap tempo */}
      <TouchableOpacity style={styles.tapBtn} onPress={handleTap}>
        <Text style={styles.tapBtnText}>TAP TEMPO</Text>
      </TouchableOpacity>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 4,
    marginBottom: 40,
  },
  beatRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  beatDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#333",
  },
  beatDotActive: {
    backgroundColor: "#e94560",
    shadowColor: "#e94560",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  beatDotAccent: {
    backgroundColor: "#ff6b6b",
    shadowColor: "#ff6b6b",
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  bpm: {
    fontSize: 96,
    fontWeight: "200",
    color: "#fff",
    lineHeight: 96,
  },
  bpmLabel: {
    fontSize: 14,
    color: "#666",
    letterSpacing: 2,
    marginBottom: 30,
  },
  bpmControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },
  bpmBtn: {
    width: 60,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  bpmBtnText: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "500",
  },
  playBtn: {
    width: width * 0.6,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  playBtnActive: {
    backgroundColor: "#444",
  },
  playBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
  },
  tapBtn: {
    width: width * 0.6,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
  },
  tapBtnText: {
    color: "#e94560",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
  },
});
