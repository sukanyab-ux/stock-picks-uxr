import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const PAD = 1;

function topOnlyPoint(s: number, r: number, straight: number, w: number): { x: number; y: number } {
  const cornerArc = (Math.PI / 2) * r;
  if (s <= cornerArc) {
    const angle = Math.PI + s / r;
    return { x: r + r * Math.cos(angle), y: r + r * Math.sin(angle) };
  }
  s -= cornerArc;
  if (s <= straight) return { x: r + s, y: 0 };
  s -= straight;
  const angle = 3 * Math.PI / 2 + s / r;
  return { x: (w - r) + r * Math.cos(angle), y: r + r * Math.sin(angle) };
}

function pointOnPath(
  s: number,
  straight: number,
  r: number,
  w: number,
  h: number,
  perim: number,
): { x: number; y: number } {
  s = ((s % perim) + perim) % perim;

  if (s <= straight) return { x: r + s, y: 0 };
  s -= straight;

  const semiArc = Math.PI * r;
  if (s <= semiArc) {
    const θ = -Math.PI / 2 + s / r;
    return { x: (w - r) + r * Math.cos(θ), y: r + r * Math.sin(θ) };
  }
  s -= semiArc;

  if (s <= straight) return { x: (w - r) - s, y: h };
  s -= straight;

  const θ = Math.PI / 2 + s / r;
  return { x: r + r * Math.cos(θ), y: r + r * Math.sin(θ) };
}

interface Props {
  width: number;
  height: number;
  colors?: string[];
  thickness?: number;
  roundness?: number;
  speed?: number;
  topOnly?: boolean;
  webOnly?: boolean;
  [key: string]: unknown;
}

export const PulsingBorderShader: React.FC<Props> = ({
  width: w,
  height: h,
  colors = ['#5669FF', '#00f5bc'],
  colorBack = '#FFFFFF',
  thickness = 1,
  roundness = 1,
  speed = 1,
  topOnly = false,
  webOnly = false,
}: Props & { colorBack?: string }) => {
  if (webOnly) return null;

  const progress     = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;

  const [frame, setFrame] = useState({ dashOffset: 0, x1: 0, y1: 0, x2: 0, y2: 0 });

  const geom = useMemo(() => {
    if (!w || !h) return null;
    const r        = Math.min(roundness, 1) * (h / 2);
    const straight = w - 2 * r;

    if (topOnly) {
      const cornerArc = (Math.PI / 2) * r;
      const topLen    = cornerArc * 2 + straight;
      const spotLen   = topLen * 0.20;
      const d = [
        `M 0 ${r}`,
        `a ${r} ${r} 0 0 1 ${r} ${-r}`,
        `h ${straight}`,
        `a ${r} ${r} 0 0 1 ${r} ${r}`,
      ].join(' ');
      return { r, straight, perim: topLen, spotLen, d, isTopOnly: true };
    }

    const perim   = 2 * straight + 2 * Math.PI * r;
    const spotLen = perim * 0.10;
    const d = [
      `M ${r} 0`,
      `h ${straight}`,
      `a ${r} ${r} 0 0 1 ${r} ${r}`,
      `v ${h - 2 * r}`,
      `a ${r} ${r} 0 0 1 ${-r} ${r}`,
      `h ${-straight}`,
      `a ${r} ${r} 0 0 1 ${-r} ${-r}`,
      `v ${-(h - 2 * r)}`,
      `a ${r} ${r} 0 0 1 ${r} ${-r}`,
      'z',
    ].join(' ');
    return { r, straight, perim, spotLen, d, isTopOnly: false };
  }, [w, h, roundness, topOnly]);

  useEffect(() => {
    if (!geom) return;
    const { r: rr, straight: st, perim, spotLen, isTopOnly } = geom;

    progress.setValue(0);
    if (isTopOnly) pulseOpacity.setValue(1);

    const sweep = isTopOnly
      ? Animated.timing(progress, {
          toValue: perim - spotLen,
          duration: 1800 / Math.max(speed, 0.1),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        })
      : Animated.loop(
          Animated.timing(progress, {
            toValue: 360,
            duration: 3000 / Math.max(speed, 0.1),
            easing: Easing.linear,
            useNativeDriver: false,
          })
        );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0.8, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    const id = progress.addListener(({ value }) => {
      if (isTopOnly) {
        const p0 = topOnlyPoint(value, rr, st, w);
        const p1 = topOnlyPoint(Math.min(value + spotLen, perim), rr, st, w);
        setFrame({ dashOffset: -value, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
      } else {
        const s0 = (value / 360) * perim;
        const p0 = pointOnPath(s0,          st, rr, w, h, perim);
        const p1 = pointOnPath(s0 + spotLen, st, rr, w, h, perim);
        setFrame({ dashOffset: -s0, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
      }
    });

    sweep.start(({ finished }) => {
      if (finished && isTopOnly) {
        pulse.stop();
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }).start();
      }
    });
    if (!isTopOnly) pulse.start();
    return () => {
      sweep.stop();
      pulse.stop();
      progress.removeListener(id);
    };
  }, [geom, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!geom) return null;

  const { perim, spotLen, d, isTopOnly } = geom;
  const c0 = colors[0] ?? '#5669FF';
  const c1 = colors[1] ?? colors[0] ?? '#00f5bc';
  const { dashOffset, x1, y1, x2, y2 } = frame;

  return (
    <Animated.View style={{ position: 'absolute', top: -PAD, left: -PAD, opacity: pulseOpacity, backgroundColor: 'transparent' }}>
      <Svg
        width={w + PAD * 2}
        height={h + PAD * 2}
        viewBox={`${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`}
        style={{ backgroundColor: 'transparent' }}
      >
        <Defs>
          <LinearGradient
            id="pbg"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%"   stopColor={c1} stopOpacity="0"    />
            <Stop offset="15%"  stopColor={c1} stopOpacity="1"    />
            <Stop offset="50%"  stopColor={c0} stopOpacity="1"    />
            <Stop offset="72%"  stopColor={c0} stopOpacity="0.55" />
            <Stop offset="88%"  stopColor={c0} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={c0} stopOpacity="0"    />
          </LinearGradient>
        </Defs>

        <Path
          d={d}
          stroke="url(#pbg)"
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={isTopOnly ? `${spotLen} ${perim * 10}` : `${spotLen} ${perim - spotLen}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </Animated.View>
  );
};
