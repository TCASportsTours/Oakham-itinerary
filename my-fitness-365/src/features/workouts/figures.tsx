/**
 * Exercise diagrams drawn from simple poses (forward kinematics on a stick figure),
 * so limb lengths stay consistent across every exercise. Colours come from CSS
 * variables so the same drawing works on the dark app and on white paper.
 */
type Pt = [number, number]

interface Limb {
  upper: number // angle in degrees, SVG coordinates (0 = right, 90 = down, -90 = up)
  lower: number
}

interface Pose {
  hip: Pt
  torso: number
  /** Front view: shoulders/hips spread sideways; arms/legs are left (near) and right (far). */
  front?: boolean
  armNear: Limb
  armFar?: Limb
  legNear: Limb
  legFar?: Limb
  head?: number // neck direction (defaults to torso direction)
  dumbbells?: 'near' | 'both' | 'chest' | 'none'
}

interface Props {
  bench?: 'flat' | 'incline' | 'upright' | 'seat-low' | 'pad-front'
  /** Bench geometry in figure units. */
  benchAt?: { x: number; y: number; w: number; angle?: number; backX?: number }
  floor: number
}

export interface Figure {
  start: Pose
  finish?: Pose // omitted for holds
  props: Props
  /** Joint the arrow follows from start to finish. */
  track?: 'hand' | 'knee' | 'hip' | 'farHand'
  caption: [string, string?]
}

const L = { upperArm: 22, foreArm: 20, thigh: 30, shin: 28, torso: 38, neck: 7, head: 8 }
const rad = (d: number) => (d * Math.PI) / 180
const go = (p: Pt, deg: number, len: number): Pt => [p[0] + Math.cos(rad(deg)) * len, p[1] + Math.sin(rad(deg)) * len]

function joints(p: Pose) {
  const shoulder = go(p.hip, p.torso, L.torso)
  const headC = go(shoulder, p.head ?? p.torso, L.neck + L.head)
  const spread = p.front ? 12 : 0
  const hipSpread = p.front ? 7 : 0
  const shN: Pt = [shoulder[0] - spread, shoulder[1]]
  const shF: Pt = [shoulder[0] + spread, shoulder[1]]
  const hipN: Pt = [p.hip[0] - hipSpread, p.hip[1]]
  const hipF: Pt = [p.hip[0] + hipSpread, p.hip[1]]
  const arm = (s: Pt, l: Limb) => {
    const e = go(s, l.upper, L.upperArm)
    return { s, e, h: go(e, l.lower, L.foreArm) }
  }
  const leg = (s: Pt, l: Limb) => {
    const k = go(s, l.upper, L.thigh)
    return { s, k, a: go(k, l.lower, L.shin) }
  }
  return {
    shoulder,
    headC,
    hip: p.hip,
    armN: arm(shN, p.armNear),
    armF: arm(shF, p.armFar ?? p.armNear),
    legN: leg(hipN, p.legNear),
    legF: leg(hipF, p.legFar ?? p.legNear),
  }
}

const line = (a: Pt, b: Pt, w: number, cls: string, key?: string) => (
  <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} className={cls} strokeLinecap="round" />
)

function Dumbbell({ at, front }: { at: Pt; front: boolean }) {
  return front ? (
    <g className="fig-db">
      <rect x={at[0] - 9} y={at[1] - 1.5} width={18} height={3} rx={1} />
      <rect x={at[0] - 11} y={at[1] - 5} width={4} height={10} rx={1} />
      <rect x={at[0] + 7} y={at[1] - 5} width={4} height={10} rx={1} />
    </g>
  ) : (
    <g className="fig-db">
      <circle cx={at[0]} cy={at[1]} r={5.5} />
      <circle cx={at[0]} cy={at[1]} r={2} className="fig-db-hole" />
    </g>
  )
}

function Bench({ props }: { props: Props }) {
  const b = props.benchAt
  if (!props.bench || !b) return null
  if (props.bench === 'pad-front') {
    // Incline pad seen from the front, behind the chest.
    return <rect x={b.x} y={b.y} width={b.w} height={62} rx={6} className="fig-bench" />
  }
  const legs = (
    <>
      <rect x={b.x + 6} y={b.y + 4} width={3} height={props.floor - b.y - 4} className="fig-bench-leg" />
      <rect x={b.x + b.w - 9} y={b.y + 4} width={3} height={props.floor - b.y - 4} className="fig-bench-leg" />
    </>
  )
  if (props.bench === 'flat' || props.bench === 'seat-low') {
    return (
      <g>
        {legs}
        <rect x={b.x} y={b.y} width={b.w} height={6} rx={2} className="fig-bench" />
      </g>
    )
  }
  // incline / upright: seat plus angled back pad
  const angle = b.angle ?? 30
  const bx = b.backX ?? b.x
  return (
    <g>
      {legs}
      <rect x={b.x} y={b.y} width={b.w} height={6} rx={2} className="fig-bench" />
      <rect x={bx} y={b.y - 2} width={48} height={6} rx={2} className="fig-bench" transform={`rotate(${180 + angle} ${bx} ${b.y + 1})`} />
    </g>
  )
}

function Person({ pose, ghost = false }: { pose: Pose; ghost?: boolean }) {
  const j = joints(pose)
  const near = ghost ? 'fig-ghost' : 'fig-near'
  const far = ghost ? 'fig-ghost' : 'fig-far'
  const db = pose.dumbbells ?? 'none'
  return (
    <g>
      {/* far side first */}
      {line(j.legF.s, j.legF.k, 7, far)}
      {line(j.legF.k, j.legF.a, 6, far)}
      {line(j.armF.s, j.armF.e, 6, far)}
      {line(j.armF.e, j.armF.h, 5, far)}
      {!ghost && (db === 'both') && <Dumbbell at={j.armF.h} front={!!pose.front} />}
      {/* torso + head */}
      {pose.front
        ? line([j.armN.s[0], j.armN.s[1]], [j.armF.s[0], j.armF.s[1]], 8, near)
        : null}
      {line(j.hip, j.shoulder, 10, near)}
      {pose.front && line(j.legN.s, j.legF.s, 8, near)}
      <circle cx={j.headC[0]} cy={j.headC[1]} r={L.head} className={ghost ? 'fig-ghost-head' : 'fig-head'} />
      {/* near side */}
      {line(j.legN.s, j.legN.k, 8, near)}
      {line(j.legN.k, j.legN.a, 7, near)}
      {line(j.armN.s, j.armN.e, 7, near)}
      {line(j.armN.e, j.armN.h, 6, near)}
      {!ghost && (db === 'near' || db === 'both') && <Dumbbell at={j.armN.h} front={!!pose.front} />}
      {!ghost && db === 'chest' && (
        <g className="fig-db">
          <rect x={j.armN.h[0] - 3} y={j.armN.h[1] - 10} width={6} height={20} rx={1.5} />
        </g>
      )}
    </g>
  )
}

function trackPoint(f: Figure, p: Pose): Pt {
  const j = joints(p)
  switch (f.track) {
    case 'knee':
      return j.legN.k
    case 'hip':
      return j.hip
    case 'farHand':
      return j.armF.h
    default:
      return j.armN.h
  }
}

function Arrow({ from, to }: { from: Pt; to: Pt }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  if (len < 8) return null
  // Bow the arrow slightly and stop short of the end so the head sits clear of the limb.
  const ux = dx / len
  const uy = dy / len
  const s: Pt = [from[0] + ux * 6, from[1] + uy * 6]
  const e: Pt = [to[0] - ux * 9, to[1] - uy * 9]
  const mid: Pt = [(s[0] + e[0]) / 2 + uy * 10, (s[1] + e[1]) / 2 - ux * 10]
  const ang = Math.atan2(e[1] - mid[1], e[0] - mid[0])
  const head = (a: number): Pt => [e[0] - Math.cos(ang + a) * 6, e[1] - Math.sin(ang + a) * 6]
  return (
    <g className="fig-arrow">
      <path d={`M${s[0]},${s[1]} Q${mid[0]},${mid[1]} ${e[0]},${e[1]}`} fill="none" strokeWidth={2.2} strokeDasharray="4 3" />
      <path d={`M${head(0.5)[0]},${head(0.5)[1]} L${e[0]},${e[1]} L${head(-0.5)[0]},${head(-0.5)[1]}`} fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function Panel({ figure, pose, label, showArrow }: { figure: Figure; pose: Pose; label: string; showArrow: boolean }) {
  return (
    <g>
      <line x1={0} y1={figure.props.floor + 1} x2={170} y2={figure.props.floor + 1} className="fig-floor" strokeWidth={2} />
      <Bench props={figure.props} />
      {showArrow && figure.finish && (figure.track ?? 'hand') === 'hand' && <Person pose={figure.start} ghost />}
      <Person pose={pose} />
      {showArrow && figure.finish && <Arrow from={trackPoint(figure, figure.start)} to={trackPoint(figure, figure.finish)} />}
      <text x={6} y={14} className="fig-label">{label}</text>
    </g>
  )
}

export const FIGURE_STYLE = `
.fig { --near: var(--fig-near, #f4f4f0); --far: var(--fig-far, #8a8a83); --prop: var(--fig-prop, #3a3a37); --db: var(--fig-db, #7777c9); --accent: var(--fig-accent, #ff7c1a); --text: var(--fig-text, #b4b4ac); }
.fig .fig-near { stroke: var(--near); }
.fig .fig-far { stroke: var(--far); }
.fig .fig-head { fill: var(--near); }
.fig .fig-ghost { stroke: var(--far); opacity: .35; }
.fig .fig-ghost-head { fill: var(--far); opacity: .35; }
.fig .fig-db rect, .fig .fig-db circle { fill: var(--db); }
.fig .fig-db .fig-db-hole { fill: var(--near); opacity: .6; }
.fig .fig-bench { fill: var(--prop); }
.fig .fig-bench-leg { fill: var(--prop); }
.fig .fig-floor { stroke: var(--prop); }
.fig .fig-arrow path { stroke: var(--accent); }
.fig .fig-label { fill: var(--text); font: 600 11px 'Josefin Sans', sans-serif; text-transform: uppercase; letter-spacing: .06em; }
`

/** Start and finish side by side (or a single "Hold" panel for static exercises). */
export function ExerciseFigure({ exerciseKey, className, title }: { exerciseKey: string; className?: string; title?: string }) {
  const f = FIGURES[exerciseKey]
  if (!f) return null
  const two = !!f.finish
  return (
    <svg viewBox={two ? '0 0 350 150' : '0 0 175 150'} className={`fig ${className ?? ''}`} role="img" aria-label={`${title ?? 'Exercise'} diagram: ${f.caption.filter(Boolean).join(', then ')}`}>
      <style>{FIGURE_STYLE}</style>
      <Panel figure={f} pose={f.start} label={two ? '1 · Start' : 'Hold'} showArrow={false} />
      {two && (
        <g transform="translate(178 0)">
          <Panel figure={f} pose={f.finish!} label="2 · Finish" showArrow />
        </g>
      )}
    </svg>
  )
}

/** Single small pose for list thumbnails (the finish position, which shows the movement best). */
export function ExerciseGlyph({ exerciseKey, className }: { exerciseKey: string; className?: string }) {
  const f = FIGURES[exerciseKey]
  if (!f) return null
  return (
    <svg viewBox="0 0 175 150" className={`fig ${className ?? ''}`} aria-hidden>
      <style>{FIGURE_STYLE}</style>
      <line x1={0} y1={f.props.floor + 1} x2={175} y2={f.props.floor + 1} className="fig-floor" strokeWidth={2} />
      <Bench props={f.props} />
      <Person pose={f.finish ?? f.start} />
    </svg>
  )
}

// ── Poses ────────────────────────────────────────────────────────────────
const straightDown: Limb = { upper: 90, lower: 90 }

export const FIGURES: Record<string, Figure> = {
  db_flat_press: {
    props: { bench: 'flat', benchAt: { x: 40, y: 96, w: 100 }, floor: 128 },
    start: { hip: [118, 90], torso: 180, armNear: { upper: 100, lower: -90 }, legNear: { upper: 20, lower: 90 }, legFar: { upper: 28, lower: 92 }, dumbbells: 'both' },
    finish: { hip: [118, 90], torso: 180, armNear: { upper: -88, lower: -90 }, armFar: { upper: -92, lower: -90 }, legNear: { upper: 20, lower: 90 }, legFar: { upper: 28, lower: 92 }, dumbbells: 'both' },
    caption: ['Dumbbells at chest, elbows about 45° from your sides', 'Press straight up over your chest'],
  },
  db_incline_press: {
    props: { bench: 'incline', benchAt: { x: 92, y: 100, w: 46, angle: 30, backX: 96 }, floor: 128 },
    start: { hip: [110, 95], torso: 210, armNear: { upper: 105, lower: -90 }, legNear: { upper: 15, lower: 90 }, legFar: { upper: 25, lower: 95 }, dumbbells: 'both' },
    finish: { hip: [110, 95], torso: 210, armNear: { upper: -95, lower: -95 }, armFar: { upper: -100, lower: -100 }, legNear: { upper: 15, lower: 90 }, legFar: { upper: 25, lower: 95 }, dumbbells: 'both' },
    caption: ['Bench at about 30°, dumbbells beside your upper chest', 'Press up over your upper chest'],
  },
  db_seated_shoulder_press: {
    props: { bench: 'upright', benchAt: { x: 78, y: 98, w: 40, angle: 82, backX: 84 }, floor: 128 },
    start: { hip: [98, 93], torso: -95, armNear: { upper: 105, lower: -85 }, armFar: { upper: 95, lower: -95 }, legNear: { upper: 0, lower: 90 }, legFar: { upper: 8, lower: 92 }, dumbbells: 'both' },
    finish: { hip: [98, 93], torso: -95, armNear: { upper: -88, lower: -90 }, armFar: { upper: -95, lower: -92 }, legNear: { upper: 0, lower: 90 }, legFar: { upper: 8, lower: 92 }, dumbbells: 'both' },
    caption: ['Sit tall, dumbbells at shoulder height', 'Press overhead, slightly in front of your head'],
  },
  db_lateral_raise: {
    props: { floor: 144 },
    start: { hip: [87, 86], torso: -90, front: true, armNear: { upper: 98, lower: 94 }, armFar: { upper: 82, lower: 86 }, legNear: { upper: 92, lower: 90 }, legFar: { upper: 88, lower: 90 }, dumbbells: 'both' },
    finish: { hip: [87, 86], torso: -90, front: true, armNear: { upper: 180, lower: 175 }, armFar: { upper: 0, lower: 5 }, legNear: { upper: 92, lower: 90 }, legFar: { upper: 88, lower: 90 }, dumbbells: 'both' },
    track: 'farHand',
    caption: ['Stand tall, light dumbbells by your sides', 'Raise out to the sides to shoulder height'],
  },
  forearm_plank: {
    props: { floor: 120 },
    start: { hip: [98, 104], torso: 189, head: 195, armNear: { upper: 90, lower: 180 }, legNear: { upper: 9, lower: 9 }, legFar: { upper: 8, lower: 8 } },
    caption: ['Elbows under shoulders, straight line from head to heels'],
  },
  db_single_arm_row: {
    props: { bench: 'flat', benchAt: { x: 30, y: 100, w: 100 }, floor: 130 },
    start: { hip: [110, 70], torso: 180, head: 185, armNear: straightDown, armFar: { upper: 135, lower: 135 }, legNear: { upper: 80, lower: 95 }, legFar: { upper: 90, lower: 0 }, dumbbells: 'near' },
    finish: { hip: [110, 70], torso: 180, head: 185, armNear: { upper: -20, lower: 90 }, armFar: { upper: 135, lower: 135 }, legNear: { upper: 80, lower: 95 }, legFar: { upper: 90, lower: 0 }, dumbbells: 'near' },
    caption: ['One knee and hand on the bench, back flat, arm hanging', 'Pull the dumbbell up to your hip'],
  },
  db_incline_rear_delt_fly: {
    props: { bench: 'pad-front', benchAt: { x: 71, y: 44, w: 32 }, floor: 140 },
    start: { hip: [87, 92], torso: -90, front: true, head: -90, armNear: { upper: 100, lower: 95 }, armFar: { upper: 80, lower: 85 }, legNear: { upper: 95, lower: 95 }, legFar: { upper: 85, lower: 85 }, dumbbells: 'both' },
    finish: { hip: [87, 92], torso: -90, front: true, head: -90, armNear: { upper: 172, lower: 178 }, armFar: { upper: 8, lower: 2 }, legNear: { upper: 95, lower: 95 }, legFar: { upper: 85, lower: 85 }, dumbbells: 'both' },
    track: 'farHand',
    caption: ['Chest on an incline bench (seen from the front), arms hanging', 'Raise the arms out wide, slight bend in the elbows'],
  },
  db_hammer_curl: {
    props: { floor: 144 },
    start: { hip: [90, 86], torso: -90, armNear: { upper: 92, lower: 90 }, legNear: { upper: 90, lower: 90 }, legFar: { upper: 92, lower: 90 }, dumbbells: 'near' },
    finish: { hip: [90, 86], torso: -90, armNear: { upper: 95, lower: -65 }, legNear: { upper: 90, lower: 90 }, legFar: { upper: 92, lower: 90 }, dumbbells: 'near' },
    caption: ['Stand tall, palms facing in', 'Curl up, elbows staying by your sides'],
  },
  reverse_crunch: {
    props: { floor: 120 },
    start: { hip: [98, 114], torso: 180, armNear: { upper: 0, lower: 0 }, legNear: { upper: -90, lower: 0 }, legFar: { upper: -85, lower: 2 } },
    finish: { hip: [94, 104], torso: 165, armNear: { upper: 15, lower: 0 }, legNear: { upper: -130, lower: -40 }, legFar: { upper: -126, lower: -36 } },
    track: 'knee',
    caption: ['On your back, knees bent at 90°', 'Curl your hips up, knees towards your chest'],
  },
  dead_bug: {
    props: { floor: 120 },
    start: { hip: [98, 114], torso: 180, armNear: { upper: -90, lower: -90 }, legNear: { upper: -90, lower: 0 }, legFar: { upper: -88, lower: 2 } },
    finish: { hip: [98, 114], torso: 180, armNear: { upper: 186, lower: 182 }, armFar: { upper: -90, lower: -90 }, legNear: { upper: -90, lower: 0 }, legFar: { upper: 8, lower: 2 } },
    caption: ['On your back, arms up, knees at 90°, lower back pressed down', 'Lower one arm and the opposite leg, then swap'],
  },
  db_chest_supported_row: {
    props: { bench: 'incline', benchAt: { x: 112, y: 114, w: 30, angle: 38, backX: 132 }, floor: 136 },
    start: { hip: [118, 96], torso: 218, head: 210, armNear: straightDown, legNear: { upper: 100, lower: 92 }, legFar: { upper: 108, lower: 90 }, dumbbells: 'both' },
    finish: { hip: [118, 96], torso: 218, head: 210, armNear: { upper: 18, lower: 92 }, armFar: { upper: 25, lower: 92 }, legNear: { upper: 100, lower: 92 }, legFar: { upper: 108, lower: 90 }, dumbbells: 'both' },
    caption: ['Chest on the incline bench, arms hanging', 'Row the elbows back, squeeze the shoulder blades'],
  },
  db_goblet_squat: {
    props: { floor: 144 },
    start: { hip: [92, 86], torso: -90, armNear: { upper: 100, lower: -60 }, legNear: { upper: 90, lower: 90 }, legFar: { upper: 92, lower: 90 }, dumbbells: 'chest' },
    finish: { hip: [80, 112], torso: -70, armNear: { upper: 100, lower: -60 }, legNear: { upper: 9.6, lower: 110 }, legFar: { upper: 12, lower: 108 }, dumbbells: 'chest' },
    track: 'hip',
    caption: ['Hold one dumbbell at your chest, feet a little wider than hips', 'Sit down between your heels, chest up'],
  },
  side_plank: {
    props: { floor: 128 },
    start: { hip: [88, 113], torso: 190, head: 195, armNear: { upper: 10, lower: 20 }, armFar: { upper: 90, lower: 180 }, legNear: { upper: 10, lower: 10 }, legFar: { upper: 11, lower: 11 } },
    caption: ['Elbow under shoulder, hips lifted in a straight line'],
  },
  db_floor_press: {
    props: { floor: 120 },
    start: { hip: [118, 114], torso: 180, armNear: { upper: 90, lower: -90 }, legNear: { upper: -45, lower: 45 }, dumbbells: 'both' },
    finish: { hip: [118, 114], torso: 180, armNear: { upper: -88, lower: -90 }, armFar: { upper: -92, lower: -90 }, legNear: { upper: -45, lower: 45 }, dumbbells: 'both' },
    caption: ['Lying on the floor, upper arms resting on the floor', 'Press up over your chest'],
  },
  incline_pushup: {
    props: { bench: 'flat', benchAt: { x: 10, y: 96, w: 46 }, floor: 128 },
    start: { hip: [86.1, 88.2], torso: 220, head: 220, armNear: { upper: 130, lower: 130 }, legNear: { upper: 40, lower: 40 }, legFar: { upper: 39, lower: 39 } },
    finish: { hip: [80.4, 102.1], torso: 205, head: 205, armNear: { upper: 206, lower: 79 }, legNear: { upper: 25, lower: 25 }, legFar: { upper: 24.5, lower: 24.5 } },
    track: 'hip',
    caption: ['Hands on the bench edge, body straight', 'Lower your chest towards the bench'],
  },
}
