
-- Exercise Library table
CREATE TABLE public.exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text NOT NULL,
  default_sets integer NOT NULL DEFAULT 3,
  default_reps text NOT NULL DEFAULT '10',
  video_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read exercises"
  ON public.exercise_library FOR SELECT
  USING (auth.role() = 'authenticated');

-- Training Templates table
CREATE TABLE public.training_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.training_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists manage own templates"
  ON public.training_templates FOR ALL
  USING (auth.uid() = specialist_id);

CREATE POLICY "Admins read all templates"
  ON public.training_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_training_templates_updated_at
  BEFORE UPDATE ON public.training_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed exercise library
INSERT INTO public.exercise_library (name, muscle_group, default_sets, default_reps) VALUES
-- Peito
('Supino reto com barra', 'Peito', 4, '8 a 10'),
('Supino inclinado com halteres', 'Peito', 4, '8 a 12'),
('Supino declinado com barra', 'Peito', 4, '8 a 10'),
('Crucifixo com halteres', 'Peito', 3, '10 a 12'),
('Crucifixo máquina', 'Peito', 3, '10 a 12'),
('Crossover polia alta', 'Peito', 3, '12 a 15'),
('Crossover polia baixa', 'Peito', 3, '12 a 15'),
('Supino reto com halteres', 'Peito', 4, '8 a 10'),
('Flexão de braço', 'Peito', 3, '10 a 15'),
-- Costas
('Puxada frontal aberta', 'Costas', 4, '8 a 12'),
('Puxada triângulo', 'Costas', 4, '8 a 10'),
('Remada curvada com barra', 'Costas', 4, '8 a 10'),
('Remada unilateral com halter', 'Costas', 3, '10 a 12'),
('Remada baixa na polia', 'Costas', 4, '8 a 12'),
('Remada cavalinho', 'Costas', 4, '8 a 10'),
('Pulldown braço reto', 'Costas', 3, '12 a 15'),
('Barra fixa', 'Costas', 3, '6 a 10'),
('Serrote', 'Costas', 3, '10 a 12'),
-- Ombro
('Desenvolvimento com halteres', 'Ombro', 4, '8 a 12'),
('Desenvolvimento máquina', 'Ombro', 4, '8 a 12'),
('Elevação lateral com halteres', 'Ombro', 3, '12 a 15'),
('Elevação lateral na polia', 'Ombro', 3, '12 a 15'),
('Elevação frontal', 'Ombro', 3, '12 a 15'),
('Face pull', 'Ombro', 3, '15 a 20'),
('Encolhimento com halteres', 'Ombro', 3, '12 a 15'),
('Desenvolvimento Arnold', 'Ombro', 3, '10 a 12'),
-- Bíceps
('Rosca direta com barra reta', 'Bíceps', 3, '10 a 12'),
('Rosca direta com barra W', 'Bíceps', 3, '10 a 12'),
('Rosca alternada com halteres', 'Bíceps', 3, '10 a 12'),
('Rosca martelo', 'Bíceps', 3, '10 a 12'),
('Rosca scott máquina', 'Bíceps', 3, '10 a 12'),
('Rosca concentrada', 'Bíceps', 3, '10 a 12'),
('Rosca na polia barra reta', 'Bíceps', 3, '10 a 12'),
-- Tríceps
('Tríceps polia com barra reta', 'Tríceps', 3, '10 a 12'),
('Tríceps polia com barra V', 'Tríceps', 3, '10 a 12'),
('Tríceps polia corda', 'Tríceps', 3, '10 a 12'),
('Tríceps francês com halter', 'Tríceps', 3, '10 a 12'),
('Tríceps testa com barra W', 'Tríceps', 3, '10 a 12'),
('Mergulho em paralelas', 'Tríceps', 3, '8 a 12'),
('Tríceps máquina', 'Tríceps', 3, '10 a 12'),
('Tríceps coice com halter', 'Tríceps', 3, '10 a 12'),
-- Pernas (Quadríceps)
('Agachamento livre com barra', 'Pernas', 4, '8 a 10'),
('Agachamento hack', 'Pernas', 4, '8 a 10'),
('Leg press 45°', 'Pernas', 4, '10 a 12'),
('Cadeira extensora', 'Pernas', 4, '12 a 15'),
('Agachamento búlgaro', 'Pernas', 3, '10 a 12'),
('Passada com halteres', 'Pernas', 3, '10 a 12'),
('Agachamento sumô', 'Pernas', 3, '10 a 12'),
-- Posteriores
('Mesa flexora', 'Posteriores', 3, '10 a 12'),
('Cadeira flexora', 'Posteriores', 3, '10 a 12'),
('Stiff com barra', 'Posteriores', 4, '8 a 10'),
('Stiff com halteres', 'Posteriores', 4, '8 a 10'),
('Levantamento terra', 'Posteriores', 4, '6 a 8'),
-- Glúteos
('Hip thrust com barra', 'Glúteos', 4, '10 a 12'),
('Elevação pélvica', 'Glúteos', 3, '12 a 15'),
('Cadeira abdutora', 'Glúteos', 3, '12 a 15'),
('Glúteo na polia', 'Glúteos', 3, '12 a 15'),
('Agachamento sumo com halter', 'Glúteos', 3, '10 a 12'),
-- Panturrilha
('Panturrilha em pé na máquina', 'Panturrilha', 4, '15 a 20'),
('Panturrilha sentado', 'Panturrilha', 4, '15 a 20'),
('Panturrilha no leg press', 'Panturrilha', 3, '15 a 20'),
-- Abdômen
('Abdominal infra', 'Abdômen', 3, '15 a 20'),
('Abdominal supra', 'Abdômen', 3, '15 a 20'),
('Prancha isométrica', 'Abdômen', 3, '30 a 60s'),
('Oblíquo na polia', 'Abdômen', 3, '12 a 15'),
('Abdominal na máquina', 'Abdômen', 3, '15 a 20');
