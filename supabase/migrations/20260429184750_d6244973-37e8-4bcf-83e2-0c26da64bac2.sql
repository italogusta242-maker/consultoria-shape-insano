-- Pedido do especialista (Guilherme):
-- "coloca a chama de honra pra que ela não se apague depois de 2 dias sem treinar se for no final de semana"
-- Alunos que treinam só seg-sex perdiam a chama na segunda. Agora sábado e domingo
-- são automaticamente aprovados pelo motor de inatividade — quem treina no fim de semana
-- continua ganhando o dia normalmente (essa função só decide PUNIÇÃO, não recompensa).

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
    dow INTEGER;
BEGIN
    -- Fim de semana é neutro: sábado (6) e domingo (0) nunca contam como inatividade.
    -- Isso preserva a chama de quem só treina dias úteis sem prejudicar quem treina no sábado.
    dow := EXTRACT(DOW FROM d_date);
    IF dow = 0 OR dow = 6 THEN
        RETURN TRUE;
    END IF;

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