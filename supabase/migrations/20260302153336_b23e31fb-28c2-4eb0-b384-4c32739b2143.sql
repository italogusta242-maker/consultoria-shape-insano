
ALTER TABLE public.exercise_library ADD COLUMN IF NOT EXISTS movement_pattern text;

UPDATE public.exercise_library SET equipment = 'Barra', movement_pattern = 'horizontal_press' WHERE name = 'Supino reto com barra';
UPDATE public.exercise_library SET equipment = 'Halter', movement_pattern = 'horizontal_press' WHERE name = 'Supino reto com halteres';
UPDATE public.exercise_library SET equipment = 'Máquina', movement_pattern = 'horizontal_press' WHERE name = 'Crucifixo máquina';
UPDATE public.exercise_library SET equipment = 'Barra', movement_pattern = 'squat' WHERE name = 'Agachamento livre com barra';
UPDATE public.exercise_library SET equipment = 'Máquina', movement_pattern = 'squat' WHERE name = 'Agachamento hack';
UPDATE public.exercise_library SET equipment = 'Máquina', movement_pattern = 'squat' WHERE name = 'Leg press 45°';
UPDATE public.exercise_library SET equipment = 'Barra', movement_pattern = 'vertical_pull' WHERE name = 'Puxada frontal aberta';
UPDATE public.exercise_library SET equipment = 'Peso Corporal', movement_pattern = 'vertical_pull' WHERE name = 'Barra fixa';

CREATE INDEX IF NOT EXISTS idx_exercise_movement_pattern ON public.exercise_library(muscle_group, movement_pattern);
