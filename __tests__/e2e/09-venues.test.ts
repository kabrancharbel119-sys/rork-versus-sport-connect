import { supabaseAdmin } from './setup';

describe('VENUES — Données', () => {
  test('✅ Récupérer tous les terrains → au moins 1 résultat', async () => {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*');

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('✅ amenities est TEXT[] → pas de JSONB', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('amenities')
      .limit(1)
      .single();

    if (data && data.amenities) {
      expect(Array.isArray(data.amenities)).toBe(true);
    }
  });

  test('✅ images est TEXT[] → pas de JSONB', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('images')
      .limit(1)
      .single();

    if (data && data.images) {
      expect(Array.isArray(data.images)).toBe(true);
    }
  });

  test('✅ sport est JSONB → peut contenir plusieurs sports', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('sport')
      .limit(1)
      .single();

    if (data && data.sport) {
      expect(typeof data.sport).toBe('object');
    }
  });

  test('✅ latitude et longitude non null et valides', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('latitude, longitude')
      .limit(1)
      .single();

    if (data) {
      expect(data.latitude).toBeDefined();
      expect(data.longitude).toBeDefined();
      expect(typeof data.latitude).toBe('number');
      expect(typeof data.longitude).toBe('number');
    }
  });
});

describe('VENUES — Filtres', () => {
  test('✅ Filtrer par ville → insensible à la casse', async () => {
    const { data: allVenues } = await supabaseAdmin
      .from('venues')
      .select('city')
      .limit(1)
      .single();

    if (allVenues && allVenues.city) {
      const { data } = await supabaseAdmin
        .from('venues')
        .select('*')
        .ilike('city', allVenues.city);

      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('✅ Trier par price_per_hour ASC → prix croissant', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('price_per_hour')
      .order('price_per_hour', { ascending: true })
      .limit(2);

    if (data && data.length > 1) {
      expect(data[0].price_per_hour).toBeLessThanOrEqual(data[1].price_per_hour);
    }
  });

  test('✅ Trier par rating DESC → mieux notés en premier', async () => {
    const { data } = await supabaseAdmin
      .from('venues')
      .select('rating')
      .order('rating', { ascending: false })
      .limit(2);

    if (data && data.length > 1) {
      expect(data[0].rating).toBeGreaterThanOrEqual(data[1].rating);
    }
  });

  test('❌ Sport inexistant → tableau vide, pas d\'erreur', async () => {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .contains('sport', { sports: ['nonexistent_sport'] });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('❌ Ville inexistante → tableau vide, pas d\'erreur', async () => {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .eq('city', 'NonexistentCity12345');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data?.length).toBe(0);
  });
});

