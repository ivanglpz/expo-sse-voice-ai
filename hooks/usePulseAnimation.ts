import { useRef } from "react";
import { Animated, Easing } from "react-native";

export type PulseMode =
  | "idle"
  | "started"
  | "in_progress"
  | "speaking"
  | "finished";

export const usePulseAnimation = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopAnimation = () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  };

  const startPulse = (
    from: number,
    to: number,
    duration: number,
    loop = true,
  ) => {
    stopAnimation();
    const sequence = Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: to,
        duration,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(scaleAnim, {
        toValue: from,
        duration,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    ]);

    animationRef.current = loop ? Animated.loop(sequence) : sequence;
    animationRef.current.start(() => {
      if (!loop) {
        scaleAnim.setValue(from); // asegurar que termina suavemente en la escala inicial
      }
    });
  };

  const setMode = (mode: PulseMode) => {
    stopAnimation();

    switch (mode) {
      case "started":
        // Escala mínima inicial
        Animated.spring(scaleAnim, {
          toValue: 0.6,
          useNativeDriver: true,
          friction: 5,
          tension: 40,
        }).start();
        break;

      case "in_progress":
        // Pulso suave hacia adentro desde la base de 0.7
        scaleAnim.stopAnimation((current) => {
          startPulse(current, 0.65, 600, true); // bucle hacia adentro
        });
        break;

      case "speaking":
        // Pulso hacia afuera desde la escala inicial, una sola vez y suave
        scaleAnim.stopAnimation(() => {
          const base = 0.7; // escala inicial del speaking
          const target = base + 0.7; // hacia afuera
          startPulse(base, target, 600, true); // no loop, efecto smooth
        });
        break;

      case "finished":
      case "idle":
      default:
        // Volver a escala normal
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 40,
        }).start();
        break;
    }
  };

  return { scaleAnim, setMode };
};
