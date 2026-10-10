-- La cuenta de la demo pública (demo@alika.app) es compartida: su contraseña
-- está publicada a propósito en /demo. La UI ya no deja cambiarla, pero
-- cualquiera puede llamar a la API de Auth de Supabase con la clave pública
-- y una sesión de la demo. Este trigger es la guarda real.
--
-- Solo frena los cambios que llegan por GoTrue (rol supabase_auth_admin): la
-- API pública y también la admin API. Un UPDATE manual como postgres (por
-- ejemplo para rotar la contraseña de la demo) sigue funcionando.

create or replace function public.bloquear_cambios_cuenta_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin'
     and lower(coalesce(old.email, '')) = 'demo@alika.app'
     and (
       new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email
       or new.phone is distinct from old.phone
     )
  then
    raise exception 'La cuenta de la demo no se puede modificar.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.bloquear_cambios_cuenta_demo() from public, anon, authenticated;

drop trigger if exists bloquear_cambios_cuenta_demo on auth.users;
create trigger bloquear_cambios_cuenta_demo
  before update on auth.users
  for each row
  execute function public.bloquear_cambios_cuenta_demo();
