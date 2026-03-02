
-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Closers and Admins can manage products
CREATE POLICY "Admins manage products"
ON public.products FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Closers manage products"
ON public.products FOR ALL
USING (has_role(auth.uid(), 'closer'::app_role))
WITH CHECK (has_role(auth.uid(), 'closer'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add product_id to invites
ALTER TABLE public.invites ADD COLUMN product_id UUID REFERENCES public.products(id);

-- Add payment_status to invites to track payment outcome
ALTER TABLE public.invites ADD COLUMN payment_status TEXT DEFAULT 'pending';
