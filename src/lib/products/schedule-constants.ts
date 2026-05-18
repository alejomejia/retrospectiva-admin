/**
 * Schedule caps for the publish-later flow. Shared between the
 * client-side picker (which validates on submit + gates the button)
 * and the server action (which re-validates, since clients can lie).
 */
export const MIN_SCHEDULE_LEAD_MINUTES = 5;
export const MAX_SCHEDULE_LEAD_MONTHS = 6;
