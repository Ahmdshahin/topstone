-- ============================================================================
-- FACADE PRESENTATION SYSTEM — SEED DATA
-- Description: Development seed data for testing and local development
-- ============================================================================
-- NOTE: This file is for LOCAL DEVELOPMENT ONLY.
--       Never run against production.
--       Auth users must be created via Supabase Auth (dashboard or API).
--       The profiles below assume test users already exist in auth.users.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- §1  MATERIALS (product catalog seed)
-- ────────────────────────────────────────────────────────────────────────────
-- These can be inserted independently since they only reference created_by.
-- In development, use the first admin user's ID.

-- NOTE: Replace '00000000-0000-0000-0000-000000000001' with the actual UUID
--       of your first admin user from auth.users after creating test accounts.

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

  -- Skip seeding if admin user doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id) THEN
    RAISE NOTICE 'Seed skipped: admin user % does not exist. Create test users first.', v_admin_id;
    RETURN;
  END IF;

  -- ── Materials ─────────────────────────────────────────────────────────────

  INSERT INTO public.materials (name, slug, description, category, sku, unit_price, price_unit, currency, color, finish, thickness, origin_country, supplier, specifications, created_by)
  VALUES
    (
      'Crema Marfil Marble',
      'crema-marfil-marble',
      'Premium Spanish marble with warm cream tones and subtle veining. Ideal for elegant facade cladding.',
      'natural_stone',
      'NST-CRM-001',
      285.00,
      'sqm',
      'SAR',
      'Cream / Beige',
      'Polished',
      '20mm',
      'Spain',
      'Mediterranean Stone Co.',
      '{"hardness": "3-4 Mohs", "porosity": "0.5-1.0%", "density": "2.68 g/cm³", "water_absorption": "0.2%", "compressive_strength": "131 MPa", "flexural_strength": "12 MPa", "fire_rating": "A1"}',
      v_admin_id
    ),
    (
      'Nero Marquina Marble',
      'nero-marquina-marble',
      'Luxurious black marble with striking white veining. Statement material for high-end facades.',
      'natural_stone',
      'NST-NRM-002',
      420.00,
      'sqm',
      'SAR',
      'Black / White Veins',
      'Honed',
      '20mm',
      'Spain',
      'Iberian Marble Group',
      '{"hardness": "3-4 Mohs", "porosity": "0.4%", "density": "2.71 g/cm³", "water_absorption": "0.15%", "fire_rating": "A1"}',
      v_admin_id
    ),
    (
      'Riyadh Limestone',
      'riyadh-limestone',
      'Local limestone with warm honey tones. Cost-effective and climatically suited for Gulf region projects.',
      'natural_stone',
      'NST-RYD-003',
      145.00,
      'sqm',
      'SAR',
      'Honey / Sand',
      'Bush Hammered',
      '30mm',
      'Saudi Arabia',
      'Saudi Stone Industries',
      '{"hardness": "3 Mohs", "porosity": "5-15%", "density": "2.3 g/cm³", "water_absorption": "3-5%", "fire_rating": "A1", "local_availability": true}',
      v_admin_id
    ),
    (
      'Ultra Compact Dekton Kelya',
      'dekton-kelya',
      'Sintered stone surface with noir marble appearance. Zero porosity, UV resistant, ideal for exterior facades.',
      'engineered_stone',
      'EST-DKK-001',
      380.00,
      'sqm',
      'SAR',
      'Dark Grey / Black',
      'Polished',
      '12mm',
      'Spain',
      'Cosentino Arabia',
      '{"porosity": "0%", "water_absorption": "0%", "scratch_resistance": "8 Mohs", "uv_resistant": true, "fire_rating": "A1", "stain_resistant": true}',
      v_admin_id
    ),
    (
      'Aged Bronze Cladding Panel',
      'aged-bronze-panel',
      'Pre-patinated bronze composite panel. Develops natural verdigris over time for living facade aesthetic.',
      'metal',
      'MTL-ABP-001',
      520.00,
      'sqm',
      'SAR',
      'Bronze / Patina Green',
      'Pre-Patinated',
      '4mm composite',
      'Germany',
      'KME Architectural',
      '{"composition": "Copper-Tin Alloy", "weight": "5.2 kg/sqm", "thermal_expansion": "17.5 μm/m·K", "fire_rating": "A2-s1,d0", "recyclable": true}',
      v_admin_id
    ),
    (
      'Laminated Safety Glass',
      'laminated-safety-glass',
      'Structural laminated glass for curtain wall and facade glazing. Available in clear, tinted, and low-E variants.',
      'glass',
      'GLS-LSG-001',
      310.00,
      'sqm',
      'SAR',
      'Clear / Low Iron',
      'Low-E Coating',
      '12mm (6+6)',
      'UAE',
      'Gulf Glass Industries',
      '{"u_value": "1.1 W/m²K", "light_transmission": "70%", "solar_factor": "0.35", "sound_reduction": "38 dB", "safety_class": "2B2"}',
      v_admin_id
    ),
    (
      'Porcelain Facade Tile — Basalt Grey',
      'porcelain-basalt-grey',
      'Large format porcelain tile mimicking natural basalt. Frost-proof, stain-resistant, low maintenance.',
      'porcelain',
      'PRC-BSG-001',
      195.00,
      'sqm',
      'SAR',
      'Dark Grey',
      'Matt / Anti-Slip R11',
      '14mm',
      'Italy',
      'Marazzi Technical',
      '{"format": "600x1200mm", "weight": "32 kg/sqm", "water_absorption": "<0.1%", "frost_resistant": true, "slip_rating": "R11", "fire_rating": "A1"}',
      v_admin_id
    ),
    (
      'Thermally Modified Ash Cladding',
      'thermo-ash-cladding',
      'Heat-treated ashwood with enhanced durability. Warm natural aesthetic with Class 1 durability rating.',
      'wood',
      'WOD-TMA-001',
      240.00,
      'sqm',
      'SAR',
      'Dark Brown / Charcoal',
      'Brushed',
      '21mm',
      'Finland',
      'Lunawood Oy',
      '{"treatment": "Thermowood D", "durability_class": "1", "moisture_content": "5-7%", "density": "450 kg/m³", "fire_rating": "D-s2,d0", "fsc_certified": true}',
      v_admin_id
    );

  RAISE NOTICE 'Seeded % materials', 8;

END $$;
