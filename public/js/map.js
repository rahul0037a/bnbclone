(() => {
    'use strict';
    const finitePoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    async function geocode(text) {
        const response = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(text) + '&format=json&limit=1', { signal: AbortSignal.timeout(7000) });
        if (!response.ok) throw new Error('Location service unavailable');
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Location not found');
        const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        if (!finitePoint(point.lat, point.lng)) throw new Error('Invalid map location');
        return point;
    }
    function draw(element, lat, lng, title, location) {
        if (typeof L === 'undefined') throw new Error('Map service unavailable');
        element.replaceChildren();
        const map = L.map(element, { scrollWheelZoom: false }).setView([lat, lng], 12);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri — Sources: Esri, HERE, Garmin, OpenStreetMap contributors' }).addTo(map);
        const popup = document.createElement('div');
        const heading = document.createElement('strong'); heading.textContent = title;
        const detail = document.createElement('p'); detail.textContent = location; detail.style.margin = '6px 0 0';
        popup.append(heading, detail);
        const marker = L.marker([lat, lng]).addTo(map).bindPopup(popup);
        return { map, marker };
    }
    const mapElement = document.getElementById('map');
    if (mapElement) {
        let loaded = false;
        const load = async () => {
            if (loaded) return; loaded = true;
            const location = [mapElement.dataset.location, mapElement.dataset.country].filter(Boolean).join(', ');
            try {
                let lat = Number.parseFloat(mapElement.dataset.lat), lng = Number.parseFloat(mapElement.dataset.lng);
                if (!finitePoint(lat, lng)) ({ lat, lng } = await geocode(location));
                draw(mapElement, lat, lng, mapElement.dataset.title || 'Stay location', location);
            } catch {
                mapElement.replaceChildren();
                const message = document.createElement('p'); message.className = 'muted small p-3'; message.textContent = 'The map is unavailable right now. Location: ' + location;
                mapElement.append(message);
            }
        };
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: '200px' });
            observer.observe(mapElement);
        } else load();
    }
    const button = document.getElementById('preview-location-btn');
    if (button) {
        const element = document.getElementById('map-preview');
        const status = document.getElementById('map-preview-status');
        const originalText = button.textContent;
        let preview;
        button.addEventListener('click', async () => {
            const location = document.getElementById('location').value.trim();
            const country = document.getElementById('country').value.trim();
            if (!location) { status.textContent = 'Enter a city or area first.'; document.getElementById('location').focus(); return; }
            button.disabled = true; button.textContent = 'Finding your place…'; status.textContent = '';
            try {
                const point = await geocode([location, country].filter(Boolean).join(', '));
                element.hidden = false;
                if (!preview) preview = draw(element, point.lat, point.lng, 'Location preview', [location, country].filter(Boolean).join(', '));
                else { preview.map.setView([point.lat, point.lng], 12); preview.marker.setLatLng([point.lat, point.lng]); }
                requestAnimationFrame(() => preview.map.invalidateSize());
                status.textContent = 'Approximate location found. Coordinates are checked again when you save.';
            } catch { status.textContent = 'Could not find that location. Try a more specific city or area.'; }
            finally { button.disabled = false; button.textContent = originalText; }
        });
    }
})();
