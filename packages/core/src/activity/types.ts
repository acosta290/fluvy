/**
 * One entry of Home Assistant's activity (`logbook/event_stream`): a state change, an automation or script run,
 * an event an integration wrote. Times are Python timestamps (seconds).
 */
export interface ActivityEvent {
  readonly when: number;
  readonly name?: string;
  readonly message?: string;
  readonly entity_id?: string;
  readonly icon?: string;
  /** What started a run (an English phrase: "state of binary_sensor.door"). */
  readonly source?: string;
  readonly domain?: string;
  readonly state?: string;
  readonly context_id?: string;
  readonly context_user_id?: string;
  readonly context_event_type?: string;
  readonly context_domain?: string;
  readonly context_service?: string;
  readonly context_entity_id?: string;
  readonly context_name?: string;
  readonly context_state?: string;
  readonly context_source?: string;
  readonly context_message?: string;
}

/** What people look for in a day, one filter each. */
export type ActivityCategory =
  'lights' | 'climate' | 'media' | 'security' | 'people' | 'automations' | 'devices' | 'system';

export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  'lights',
  'climate',
  'media',
  'security',
  'people',
  'automations',
  'devices',
  'system',
];

/** The view's filter: the highlights (the default), everything, or one category. */
export type ActivityFilter = 'highlights' | 'all' | ActivityCategory;
