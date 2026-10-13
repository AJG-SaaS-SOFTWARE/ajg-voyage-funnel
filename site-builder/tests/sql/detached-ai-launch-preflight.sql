-- ELTARA read-only preflight for detached BUILD (run as DBA on the intended staging DB).
-- Returns whether the installed function text contains the guarded BUILD branches.
-- This is NOT proof of business correctness: run SQL fixtures and Stripe sandbox separately.
with expected(schema_name,function_name,signature,fragment) as (
 values
 ('public','get_my_site_capabilities','uuid','purchased_launch'),
 ('private','reserve_my_site_ai_generation_internal','uuid, uuid','v_plan=''free'''),
 ('public','get_my_site_ai_access','uuid','launch_operations_remaining'),
 ('public','reserve_my_site_launch_operation','uuid, uuid, text','reserve_my_site_launch_operation_internal')
),
installed as (
 select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
        pg_get_functiondef(p.oid) as definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private')
)
select e.schema_name,e.function_name,
       to_regprocedure(format('%I.%I(%s)',e.schema_name,e.function_name,e.signature)) is not null as function_present,
       coalesce(position(e.fragment in pg_get_functiondef(to_regprocedure(format('%I.%I(%s)',e.schema_name,e.function_name,e.signature))))>0,false) as expected_guard_present
from expected e order by e.schema_name,e.function_name;

