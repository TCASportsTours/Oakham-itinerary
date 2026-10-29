import type { MeasurementType } from '@/data/types'

export interface MeasurementInfo {
  type: MeasurementType
  label: string
  method: string
  frequency: string
  steps: string[]
  optional?: boolean
  /** Illustration: tape line position on the figure. */
  tape: { x1: number; x2: number; y: number }
}

const COMMON = [
  'Keep the tape level (parallel to the floor) all the way round — use a mirror to check.',
  'Snug against the skin but not pressing in. Do not pull tight.',
  'Measure at the same time of day (ideally morning, before eating) and in the same place each time.',
  'Take two readings and use the average if they differ.',
]

export const MEASUREMENTS: MeasurementInfo[] = [
  { type: 'waist_navel', label: 'Waist at navel', method: 'Tape around belly-button level, abdomen relaxed', frequency: 'Fortnightly', steps: ['Stand tall, feet together, stomach relaxed — don’t suck in.', 'Wrap the tape round at the level of your belly button.', 'Read the tape at the end of a normal breath out.'], tape: { x1: 38, x2: 82, y: 98 } },
  { type: 'chest', label: 'Chest', method: 'Around the fullest part of the chest, tape horizontal', frequency: 'Every 4 weeks', steps: ['Arms relaxed by your sides.', 'Tape across the nipples / fullest part of the chest and under the armpits at the back.', 'Read at the end of a normal breath out.'], tape: { x1: 36, x2: 84, y: 66 } },
  { type: 'shoulders', label: 'Shoulders', method: 'Around the widest point of the shoulders and upper arms', frequency: 'Every 4 weeks', steps: ['Stand tall with arms relaxed by your sides.', 'Wrap the tape round the widest point of your shoulders, over the top of the upper arms.', 'You may need a helper for this one.'], tape: { x1: 24, x2: 96, y: 52 } },
  { type: 'arm_left', label: 'Left upper arm', method: 'Midpoint between shoulder and elbow, relaxed', frequency: 'Every 4 weeks', steps: ['Let the arm hang relaxed.', 'Find the midpoint between the bony point of the shoulder and the elbow.', 'Wrap the tape round at that midpoint.'], tape: { x1: 86, x2: 100, y: 74 } },
  { type: 'arm_right', label: 'Right upper arm', method: 'Midpoint between shoulder and elbow, relaxed', frequency: 'Every 4 weeks', steps: ['Let the arm hang relaxed.', 'Find the midpoint between the bony point of the shoulder and the elbow.', 'Wrap the tape round at that midpoint.'], tape: { x1: 20, x2: 34, y: 74 } },
  { type: 'hips', label: 'Hips', method: 'Widest part of the hips / buttocks', frequency: 'Every 4 weeks', steps: ['Feet together.', 'Wrap the tape round the widest part of your buttocks.', 'Check from the side that it is level.'], tape: { x1: 36, x2: 84, y: 118 } },
  { type: 'thigh_left', label: 'Left thigh', method: 'Consistent midpoint position', frequency: 'Every 4 weeks', steps: ['Stand with weight evenly on both legs.', 'Measure halfway between the hip crease and the top of the kneecap (note the distance so you can repeat it).'], tape: { x1: 61, x2: 80, y: 145 } },
  { type: 'thigh_right', label: 'Right thigh', method: 'Consistent midpoint position', frequency: 'Every 4 weeks', steps: ['Stand with weight evenly on both legs.', 'Measure halfway between the hip crease and the top of the kneecap (note the distance so you can repeat it).'], tape: { x1: 40, x2: 59, y: 145 } },
  { type: 'neck', label: 'Neck', method: 'Around the neck just below the Adam’s apple', frequency: 'Every 4 weeks', steps: ['Look straight ahead, shoulders relaxed.', 'Place the tape just below the Adam’s apple, sloping very slightly down at the front.'], tape: { x1: 52, x2: 68, y: 38 } },
  { type: 'waist_natural', label: 'Natural waist', method: 'Narrowest point between ribs and hips', frequency: 'Optional', optional: true, steps: ['Find the narrowest point of your torso, usually just above the belly button.', 'Measure relaxed at the end of a normal breath out.'], tape: { x1: 39, x2: 81, y: 88 } },
  { type: 'calf_left', label: 'Left calf', method: 'Widest part of the calf', frequency: 'Optional', optional: true, steps: ['Stand with weight even.', 'Measure round the widest part of the calf.'], tape: { x1: 63, x2: 77, y: 178 } },
  { type: 'calf_right', label: 'Right calf', method: 'Widest part of the calf', frequency: 'Optional', optional: true, steps: ['Stand with weight even.', 'Measure round the widest part of the calf.'], tape: { x1: 43, x2: 57, y: 178 } },
]

export const COMMON_TIPS = COMMON
export const measurementLabel = (t: MeasurementType) => (t === 'body_fat_pct' ? 'Estimated body fat %' : MEASUREMENTS.find((m) => m.type === t)?.label ?? t)

/** Simple front-view figure with the tape position highlighted. */
export function TapeIllustration({ info, className = 'h-44 w-28 shrink-0' }: { info: MeasurementInfo; className?: string }) {
  return (
    <svg viewBox="0 0 120 200" className={className} role="img" aria-label={`Tape placement for ${info.label}`}>
      <g fill="#2b2b29" stroke="#4a4a45" strokeWidth="1.5">
        <circle cx="60" cy="20" r="13" />
        <rect x="53" y="31" width="14" height="12" rx="3" />
        <path d="M30 46 Q60 38 90 46 L88 110 Q60 122 32 110 Z" />
        <path d="M30 48 L18 100 L26 102 L36 62 Z" />
        <path d="M90 48 L102 100 L94 102 L84 62 Z" />
        <path d="M34 108 Q60 126 86 108 L84 128 L36 128 Z" />
        <path d="M36 126 L40 190 L58 190 L59 128 Z" />
        <path d="M84 126 L80 190 L62 190 L61 128 Z" />
      </g>
      <line x1={info.tape.x1} x2={info.tape.x2} y1={info.tape.y} y2={info.tape.y} stroke="#ff7c1a" strokeWidth="4" strokeLinecap="round" />
      <line x1={info.tape.x1} x2={info.tape.x2} y1={info.tape.y} y2={info.tape.y} stroke="#ffffff" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  )
}
