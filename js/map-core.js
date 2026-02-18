// ============================================================
// Map Core – Shared Leaflet utilities
// ============================================================

/**
 * Initialize the GTA 5 Leaflet map
 */
function initMap(elementId) {
    const map = L.map(elementId, {
        crs: L.CRS.Simple,
        minZoom: 3,
        maxZoom: 7,
        zoomControl: true,
    });

    L.tileLayer('https://gta5-map.github.io/tiles/road/{z}-{x}_{y}.png', {
        tileSize: 256,
        minZoom: 3,
        maxZoom: 7,
        attribution: 'GTA V Map',
    }).addTo(map);

    map.setView([-70, 120], 3);
    return map;
}

/**
 * Style for zone type
 */
function styleForType(type) {
    switch (type) {
        case 'base':
            return { color: '#00c8ff', fillColor: '#00c8ff', fillOpacity: 0.22, weight: 2, opacity: 0.8 };
        case 'bauverbot':
            return { color: '#ff5a5a', fillColor: '#ff5a5a', fillOpacity: 0.22, weight: 2, opacity: 0.8 };
        case 'aktionspunkt':
            return { color: '#ffc800', fillColor: '#ffc800', fillOpacity: 0.22, weight: 2, opacity: 0.8 };
        default:
            return { color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.12, weight: 2, opacity: 0.6 };
    }
}

/**
 * Type label in German
 */
function typeLabel(type) {
    switch (type) {
        case 'base': return 'Base';
        case 'bauverbot': return 'Bauverbot';
        case 'aktionspunkt': return 'Aktionspunkt';
        default: return type || 'Unbekannt';
    }
}

/**
 * Badge CSS class for type
 */
function badgeClassForType(type) {
    switch (type) {
        case 'base': return 'badge-base';
        case 'bauverbot': return 'badge-bauverbot';
        case 'aktionspunkt': return 'badge-aktionspunkt';
        default: return '';
    }
}

/**
 * Dot CSS class for type
 */
function dotClassForType(type) {
    switch (type) {
        case 'base': return 'dot-base';
        case 'bauverbot': return 'dot-bauverbot';
        case 'aktionspunkt': return 'dot-aktionspunkt';
        default: return '';
    }
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

/**
 * Create an action marker (yellow dot)
 */
function makeActionMarker(latlng) {
    const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:999px;background:rgba(255,200,0,0.95);
           border:2px solid rgba(10,10,15,0.9);box-shadow:0 0 12px rgba(255,200,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
    return L.marker(latlng, { icon });
}

/**
 * Get layer center LatLng
 */
function getLayerCenter(layer) {
    try {
        if (layer.getLatLng) return layer.getLatLng();
        if (layer.getBounds) return layer.getBounds().getCenter();
    } catch { }
    return L.latLng(-70, 120);
}

/**
 * Convert a DB zone record to a Leaflet layer
 */
function zoneToLayer(zone) {
    const type = zone.type || 'base';
    const shape = zone.shape || 'polygon';
    const style = styleForType(type);

    let layer;

    if (shape === 'circle') {
        const center = zone.center
            ? L.latLng(zone.center[0], zone.center[1])
            : (zone.geometry?.coordinates ? L.latLng(zone.geometry.coordinates[1], zone.geometry.coordinates[0]) : L.latLng(-70, 120));
        const radius = Number(zone.radius || 50);
        layer = L.circle(center, { radius, ...style });
    } else if (shape === 'marker') {
        const coords = zone.geometry?.coordinates;
        const latlng = coords ? L.latLng(coords[1], coords[0]) : L.latLng(-70, 120);
        layer = (type === 'aktionspunkt') ? makeActionMarker(latlng) : L.marker(latlng);
    } else {
        // Polygon / Rectangle – use GeoJSON
        const feature = {
            type: 'Feature',
            geometry: zone.geometry,
            properties: zone,
        };
        const temp = L.geoJSON(feature, { style: () => style });
        temp.eachLayer(l => { layer = l; });
    }

    if (layer) {
        layer._zoneData = zone;
    }

    return layer;
}

/**
 * Convert a drawn Leaflet layer to zone database fields
 */
function layerToZoneData(layer, props) {
    const data = {
        name: props.name || '',
        plz: props.plz || '',
        type: props.type || 'base',
    };

    if (layer instanceof L.Circle) {
        data.shape = 'circle';
        const c = layer.getLatLng();
        data.radius = layer.getRadius();
        data.center = [c.lat, c.lng];
        data.geometry = { type: 'Point', coordinates: [c.lng, c.lat] };
    } else if (layer instanceof L.Marker) {
        data.shape = 'marker';
        const ll = layer.getLatLng();
        data.geometry = { type: 'Point', coordinates: [ll.lng, ll.lat] };
    } else if (layer instanceof L.Rectangle) {
        data.shape = 'rectangle';
        data.geometry = layer.toGeoJSON().geometry;
    } else if (layer instanceof L.Polygon) {
        data.shape = 'polygon';
        data.geometry = layer.toGeoJSON().geometry;
    } else {
        data.shape = 'polygon';
        data.geometry = layer.toGeoJSON().geometry;
    }

    return data;
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span style="font-weight:700">${icon}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show / hide loading overlay
 */
function showLoading() {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}
