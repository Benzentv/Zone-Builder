// ============================================================
// Auth Module – Supabase Authentication
// ============================================================

let _supabase = null;

function getSupabase() {
    if (!_supabase) {
        if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('DEIN-PROJEKT')) {
            alert('Bitte konfiguriere SUPABASE_URL und SUPABASE_ANON_KEY in js/config.js!\nSiehe SETUP.md für Anleitung.');
            throw new Error('Supabase not configured');
        }
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _supabase;
}

// ---- Session ----
async function getSession() {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) {
        console.error('getSession error:', error);
        return null;
    }
    return data.session;
}

async function getUser() {
    const session = await getSession();
    return session?.user || null;
}

// ---- Sign In / Out ----
async function signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
}

// ---- User Role ----
async function getUserRole() {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await getSupabase()
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.warn('getUserRole error (user may not have a role assigned):', error.message);
        return 'viewer'; // Default to viewer if no role found
    }
    return data.role;
}

// ---- Auth Guards ----

/**
 * Requires authentication. Redirects to login if not authenticated.
 * Returns { user, role } if authenticated.
 */
async function requireAuth(requiredRole) {
    const session = await getSession();

    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    const role = await getUserRole();

    if (requiredRole && role !== requiredRole) {
        // Admin required but user is viewer → redirect to viewer map
        if (requiredRole === 'admin' && role !== 'admin') {
            window.location.href = 'map.html';
            return null;
        }
    }

    return { user: session.user, role };
}

// ---- Auth State Change Listener ----
function onAuthStateChange(callback) {
    getSupabase().auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
