/** The Activity page's download: what the list shows, as CSV. */
import { downloadCsv } from '../shared/csv.js';
import type { FluvyActivity } from './view.js';

export function download(page: FluvyActivity): void {
  const rows = page.model().shown;
  if (!rows.length) return;
  const head = [
    'time',
    'entity_id',
    'state',
    'name',
    'message',
    'source',
    'context_id',
    'context_user_id',
    'context_event_type',
    'context_domain',
    'context_service',
    'context_entity_id',
    'context_state',
    'context_source',
  ];
  downloadCsv(
    'activity.csv',
    head,
    rows.map((e) => [
      new Date(e.when * 1000).toISOString(),
      e.entity_id,
      e.state,
      e.name,
      e.message,
      e.source,
      e.context_id,
      e.context_user_id,
      e.context_event_type,
      e.context_domain,
      e.context_service,
      e.context_entity_id,
      e.context_state,
      e.context_source,
    ]),
  );
}
