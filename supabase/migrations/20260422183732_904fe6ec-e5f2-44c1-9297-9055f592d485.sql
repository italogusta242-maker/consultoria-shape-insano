UPDATE public.exercise_library
SET muscle_group = 'cardio'
WHERE category = 'cardio' AND muscle_group <> 'cardio';