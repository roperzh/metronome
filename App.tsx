import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  PanResponder,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const MIN_BPM = 20;
const MAX_BPM = 300;

type TimeSignature = { beats: number; noteValue: number; label: string };

const TIME_SIGNATURES: TimeSignature[] = [
  { beats: 2, noteValue: 4, label: "2/4" },
  { beats: 3, noteValue: 4, label: "3/4" },
  { beats: 4, noteValue: 4, label: "4/4" },
  { beats: 5, noteValue: 4, label: "5/4" },
  { beats: 6, noteValue: 8, label: "6/8" },
  { beats: 7, noteValue: 8, label: "7/8" },
];

type Subdivision = { divisions: number; label: string };

const SUBDIVISIONS: Subdivision[] = [
  { divisions: 1, label: "None" },
  { divisions: 2, label: "8th" },
  { divisions: 3, label: "Triplet" },
  { divisions: 4, label: "16th" },
];

export default function App() {
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentSub, setCurrentSub] = useState(-1);
  const [timeSigIndex, setTimeSigIndex] = useState(2);
  const [subIndex, setSubIndex] = useState(0);

  const clickPlayer = useAudioPlayer(require("./assets/click.wav"));
  const accentPlayer = useAudioPlayer(require("./assets/click-accent.wav"));
  const subPlayer = useAudioPlayer(require("./assets/click-sub.wav"));

  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);
  const tapTimesRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  const timeSig = TIME_SIGNATURES[timeSigIndex];
  const subdivision = SUBDIVISIONS[subIndex];

  // Swipe to change BPM
  const dragStartBpm = useRef(bpm);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          dragStartBpm.current = bpmRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const delta = Math.round(-gestureState.dy / 4);
          const newBpm = Math.min(
            MAX_BPM,
            Math.max(MIN_BPM, dragStartBpm.current + delta)
          );
          setBpm(newBpm);
        },
      }),
    []
  );

  // Full-screen tap tempo
  const handleScreenTap = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);

    if (tapTimesRef.current.length >= 2) {
      const t = tapTimesRef.current;
      const totalTime = t[t.length - 1] - t[0];
      const tapBpm = Math.round(60000 / (totalTime / (t.length - 1)));
      setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, tapBpm)));
    }

    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current = tapTimesRef.current.slice(-8);
    }
  }, []);

  const clearScheduled = useCallback(() => {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  }, []);

  const playBeat = useCallback(async () => {
    const beat = beatRef.current;
    setCurrentBeat(beat);
    setCurrentSub(0);

    const player = beat === 0 ? accentPlayer : clickPlayer;
    player.seekTo(0);
    player.play();

    const beatDuration = (60 / bpm) * 1000;
    const divisions = subdivision.divisions;
    if (divisions > 1) {
      const subInterval = beatDuration / divisions;
      for (let s = 1; s < divisions; s++) {
        const id = setTimeout(() => {
          setCurrentSub(s);
          subPlayer.seekTo(0);
          subPlayer.play();
        }, subInterval * s);
        timeoutIds.current.push(id);
      }
    }

    beatRef.current = (beat + 1) % timeSig.beats;
  }, [bpm, subdivision.divisions, timeSig.beats, clickPlayer, accentPlayer, subPlayer]);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearScheduled();
    beatRef.current = 0;
    playBeat();
    intervalRef.current = setInterval(playBeat, (60 / bpm) * 1000);
    setPlaying(true);
  }, [bpm, playBeat, clearScheduled]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    clearScheduled();
    setPlaying(false);
    setCurrentBeat(-1);
    setCurrentSub(-1);
    beatRef.current = 0;
  }, [clearScheduled]);

  useEffect(() => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearScheduled();
      intervalRef.current = setInterval(playBeat, (60 / bpm) * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearScheduled();
    };
  }, [bpm, playing, playBeat, clearScheduled]);

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.min(MAX_BPM, Math.max(MIN_BPM, prev + delta)));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen tap zone behind everything */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleScreenTap}
      />

      {/* Beat indicators */}
      <View style={styles.beatRow}>
        {Array.from({ length: timeSig.beats }).map((_, i) => (
          <View key={i} style={styles.beatGroup}>
            <View
              style={[
                styles.beatDot,
                currentBeat === i && styles.beatDotActive,
                i === 0 && currentBeat === 0 && styles.beatDotAccent,
              ]}
            />
            {subdivision.divisions > 1 && (
              <View style={styles.subDotRow}>
                {Array.from({ length: subdivision.divisions - 1 }).map(
                  (_, s) => (
                    <View
                      key={s}
                      style={[
                        styles.subDot,
                        currentBeat === i &&
                          currentSub === s + 1 &&
                          styles.subDotActive,
                      ]}
                    />
                  )
                )}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* BPM display — draggable */}
      <View {...panResponder.panHandlers}>
        <Text style={styles.bpm}>{bpm}</Text>
      </View>
      <Text style={styles.bpmLabel}>BPM — drag up/down</Text>

      {/* BPM controls */}
      <View style={styles.bpmControls}>
        <TouchableOpacity style={styles.bpmBtn} onPress={() => adjustBpm(-5)}>
          <Text style={styles.bpmBtnText}>-5</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bpmBtn} onPress={() => adjustBpm(-1)}>
          <Text style={styles.bpmBtnText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bpmBtn} onPress={() => adjustBpm(1)}>
          <Text style={styles.bpmBtnText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bpmBtn} onPress={() => adjustBpm(5)}>
          <Text style={styles.bpmBtnText}>+5</Text>
        </TouchableOpacity>
      </View>

      {/* Time signature selector */}
      <Text style={styles.sectionLabel}>TIME SIGNATURE</Text>
      <View style={styles.selectorRow}>
        {TIME_SIGNATURES.map((ts, i) => (
          <TouchableOpacity
            key={ts.label}
            style={[
              styles.selectorBtn,
              i === timeSigIndex && styles.selectorBtnActive,
            ]}
            onPress={() => {
              setTimeSigIndex(i);
              if (playing) {
                beatRef.current = 0;
              }
            }}
          >
            <Text
              style={[
                styles.selectorBtnText,
                i === timeSigIndex && styles.selectorBtnTextActive,
              ]}
            >
              {ts.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subdivision selector */}
      <Text style={styles.sectionLabel}>SUBDIVISION</Text>
      <View style={styles.selectorRow}>
        {SUBDIVISIONS.map((sub, i) => (
          <TouchableOpacity
            key={sub.label}
            style={[
              styles.selectorBtn,
              i === subIndex && styles.selectorBtnActive,
            ]}
            onPress={() => setSubIndex(i)}
          >
            <Text
              style={[
                styles.selectorBtnText,
                i === subIndex && styles.selectorBtnTextActive,
              ]}
            >
              {sub.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Play/Stop button */}
      <TouchableOpacity
        style={[styles.playBtn, playing && styles.playBtnActive]}
        onPress={playing ? stop : start}
      >
        <Text style={styles.playBtnText}>{playing ? "STOP" : "START"}</Text>
      </TouchableOpacity>

      {/* Hint */}
      <Text style={styles.hint}>Tap anywhere for tap tempo</Text>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
    letterSpacing: 2,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  selectorBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  selectorBtnActive: {
    borderColor: "#e94560",
    backgroundColor: "rgba(233, 69, 96, 0.15)",
  },
  selectorBtnText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },
  selectorBtnTextActive: {
    color: "#e94560",
  },
  beatRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
    alignItems: "flex-start",
  },
  beatGroup: {
    alignItems: "center",
    gap: 6,
  },
  beatDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  subDotRow: {
    flexDirection: "row",
    gap: 4,
  },
  subDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a2a3e",
  },
  subDotActive: {
    backgroundColor: "#e9456088",
  },
  bpm: {
    fontSize: 140,
    fontWeight: "200",
    color: "#fff",
    lineHeight: 140,
  },
  bpmLabel: {
    fontSize: 12,
    color: "#555",
    letterSpacing: 1,
    marginBottom: 20,
  },
  bpmControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
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
    marginBottom: 12,
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
  hint: {
    fontSize: 12,
    color: "#444",
    letterSpacing: 1,
  },
});
