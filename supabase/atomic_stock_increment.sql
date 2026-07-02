-- Run this ONCE in Supabase SQL Editor
-- Atomic stock increment/decrement — prevents doubling on retry

CREATE OR REPLACE FUNCTION increment_mobile_stock(p_id UUID, p_delta INT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE mobiles SET stock = GREATEST(0, stock + p_delta) WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION increment_accessory_stock(p_id UUID, p_delta INT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE accessories SET stock = GREATEST(0, stock + p_delta) WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION increment_mobile_stock(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_accessory_stock(UUID, INT) TO anon, authenticated;
