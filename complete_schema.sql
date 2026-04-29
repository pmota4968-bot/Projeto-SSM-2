-- Comprehensive SQL Schema for SSM Digital Command Center
-- This script contains all tables and RLS policies required for full operation.

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  color TEXT,
  type TEXT, -- 'Banco', 'Escola', 'Empresa', 'Ambulância', 'Outro'
  plan TEXT, -- 'Basic', 'Premium', 'Enterprise'
  contract_end DATE,
  total_employees INTEGER DEFAULT 0,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  deletion_reason TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profiles Table (Extended)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT,
  company_id TEXT REFERENCES public.companies(id),
  username TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  dob DATE,
  gender TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id),
  name TEXT NOT NULL,
  bi TEXT,
  age INTEGER,
  sex TEXT, -- 'M', 'F'
  blood_type TEXT,
  insurer TEXT,
  policy_number TEXT,
  policy_validity TEXT,
  emergency_contact JSONB, -- {name, relation, phone}
  allergies TEXT[],
  medications TEXT[],
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ambulances Table
CREATE TABLE IF NOT EXISTS public.ambulances (
  id TEXT PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  type TEXT, -- 'Básica', 'Avançada', 'Resgate'
  current_pos JSONB, -- [lat, lng]
  phase TEXT DEFAULT 'idle', -- 'idle', 'pending_accept', ...
  status TEXT DEFAULT 'available', -- 'available', 'maintenance', 'break'
  company_id TEXT REFERENCES public.companies(id),
  imei TEXT,
  capacity TEXT,
  performance JSONB, -- {totalIncidents, acceptanceRate, avgResponseTime}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id),
  name TEXT NOT NULL,
  license_number TEXT,
  phone TEXT,
  status TEXT DEFAULT 'available', -- 'available', 'on_duty', 'off_duty', 'break'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Resources Table
CREATE TABLE IF NOT EXISTS public.resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  category TEXT, -- 'ambulance', 'hospital', 'team'
  status TEXT, -- 'available', 'assigned', 'offline', 'maintenance'
  location TEXT,
  company_id TEXT REFERENCES public.companies(id),
  capacity TEXT,
  equipment TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  location_name TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'triage', 'transit', 'closed'
  priority TEXT, -- 'A', 'B', 'C', 'D'
  coords JSONB, -- [lat, lng]
  company_id TEXT REFERENCES public.companies(id),
  ambulance_id TEXT REFERENCES public.ambulances(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. GPS Tracks Table
CREATE TABLE IF NOT EXISTS public.gps_tracks (
  id BIGSERIAL PRIMARY KEY,
  imei TEXT NOT NULL,
  coords JSONB NOT NULL,
  speed NUMERIC,
  bearing NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Communication Logs Table
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id TEXT REFERENCES public.incidents(id),
  sender_id TEXT,
  sender_name TEXT,
  sender_role TEXT,
  recipient TEXT,
  message TEXT,
  type TEXT, -- 'RADIO', 'PHONE', 'WHATSAPP', 'SYSTEM', 'EXTERNAL'
  is_critical BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enabling RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 11. Comprehensive RLS Policies
-- General rule: ADMIN_SSM can see everything. Others see their own company records.

-- Drivers
DROP POLICY IF EXISTS "Drivers isolation" ON public.drivers;
CREATE POLICY "Drivers isolation" ON public.drivers FOR ALL USING (
  company_id = auth.jwt() -> 'user_metadata' ->> 'company_id' 
  OR auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN_SSM'
);

-- Ambulances
DROP POLICY IF EXISTS "Ambulance isolation" ON public.ambulances;
CREATE POLICY "Ambulance isolation" ON public.ambulances FOR ALL USING (
  company_id = auth.jwt() -> 'user_metadata' ->> 'company_id' 
  OR auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN_SSM'
);

-- Profiles
DROP POLICY IF EXISTS "Profile isolation" ON public.profiles;
CREATE POLICY "Profile isolation" ON public.profiles FOR ALL USING (
  id = auth.uid() 
  OR company_id = auth.jwt() -> 'user_metadata' ->> 'company_id'
  OR auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN_SSM'
);

-- Employees
DROP POLICY IF EXISTS "Employee isolation" ON public.employees;
CREATE POLICY "Employee isolation" ON public.employees FOR ALL USING (
  company_id = auth.jwt() -> 'user_metadata' ->> 'company_id' 
);

-- Incidents
DROP POLICY IF EXISTS "Incident isolation" ON public.incidents;
CREATE POLICY "Incident isolation" ON public.incidents FOR ALL USING (
  company_id = auth.jwt() -> 'user_metadata' ->> 'company_id' 
  OR auth.jwt() -> 'user_metadata' ->> 'role' IN ('ADMIN_SSM', 'OPERADOR_COORD')
);

-- Resources
DROP POLICY IF EXISTS "Resource isolation" ON public.resources;
CREATE POLICY "Resource isolation" ON public.resources FOR ALL USING (
  company_id = auth.jwt() -> 'user_metadata' ->> 'company_id' 
  OR auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN_SSM'
);

-- Function to handle new user registration from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, company_id, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'company_id',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
