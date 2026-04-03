/** Keep in sync with DB RPC `internship_process_heartbeat` v_idle (seconds). */
export const SERVER_INACTIVITY_SECONDS = 3 * 60
export const CLIENT_INACTIVITY_MS = SERVER_INACTIVITY_SECONDS * 1000

/**
 * Heartbeat while the tab is visible (or session is ON_BREAK — break time credits must stay under
 * RPC v_tick_cap ~45s per tick for accurate totals).
 * Must be ≤ ~45s if you want full second-for-second credit each tick.
 */
export const HEARTBEAT_INTERVAL_MS_VISIBLE = 30_000

/**
 * When ACTIVE (or INACTIVE_AUTO) with a hidden tab, RPC credits 0 active time but still advances
 * last_tick_at. Slower pings save Vercel + DB vs the visible interval; must stay well under
 * SERVER_INACTIVITY_SECONDS (180) so we do not auto-INACTIVE solely from skipped heartbeats.
 */
export const HEARTBEAT_INTERVAL_MS_TAB_HIDDEN_THROTTLE = 120_000

/** Optional random “still there?” prompt between these bounds */
export const PING_CHALLENGE_MIN_MS = 20 * 60 * 1000
export const PING_CHALLENGE_MAX_MS = 40 * 60 * 1000

/** UTC day cap for credited active internship time (must match DB RPC `internship_process_heartbeat`). */
export const MAX_DAILY_ACTIVE_SECONDS = 3600
