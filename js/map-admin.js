// ============================================================
// Map Admin – Full CRUD zone editor
// ============================================================

(async function () {
    showLoading();

    // Auth check – Admin required
    const auth = await requireAuth('admin');
    if (!auth) return;

    // Setup navbar
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');
    if (userEmail) userEmail.textContent = auth.user.email;
    if (userRole) {
        userRole.textContent = 'Admin';
        userRole.className = 'badge badge-admin';
    }

    // Init map
    const map = initMap('map');
    const drawnItems = L.featureGroup().addTo(map);

    // Draw controls
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: {
            polygon: true,
            rectangle: true,
            circle: true,
            polyline: false,
            circlemarker: false,
            marker: true,
        },
    });
    map.addControl(drawControl);

    // State
    let allZones = [];

    // DOM refs
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    const zoneList = document.getElementById('zoneList');
    const zoneCount = document.getElementById('zoneCount');
    const togglePanelBtn = document.getElementById('togglePanelBtn');
    const sidePanel = document.getElementById('sidePanel');

    // Toggle panel
    if (togglePanelBtn && sidePanel) {
        togglePanelBtn.addEventListener('click', () => {
            sidePanel.classList.toggle('collapsed');
            document.body.classList.toggle('has-panel', !sidePanel.classList.contains('collapsed'));
            map.invalidateSize();
        });
    }

    // ---- Load Zones ----
    async function reloadZones() {
        try {
            allZones = await loadZones();
            drawnItems.clearLayers();

            allZones.forEach(zone => {
                const layer = zoneToLayer(zone);
                if (!layer) return;
                bindAdminPopup(layer, zone);
                drawnItems.addLayer(layer);
            });

            renderZoneList();

            if (allZones.length > 0 && drawnItems.getBounds().isValid()) {
                map.fitBounds(drawnItems.getBounds().pad(0.3));
            }
        } catch (err) {
            console.error('Failed to load zones:', err);
            showToast('Fehler beim Laden: ' + err.message, 'error');
        }
    }

    // ---- Bind admin popup (view + edit + delete) ----
    function bindAdminPopup(layer, zone) {
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
          <div class="popup-actions">
            <button class="btn btn-sm" data-action="edit" style="flex:1">✏️ Bearbeiten</button>
            <button class="btn btn-sm btn-danger" data-action="delete" style="flex:1">🗑️ Löschen</button>
          </div>
        </div>
      `;

            const popup = L.popup({ closeButton: true, autoClose: true })
                .setLatLng(getLayerCenter(layer))
                .setContent(html);

            popup.on('add', () => {
                setTimeout(() => {
                    const el = popup.getElement();
                    if (!el) return;

                    L.DomEvent.disableClickPropagation(el);

                    const editBtn = el.querySelector('[data-action="edit"]');
                    const delBtn = el.querySelector('[data-action="delete"]');

                    if (editBtn) {
                        L.DomEvent.on(editBtn, 'click', (e) => {
                            L.DomEvent.stop(e);
                            map.closePopup();
                            openEditForm(layer, zone);
                        });
                    }

                    if (delBtn) {
                        L.DomEvent.on(delBtn, 'click', async (e) => {
                            L.DomEvent.stop(e);
                            if (!confirm(`Zone "${zone.name || '(ohne Name)'}" wirklich löschen?`)) return;
                            try {
                                await deleteZone(zone.id);
                                showToast('Zone gelöscht', 'success');
                                map.closePopup();
                                await reloadZones();
                            } catch (err) {
                                showToast('Fehler: ' + err.message, 'error');
                            }
                        });
                    }
                }, 50);
            });

            popup.openOn(map);
        });
    }

    // ---- Edit form popup ----
    function openEditForm(layer, zone) {
        const html = `
      <div class="popup-create-form">
        <h4>Zone bearbeiten</h4>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select class="form-input" data-role="type">
            <option value="base" ${zone.type === 'base' ? 'selected' : ''}>Base</option>
            <option value="bauverbot" ${zone.type === 'bauverbot' ? 'selected' : ''}>Bauverbot</option>
            <option value="aktionspunkt" ${zone.type === 'aktionspunkt' ? 'selected' : ''}>Aktionspunkt</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1">
            <label class="form-label">PLZ</label>
            <input class="form-input" data-role="plz" value="${escapeHtml(zone.plz || '')}" placeholder="z.B. 7001" />
          </div>
          <div class="form-group" style="flex:1.2">
            <label class="form-label">Name</label>
            <input class="form-input" data-role="name" value="${escapeHtml(zone.name || '')}" placeholder="z.B. Grove Base" />
          </div>
        </div>
        <div class="popup-btn-row">
          <button class="btn btn-primary btn-sm" data-role="save" style="flex:1">💾 Speichern</button>
          <button class="btn btn-sm" data-role="cancel" style="flex:1">Abbrechen</button>
        </div>
      </div>
    `;

        const popup = L.popup({ closeOnClick: false, autoClose: false, closeButton: true })
            .setLatLng(getLayerCenter(layer))
            .setContent(html);

        popup.on('add', () => {
            setTimeout(() => {
                const el = popup.getElement();
                if (!el) return;

                L.DomEvent.disableClickPropagation(el);
                L.DomEvent.disableScrollPropagation(el);

                const typeEl = el.querySelector('[data-role="type"]');
                const plzEl = el.querySelector('[data-role="plz"]');
                const nameEl = el.querySelector('[data-role="name"]');
                const saveBtn = el.querySelector('[data-role="save"]');
                const cancelBtn = el.querySelector('[data-role="cancel"]');

                if (saveBtn) {
                    L.DomEvent.on(saveBtn, 'click', async (e) => {
                        L.DomEvent.stop(e);
                        try {
                            await updateZone(zone.id, {
                                type: typeEl.value,
                                plz: plzEl.value.trim(),
                                name: nameEl.value.trim(),
                            });
                            showToast('Zone aktualisiert', 'success');
                            map.closePopup();
                            await reloadZones();
                        } catch (err) {
                            showToast('Fehler: ' + err.message, 'error');
                        }
                    });
                }

                if (cancelBtn) {
                    L.DomEvent.on(cancelBtn, 'click', (e) => {
                        L.DomEvent.stop(e);
                        map.closePopup();
                    });
                }
            }, 50);
        });

        popup.openOn(map);
    }

    // ---- Create new zone (draw event) ----
    map.on(L.Draw.Event.CREATED, (e) => {
        let layer = e.layer;
        const defaultType = 'base';

        // Show create form
        const html = `
      <div class="popup-create-form">
        <h4>Neue Zone speichern</h4>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select class="form-input" data-role="type">
            <option value="base">Base</option>
            <option value="bauverbot">Bauverbot</option>
            <option value="aktionspunkt">Aktionspunkt</option>
            <option value="safezone">Safezone</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1">
            <label class="form-label">PLZ</label>
            <input class="form-input" data-role="plz" placeholder="z.B. 7001" />
          </div>
          <div class="form-group" style="flex:1.2">
            <label class="form-label">Name</label>
            <input class="form-input" data-role="name" placeholder="z.B. Grove Base" />
          </div>
        </div>
        <div class="popup-btn-row">
          <button class="btn btn-primary btn-sm" data-role="save" style="flex:1">💾 Speichern</button>
          <button class="btn btn-sm btn-danger" data-role="cancel" style="flex:1">Abbrechen</button>
        </div>
      </div>
    `;

        // Temporarily add layer so we can see it
        drawnItems.addLayer(layer);

        const popup = L.popup({ closeOnClick: false, autoClose: false, closeButton: true })
            .setLatLng(getLayerCenter(layer))
            .setContent(html);

        popup.on('add', () => {
            setTimeout(() => {
                const el = popup.getElement();
                if (!el) return;

                L.DomEvent.disableClickPropagation(el);
                L.DomEvent.disableScrollPropagation(el);

                const typeEl = el.querySelector('[data-role="type"]');
                const plzEl = el.querySelector('[data-role="plz"]');
                const nameEl = el.querySelector('[data-role="name"]');
                const saveBtn = el.querySelector('[data-role="save"]');
                const cancelBtn = el.querySelector('[data-role="cancel"]');

                // Live preview style
                if (typeEl) {
                    L.DomEvent.on(typeEl, 'change', (ev) => {
                        L.DomEvent.stop(ev);
                        if (layer.setStyle) layer.setStyle(styleForType(typeEl.value));
                    });
                }

                if (saveBtn) {
                    L.DomEvent.on(saveBtn, 'click', async (ev) => {
                        L.DomEvent.stop(ev);
                        const zoneData = layerToZoneData(layer, {
                            type: typeEl.value,
                            plz: plzEl.value.trim(),
                            name: nameEl.value.trim(),
                        });

                        try {
                            await saveZone(zoneData);
                            showToast('Zone erstellt!', 'success');
                            map.closePopup();
                            await reloadZones();
                        } catch (err) {
                            showToast('Fehler: ' + err.message, 'error');
                        }
                    });
                }

                if (cancelBtn) {
                    L.DomEvent.on(cancelBtn, 'click', (ev) => {
                        L.DomEvent.stop(ev);
                        drawnItems.removeLayer(layer);
                        map.closePopup();
                    });
                }
            }, 50);
        });

        popup.openOn(map);

        // Apply default style
        if (layer.setStyle) layer.setStyle(styleForType(defaultType));
    });

    // ---- Render zone list in sidebar ----
    function renderZoneList() {
        if (!zoneList) return;

        const query = (searchInput?.value || '').toLowerCase().trim();
        const filter = filterSelect?.value || 'all';

        const filtered = allZones.filter(z => {
            if (filter !== 'all' && z.type !== filter) return false;
            if (query) {
                const blob = `${z.name || ''} ${z.plz || ''}`.toLowerCase();
                if (!blob.includes(query)) return false;
            }
            return true;
        });

        if (zoneCount) zoneCount.textContent = `${filtered.length} Zone${filtered.length !== 1 ? 'n' : ''}`;

        if (filtered.length === 0) {
            zoneList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗺️</div>
          <div>Keine Zonen gefunden.</div>
        </div>
      `;
            return;
        }

        zoneList.innerHTML = '';

        filtered.forEach(zone => {
            const item = document.createElement('div');
            item.className = 'zone-item';
            item.innerHTML = `
        <div class="zone-dot ${dotClassForType(zone.type)}"></div>
        <div class="zone-info">
          <div class="zone-name">${escapeHtml(zone.name?.trim() || '(ohne Name)')}</div>
          <div class="zone-meta">
            <span>PLZ: ${escapeHtml(zone.plz?.trim() || '-')}</span>
            <span>${escapeHtml(typeLabel(zone.type))}</span>
          </div>
        </div>
        <div class="zone-actions">
          <button class="btn btn-icon btn-sm" data-action="focus" title="Zur Zone springen">📍</button>
          <button class="btn btn-icon btn-sm btn-danger" data-action="delete" title="Löschen">🗑️</button>
        </div>
      `;

            // Focus on map
            const focusBtn = item.querySelector('[data-action="focus"]');
            focusBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                focusZoneOnMap(zone);
            });

            // Delete
            const delBtn = item.querySelector('[data-action="delete"]');
            delBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                if (!confirm(`Zone "${zone.name || '(ohne Name)'}" löschen?`)) return;
                try {
                    await deleteZone(zone.id);
                    showToast('Zone gelöscht', 'success');
                    await reloadZones();
                } catch (err) {
                    showToast('Fehler: ' + err.message, 'error');
                }
            });

            // Click to focus
            item.addEventListener('click', () => focusZoneOnMap(zone));

            zoneList.appendChild(item);
        });
    }

    function focusZoneOnMap(zone) {
        drawnItems.eachLayer(layer => {
            if (layer._zoneData && layer._zoneData.id === zone.id) {
                if (layer.getBounds) {
                    map.fitBounds(layer.getBounds().pad(0.3));
                } else if (layer.getLatLng) {
                    map.setView(layer.getLatLng(), Math.max(map.getZoom(), 6));
                }
                layer.fire('click');
            }
        });
    }

    // Search & filter
    if (searchInput) searchInput.addEventListener('input', renderZoneList);
    if (filterSelect) filterSelect.addEventListener('change', renderZoneList);

    // ---- Initial load ----
    await reloadZones();
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
