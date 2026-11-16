import { startSessionTerminationScheduler } from '../utils/session-termination'

/**
 * Starts the appointment-end room termination scheduler when Nitro boots.
 * The startup sweep covers rooms whose timer was lost during a restart.
 */
export default defineNitroPlugin(() => {
  startSessionTerminationScheduler()
})
