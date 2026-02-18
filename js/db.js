// ============================================================
// Database Module – Supabase CRUD for Zones
// ============================================================

/**
 * Load all zones from Supabase
 */
async function loadZones() {
    const { data, error } = await getSupabase()
        .from('zones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('loadZones error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Save a new zone to Supabase
 */
async function saveZone(zone) {
    const user = await getUser();
    const payload = {
        name: zone.name || '',
        plz: zone.plz || '',
        type: zone.type || 'base',
        shape: zone.shape || 'polygon',
        geometry: zone.geometry,
        radius: zone.radius || null,
        center: zone.center || null,
        created_by: user?.id || null,
    };

    const { data, error } = await getSupabase()
        .from('zones')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('saveZone error:', error);
        throw error;
    }
    return data;
}

/**
 * Update an existing zone in Supabase
 */
async function updateZone(id, updates) {
    const payload = {
        updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.plz !== undefined) payload.plz = updates.plz;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.shape !== undefined) payload.shape = updates.shape;
    if (updates.geometry !== undefined) payload.geometry = updates.geometry;
    if (updates.radius !== undefined) payload.radius = updates.radius;
    if (updates.center !== undefined) payload.center = updates.center;

    const { data, error } = await getSupabase()
        .from('zones')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('updateZone error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a zone from Supabase
 */
async function deleteZone(id) {
    const { error } = await getSupabase()
        .from('zones')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('deleteZone error:', error);
        throw error;
    }
}
