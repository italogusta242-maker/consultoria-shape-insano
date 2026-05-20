-- Create function to allow admins to edit flame status directly bypassing RLS via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.admin_update_flame_status(
  student_id UUID,
  new_streak INTEGER,
  new_state TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tz TEXT;
  local_today DATE;
BEGIN
  -- 1. Verificar permissão de admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar a chama.';
  END IF;

  -- 2. Obter fuso horário do perfil (padrão: America/Sao_Paulo)
  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO user_tz
  FROM public.profiles
  WHERE id = student_id;

  -- 3. Calcular a data de hoje no fuso horário do usuário
  local_today := (timezone(user_tz, now() at time zone 'utc'))::date;

  -- 4. Inserir ou atualizar na tabela flame_status
  INSERT INTO public.flame_status (
    user_id, 
    streak, 
    state, 
    last_approved_date, 
    last_midnight_check, 
    updated_at
  )
  VALUES (
    student_id, 
    new_streak, 
    new_state, 
    CASE WHEN new_state = 'ativa' THEN local_today ELSE NULL END, 
    local_today, 
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET streak = EXCLUDED.streak,
      state = EXCLUDED.state,
      last_approved_date = CASE WHEN EXCLUDED.state = 'ativa' THEN EXCLUDED.last_approved_date ELSE flame_status.last_approved_date END,
      last_midnight_check = EXCLUDED.last_midnight_check,
      updated_at = EXCLUDED.updated_at;
END;
$$;
