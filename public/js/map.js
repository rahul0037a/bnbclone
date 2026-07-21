// Initialize map on the show page
(function () {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const lng = parseFloat(mapEl.dataset.lng);
    const lat = parseFloat(mapEl.dataset.lat);
    const title = mapEl.dataset.title || 'Listing Location';
    const location = mapEl.dataset.location || '';
    const country = mapEl.dataset.country || '';
    const locationText = location + (country ? ', ' + country : '');

    // Custom red marker icon
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });

    function createMap(lat, lng) {
        const map = L.map('map').setView([lat, lng], 13);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        L.marker([lat, lng], { icon: redIcon })
            .addTo(map)
            .bindPopup(
                `<h6 style="margin:0 0 4px 0;">${title}</h6>` +
                `<p style="margin:0; color:#555;">${locationText}</p>`
            )
            .openPopup();
    }

    // If we have stored coordinates, use them directly
    if (!isNaN(lng) && !isNaN(lat)) {
        createMap(lat, lng);
    } else if (location) {
        // Fallback: geocode the location text client-side
        const query = encodeURIComponent(locationText);
        fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            { headers: { 'User-Agent': 'WanderLust-BnBClone/1.0' } }
        )
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    createMap(parseFloat(data[0].lat), parseFloat(data[0].lon));
                } else {
                    mapEl.innerHTML = '<p class="text-muted text-center py-4">Could not find this location on the map.</p>';
                }
            })
            .catch(() => {
                mapEl.innerHTML = '<p class="text-muted text-center py-4">Could not load the map.</p>';
            });
    } else {
        mapEl.style.display = 'none';
    }
})();

// Map preview for create/edit forms
(function () {
    const previewBtn = document.getElementById('preview-location-btn');
    if (!previewBtn) return;

    const mapPreviewEl = document.getElementById('map-preview');
    const locationInput = document.querySelector('input[name="listing[location]"]');
    const countryInput = document.querySelector('input[name="listing[country]"]');
    let previewMap = null;
    let previewMarker = null;

    // If editing an existing listing with coordinates, show map immediately
    if (mapPreviewEl && mapPreviewEl.dataset.lng && mapPreviewEl.dataset.lat) {
        const lng = parseFloat(mapPreviewEl.dataset.lng);
        const lat = parseFloat(mapPreviewEl.dataset.lat);
        if (!isNaN(lng) && !isNaN(lat)) {
            mapPreviewEl.style.display = 'block';
            previewMap = L.map('map-preview').setView([lat, lng], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(previewMap);
            previewMarker = L.marker([lat, lng]).addTo(previewMap);
        }
    }

    previewBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        const location = locationInput ? locationInput.value.trim() : '';
        const country = countryInput ? countryInput.value.trim() : '';

        if (!location) {
            alert('Please enter a location first.');
            return;
        }

        previewBtn.disabled = true;
        previewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';

        try {
            const query = encodeURIComponent(`${location}${country ? ', ' + country : ''}`);
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
                { headers: { 'User-Agent': 'WanderLust-BnBClone/1.0' } }
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);

                mapPreviewEl.style.display = 'block';

                if (!previewMap) {
                    previewMap = L.map('map-preview').setView([lat, lng], 13);
                    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '&copy; OpenStreetMap contributors',
                    }).addTo(previewMap);
                } else {
                    previewMap.setView([lat, lng], 13);
                }

                if (previewMarker) {
                    previewMarker.setLatLng([lat, lng]);
                } else {
                    previewMarker = L.marker([lat, lng]).addTo(previewMap);
                }

                // Invalidate size after display change
                setTimeout(() => previewMap.invalidateSize(), 100);
            } else {
                alert('Location not found. Try a more specific address.');
            }
        } catch (err) {
            console.error('Geocoding error:', err);
            alert('Error looking up location. Please try again.');
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Preview on Map';
        }
    });
})();
