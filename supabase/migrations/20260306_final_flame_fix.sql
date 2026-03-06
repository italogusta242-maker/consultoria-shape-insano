-- 1. Schema Updates: Adicionando colunas de fuso e controle
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='timezone') THEN
        ALTER TABLE public.profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flame_status' AND column_name='last_midnight_check') THEN
        ALTER TABLE public.flame_status ADD COLUMN last_midnight_check DATE;
    END IF;
END $$;

-- 2. Função de Validação de Meta (SQL NATIVO)
CREATE OR REPLACE FUNCTION public.check_user_day_approval(u_id UUID, d_date DATE, tz TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    workout_exists BOOLEAN;
    total_meals INTEGER;
    completed_meals_count INTEGER;
BEGIN
    -- Verifica Treinos Finalizados no dia local do usuário
    SELECT EXISTS (
        SELECT 1 FROM public.workouts
        WHERE user_id = u_id
          AND (finished_at AT TIME ZONE tz)::date = d_date
    ) INTO workout_exists;

    IF workout_exists THEN RETURN TRUE; END IF;

    -- Verifica Dieta (Meta de 50%)
    SELECT jsonb_array_length(meals) FROM public.diet_plans
    WHERE user_id = u_id AND active = true
    ORDER BY created_at DESC LIMIT 1 INTO total_meals;

    IF total_meals IS NULL OR total_meals = 0 THEN RETURN FALSE; END IF;

    SELECT jsonb_array_length(completed_meals) FROM public.daily_habits
    WHERE user_id = u_id AND date = d_date INTO completed_meals_count;

    RETURN COALESCE((completed_meals_count::float / total_meals::float) >= 0.5, FALSE);
END;
$$;

-- 3. Função "O Juiz da Meia-Noite" (Multi-timezone Aware)
CREATE OR REPLACE FUNCTION public.process_midnight_flame_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    local_now timestamp;
    local_today date;
    local_yesterday date;
BEGIN
    FOR r IN 
        SELECT fs.user_id, fs.state, p.timezone, fs.streak, fs.last_midnight_check
        FROM public.flame_status fs
        JOIN public.profiles p ON p.id = fs.user_id
        WHERE fs.state IN ('ativa', 'tregua')
    LOOP
        local_now := now() AT TIME ZONE r.timezone;
        local_today := local_now::date;
        local_yesterday := (local_now - interval '1 day')::date;

        -- Só executa se for a hora 00:00 (ou logo após) no fuso do usuário
        IF EXTRACT(HOUR FROM local_now) = 0 THEN
             -- Idempotência: Se já checamos esse "hoje" local, pula
             IF r.last_midnight_check IS NULL OR r.last_midnight_check < local_today THEN
                 
                 -- Verifica se o aluno aprovou o dia que acabou de terminar (ontem local)
                 IF NOT public.check_user_day_approval(r.user_id, local_yesterday, r.timezone) THEN
                     IF r.state = 'ativa' THEN
                         UPDATE public.flame_status 
                         SET state = 'tregua', last_midnight_check = local_today, updated_at = now() 
                         WHERE user_id = r.user_id;
                     ELSIF r.state = 'tregua' THEN
                         UPDATE public.flame_status 
                         SET state = 'extinta', streak = 0, last_midnight_check = local_today, updated_at = now() 
                         WHERE user_id = r.user_id;
                     END IF;
                 ELSE
                     UPDATE public.flame_status 
                     SET last_midnight_check = local_today, updated_at = now() 
                     WHERE user_id = r.user_id;
                 END IF;
             END IF;
        END IF;
    END LOOP;
END;
$$;

-- 4. MIGRAÇÃO CURATIVA (SELF-HEALING)
-- Essa parte roda uma vez no deploy para punir quem deveria ter sido punido ontem.
DO $$
DECLARE
    r RECORD;
    local_yesterday date;
BEGIN
    RAISE NOTICE 'Iniciando Migração Curativa da Chama de Honra...';
    FOR r IN 
        SELECT fs.user_id, fs.state, p.timezone, fs.streak
        FROM public.flame_status fs
        JOIN public.profiles p ON p.id = fs.user_id
        WHERE fs.state IN ('ativa', 'tregua')
    LOOP
        -- Consideramos o "ontem" no fuso do cara
        local_yesterday := (now() AT TIME ZONE r.timezone - interval '1 day')::date;

        -- Se ele não aprovou o dia de ontem, punimos agora para "limpar a casa"
        IF NOT public.check_user_day_approval(r.user_id, local_yesterday, r.timezone) THEN
            IF r.state = 'ativa' THEN
                UPDATE public.flame_status SET state = 'tregua', updated_at = now() WHERE user_id = r.user_id;
                RAISE NOTICE 'Usuário % rebaixado para tregua (curativo)', r.user_id;
            ELSIF r.state = 'tregua' THEN
                UPDATE public.flame_status SET state = 'extinta', streak = 0, updated_at = now() WHERE user_id = r.user_id;
                RAISE NOTICE 'Usuário % rebaixado para extinta (curativo)', r.user_id;
            END IF;
        END IF;
    END LOOP;
END $$;

-- 5. Re-agendamento no Cron para rodar a cada hora no minuto 1
SELECT cron.unschedule('daily-flame-check');
SELECT cron.schedule(
    'daily-flame-check-v3',
    '1 * * * *',
    'SELECT public.process_midnight_flame_check()'
);
