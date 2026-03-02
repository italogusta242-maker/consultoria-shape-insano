-- Enable realtime for the tables the specialist panel listens to
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_habits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workouts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.psych_checkins;