export const WALK_SPEED = 3.15;
export const SPRINT_SPEED = 4.9;
export const CROUCH_SPEED = 1.65;
export const JUMP_VELOCITY = 5.2;
export const GRAVITY = 12;
export const EYE_HEIGHT_STANDING = 0.85;
export const CROUCH_EYE_DROP = 0.2;
export const PLAYER_HEIGHT_STANDING = 1.78;
export const PLAYER_HEAD_CLEARANCE = 1.3;
export const FALL_SAFE_HEIGHT = 2.2;
export const FALL_DAMAGE_PER_METER = 14;
export const PLAYER_HEIGHT_CROUCHED = 1.18;
export const PLAYER_RADIUS = 0.15;
export const PLAYER_HIT_RADIUS = 0.2;
export const STEP_UP_HEIGHT = 0.36;
export const AIR_STEP_HEIGHT = 0.12;
export const RAMP_STICK_DISTANCE = 0.45;
export const CROUCH_TRANSITION_SPEED = 4.2;
export const GROUND_ACCELERATION = 38;
export const AIR_ACCELERATION = 9;
export const MAX_FALL_SPEED = 30;

export const ENERGY_MAX = 100;
export const HEALTH_MAX = 100;
export const SPRINT_ENERGY_COST_PER_SECOND = 15;
export const LANTERN_ENERGY_COST_PER_SECOND = 3.8;
export const ENERGY_REGEN_PER_SECOND = 8;
/** Délai après le sprint ou la lanterne : les couper une seconde ne recharge rien. */
export const ENERGY_USE_REGEN_PAUSE_SECONDS = 1;
export const SPRINT_START_ENERGY_COST = 2;
export const LANTERN_OPEN_ENERGY_COST = 1.5;
export const SPRINT_STOP_THRESHOLD = 1;
export const SPRINT_RESUME_THRESHOLD = 20;
export const LANTERN_MIN_ENERGY_TO_OPEN = 2;
export const JUMP_ENERGY_COST = 8;
export const JUMP_MIN_ENERGY = 2;
/** Plus long qu'un saut (0,87 s en l'air) : enchaîner les sauts ne régénère rien. */
export const JUMP_REGEN_PAUSE_SECONDS = 1.5;

export const LANTERN_LIGHT_INTENSITY = 12;
export const LANTERN_LIGHT_RANGE = 16;

export const MOVEMENT_BUDGET_CAP = 2.4;
export const SPRINT_GRACE_MS = 700;
