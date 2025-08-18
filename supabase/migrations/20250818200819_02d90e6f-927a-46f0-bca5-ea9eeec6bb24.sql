-- 1) Create or replace function to auto-expire pending offers when an order is unassigned
create or replace function public.expire_pending_offers_on_unassign()
returns trigger
language plpgsql
as $$
begin
  -- Only on UPDATE
  if tg_op = 'UPDATE' then
    -- Condition A: engineer_id changed from not-null to null (manual unassign)
    -- Condition B: status_enhanced changed to 'awaiting_install_booking'
    if (
         (new.engineer_id is null and old.engineer_id is not null)
         or
         (new.status_enhanced = 'awaiting_install_booking' and old.status_enhanced is distinct from new.status_enhanced)
       )
    then
      update public.job_offers
      set
        status = 'expired',
        expired_at = now(),
        updated_at = now(),
        delivery_details = coalesce(delivery_details, '{}'::jsonb)
          || jsonb_build_object(
               'auto_expired_due_to_unassign', true,
               'auto_expired_at', now(),
               'reason', case
                 when new.engineer_id is null and old.engineer_id is not null then 'engineer_unassigned'
                 when new.status_enhanced = 'awaiting_install_booking' then 'status_reset_to_needs_scheduling'
                 else 'unassign_reset'
               end
             )
      where order_id = new.id
        and status = 'pending';
      -- Note: We intentionally only expire PENDING offers; accepted/rejected/expired remain unchanged.
    end if;
  end if;

  return new;
end;
$$;

-- 2) Create trigger on orders to invoke the function after updates
drop trigger if exists trig_expire_offers_on_order_unassign on public.orders;

create trigger trig_expire_offers_on_order_unassign
after update on public.orders
for each row
execute function public.expire_pending_offers_on_unassign();