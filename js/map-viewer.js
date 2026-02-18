// ============================================================
// Map Viewer – Read-only zone display
// ============================================================

(async function () {
    showLoading();

    // Auth check
    const auth = await requireAuth();
    if (!auth) return;

    // Setup navbar user info
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');
    if (userEmail) userEmail.textContent = auth.user.email;
    if (userRole) {
        userRole.textContent = auth.role === 'admin' ? 'Admin' : 'Viewer';
        userRole.className = 'badge ' + (auth.role === 'admin' ? 'badge-admin' : 'badge-viewer');
    }

    // Show admin link if admin
    const adminLink = document.getElementById('adminLink');
    if (adminLink && auth.role === 'admin') {
        adminLink.style.display = 'inline-flex';
    }

    // Init map
    const map = initMap('map');
    const zonesLayer = L.featureGroup().addTo(map);

    // Load zones
    try {
        const zones = await loadZones();
        let countBase = 0, countBan = 0, countAct = 0, countSafe = 0;

        zones.forEach(zone => {
            const layer = zoneToLayer(zone);
            if (!layer) return;

            // Count
            if (zone.type === 'base') countBase++;
            else if (zone.type === 'bauverbot') countBan++;
            else if (zone.type === 'safezone') countSafe++;
            else countAct++;

            // Popup
            layer.on('click', () => {
                const name = zone.name?.trim() || '(ohne Name)';
                const plz = zone.plz?.trim() || '-';
                const html = `
          <div class="popup-zone-card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span class="badge ${badgeClassForType(zone.type)}">${escapeHtml(typeLabel(zone.type))}</span>
            </div>
            <h4>${escapeHtml(name)}</h4>
            <div class="popup-detail"><span style="opacity:.6">PLZ:</span> <b>${escapeHtml(plz)}</b></div>
            <div class="popup-detail"><span style="opacity:.6">Form:</span> <b>${escapeHtml(zone.shape || '-')}</b></div>
          </div>
        `;
                L.popup({ closeButton: true })
                    .setLatLng(getLayerCenter(layer))
                    .setContent(html)
                    .openOn(map);
            });

            zonesLayer.addLayer(layer);
        });

        // Stats
        const statsBase = document.getElementById('statsBase');
        const statsBan = document.getElementById('statsBan');
        const statsAct = document.getElementById('statsAct');
        const statsSafe = document.getElementById('statsSafe');
        if (statsBase) statsBase.textContent = countBase;
        if (statsBan) statsBan.textContent = countBan;
        if (statsAct) statsAct.textContent = countAct;
        if (statsSafe) statsSafe.textContent = countSafe;

        // Fit bounds if zones exist
        if (zones.length > 0 && zonesLayer.getBounds().isValid()) {
            map.fitBounds(zonesLayer.getBounds().pad(0.3));
        }

    } catch (err) {
        console.error('Failed to load zones:', err);
        showToast('Fehler beim Laden der Zonen: ' + err.message, 'error');
    }

    hideLoading();

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut();
            window.location.href = 'index.html';
        });
    }
})();
