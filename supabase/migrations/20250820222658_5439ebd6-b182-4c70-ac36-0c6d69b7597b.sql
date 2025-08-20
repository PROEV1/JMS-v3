-- Insert some sample inventory items if they don't exist
INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active, is_charger, is_serialized) 
SELECT 'EV Charging Cable Type 2', 'CABLE-T2-001', '32A Type 2 charging cable 5 meters', 'each', 89.99, 5, 50, 10, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE sku = 'CABLE-T2-001');

INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active, is_charger, is_serialized) 
SELECT 'Wall Mount Bracket', 'BRACKET-WM-001', 'Universal wall mount bracket for EV chargers', 'each', 45.50, 10, 100, 20, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE sku = 'BRACKET-WM-001');

INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active, is_charger, is_serialized) 
SELECT 'Circuit Breaker 32A', 'CB-32A-001', '32A single pole circuit breaker', 'each', 25.99, 5, 30, 8, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE sku = 'CB-32A-001');

INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active, is_charger, is_serialized) 
SELECT 'Tesla Wall Connector Gen 3', 'TWC-GEN3-001', 'Tesla Wall Connector Generation 3 up to 48A', 'each', 399.99, 2, 10, 3, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE sku = 'TWC-GEN3-001');

INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active, is_charger, is_serialized) 
SELECT 'Zappi v2 EV Charger', 'ZAPPI-V2-001', 'Zappi v2 intelligent EV charger 7.4kW', 'each', 899.99, 1, 5, 2, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE sku = 'ZAPPI-V2-001');