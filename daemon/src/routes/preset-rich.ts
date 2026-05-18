import { Hono } from 'hono';
import { queries } from './session.js';

export const presetRichRoutes = new Hono();

/**
 * GET /api/preset/rich
 *
 * Returns the 32-item rich preset checklist for the current active (or latest)
 * session, merged with live status from preset_status_history.
 *
 * Response: { items: PresetRichRow[], total: number, done: number, partial: number, missing: number }
 */
presetRichRoutes.get('/rich', (c) => {
  const session = queries.getCurrentActiveSession() ?? queries.getLatestSession();
  if (!session) {
    return c.json({
      items: [],
      total: 0,
      done: 0,
      partial: 0,
      missing: 0,
    });
  }

  const items = queries.listPresetRich(session.id);
  const done = items.filter((i) => i.status === 'done').length;
  const partial = items.filter((i) => i.status === 'partial').length;
  const missing = items.filter((i) => i.status === 'missing').length;

  return c.json({
    items,
    total: items.length,
    done,
    partial,
    missing,
  });
});
