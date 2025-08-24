
-- 1) Create a robust admin-only delete function that handles dependencies and logs the action
create or replace function public.admin_delete_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order record;
begin
  -- Enforce admin access
  if not public.is_admin() then
    raise exception 'Access denied: Admin privileges required';
  end if;

  -- Fetch order (for logging) or fail early
  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- Log action
  perform public.log_user_action(
    'order_deleted',
    auth.uid(),
    jsonb_build_object(
      'order_id', p_order_id,
      'order_number', v_order.order_number,
      'client_id', v_order.client_id,
      'quote_id', v_order.quote_id,
      'total_amount', v_order.total_amount
    )
  );

  -- Defensive cleanup of related records (in case FKs are NOT cascading)
  delete from public.order_quote_snapshots where order_id = p_order_id;
  delete from public.job_offers            where order_id = p_order_id;
  delete from public.order_activity        where order_id = p_order_id;
  delete from public.order_payments        where order_id = p_order_id;
  delete from public.engineer_uploads      where order_id = p_order_id;
  delete from public.client_surveys        where order_id = p_order_id;
  delete from public.order_completion_checklist where order_id = p_order_id;

  -- Finally delete the order itself
  delete from public.orders where id = p_order_id;

  if not found then
    raise exception 'Failed to delete order %', p_order_id;
  end if;

  return true;
end;
$$;

-- 2) Allow authenticated users (front-end) to call this function;
--    admin enforcement is done inside the function via is_admin()
grant execute on function public.admin_delete_order(uuid) to authenticated;
