select
  r.id as reservation_id,
  r.project_id,
  p.status as project_status,
  p.topic,
  r.reserved_credits,
  r.committed_credits,
  r.reserved_credits - r.committed_credits as unspent_credits,
  r.created_at,
  now() - r.created_at as age
from long_form_project_reservations r
join long_form_projects p on p.id = r.project_id
where r.status = 'reserved'
order by r.created_at asc;
