// F9: Geospatial Map Visualization using Leaflet
import Alpine from 'alpinejs';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Recursively find GeoJSON-like structures in a document
function findGeoFields(obj, path = '') {
  const results = [];
  if (!obj || typeof obj !== 'object') return results;

  // Check if this object IS a GeoJSON geometry
  if (obj.type && obj.coordinates) {
    const geoTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'];
    if (geoTypes.includes(obj.type)) {
      results.push({ path: path || 'root', geometry: obj });
      return results;
    }
  }

  // Check for legacy coordinate pair [lng, lat] stored in a "loc" or "location" or "coordinates" field
  if (Array.isArray(obj) && obj.length === 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
    const fieldName = path.split('.').pop() || '';
    if (/loc|coord|pos|geo|point/i.test(fieldName)) {
      results.push({ path, geometry: { type: 'Point', coordinates: obj } });
      return results;
    }
  }

  // Recurse into object properties
  if (Array.isArray(obj)) {
    for (const [i, item] of obj.entries()) {
      results.push(...findGeoFields(item, path ? `${path}[${i}]` : `[${i}]`));
    }
  } else {
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('_') && key !== '_id') continue;
      results.push(...findGeoFields(val, path ? `${path}.${key}` : key));
    }
  }
  return results;
}

Alpine.data('geoMap', () => ({
  hasGeo: false,
  expanded: false,
  geoFields: [],
  map: null,

  init() {
    // Parse document JSON from embedded script tag
    const jsonEl = document.querySelector('#geo-document-json');
    if (!jsonEl) return;
    try {
      const doc = JSON.parse(jsonEl.textContent);
      this.geoFields = findGeoFields(doc);
      this.hasGeo = this.geoFields.length > 0;
    } catch {
      // Not valid JSON
    }
  },

  toggleMap() {
    this.expanded = !this.expanded;
    if (this.expanded && !this.map) {
      this.$nextTick(() => this.renderMap());
    }
  },

  renderMap() {
    const container = document.querySelector('#geo-map-container');
    if (!container || this.map) return;

    this.map = L.map(container).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);

    const bounds = [];
    for (const { path, geometry } of this.geoFields) {
      try {
        if (geometry.type === 'Point') {
          const [lng, lat] = geometry.coordinates;
          const marker = L.circleMarker([lat, lng], {
            radius: 8, fillColor: '#3b82f6', color: '#1d4ed8',
            weight: 2, opacity: 1, fillOpacity: 0.8,
          }).addTo(this.map);
          marker.bindPopup(`<b>${path}</b><br>[${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
          bounds.push([lat, lng]);
        } else {
          // Use Leaflet's GeoJSON layer for complex geometries
          const layer = L.geoJSON(geometry, {
            pointToLayer(feature, latlng) {
              return L.circleMarker(latlng, {
                radius: 8, fillColor: '#3b82f6', color: '#1d4ed8',
                weight: 2, opacity: 1, fillOpacity: 0.8,
              });
            },
          }).addTo(this.map);
          layer.bindPopup(`<b>${path}</b><br>Type: ${geometry.type}`);
          const layerBounds = layer.getBounds();
          if (layerBounds.isValid()) {
            bounds.push(layerBounds.getSouthWest(), layerBounds.getNorthEast());
          }
        }
      } catch {
        // Skip invalid geometry
      }
    }

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        this.map.setView(bounds[0], 12);
      } else {
        this.map.fitBounds(bounds, { padding: [30, 30] });
      }
    }

    // Fix map sizing after render
    setTimeout(() => this.map.invalidateSize(), 100);
  },
}));
