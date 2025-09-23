// =========================================================================
// 🚀 VARIÁVEIS GLOBAIS E-MÍDIAS MELHORADAS
// =========================================================================
let map;
let radioData = {};
let radioMarkers = [];
let coverageLayers = [];
let cityMarkers = [];
let cityMarkersByRadio = []; // Para controle por rádio (ambos os modos)
let allCities = [];
let filteredCities = [];
let isPropostaMode = false;
let activeRadios = [];
let cityRadioMapping = {};
let isMapExpanded = false;

// Mapeamento entre nomes de cidades e índices dos marcadores
window.cityPlacemarkMap = {};

// Cores para diferentes rádios na proposta
const RADIO_COLORS = [
    '#06055B', '#FC1E75', '#D71E97', '#AA1EA5', '#10B981', '#9E33AC'
];

// =========================================================================
// 🔧 FUNÇÃO: Toggle do Mapa Expandido
// =========================================================================
function toggleMapExpansion() {
    const propostaLayout = document.getElementById('proposta-section');
    const expandBtn = document.getElementById('map-expand-btn');
    const expandIcon = document.getElementById('expand-icon');
    const expandText = document.getElementById('expand-text');
    
    if (!propostaLayout || !expandBtn) return;
    
    isMapExpanded = !isMapExpanded;
    
    if (isMapExpanded) {
        propostaLayout.classList.add('map-expanded');
        expandBtn.classList.add('expanded');
        expandIcon.textContent = '🔽';
        expandText.textContent = 'Ocultar Lista';
        console.log('🔼 Mapa expandido');
    } else {
        propostaLayout.classList.remove('map-expanded');
        expandBtn.classList.remove('expanded');
        expandIcon.textContent = '🔼';
        expandText.textContent = 'Expandir Mapa';
        console.log('🔽 Mapa recolhido');
    }
    
    // Ajustar tamanho do mapa após transição
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 450);
}

// =========================================================================
// 🔧 FUNÇÃO: Converter KML Placemarks para Lista de Cidades
// =========================================================================
function convertKMLPlacemarksToCities(kmlPlacemarks, radioCoords, radioUF, radioName = '') {
    if (!kmlPlacemarks || kmlPlacemarks.length === 0) {
        console.log('❌ Nenhum placemark KML encontrado');
        return [];
    }
    
    console.log(`📍 Convertendo ${kmlPlacemarks.length} placemarks para lista de cidades`);
    
    const radioLocation = radioName ? radioName.toLowerCase() : '';
    const convertedCities = [];
    
    kmlPlacemarks.forEach((placemark, index) => {
        const cityName = placemark.name;
        const cityNameLower = cityName.toLowerCase();
        
        // Filtrar origem/rádio para não incluir na lista
        if (
            cityNameLower.includes('origem') ||
            cityNameLower.includes(radioLocation.replace('rádio', '').replace('fm', '').trim()) ||
            placemark.description?.includes('0.0 km') ||
            placemark.description?.includes('0,0 km')
        ) {
            console.log(`⚠️ Ignorando placemark de origem: "${cityName}"`);
            return;
        }
        
        const [lat, lng] = placemark.coordinates;
        const distance = calculateDistance(radioCoords[0], radioCoords[1], lat, lng);
        
        // Filtrar cidades muito próximas (provavelmente a própria rádio)
        if (distance < 0.5) {
            console.log(`⚠️ Ignorando cidade muito próxima: "${cityName}" (${distance.toFixed(1)} km)`);
            return;
        }
        
        const formattedCity = `${cityName} (${distance.toFixed(1)} km) - ${radioUF}`;
        convertedCities.push(formattedCity);
        
        console.log(`✅ Cidade convertida: "${formattedCity}"`);
    });
    
    // Ordenar por distância
    convertedCities.sort((a, b) => extractDistance(a) - extractDistance(b));
    
    console.log(`📋 Total de cidades convertidas: ${convertedCities.length}`);
    return convertedCities;
}

// =========================================================================
// 📊 FUNÇÃO: Export Excel (.XLSX)
// =========================================================================
function exportToExcel() {
    let citiesToExport = [];
    
    if (isPropostaMode) {
        citiesToExport = getUniqueCitiesOnly() || [];
    } else {
        citiesToExport = radioData.cidades || [];
    }
    
    if (!citiesToExport || citiesToExport.length === 0) {
        alert('❌ Nenhuma cidade disponível para exportar.');
        return;
    }
    
    try {
        const excelData = [];
        
        if (isPropostaMode) {
            excelData.push(['UF', 'Cidade', 'Distância (km)', 'Rádios']);
        } else {
            excelData.push(['Cidade', 'UF', 'Região', 'Distância (km)']);
        }
        
        citiesToExport.forEach(cidadeOriginal => {
            let nomeCidade = cidadeOriginal;
            let uf = '';
            let distancia = '';
            
            // Extrair distância se houver "(X.X km)"
            const distanceMatch = cidadeOriginal.match(/^(.*?)\s*$(\d+\.?\d*)\s*km$/i);
            if (distanceMatch) {
                nomeCidade = distanceMatch[1].trim();
                distancia = distanceMatch[2];
            }
            
            // Extrair UF se houver " - UF"
            if (nomeCidade.includes(' - ')) {
                const parts = nomeCidade.split(' - ');
                nomeCidade = parts[0];
                uf = parts[1];
            }
            
            if (isPropostaMode) {
                const radiosQueCobrema = cityRadioMapping[nomeCidade] || [];
                const radiosTexto = radiosQueCobrema.map(radio => 
                    `${radio.name} ${radio.dial}`
                ).join(', ');
                
                excelData.push([uf, nomeCidade, distancia, radiosTexto]);
            } else {
                excelData.push([nomeCidade, uf || radioData.uf, radioData.region || 'N/A', distancia]);
            }
        });
        
        // Criar e baixar Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        ws['!cols'] = isPropostaMode ? 
            [{ width: 8 }, { width: 30 }, { width: 12 }, { width: 50 }] :
            [{ width: 30 }, { width: 8 }, { width: 15 }, { width: 12 }];
        
        XLSX.utils.book_append_sheet(wb, ws, "Cobertura");
        
        const fileName = isPropostaMode ? 
            `cobertura-proposta-${new Date().toISOString().split('T')[0]}.xlsx` :
            `cobertura-${radioData.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'radio'}-${new Date().toISOString().split('T')[0]}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        
        // Feedback visual
        const btn = document.querySelector('.excel-export-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Exportado!';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        }
        
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('❌ Erro ao exportar arquivo. Tente novamente.');
    }
}

// =========================================================================
// 🏙️ FUNÇÕES AUXILIARES PARA CIDADES
// =========================================================================
function getUniqueCitiesOnly() {
    const uniqueCities = new Set();
    
    activeRadios.forEach((radio, index) => {
        if (radio.active && radioData.radios[index]) {
            const cities = radioData.radios[index].cidades || [];
            cities.forEach(cidade => {
                if (isRealCityWithDistance(cidade)) {
                    uniqueCities.add(cidade);
                }
            });
        }
    });
    
    return Array.from(uniqueCities).sort();
}

function isRealCityWithDistance(cityName) {
    if (!cityName || typeof cityName !== 'string') return false;
    
    const cityNameTrim = cityName.trim();
    const hasDistancePattern = /$\d+\.?\d*\s*km$$/i.test(cityNameTrim);
    
    return hasDistancePattern;
}

function countUniqueCities() {
    if (isPropostaMode) {
        const uniqueCities = new Set();
        
        activeRadios.forEach((radio, index) => {
            if (radio.active && radioData.radios[index]) {
                const cities = radioData.radios[index].cidades || [];
                cities.forEach(cidade => {
                    if (isRealCityWithDistance(cidade)) {
                        const cityName = extractCityName(cidade);
                        uniqueCities.add(cityName);
                    }
                });
            }
        });
        
        return uniqueCities.size;
    } else {
        if (!radioData.cidades) return 0;
        
        const uniqueCities = new Set();
        radioData.cidades.forEach(cidade => {
            if (isRealCityWithDistance(cidade)) {
                const cityName = extractCityName(cidade);
                uniqueCities.add(cityName);
            }
        });
        
        return uniqueCities.size;
    }
}

function extractCityName(fullCityString) {
    let cityName = fullCityString;
    
    // Remover "(X.X km)" se houver
    cityName = cityName.replace(/\s*$\d+\.?\d*\s*km$/i, '');
    
    // Remover " - UF" se houver
    if (cityName.includes(' - ')) {
        cityName = cityName.split(' - ')[0];
    }
    
    return cityName.trim();
}

function extractDistance(cityString) {
    const distanceMatch = cityString.match(/$(\d+\.?\d*)\s*km$/i);
    return distanceMatch ? parseFloat(distanceMatch[1]) : 999999;
}

// Função auxiliar para calcular distância entre coordenadas (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// =========================================================================
// 🚀 INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadRadioData();
        
        isPropostaMode = radioData.type === 'proposta';
        
        if (isPropostaMode) {
            await initializePropostaMode();
        } else {
            await initializeIndividualMode();
        }
        
        hideLoading();
    } catch (error) {
        console.error('Erro:', error);
        showError(error.message, error.stack);
    }
});

// =========================================================================
// 📡 CARREGAR DADOS
// =========================================================================
async function loadRadioData() {
    const params = new URLSearchParams(window.location.search);
    const notionId = params.get('id');
    const propostaId = params.get('proposta') || params.get('database');
    
    if (propostaId && /^[0-9a-f]{32}$/i.test(propostaId)) {
        radioData = await fetchPropostaFromNotion(propostaId);
    } else if (notionId && /^[0-9a-f]{32}$/i.test(notionId)) {
        radioData = await fetchRadioFromNotion(notionId);
    } else {
        // Dados de exemplo para desenvolvimento/teste
        radioData = {
            name: 'RÁDIO EXEMPLO FM',
            dial: '107.3',
            latitude: -27.0965,
            longitude: -48.8438,
            radius: 50000,
            region: 'Sul',
            uf: 'SC',
            praca: 'Florianópolis',
            universo: 1061390,
            pmm: 12886,
            impactos: 15000,
            imageUrl: 'https://via.placeholder.com/100x75/06055B/white?text=107.3',
            coverageType: 'circle',
            kmlPlacemarks: [
                { name: 'São José', coordinates: [-27.1167, -48.6333], description: '5.2 km' },
                { name: 'Palhoça', coordinates: [-27.6378, -48.6706], description: '12.8 km' },
                { name: 'Biguaçu', coordinates: [-27.4939, -48.6553], description: '15.1 km' },
                { name: 'Blumenau', coordinates: [-26.9194, -49.0661], description: '24.2 km' },
                { name: 'Joinville', coordinates: [-26.3044, -48.8458], description: '36.8 km' },
                { name: 'Itajaí', coordinates: [-26.9078, -48.6619], description: '42.5 km' }
            ],
            cidades: [],
            source: 'example',
            type: 'individual'
        };
        
        // Converter KML para lista de cidades no exemplo
        if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
            radioData.cidades = convertKMLPlacemarksToCities(
                radioData.kmlPlacemarks,
                [radioData.latitude, radioData.longitude],
                radioData.uf,
                radioData.name
            );
        }
    }
}

async function fetchRadioFromNotion(notionId) {
    const response = await fetch(`/.netlify/functions/radio-data?id=${notionId}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Converter KML para lista se necessário
    if (data.kmlPlacemarks && data.kmlPlacemarks.length > 0 && 
        (!data.cidades || data.cidades.filter(c => isRealCityWithDistance(c)).length === 0)) {
        
        console.log('🔧 Convertendo KML placemarks para lista de cidades (modo individual)');
        data.cidades = convertKMLPlacemarksToCities(
            data.kmlPlacemarks,
            [data.latitude, data.longitude],
            data.uf,
            data.name
        );
    }
    
    return data;
}

async function fetchPropostaFromNotion(databaseId) {
    const response = await fetch(`/.netlify/functions/radio-data?proposta=${databaseId}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📻 Rádios carregadas:', data.radios?.length || 0);
    
    // Converter KML para lista em cada rádio se necessário
    if (data.radios && data.radios.length > 0) {
        data.radios.forEach((radio, index) => {
            if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0 && 
                (!radio.cidades || radio.cidades.filter(c => isRealCityWithDistance(c)).length === 0)) {
                
                console.log(`🔧 Convertendo KML placemarks para lista de cidades (rádio ${index + 1})`);
                radio.cidades = convertKMLPlacemarksToCities(
                    radio.kmlPlacemarks,
                    [radio.latitude, radio.longitude],
                    radio.uf,
                    radio.name
                );
            }
        });
    }
    
    return data;
}

// =========================================================================
// 🎯 MODO INDIVIDUAL
// =========================================================================
async function initializeIndividualMode() {
    console.log('🎯 Inicializando modo individual...');
    
    const mapSection = document.getElementById('map-section');
    const mapDiv = document.getElementById('map');
    
    if (!mapSection || !mapDiv) {
        console.error('❌ Elementos do mapa não encontrados!');
        return;
    }
    
    // Forçar visibilidade
    mapSection.style.display = 'block';
    mapDiv.style.display = 'block';
    mapDiv.style.height = '600px';
    mapDiv.style.minHeight = '600px';
    
    await initializeMapIndividual();
    renderCidadesIndividual();
}

async function initializeMapIndividual() {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                console.log('🗺️ Inicializando mapa individual...');
                
                const mapElement = document.getElementById('map');
                if (!mapElement) {
                    console.error('❌ Elemento #map não encontrado!');
                    resolve();
                    return;
                }
                
                // Garantir visibilidade
                mapElement.style.height = '600px';
                mapElement.style.minHeight = '600px';
                mapElement.style.display = 'block';
                mapElement.style.visibility = 'visible';
                
                map = L.map('map', {
                    preferCanvas: false,
                    attributionControl: true,
                    zoomControl: true
                });
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18
                }).addTo(map);
                
                // Forçar redimensionamento
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
                
                addRadioMarkerIndividual();
                addCoverageIndividual();
                
                // Adicionar marcadores de cidades se houver KML
                if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
                    addCityMarkersIndividual();
                }
                
                fitMapToCoverageIndividual();
                
                // Redimensionamento final
                setTimeout(() => {
                    map.invalidateSize();
                }, 200);
                
                resolve();
            } catch (error) {
                console.error('❌ Erro ao inicializar mapa:', error);
                resolve();
            }
        }, 100);
    });
}

function addRadioMarkerIndividual() {
    const radioIcon = L.divIcon({
        html: `
            <img src="${radioData.imageUrl}" 
                    alt="${radioData.name}" 
                    class="radio-marker-image"
                    onerror="this.src='https://via.placeholder.com/56x56/06055B/white?text=${encodeURIComponent(radioData.dial || 'FM')}'">
        `,
        className: 'radio-marker',
        iconSize: [56, 56],
        iconAnchor: [28, 28]
    });
    
    const popupContent = `
        <div class="radio-popup">
            <img src="${radioData.imageUrl}" 
                    alt="${radioData.name}" 
                    onerror="this.src='https://via.placeholder.com/90x68/06055B/white?text=${encodeURIComponent(radioData.dial || 'FM')}'"
            >
            <h3>${radioData.name}</h3>
            <p><strong>${radioData.dial}</strong></p>
            <p>${radioData.praca} - ${radioData.uf}</p>
        </div>
    `;
    
    const radioMarker = L.marker([radioData.latitude, radioData.longitude], { icon: radioIcon })
        .bindPopup(popupContent)
        .addTo(map);
        
    radioMarkers.push(radioMarker);
}

function addCoverageIndividual() {
    if (radioData.coverageType === 'kml' && radioData.kmlCoordinates && radioData.kmlCoordinates.length > 0) {
        addKMLPolygonsIndividual();
    } else {
        addCoverageCircleIndividual();
    }
}

function addKMLPolygonsIndividual() {
    const kmlGroup = L.layerGroup();
    
    for (const polygon of radioData.kmlCoordinates) {
        if (polygon.length > 2) {
            const leafletPolygon = L.polygon(polygon, {
                color: '#06055B',
                fillColor: '#06055B',
                fillOpacity: 0.15,
                weight: 2,
                opacity: 0.8
            });
            
            leafletPolygon.bindPopup(`
                <div style="text-align: center; font-family: var(--font-primary);">
                    <h4 style="color: #06055B; margin: 0 0 8px 0;">Projeção de Cobertura</h4>
                    <p style="margin: 0; color: #64748B; font-size: 13px;">Área calculada via KML</p>
                </div>
            `);
            
            kmlGroup.addLayer(leafletPolygon);
        }
    }
    
    const coverageLayer = kmlGroup;
    coverageLayer.addTo(map);
    coverageLayers.push(coverageLayer);
}

function addCoverageCircleIndividual() {
    const coverageLayer = L.circle([radioData.latitude, radioData.longitude], {
        color: '#06055B',
        fillColor: '#06055B',
        fillOpacity: 0.1,
        radius: radioData.radius,
        weight: 2
    });
    
    coverageLayer.bindPopup(`
        <div style="text-align: center; font-family: var(--font-primary);">
            <h4 style="color: #06055B; margin: 0 0 8px 0;">Projeção de Cobertura</h4>
            <p style="margin: 0; color: #64748B;">Raio: <strong>${(radioData.radius / 1000).toFixed(0)} km</strong></p>
        </div>
    `);
    
    coverageLayer.addTo(map);
    coverageLayers.push(coverageLayer);
}

function addCityMarkersIndividual() {
    // Limpar marcadores anteriores
    clearAllCityMarkers();
    
    // Usar função unificada para modo individual
    if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
        addCityMarkers(radioData, 0, '#06055B', true);
    }
    
    // Atualizar visibilidade
    updateCityMarkersVisibility();
}

function fitMapToCoverageIndividual() {
    if (radioData.coverageType === 'kml' && radioData.kmlBounds) {
        const bounds = L.latLngBounds(
            [radioData.kmlBounds.south, radioData.kmlBounds.west],
            [radioData.kmlBounds.north, radioData.kmlBounds.east]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
    } else if (coverageLayers.length > 0 && coverageLayers[0].getBounds) {
        map.fitBounds(coverageLayers[0].getBounds(), { padding: [80, 80] });
    } else {
        const radiusKm = radioData.radius / 1000;
        const zoom = radiusKm > 100 ? 5 : radiusKm > 50 ? 6 : radiusKm > 25 ? 7 : 8;
        map.setView([radioData.latitude, radioData.longitude], zoom);
    }
}

function renderCidadesIndividual() {
    // Filtrar e ordenar por distância
    allCities = (radioData.cidades || [])
        .filter(cidade => isRealCityWithDistance(cidade))
        .sort((a, b) => extractDistance(a) - extractDistance(b));
    
    filteredCities = [...allCities];
    
    updateCidadesList();
    setupCitySearch();
    
    document.getElementById('cidade-count').textContent = allCities.length;
    document.getElementById('cidades-section').style.display = 'block';
}

// =========================================================================
// 🎯 MODO PROPOSTA
// =========================================================================
async function initializePropostaMode() {
    if (!radioData.radios || radioData.radios.length === 0) {
        throw new Error('Nenhuma rádio encontrada na proposta');
    }
    
    // Limpar marcadores anteriores
    clearAllCityMarkers();
    
    // Garantir propriedades básicas
    radioData.radios = radioData.radios.map((radio, index) => ({
        name: radio.name || 'Rádio Desconhecida',
        dial: radio.dial || 'N/A',
        latitude: radio.latitude || -23.5505,
        longitude: radio.longitude || -46.6333,
        radius: radio.radius || 50000,
        region: radio.region || 'N/A',
        uf: radio.uf || 'N/A',
        praca: radio.praca || 'N/A',
        universo: radio.universo || 0,
        pmm: radio.pmm || 0,
        impactos: radio.impactos || 0,
        imageUrl: radio.imageUrl || `https://via.placeholder.com/56x56/06055B/white?text=${encodeURIComponent(radio.dial || 'FM')}`,
        coverageType: radio.coverageType || 'circle',
        kmlCoordinates: radio.kmlCoordinates || [],
        kmlPlacemarks: radio.kmlPlacemarks || [],
        kmlBounds: radio.kmlBounds || null,
        cidades: radio.cidades || [],
        notionId: radio.notionId || `radio-${index}`,
        ...radio
    }));
    
    renderPropostaLayout();
    await initializeMapProposta();
    renderCidadesProposta();
}

function renderPropostaLayout() {
    // Esconder seção individual
    document.getElementById('info-section').style.display = 'none';
    document.getElementById('map-section').style.display = 'none';
    
    // Mostrar layout proposta
    document.getElementById('proposta-section').style.display = 'grid';
    
    // Inicializar rádios ativas
    activeRadios = radioData.radios.map((radio, index) => ({
        ...radio,
        index: index,
        active: true
    }));
    
    // Gerar lista de rádios
    const radiosListHtml = radioData.radios.map((radio, index) => `
        <div class="radio-item" id="radio-item-${index}">
            <img src="${radio.imageUrl}" 
                    alt="${radio.name}"
                    onerror="this.src='https://via.placeholder.com/36x27/${RADIO_COLORS[index % RADIO_COLORS.length].replace('#', '')}/white?text=FM'">
            <div class="radio-item-info" onclick="focusOnRadio(${index})">
                <div class="radio-item-name">${radio.name}</div>
                <div class="radio-item-details">${radio.dial} • ${radio.praca} - ${radio.uf}</div>
            </div>
            <input type="checkbox" 
                    class="radio-item-checkbox" 
                    id="checkbox-${index}"
                    checked 
                    onchange="toggleRadio(${index})">
        </div>
    `).join('');
    
    document.getElementById('radios-list').innerHTML = radiosListHtml;
    document.getElementById('radio-count-badge').textContent = radioData.totalRadios;
}

async function initializeMapProposta() {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                map = L.map('map');
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18
                }).addTo(map);
                
                setTimeout(() => map.invalidateSize(), 100);
                
                addMultipleRadios();
                fitMapToMultipleCoverage();
                
                resolve();
            } catch (error) {
                console.error('Erro do mapa proposta:', error);
                resolve();
            }
        }, 50);
    });
}

function addMultipleRadios() {
    if (!radioData.radios || radioData.radios.length === 0) return;
    
    // Adicionar coberturas primeiro
    const sortedRadios = [...radioData.radios].sort((a, b) => {
        const radiusA = a.radius || 50000;
        const radiusB = b.radius || 50000;
        return radiusB - radiusA;
    });
    
    sortedRadios.forEach((radio, sortIndex) => {
        const originalIndex = radioData.radios.findIndex(r => r.notionId === radio.notionId);
        const colorIndex = originalIndex % RADIO_COLORS.length;
        const color = RADIO_COLORS[colorIndex];
        
        addCoverageProposta(radio, originalIndex, color);
    });
    
    // Adicionar marcadores
    radioData.radios.forEach((radio, index) => {
        const colorIndex = index % RADIO_COLORS.length;
        const color = RADIO_COLORS[colorIndex];
        
        const adjustedPosition = calculateSmartOffset(radio, index, radioData.radios);
        
        addRadioMarkerProposta(radio, index, color, adjustedPosition);
        
        // Adicionar marcadores de cidades se houver KML
        if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0) {
            addCityMarkers(radio, index, color, false);
        }
    });
}

function calculateSmartOffset(currentRadio, currentIndex, allRadios) {
    const proximityThreshold = 0.01;
    const offsetDistance = 0.005;
    
    let adjustedLat = currentRadio.latitude;
    let adjustedLng = currentRadio.longitude;
    
    const nearbyRadios = allRadios.slice(0, currentIndex).filter(radio => {
        const distance = Math.sqrt(
            Math.pow(radio.latitude - currentRadio.latitude, 2) + 
            Math.pow(radio.longitude - currentRadio.longitude, 2)
        );
        return distance < proximityThreshold;
    });
    
    if (nearbyRadios.length > 0) {
        const angle = (currentIndex % 8) * (Math.PI / 4);
        const radius = offsetDistance * Math.ceil(currentIndex / 8);
        
        adjustedLat += Math.sin(angle) * radius;
        adjustedLng += Math.cos(angle) * radius;
    }
    
    return [adjustedLat, adjustedLng];
}

function addRadioMarkerProposta(radio, index, color, adjustedPosition = null) {
    const [lat, lng] = adjustedPosition || [radio.latitude, radio.longitude];
    
    const radioIcon = L.divIcon({
        html: `
            <img src="${radio.imageUrl}" 
                    alt="${radio.name}" 
                    class="radio-marker-image proposta-${(index % 5) + 1}"
                    onerror="this.src='https://via.placeholder.com/56x56/${color.replace('#', '')}/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
        `,
        className: 'radio-marker',
        iconSize: [56, 56],
        iconAnchor: [28, 28]
    });
    
    const popupContent = `
        <div class="radio-popup">
            <img src="${radio.imageUrl}" 
                    alt="${radio.name}" 
                    onerror="this.src='https://via.placeholder.com/90x68/${color.replace('#', '')}/white?text=${encodeURIComponent(radio.dial || 'FM')}'"
            >
            <h3>${radio.name}</h3>
            <p><strong>${radio.dial}</strong></p>
            <p>${radio.praca} - ${radio.uf}</p>
            <p style="font-size: 12px; color: ${color};">Rádio ${index + 1} de ${radioData.totalRadios}</p>
        </div>
    `;
    
    const radioMarker = L.marker([lat, lng], { icon: radioIcon })
        .bindPopup(popupContent)
        .addTo(map);
        
    radioMarkers.push(radioMarker);
}

function addCoverageProposta(radio, index, color) {
    if (radio.coverageType === 'kml' && radio.kmlCoordinates && radio.kmlCoordinates.length > 0) {
        const kmlGroup = L.layerGroup();
        
        for (const polygon of radio.kmlCoordinates) {
            if (polygon.length > 2) {
                const leafletPolygon = L.polygon(polygon, {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 2,
                    opacity: 0.6
                });
                
                leafletPolygon.bindPopup(`
                    <div style="text-align: center; font-family: var(--font-primary);">
                        <h4 style="color: ${color}; margin: 0 0 8px 0;">${radio.name}</h4>
                        <p style="margin: 0; color: #64748B; font-size: 13px;">Cobertura via KML</p>
                    </div>
                `);
                
                kmlGroup.addLayer(leafletPolygon);
            }
        }
        
        kmlGroup.addTo(map);
        coverageLayers.push(kmlGroup);
    } else {
        const coverageLayer = L.circle([radio.latitude, radio.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.08,
            radius: radio.radius,
            weight: 2,
            opacity: 0.6
        });
        
        coverageLayer.bindPopup(`
            <div style="text-align: center; font-family: var(--font-primary);">
                <h4 style="color: ${color}; margin: 0 0 8px 0;">${radio.name}</h4>
                <p style="margin: 0; color: #64748B;">Raio: <strong>${(radio.radius / 1000).toFixed(0)} km</strong></p>
            </div>
        `);
        
        coverageLayer.addTo(map);
        coverageLayers.push(coverageLayer);
    }
}

function fitMapToMultipleCoverage() {
    if (radioMarkers.length === 0) return;
    
    try {
        let bounds = L.latLngBounds();
        let boundsCreated = false;
        
        radioData.radios.forEach(radio => {
            if (radio.latitude && radio.longitude) {
                bounds.extend([radio.latitude, radio.longitude]);
                boundsCreated = true;
            }
        });
        
        radioData.radios.forEach(radio => {
            if (radio.kmlBounds) {
                bounds.extend([radio.kmlBounds.south, radio.kmlBounds.west]);
                bounds.extend([radio.kmlBounds.north, radio.kmlBounds.east]);
                boundsCreated = true;
            }
        });
        
        if (boundsCreated) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            const firstRadio = radioData.radios[0];
            map.setView([firstRadio.latitude, firstRadio.longitude], 8);
        }
    } catch (error) {
        console.error('Erro ao ajustar zoom:', error);
        const firstRadio = radioData.radios[0];
        map.setView([firstRadio.latitude, firstRadio.longitude], 8);
    }
}

function renderCidadesProposta() {
    const allRealCities = new Set();
    
    radioData.radios.forEach(radio => {
        const cities = radio.cidades || [];
        cities.forEach(cidade => {
            if (isRealCityWithDistance(cidade)) {
                allRealCities.add(cidade);
            }
        });
    });
    
    allCities = Array.from(allRealCities).sort((a, b) => extractDistance(a) - extractDistance(b));
    filteredCities = [...allCities];
    
    buildCityRadioMapping();
    
    updateCidadesList();
    setupCitySearch();
    
    const cidadesUnicasCount = countUniqueCities();
    document.getElementById('cidade-count').textContent = cidadesUnicasCount;
    document.getElementById('cidades-section').style.display = 'block';
}

// =========================================================================
// 🗺️ MAPEAMENTO CIDADE -> RÁDIOS
// =========================================================================
function buildCityRadioMapping() {
    cityRadioMapping = {};
    
    if (!radioData.radios) return;
    
    radioData.radios.forEach((radio, originalIndex) => {
        const cities = radio.cidades || [];
        
        cities.forEach(cidade => {
            if (!isRealCityWithDistance(cidade)) return;
            
            const cityName = extractCityName(cidade);
            
            if (!cityRadioMapping[cityName]) {
                cityRadioMapping[cityName] = [];
            }
            
            cityRadioMapping[cityName].push({
                ...radio,
                originalIndex: originalIndex
            });
        });
    });
}

// =========================================================================
// 🎯 FUNÇÕES AUXILIARES PARA PROPOSTA
// =========================================================================
function focusOnRadio(radioIndex) {
    if (!radioData.radios || radioIndex >= radioData.radios.length) return;
    
    const radio = radioData.radios[radioIndex];
    map.setView([radio.latitude, radio.longitude], 10);
    
    if (radioMarkers[radioIndex]) {
        radioMarkers[radioIndex].openPopup();
    }
}

function toggleRadio(radioIndex) {
    if (!radioData.radios || radioIndex >= radioData.radios.length) return;
    
    const checkbox = document.getElementById(`checkbox-${radioIndex}`);
    const radioItem = document.getElementById(`radio-item-${radioIndex}`);
    
    if (!checkbox || !radioItem) return;
    
    const isActive = checkbox.checked;
    activeRadios[radioIndex].active = isActive;
    
    if (isActive) {
        radioItem.classList.remove('disabled');
    } else {
        radioItem.classList.add('disabled');
    }
    
    updateMapLayers();
    updateRadioCount();
    
    const cidadesUnicasCount = countUniqueCities();
    document.getElementById('cidade-count').textContent = cidadesUnicasCount;
}

function updateMapLayers() {
    if (!isPropostaMode) return;
    
    radioMarkers.forEach((marker, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(marker)) map.addLayer(marker);
        } else {
            if (map.hasLayer(marker)) map.removeLayer(marker);
        }
    });
    
    coverageLayers.forEach((layer, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(layer)) map.addLayer(layer);
        } else {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        }
    });
    
    updateCityMarkersVisibility();
    updateCitiesForActiveRadios();
}

function updateCitiesForActiveRadios() {
    const activeCities = new Set();
    
    activeRadios.forEach((radio, index) => {
        if (radio.active && radioData.radios[index]) {
            const cities = radioData.radios[index].cidades || [];
            cities.forEach(cidade => {
                if (isRealCityWithDistance(cidade)) {
                    activeCities.add(cidade);
                }
            });
        }
    });
    
    allCities = Array.from(activeCities).sort((a, b) => extractDistance(a) - extractDistance(b));
    filteredCities = [...allCities];
    
    buildCityRadioMappingForActiveRadios();
    updateCidadesList();
    
    const cidadesUnicasCount = countUniqueCities();
    document.getElementById('cidade-count').textContent = cidadesUnicasCount;
}

function buildCityRadioMappingForActiveRadios() {
    cityRadioMapping = {};
    
    activeRadios.forEach((radio, index) => {
        if (!radio.active || !radioData.radios[index]) return;
        
        const radioData_single = radioData.radios[index];
        const cities = radioData_single.cidades || [];
        
        cities.forEach(cidade => {
            if (!isRealCityWithDistance(cidade)) return;
            
            const cityName = extractCityName(cidade);
            
            if (!cityRadioMapping[cityName]) {
                cityRadioMapping[cityName] = [];
            }
            
            cityRadioMapping[cityName].push({
                ...radioData_single,
                originalIndex: index
            });
        });
    });
}

function updateRadioCount() {
    const activeCount = activeRadios.filter(radio => radio.active).length;
    const badge = document.getElementById('radio-count-badge');
    
    if (badge) {
        badge.textContent = `${activeCount}/${radioData.totalRadios}`;
        
        if (activeCount === 0) {
            badge.style.background = 'var(--emidias-gray)';
        } else if (activeCount === radioData.totalRadios) {
            badge.style.background = 'var(--gradient-accent)';
        } else {
            badge.style.background = 'var(--gradient-primary)';
        }
    }
}

// =========================================================================
// 🎨 FUNÇÕES COMUNS
// =========================================================================
function updateCidadesList() {
    if (isPropostaMode) {
        updateCidadesListProposta();
    } else {
        updateCidadesListIndividual();
    }
}

function updateCidadesListIndividual() {
    const container = document.getElementById('cidades-list');
    
    if (filteredCities.length === 0) {
        container.innerHTML = '<div class="cidade-item">❌ Nenhuma cidade encontrada</div>';
        return;
    }
    
    container.innerHTML = filteredCities.map(cidade => {
        const cityName = extractCityName(cidade);
        const distance = extractDistance(cidade);
        let uf = '';
        
        if (cidade.includes(' - ')) {
            const parts = cidade.split(' - ');
            uf = parts[parts.length - 1];
        }
        
        const distanceText = distance < 999