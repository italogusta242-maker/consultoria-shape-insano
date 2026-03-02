
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS logradouro text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS meta_peso text,
ADD COLUMN IF NOT EXISTS como_chegou text;
