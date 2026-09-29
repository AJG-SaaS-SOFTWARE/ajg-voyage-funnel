alter table public.product_events
  drop constraint if exists product_events_event_name_check;

alter table public.product_events
  add constraint product_events_event_name_check
  check (
    event_name in (
      'builder_open',
      'step_identity',
      'step_story',
      'step_booking',
      'step_review',
      'architect_generated',
      'architect_regenerated',
      'architect_refined',
      'architect_failed',
      'architect_applied',
      'revision_applied',
      'publish_success'
    )
  );
