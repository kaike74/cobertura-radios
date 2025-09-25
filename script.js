
// =========================================================================
// 🚀 VARIÁVEIS GLOBAIS E-MÍDIAS
// =========================================================================
let map;
let radioData = {};
let radioMarkers = []; // Array para múltiplos marcadores
let coverageLayers = []; // Array para múltiplas coberturas
let cityMarkers = [];
let allCities = [];
let filteredCities = [];
let isPropostaMode = false; // Flag para detectar modo
let activeRadios = []; // Array para controlar rádios ativas (checkboxes)
let cityRadioMapping = {}; // Mapeamento cidade -> rádios que a cobrem
let isMapExpanded = false;
let radioListItems = [];

// Mapeamento entre nomes de cidades e índices dos marcadores
window.cityPlacemarkMap = {};

// Cores para diferentes rádios na proposta
const RADIO_COLORS = [
    '#06055B', // Azul E-MÍDIAS
    '#FC1E75', // Magenta E-MÍDIAS
    '#D71E97', // Rosa E-MÍDIAS
    '#AA1EA5', // Roxo E-MÍDIAS
    '#10B981', // Verde sucesso
    '#9E33AC'  // Roxo acinzentado
];

// =========================================================================
// 📊 EXPORTAR PARA EXCEL (NOVA ESTRUTURA)
// =========================================================================
function exportToExcel() {
    console.log('📊 Iniciando exportação para Excel...');
    
    if (!filteredCities || filteredCities.length === 0) {
        alert('❌ Nenhuma cidade disponível para exportação.');
        return;
    }
    
    try {
        // Preparar dados conforme nova estrutura
        const excelData = [];
        
        // Cabeçalho
        excelData.push(['UF', 'Cidade', 'Rádios que abrangem a praça']);
        
        // Processar cada cidade
        filteredCities.forEach(cidade => {
            // Filtrar apenas rádios ativas (se for modo proposta)
            let radiosParaExportar = cidade.radios;
            
            if (isPropostaMode) {
                radiosParaExportar = cidade.radios.filter(radio => 
                    activeRadios[radio.originalIndex] && activeRadios[radio.originalIndex].active
                );
            }
            
            if (radiosParaExportar.length === 0) return;
            
            // Criar string das rádios no formato: "Rádio - Dial - Cidade de origem"
            const radiosString = radiosParaExportar.map(radio => {
                const nomeRadio = radio.name || 'Rádio Desconhecida';
                const dial = radio.dial || 'N/A';
                const cidadeOrigem = radio.praca || 'N/A';
                
                return `${nomeRadio} - ${dial} - ${cidadeOrigem}`;
            }).join(', ');
            
            // Adicionar linha à planilha
            excelData.push([
                cidade.uf,           // Coluna A: UF
                cidade.nome,         // Coluna B: Cidade (sem quilometragem)
                radiosString         // Coluna C: Rádios que abrangem a praça
            ]);
        });
        
        console.log('📊 Dados preparados:', excelData.length - 1, 'cidades');
        
        // Criar workbook
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        
        // Configurar larguras das colunas
        ws['!cols'] = [
            { wch: 8 },   // Coluna A (UF): 8 caracteres
            { wch: 25 },  // Coluna B (Cidade): 25 caracteres
            { wch: 60 }   // Coluna C (Rádios): 60 caracteres
        ];
        
        // Estilizar cabeçalho
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "06055B" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        
        // Aplicar estilo ao cabeçalho
        ['A1', 'B1', 'C1'].forEach(cell => {
            if (ws[cell]) {
                ws[cell].s = headerStyle;
            }
        });
        
        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Cidades de Cobertura');
        
        // Gerar nome do arquivo
        let fileName = 'cidades_cobertura';
        
        if (isPropostaMode) {
            fileName = 'proposta_cidades_cobertura';
        } else if (radioData.name) {
            const radioNameClean = radioData.name
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase();
            fileName = `${radioNameClean}_cidades`;
        }
        
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Fazer download
        XLSX.writeFile(wb, fileName);
        
        console.log('✅ Exportação concluída:', fileName);
        
        // Feedback visual
        const exportBtn = document.querySelector('.excel-export-btn');
        if (exportBtn) {
            const originalText = exportBtn.textContent;
            exportBtn.textContent = '✅ Exportado!';
            exportBtn.style.background = 'var(--gradient-success)';
            
            setTimeout(() => {
                exportBtn.textContent = originalText;
                exportBtn.style.background = '';
            }, 2000);
        }
        
    } catch (error) {
        console.error('❌ Erro na exportação:', error);
        alert('❌ Erro ao exportar planilha. Verifique o console para mais detalhes.');
    }
}

// =========================================================================
// 🏙️ FUNÇÃO PARA OBTER APENAS CIDADES ÚNICAS (SEM NOMES DE RÁDIOS)
// =========================================================================
function getUniqueCitiesOnly() {
    const uniqueCities = new Set();
    
    // Coletar cidades de todas as rádios ativas
    activeRadios.forEach((radio, index) => {
        if (radio.active && radioData.radios[index]) {
            const cities = radioData.radios[index].cidades || [];
            cities.forEach(cidade => {
                // Verificar se é realmente uma cidade (não nome de rádio)
                if (isRealCity(cidade)) {
                    uniqueCities.add(cidade);
                }
            });
        }
    });
    
    return Array.from(uniqueCities).sort();
}

// =========================================================================
// 🔍 FUNÇÃO PARA VERIFICAR SE É UMA CIDADE REAL (NÃO NOME DE RÁDIO)
// =========================================================================
function isRealCity(cityName) {
    const lowerCityName = cityName.toLowerCase();
    
    // Lista de palavras que indicam que é nome de rádio, não cidade
    const radioIndicators = [
        'rádio', 'radio', 'fm', 'am', 'mhz', 'khz',
        'emissora', 'transmissora', 'antena', 'torre'
    ];
    
    // Verificar se contém indicadores de rádio
    for (const indicator of radioIndicators) {
        if (lowerCityName.includes(indicator)) {
            return false;
        }
    }
    
    // Verificar se é apenas números (frequência)
    if (/^\d+[\.,]?\d*$/.test(cityName.trim())) {
        return false;
    }
    
    // Se chegou até aqui, provavelmente é uma cidade
    return true;
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
    return R * c; // Distância em km
}

// =========================================================================
// 🚀 INICIALIZAÇÃO E-MÍDIAS
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadRadioData();
        
        // Detectar modo (individual vs proposta)
        isPropostaMode = radioData.type === 'proposta';
        
        if (isPropostaMode) {
            await initializePropostaMode();
        } else {
            await initializeIndividualMode();
        }
        
        hideLoading();
    } catch (error) {
        console.error('Erro completo:', error);
        showError(error.message, error.stack);
    }
});

// =========================================================================
// 📡 CARREGAR DADOS DO NOTION E-MÍDIAS (CORRIGIDO PARA TESTE)
// =========================================================================
async function loadRadioData() {
    const params = new URLSearchParams(window.location.search);
    const notionId = params.get('id');
    const propostaId = params.get('proposta') || params.get('database');
    
    if (propostaId && /^[0-9a-f]{32}$/i.test(propostaId)) {
        try {
            radioData = await fetchPropostaFromNotion(propostaId);
        } catch (error) {
            throw new Error(`Erro ao carregar proposta: ${error.message}`);
        }
    } else if (notionId && /^[0-9a-f]{32}$/i.test(notionId)) {
        try {
            radioData = await fetchRadioFromNotion(notionId);
        } catch (error) {
            throw new Error(`Erro ao carregar dados: ${error.message}`);
        }
    } else {
        // 🔧 DADOS DE EXEMPLO CORRIGIDOS PARA DESENVOLVIMENTO/TESTE
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
            imageUrl: 'https://via.placeholder.com/100x75/06055B/white?text=107.3',
            coverageType: 'circle', // Usar cobertura circular para teste
            // 🆕 CIDADES DE EXEMPLO PARA TESTE
            cidades: [
                'Florianópolis - SC',
                'São José - SC', 
                'Palhoça - SC',
                'Biguaçu - SC',
                'Santo Amaro da Imperatriz - SC',
                'Águas Mornas - SC',
                'Antônio Carlos - SC',
                'Governador Celso Ramos - SC',
                'Blumenau - SC',
                'Joinville - SC',
                'Itajaí - SC',
                'Balneário Camboriú - SC',
                'Chapecó - SC',
                'Criciúma - SC',
                'Lages - SC',
                'Tubarão - SC',
                'Caçador - SC',
                'Concórdia - SC',
                'Videira - SC',
                'Joaçaba - SC'
            ],
            // 🆕 PLACEMARKS DE EXEMPLO (COORDENADAS REAIS DE SC)
            kmlPlacemarks: [
                {
                    name: 'São José',
                    coordinates: [-27.1173, -48.6167],
                    description: '15.2 km'
                },
                {
                    name: 'Palhoça',
                    coordinates: [-27.6386, -48.6703],
                    description: '22.8 km'
                },
                {
                    name: 'Biguaçu',
                    coordinates: [-27.4939, -48.6581],
                    description: '18.5 km'
                },
                {
                    name: 'Santo Amaro da Imperatriz',
                    coordinates: [-27.6889, -48.7806],
                    description: '35.4 km'
                },
                {
                    name: 'Blumenau',
                    coordinates: [-26.9194, -49.0661],
                    description: '85.2 km'
                },
                {
                    name: 'Joinville',
                    coordinates: [-26.3044, -48.8456],
                    description: '120.8 km'
                },
                {
                    name: 'Itajaí',
                    coordinates: [-26.9078, -48.6614],
                    description: '95.6 km'
                },
                {
                    name: 'Balneário Camboriú',
                    coordinates: [-26.9906, -48.6336],
                    description: '78.3 km'
                },
                {
                    name: 'Chapecó',
                    coordinates: [-27.1009, -52.6156],
                    description: '285.7 km'
                },
                {
                    name: 'Criciúma',
                    coordinates: [-28.6778, -49.3694],
                    description: '195.4 km'
                }
            ],
            source: 'example',
            type: 'individual'
        };
        
        console.log('🧪 Dados de exemplo carregados para teste:', {
            cidades: radioData.cidades.length,
            placemarks: radioData.kmlPlacemarks.length,
            coordinates: [radioData.latitude, radioData.longitude]
        });
    }
}

// BUSCAR DADOS INDIVIDUAIS DO NOTION VIA NETLIFY FUNCTION
async function fetchRadioFromNotion(notionId) {
    const response = await fetch(`/.netlify/functions/radio-data?id=${notionId}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data;
}

// NOVA: BUSCAR DADOS DE PROPOSTA DO NOTION VIA NETLIFY FUNCTION
async function fetchPropostaFromNotion(databaseId) {
    console.log('🔍 Buscando proposta:', databaseId);
    
    const response = await fetch(`/.netlify/functions/radio-data?proposta=${databaseId}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📡 Dados recebidos da API:', data);
    
    // Verificar estrutura dos dados
    if (data.type !== 'proposta') {
        console.warn('⚠️ Tipo de dados inesperado:', data.type);
    }
    
    if (!data.radios || data.radios.length === 0) {
        console.warn('⚠️ Nenhuma rádio encontrada nos dados');
    } else {
        console.log('📻 Rádios encontradas:', data.radios.length);
        data.radios.forEach((radio, i) => {
            console.log(`📻 Rádio ${i + 1}:`, {
                name: radio.name,
                dial: radio.dial,
                coords: [radio.latitude, radio.longitude],
                notionId: radio.notionId
            });
        });
    }
    
    return data;
}

// =========================================================================
// 🎯 MODO INDIVIDUAL (ATUALIZADO PARA NOVA ESTRUTURA)
// =========================================================================
async function initializeIndividualMode() {
    console.log('🔍 Modo Individual ativado');
    
    // Ajustar layout para modo individual
    const mapLayout = document.querySelector('.map-layout');
    if (mapLayout) {
        mapLayout.classList.add('individual-mode');
    }
    
    await initializeMapIndividual();
    renderCidadesIndividual();
}

// =========================================================================
// 🗺️ INICIALIZAR MAPA INDIVIDUAL (CORRIGIDO - SEM TRAVAMENTO)
// =========================================================================
async function initializeMapIndividual() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (typeof L === 'undefined') {
                    throw new Error('Leaflet não foi carregado corretamente');
                }

                const mapElement = document.getElementById('map');
                if (!mapElement) {
                    throw new Error('Elemento do mapa não encontrado');
                }

                // Mostrar o container do mapa antes de criar o mapa (evita cálculo de tamanho errado)
                const mapSection = document.getElementById('map-section');
                if (mapSection) mapSection.style.display = 'block';

                console.log('🗺️ Criando mapa individual...');
                map = L.map('map').setView([radioData.latitude, radioData.longitude], 8);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18
                }).addTo(map);

                // Pequeno delay para o DOM atualizar, depois invalida e adiciona camadas
                setTimeout(() => {
                    map.invalidateSize();

                    addRadioMarkerIndividual();
                    addCoverageIndividual();

                    // Depois de adicionar, ajustar bounds
                    setTimeout(() => {
                        fitMapToCoverageIndividual();
                        resolve();
                    }, 300);

                }, 120);

            } catch (error) {
                console.error('❌ Erro detalhado do mapa individual:', error);
                reject(error);
            }
        }, 50);
    });
}


// =========================================================================
// 📍 ADICIONAR MARCADOR DE RÁDIO INDIVIDUAL (GARANTIR QUE FUNCIONA)
// =========================================================================
function addRadioMarkerIndividual() {
    try {
        console.log('📍 Adicionando marcador da rádio...');

        const r = radioData;

        const radioIcon = L.divIcon({
            html: `
                <img src="${r.imageUrl}" 
                        alt="${r.name}" 
                        class="radio-marker-image"
                        onerror="this.src='https://via.placeholder.com/56x56/06055B/white?text=${encodeURIComponent(r.dial || 'FM')}'">
            `,
            className: 'radio-marker',
            iconSize: [56, 56],
            iconAnchor: [28, 28]
        });

        const pmmFormatted = r.pmm ? r.pmm.toLocaleString() : 'N/A';
        const universoFormatted = r.universo ? r.universo.toLocaleString() : 'N/A';
        const cidadesCount = r.cidades ? r.cidades.length : 0;
        const coverageKm = r.radius ? (r.radius / 1000).toFixed(0) : 'N/A';

        const popupContent = `
            <div class="radio-popup" style="min-width:200px; font-family:var(--font-primary);">
                <div style="display:flex; gap:10px; align-items:center;">
                    <img src="${r.imageUrl}" alt="${r.name}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;"
                        onerror="this.src='https://via.placeholder.com/90x68/06055B/white?text=${encodeURIComponent(r.dial || 'FM')}'">
                    <div>
                        <h3 style="margin:0; font-size:15px; color:#06055B;">${r.name}</h3>
                        <div style="font-size:13px; color:#334155;"><strong>${r.dial}</strong> — ${r.praca} - ${r.uf}</div>
                    </div>
                </div>

                <hr style="margin:8px 0; border:none; border-top:1px solid rgba(0,0,0,0.06)">

                <div style="font-size:13px; color:#475569;">
                    <div><strong>🌐 Alcance e Cobertura</strong></div>
                    <div style="margin-top:6px;"><strong>PMM:</strong> ${pmmFormatted}</div>
                    <div><strong>Universo:</strong> ${universoFormatted}</div>
                    <div><strong>Cidades:</strong> ${cidadesCount}</div>
                    <div><strong>Raio:</strong> ${coverageKm} km</div>
                </div>
            </div>
        `;

        const radioMarker = L.marker([r.latitude, r.longitude], { icon: radioIcon })
            .addTo(map)
            .bindPopup(popupContent);

        radioMarkers.push(radioMarker);
        console.log('✅ Marcador da rádio adicionado');

        // 🔧 CORREÇÃO: Centralização melhorada
        radioMarker.on('click', () => {
            centerMapOnRadio(r.latitude, r.longitude, radioMarker);
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar marcador da rádio:', error);
    }
}


// =========================================================================
// ⭕ ADICIONAR COBERTURA INDIVIDUAL (GARANTIR QUE FUNCIONA)
// =========================================================================
function addCoverageIndividual() {
    try {
        console.log('⭕ Adicionando cobertura...');
        
        if (radioData.coverageType === 'kml' && radioData.kmlCoordinates && radioData.kmlCoordinates.length > 0) {
            addKMLPolygonsIndividual();
        } else {
            addCoverageCircleIndividual();
        }
        
        if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
            addCityMarkersIndividual();
        }
        
        console.log('✅ Cobertura adicionada');
        
    } catch (error) {
        console.error('❌ Erro ao adicionar cobertura:', error);
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

// =========================================================================
// ⭕ ADICIONAR CÍRCULO DE COBERTURA (SIMPLIFICADO)
// =========================================================================
function addCoverageCircleIndividual() {
    try {
        const coverageLayer = L.circle([radioData.latitude, radioData.longitude], {
            color: '#06055B',
            fillColor: '#06055B',
            fillOpacity: 0.1,
            radius: radioData.radius || 50000,
            weight: 2
        });
        
        coverageLayer.bindPopup(`
            <div style="text-align: center; font-family: var(--font-primary);">
                <h4 style="color: #06055B; margin: 0 0 8px 0;">Projeção de Cobertura</h4>
                <p style="margin: 0; color: #64748B;">Raio: <strong>${((radioData.radius || 50000) / 1000).toFixed(0)} km</strong></p>
            </div>
        `);
        
        coverageLayer.addTo(map);
        coverageLayers.push(coverageLayer);
        
        console.log('⭕ Círculo de cobertura adicionado');
        
    } catch (error) {
        console.error('❌ Erro ao adicionar círculo de cobertura:', error);
    }
}

function addCityMarkersIndividual() {
    cityMarkers.forEach(marker => map.removeLayer(marker));
    cityMarkers = [];
    
    window.cityPlacemarkMap = {};
    
    const cityIcon = L.divIcon({
        html: `
            <div style="
                width: 18px; 
                height: 18px; 
                background: #06055B; 
                border-radius: 50%; 
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(6, 5, 91, 0.3);
            "></div>
        `,
        className: 'city-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });
    
    const radioLocation = radioData.praca ? radioData.praca.toLowerCase() : '';
    const radioName = radioData.name ? radioData.name.toLowerCase() : '';
    
    radioData.kmlPlacemarks.forEach((placemark, index) => {
        const cityName = placemark.name.toLowerCase();
        
        if (
            cityName.includes(radioLocation) || 
            placemark.description?.includes('0.0 km') ||
            placemark.description?.includes('0,0 km') ||
            cityName === radioLocation ||
            cityName.includes('origem') ||
            cityName.includes(radioName.replace('rádio', '').replace('fm', '').trim()) ||
            radioName.includes(cityName) ||
            (placemark.description && placemark.description.match(/0\.[0-9]\s*km/))
        ) {
            return;
        }
        
        const [lat, lng] = placemark.coordinates;
        
        const distanceFromRadio = calculateDistance(
            radioData.latitude, radioData.longitude,
            lat, lng
        );
        
        if (distanceFromRadio < 0.5) {
            return;
        }
        
        const cityMarker = L.marker([lat, lng], { icon: cityIcon })
            .bindPopup(`
                <div style="text-align: center; min-width: 160px; font-family: var(--font-primary);">
                    <h4 style="margin: 0 0 8px 0; color: #06055B; font-weight: 600;">${placemark.name}</h4>
                    ${placemark.description ? `<p style="margin: 4px 0; font-size: 12px; color: #64748B;">${placemark.description}</p>` : ''}
                    <p style="margin: 4px 0; font-size: 11px; color: #9CA3AF;">
                        📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                </div>
            `)
            .addTo(map);
            
        const markerIndex = cityMarkers.length;
        cityMarkers.push(cityMarker);
        window.cityPlacemarkMap[placemark.name.toLowerCase()] = {
            markerIndex: markerIndex,
            coordinates: [lat, lng],
            placemark: placemark
        };
    });
}

// =========================================================================
// 🗺️ AJUSTAR ZOOM INDIVIDUAL (SIMPLIFICADO)
// =========================================================================
function fitMapToCoverageIndividual() {
    try {
        let bounds = L.latLngBounds();
        let boundsCreated = false;
        
        console.log('🗺️ Ajustando zoom individual...');
        
        // 1. Adicionar coordenadas da rádio
        if (radioData.latitude && radioData.longitude) {
            bounds.extend([radioData.latitude, radioData.longitude]);
            boundsCreated = true;
        }
        
        // 2. Adicionar coordenadas das cidades (placemarks)
        if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
            radioData.kmlPlacemarks.forEach(placemark => {
                if (placemark.coordinates && placemark.coordinates.length >= 2) {
                    const [lat, lng] = placemark.coordinates;
                    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                        bounds.extend([lat, lng]);
                        boundsCreated = true;
                    }
                }
            });
            console.log(`🏙️ ${radioData.kmlPlacemarks.length} cidades adicionadas ao bounds`);
        }
        
        // 3. Se não tem placemarks, usar cobertura circular
        if (!boundsCreated || radioData.kmlPlacemarks.length === 0) {
            const radiusInDegrees = (radioData.radius || 50000) / 111320;
            bounds.extend([
                radioData.latitude - radiusInDegrees,
                radioData.longitude - radiusInDegrees
            ]);
            bounds.extend([
                radioData.latitude + radiusInDegrees,
                radioData.longitude + radiusInDegrees
            ]);
            boundsCreated = true;
            console.log('⭕ Usando cobertura circular para bounds');
        }
        
        // 4. Aplicar bounds se válido
        if (boundsCreated && bounds.isValid()) {
            map.fitBounds(bounds, { 
                padding: [30, 30],
                maxZoom: 10
            });
            console.log('✅ Zoom ajustado com sucesso');
        } else {
            // Fallback
            map.setView([radioData.latitude, radioData.longitude], 8);
            console.log('⚠️ Usando zoom padrão');
        }
        
    } catch (error) {
        console.error('❌ Erro ao ajustar zoom:', error);
        map.setView([radioData.latitude, radioData.longitude], 8);
    }
}

// =========================================================================
// 🏙️ RENDERIZAR CIDADES INDIVIDUAL (CORRIGIDO)
// =========================================================================
function renderCidadesIndividual() {
    console.log('🏙️ Renderizando cidades individuais...');
    
    // Garantir que temos cidades para mostrar
    if (!radioData.cidades || radioData.cidades.length === 0) {
        console.warn('⚠️ Nenhuma cidade encontrada nos dados');
        allCities = [];
    } else {
        // Filtrar cidades válidas (remover nomes de rádios) e LIMPAR distâncias duplicadas
        allCities = radioData.cidades
            .filter(cidade => {
                const cityName = cidade.toLowerCase();
                const radioName = (radioData.name || '').toLowerCase();
                const radioLocation = (radioData.praca || '').toLowerCase();
                
                // Não incluir se for o nome da rádio ou localização da rádio
                return !cityName.includes(radioName.replace('rádio', '').replace('fm', '').trim()) &&
                       !cityName.includes(radioLocation);
            })
            .map(cidade => {
                // 🔧 LIMPAR DISTÂNCIAS DUPLICADAS
                return cleanDuplicateDistance(cidade);
            });
        
        console.log('🏙️ Cidades válidas encontradas:', allCities.length);
    }
    
    filteredCities = [...allCities];
    
    updateCidadesList();
    setupCitySearch();
    
    // Atualizar contador
    const cidadeCountElement = document.getElementById('cidade-count');
    if (cidadeCountElement) {
        cidadeCountElement.textContent = allCities.length;
    }
    
    // Mostrar seção
    const cidadesSectionElement = document.getElementById('cidades-section');
    if (cidadesSectionElement) {
        cidadesSectionElement.style.display = 'block';
    }
    
    console.log('✅ Seção de cidades renderizada:', allCities.length, 'cidades');
}

// =========================================================================
// 🧹 NOVA FUNÇÃO: LIMPAR DISTÂNCIAS DUPLICADAS
// =========================================================================
function cleanDuplicateDistance(cityName) {
    // Regex para encontrar padrões como: "Cidade (15.2 km) (15.2 km)"
    const duplicateDistanceRegex = /^(.*?)\s*\(([0-9]+[.,]?[0-9]*)\s*km\)\s*\(([0-9]+[.,]?[0-9]*)\s*km\)(.*)$/i;
    
    const match = cityName.match(duplicateDistanceRegex);
    
    if (match) {
        const cityBaseName = match[1].trim();
        const distance1 = match[2];
        const distance2 = match[3];
        const suffix = match[4].trim();
        
        // Se as distâncias são iguais, manter apenas uma
        if (distance1 === distance2) {
            const cleanName = `${cityBaseName} (${distance1} km)${suffix ? ' ' + suffix : ''}`;
            console.log('🧹 Distância duplicada removida:', cityName, '→', cleanName);
            return cleanName;
        }
    }
    
    // Se não encontrou duplicação, retornar original
    return cityName;
}

// =========================================================================
// 🏢 MODO PROPOSTA - COM DEBUG (ATUALIZADO)
// =========================================================================
async function initializePropostaMode() {
    console.log('🏢 Modo Proposta ativado');
    
    // Validar dados básicos
    if (!radioData.radios || radioData.radios.length === 0) {
        throw new Error('Nenhuma rádio encontrada na proposta');
    }
    
    console.log('📊 Rádios encontradas:', radioData.radios.length);
    
    // Garantir que todos os rádios tenham propriedades necessárias
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
        impactos: radio.impactos || radio.pmm || 0,
        imageUrl: radio.imageUrl || `https://via.placeholder.com/56x56/06055B/white?text=${encodeURIComponent(radio.dial || 'FM')}`,
        coverageType: radio.coverageType || 'circle',
        kmlCoordinates: radio.kmlCoordinates || [],
        kmlPlacemarks: radio.kmlPlacemarks || [],
        kmlBounds: radio.kmlBounds || null,
        cidades: radio.cidades || [],
        notionId: radio.notionId || `radio-${index}`,
        ...radio
    }));
    
    // Inicializar array de rádios ativas (todas ativas por padrão)
    activeRadios = radioData.radios.map((radio, index) => ({
        active: true,
        index: index
    }));
    
    console.log('📊 Rádios validadas:', radioData.radios.length);
    console.log('📊 activeRadios inicializado:', activeRadios.length);
    
    // Inicializar mapa
      await initializeMapProposta();
    renderRadiosList();
    renderCidadesProposta();
    
    // 🆕 INICIALIZAR TOOLTIPS
    setTimeout(() => {
        setupTooltipPositioning();
    }, 500);

    // 🔧 DEBUG: Verificar elementos antes de renderizar
    setTimeout(() => {
        debugRadiosList();
        renderRadiosList();
        renderCidadesProposta();
    }, 500);
}

// =========================================================================
// 📻 RENDERIZAR LISTA LATERAL DE RÁDIOS (COM DEBUG)
// =========================================================================
function renderRadiosList() {
    console.log('📻 Iniciando renderRadiosList()');
    console.log('- isPropostaMode:', isPropostaMode);
    
    if (!isPropostaMode) {
        console.log('❌ Não é modo proposta, saindo...');
        return;
    }
    
    const radiosList = document.getElementById('radios-list');
    const radiosSidebar = document.getElementById('radios-sidebar');
    const radiosCount = document.getElementById('radios-count');
    
    console.log('📻 Elementos encontrados:');
    console.log('- radiosList:', radiosList ? 'SIM' : 'NÃO');
    console.log('- radiosSidebar:', radiosSidebar ? 'SIM' : 'NÃO');
    console.log('- radiosCount:', radiosCount ? 'SIM' : 'NÃO');
    
    if (!radiosList || !radiosSidebar) {
        console.error('❌ Elementos da lista lateral não encontrados');
        console.log('🔍 Tentando criar elementos...');
        
        // Tentar criar os elementos se não existirem
        createRadiosListElements();
        return;
    }
    
    console.log('📻 Mostrando sidebar...');
    // Mostrar sidebar
    radiosSidebar.style.display = 'flex';
    radiosSidebar.style.visibility = 'visible';
    
    // Atualizar contador
    const activeCount = activeRadios.filter(r => r.active).length;
    if (radiosCount) {
        radiosCount.textContent = `${activeCount}/${radioData.radios.length}`;
    }
    
    console.log('📻 Gerando HTML para', radioData.radios.length, 'rádios...');
    
    // Gerar HTML da lista
    const radiosHTML = radioData.radios.map((radio, index) => {
        const isActive = activeRadios[index].active;
        const pmmFormatted = radio.pmm ? radio.pmm.toLocaleString() : '0';
        const universoFormatted = radio.universo ? radio.universo.toLocaleString() : '0';
        const cidadesCount = radio.cidades ? radio.cidades.length : 0;
        
        return `
            <div class="radio-list-item ${!isActive ? 'disabled' : ''}" id="radio-item-${index}">
                <input type="checkbox" 
                       class="radio-checkbox" 
                       id="checkbox-${index}"
                       ${isActive ? 'checked' : ''}
                       onchange="toggleRadioVisibility(${index})"
                       onclick="event.stopPropagation()">
                
                <img src="${radio.imageUrl}" 
                     alt="${radio.name}" 
                     class="radio-logo-list"
                     onerror="this.src='https://via.placeholder.com/48x36/06055B/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
                
                <div class="radio-info-list" onclick="focusOnRadio(${index})">
                    <div class="radio-name-list">${radio.name}</div>
                    <div class="radio-details-list">
                        <span><strong>${radio.dial}</strong></span>
                        <span>•</span>
                        <span>${radio.praca} - ${radio.uf}</span>
                    </div>
                    <div class="radio-stats-list">
                        PMM: ${pmmFormatted} • Cidades: ${cidadesCount}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    radiosList.innerHTML = radiosHTML;
    
    console.log('✅ Lista lateral de rádios renderizada:', radioData.radios.length, 'rádios');
    console.log('📻 HTML gerado:', radiosHTML.length, 'caracteres');
}

// =========================================================================
// 🔧 FUNÇÃO PARA CRIAR ELEMENTOS SE NÃO EXISTIREM
// =========================================================================
function createRadiosListElements() {
    console.log('🔧 Criando elementos da lista de rádios...');
    
    const mapSection = document.getElementById('map-section');
    if (!mapSection) {
        console.error('❌ map-section não encontrado');
        return;
    }
    
    // Verificar se já existe map-layout
    let mapLayout = mapSection.querySelector('.map-layout');
    if (!mapLayout) {
        console.log('🔧 Criando map-layout...');
        
        // Pegar o mapa existente
        const existingMap = document.getElementById('map');
        if (!existingMap) {
            console.error('❌ Mapa não encontrado');
            return;
        }
        
        // Criar nova estrutura
        mapLayout = document.createElement('div');
        mapLayout.className = 'map-layout';
        
        // Criar map-content
        const mapContent = document.createElement('div');
        mapContent.className = 'map-content';
        mapContent.id = 'map-content';
        
        // Mover o mapa para dentro do map-content
        mapContent.appendChild(existingMap);
        
        // Criar botão de mostrar rádios
        const showBtn = document.createElement('button');
        showBtn.className = 'show-radios-btn';
        showBtn.id = 'show-radios-btn';
        showBtn.onclick = showRadiosList;
        showBtn.style.display = 'none';
        showBtn.textContent = '📻 Mostrar Rádios';
        mapContent.appendChild(showBtn);
        
        // Criar sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'radios-sidebar';
        sidebar.id = 'radios-sidebar';
        sidebar.innerHTML = `
            <div class="radios-sidebar-header">
                <h3 class="radios-sidebar-title">
                    📻 Rádios da Proposta
                    <span class="radios-count" id="radios-count">0/0</span>
                </h3>
                <button class="expand-map-btn" onclick="toggleMapExpansion()">
                    🔍 Expandir Mapa
                </button>
            </div>
            
            <div class="radios-list-container">
                <div class="radios-actions">
                    <button class="radios-action-btn" onclick="selectAllRadios()">✅ Selecionar Todas</button>
                    <button class="radios-action-btn" onclick="deselectAllRadios()">❌ Desmarcar Todas</button>
                </div>
                
                <div class="radios-list" id="radios-list">
                    <!-- Lista será preenchida dinamicamente -->
                </div>
            </div>
        `;
        
        // Montar estrutura
        mapLayout.appendChild(mapContent);
        mapLayout.appendChild(sidebar);
        
        // Limpar mapSection e adicionar nova estrutura
        mapSection.innerHTML = '';
        mapSection.appendChild(mapLayout);
        
        console.log('✅ Elementos criados com sucesso');
        
        // Tentar renderizar novamente
        setTimeout(() => {
            renderRadiosList();
        }, 100);
    }
}

// =========================================================================
// 🔘 FUNÇÃO: TOGGLE VISIBILIDADE DE RÁDIO
// =========================================================================
function toggleRadioVisibility(radioIndex) {
    if (!radioData.radios || radioIndex >= radioData.radios.length) {
        return;
    }
    
    const checkbox = document.getElementById(`checkbox-${radioIndex}`);
    const radioItem = document.getElementById(`radio-item-${radioIndex}`);
    
    if (!checkbox || !radioItem) {
        return;
    }
    
    const isActive = checkbox.checked;
    
    // Atualizar array de rádios ativas
    activeRadios[radioIndex].active = isActive;
    
    // Atualizar visual do item
    if (isActive) {
        radioItem.classList.remove('disabled');
    } else {
        radioItem.classList.add('disabled');
    }
    
    // 🔧 ATUALIZAR APENAS O MAPA, NÃO RECRIAR A LISTA DE CIDADES
    updateMapLayersOnly();
    
    // Atualizar contador
    updateRadioCount();
    
    // 🆕 ATUALIZAR APENAS A VISIBILIDADE DAS CIDADES NA LISTA EXISTENTE
    updateCityListVisibility();
    
    console.log(`📻 Rádio ${radioIndex} (${radioData.radios[radioIndex].name}): ${isActive ? 'Ativada' : 'Desativada'}`);
}


// =========================================================================
// 🗺️ INICIALIZAR MAPA PROPOSTA (CORRIGIDO TAMBÉM)
// =========================================================================
async function initializeMapProposta() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (typeof L === 'undefined') {
                    throw new Error('Leaflet não foi carregado corretamente');
                }
                
                const mapElement = document.getElementById('map');
                if (!mapElement) {
                    throw new Error('Elemento do mapa não encontrado');
                }
                
                console.log('��️ Criando mapa proposta...');
                
                // Usar coordenadas da primeira rádio como posição inicial
                const firstRadio = radioData.radios[0];
                map = L.map('map').setView([firstRadio.latitude, firstRadio.longitude], 6);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18
                }).addTo(map);
                
                setTimeout(() => {
                    map.invalidateSize();
                    
                    addMultipleRadios();
                    
                    setTimeout(() => {
                        fitMapToMultipleCoverage();
                        resolve();
                    }, 200);
                    
                }, 100);

                // Mostrar o container do mapa
                document.getElementById("map-section").style.display = "block";

                // Forçar o Leaflet a recalcular o tamanho
                setTimeout(() => {
                    map.invalidateSize();
                }, 300);
                
            } catch (error) {
                console.error('❌ Erro detalhado do mapa proposta:', error);
                reject(error);
            }
        }, 50);
    });
}

function addMultipleRadios() {
    if (!radioData.radios || radioData.radios.length === 0) {
        console.warn('Nenhuma rádio encontrada na proposta');
        return;
    }
    
    // Agrupar rádios por proximidade geográfica para evitar sobreposição
    const radioGroups = groupRadiosByProximity(radioData.radios);
    
    // Ordenar rádios por cobertura (maior primeiro) para rendering em camadas corretas
    const sortedRadios = [...radioData.radios].sort((a, b) => {
        const radiusA = a.radius || 50000;
        const radiusB = b.radius || 50000;
        return radiusB - radiusA; // Maior primeiro (vai para baixo no mapa)
    });
    
    // Adicionar coberturas primeiro (maior embaixo)
    sortedRadios.forEach((radio, sortIndex) => {
        const originalIndex = radioData.radios.findIndex(r => r.notionId === radio.notionId);
        const colorIndex = originalIndex % RADIO_COLORS.length;
        const color = RADIO_COLORS[colorIndex];
        
        addCoverageProposta(radio, originalIndex, color);
    });
    
    // Adicionar marcadores com reposicionamento para evitar sobreposição
    radioData.radios.forEach((radio, index) => {
        const colorIndex = index % RADIO_COLORS.length;
        const color = RADIO_COLORS[colorIndex];
        
        // Calcular offset para evitar sobreposição
        const adjustedPosition = calculateRadioOffset(radio, index, radioData.radios);
        
        addRadioMarkerProposta(radio, index, color, adjustedPosition);
        
        // Adicionar marcadores de cidades (se houver KML)
        if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0) {
            addCityMarkersProposta(radio, index, color);
        }
    });
}

// =========================================================================
// 📍 FUNÇÃO PARA CALCULAR OFFSET DE RÁDIOS (EVITAR SOBREPOSIÇÃO)
// =========================================================================
function calculateRadioOffset(currentRadio, currentIndex, allRadios) {
    const proximityThreshold = 0.005; // ~500 metros
    const offsetDistance = 0.003; // ~300 metros
    
    let adjustedLat = currentRadio.latitude;
    let adjustedLng = currentRadio.longitude;
    
    // Verificar se há outras rádios muito próximas
    const nearbyRadios = allRadios.filter((radio, index) => {
        if (index >= currentIndex) return false; // Só verificar rádios já processadas
        
        const distance = Math.sqrt(
            Math.pow(radio.latitude - currentRadio.latitude, 2) + 
            Math.pow(radio.longitude - currentRadio.longitude, 2)
        );
        
        return distance < proximityThreshold;
    });
    
    if (nearbyRadios.length > 0) {
        // Calcular offset baseado no índice para criar padrão circular
        const angle = (currentIndex % 8) * (Math.PI / 4); // 8 posições ao redor
        const radius = offsetDistance * (Math.floor(currentIndex / 8) + 1);
        
        adjustedLat += Math.sin(angle) * radius;
        adjustedLng += Math.cos(angle) * radius;
        
        console.log(`📍 Rádio ${currentIndex} reposicionada para evitar sobreposição:`, {
            original: [currentRadio.latitude, currentRadio.longitude],
            adjusted: [adjustedLat, adjustedLng],
            nearbyCount: nearbyRadios.length
        });
    }
    
    return [adjustedLat, adjustedLng];
}

function groupRadiosByProximity(radios) {
    const groups = {};
    const proximityThreshold = 0.01; // ~1km
    
    radios.forEach((radio, index) => {
        const key = `${Math.round(radio.latitude / proximityThreshold)}_${Math.round(radio.longitude / proximityThreshold)}`;
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push({ radio, index });
    });
    
    return groups;
}

function addRadioMarkerProposta(radio) {
    try {
        const radioIcon = L.divIcon({
            html: `
                <img src="${radio.imageUrl}" 
                        alt="${radio.name}" 
                        class="radio-marker-image"
                        onerror="this.src='https://via.placeholder.com/56x56/06055B/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
            `,
            className: 'radio-marker',
            iconSize: [56, 56],
            iconAnchor: [28, 28]
        });

        const pmmFormatted = radio.pmm ? radio.pmm.toLocaleString() : 'N/A';
        const universoFormatted = radio.universo ? radio.universo.toLocaleString() : 'N/A';
        const cidadesCount = radio.cidades ? radio.cidades.length : 0;
        const coverageKm = radio.radius ? (radio.radius / 1000).toFixed(0) : 'N/A';

        const popupContent = `
            <div class="radio-popup" style="min-width:200px; font-family:var(--font-primary);">
                <div style="display:flex; gap:10px; align-items:center;">
                    <img src="${radio.imageUrl}" alt="${radio.name}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;"
                        onerror="this.src='https://via.placeholder.com/90x68/06055B/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
                    <div>
                        <h3 style="margin:0; font-size:15px; color:#06055B;">${radio.name}</h3>
                        <div style="font-size:13px; color:#334155;"><strong>${radio.dial}</strong> — ${radio.praca} - ${radio.uf}</div>
                    </div>
                </div>

                <hr style="margin:8px 0; border:none; border-top:1px solid rgba(0,0,0,0.06)">

                <div style="font-size:13px; color:#475569;">
                    <div><strong>🌐 Alcance e Cobertura</strong></div>
                    <div style="margin-top:6px;"><strong>PMM:</strong> ${pmmFormatted}</div>
                    <div><strong>Universo:</strong> ${universoFormatted}</div>
                    <div><strong>Cidades:</strong> ${cidadesCount}</div>
                    <div><strong>Raio:</strong> ${coverageKm} km</div>
                </div>
            </div>
        `;

        const radioMarker = L.marker([radio.latitude, radio.longitude], { icon: radioIcon })
            .addTo(map)
            .bindPopup(popupContent);

        radioMarkers.push(radioMarker);

        // 🔧 CORREÇÃO: Centralização melhorada
        radioMarker.on('click', () => {
            centerMapOnRadio(radio.latitude, radio.longitude, radioMarker);
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar marcador da rádio (proposta):', error);
    }
}

function addCoverageProposta(radio, index, color) {
    if (radio.coverageType === 'kml' && radio.kmlCoordinates && radio.kmlCoordinates.length > 0) {
        // Cobertura KML
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
        // Cobertura circular
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

function addCityMarkersProposta(radio, radioIndex, color) {
    const cityIcon = L.divIcon({
        html: `
            <div style="
                width: 16px; 
                height: 16px; 
                background: ${color}; 
                border-radius: 50%; 
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            "></div>
        `,
        className: 'city-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    const radioLocation = radio.praca ? radio.praca.toLowerCase() : '';
    const radioName = radio.name ? radio.name.toLowerCase() : '';
    
    radio.kmlPlacemarks.forEach((placemark, index) => {
        const cityName = placemark.name.toLowerCase();
        
        // Filtros para evitar marcadores duplicados
        if (
            cityName.includes(radioLocation) || 
            placemark.description?.includes('0.0 km') ||
            placemark.description?.includes('0,0 km') ||
            cityName === radioLocation ||
            cityName.includes('origem') ||
            cityName.includes(radioName.replace('rádio', '').replace('fm', '').trim())
        ) {
            return;
        }
        
        const [lat, lng] = placemark.coordinates;
        
        const distanceFromRadio = calculateDistance(
            radio.latitude, radio.longitude,
            lat, lng
        );
        
        if (distanceFromRadio < 0.5) {
            return;
        }
        
        const cityMarker = L.marker([lat, lng], { icon: cityIcon })
            .bindPopup(`
                <div style="text-align: center; min-width: 160px; font-family: var(--font-primary);">
                    <h4 style="margin: 0 0 8px 0; color: ${color}; font-weight: 600;">${placemark.name}</h4>
                    <p style="margin: 4px 0; font-size: 12px; color: #64748B;">Cobertura de: ${radio.name}</p>
                    ${placemark.description ? `<p style="margin: 4px 0; font-size: 12px; color: #64748B;">${placemark.description}</p>` : ''}
                    <p style="margin: 4px 0; font-size: 11px; color: #9CA3AF;">
                        📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                </div>
            `)
            .addTo(map);
            
        cityMarkers.push(cityMarker);
    });
}

function fitMapToMultipleCoverage() {
    try {
        let bounds = L.latLngBounds();
        let boundsCreated = false;
        
        console.log('🗺️ Iniciando ajuste de zoom para proposta com', radioData.radios.length, 'rádios');
        
        // 1. Adicionar coordenadas de todas as rádios
        radioData.radios.forEach((radio, index) => {
            if (radio.latitude && radio.longitude && !isNaN(radio.latitude) && !isNaN(radio.longitude)) {
                bounds.extend([radio.latitude, radio.longitude]);
                boundsCreated = true;
                console.log(`📍 Rádio ${index + 1} adicionada ao bounds:`, [radio.latitude, radio.longitude]);
            }
        });
        
        // 2. Adicionar bounds de KML de cada rádio
        radioData.radios.forEach((radio, index) => {
            if (radio.kmlBounds) {
                bounds.extend([radio.kmlBounds.south, radio.kmlBounds.west]);
                bounds.extend([radio.kmlBounds.north, radio.kmlBounds.east]);
                boundsCreated = true;
                console.log(`🗺️ KML bounds da rádio ${index + 1} adicionados`);
            }
        });
        
        // 3. Adicionar coordenadas de todas as cidades (placemarks)
        radioData.radios.forEach((radio, index) => {
            if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0) {
                radio.kmlPlacemarks.forEach(placemark => {
                    if (placemark.coordinates && placemark.coordinates.length >= 2) {
                        const [lat, lng] = placemark.coordinates;
                        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                            bounds.extend([lat, lng]);
                            boundsCreated = true;
                        }
                    }
                });
                console.log(`🏙️ ${radio.kmlPlacemarks.length} cidades da rádio ${index + 1} adicionadas`);
            }
        });
        
        // 4. Se não tem dados suficientes, usar cobertura circular de cada rádio
        if (!boundsCreated) {
            radioData.radios.forEach(radio => {
                if (radio.latitude && radio.longitude && radio.radius) {
                    const radiusInDegrees = radio.radius / 111320; // Conversão aproximada
                    bounds.extend([
                        radio.latitude - radiusInDegrees,
                        radio.longitude - radiusInDegrees
                    ]);
                    bounds.extend([
                        radio.latitude + radiusInDegrees,
                        radio.longitude + radiusInDegrees
                    ]);
                    boundsCreated = true;
                }
            });
        }
        
        // 5. Aplicar bounds com configurações otimizadas
        if (boundsCreated && bounds.isValid()) {
            // Calcular zoom ideal baseado na área
            const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
            let maxZoom = 10;
            
            if (boundsSize > 500000) maxZoom = 6;      // Área muito grande
            else if (boundsSize > 200000) maxZoom = 7; // Área grande
            else if (boundsSize > 100000) maxZoom = 8; // Área média
            else if (boundsSize > 50000) maxZoom = 9;  // Área pequena
            
            map.fitBounds(bounds, { 
                padding: [40, 40],
                maxZoom: maxZoom
            });
            
            console.log('✅ Zoom da proposta ajustado com sucesso. Área:', boundsSize.toFixed(0), 'm, MaxZoom:', maxZoom);
        } else {
            // Fallback: centralizar na primeira rádio
            const firstRadio = radioData.radios[0];
            map.setView([firstRadio.latitude, firstRadio.longitude], 6);
            console.log('⚠️ Usando fallback: centralizado na primeira rádio');
        }
        
    } catch (error) {
        console.error('❌ Erro ao ajustar zoom da proposta:', error);
        // Fallback seguro
        if (radioData.radios && radioData.radios.length > 0) {
            const firstRadio = radioData.radios[0];
            map.setView([firstRadio.latitude, firstRadio.longitude], 5);
        }
    }
}

// =========================================================================
// 🏢 RENDERIZAR CIDADES NO MODO PROPOSTA (CORRIGIDO - SEM KILOMETRAGEM)
// =========================================================================
function renderCidadesProposta() {
    console.log('🏢 Renderizando cidades no modo proposta...');
    
    // Coletar todas as cidades únicas de todas as rádios ativas
    const allCitiesMap = new Map(); // Usar Map para evitar duplicatas
    
    activeRadios.forEach((radio, index) => {
        if (!radio.active || !radioData.radios[index]) return;
        
        const radioData_single = radioData.radios[index];
        const cities = radioData_single.cidades || [];
        
        cities.forEach(cidade => {
            // Filtrar apenas cidades reais
            if (!isRealCity(cidade)) return;
            
            // 🔧 LIMPAR DISTÂNCIA E EXTRAIR APENAS O NOME DA CIDADE
            const cidadeLimpa = cleanDuplicateDistance(cidade);
            const nomeComUF = cidadeLimpa.replace(/\s*\([^)]*\)\s*/g, '').trim(); // Remove parênteses e conteúdo
            
            // Separar nome da cidade e UF
            const parts = nomeComUF.split(' - ');
            const nomeCidade = parts[0].trim();
            const uf = parts[1] ? parts[1].trim() : radioData_single.uf || '';
            
            const chaveUnica = `${nomeCidade} - ${uf}`;
            
            // Se a cidade já existe, adicionar a rádio à lista
            if (allCitiesMap.has(chaveUnica)) {
                const cidadeExistente = allCitiesMap.get(chaveUnica);
                
                // Verificar se esta rádio já não está na lista
                const radioJaExiste = cidadeExistente.radios.some(r => r.notionId === radioData_single.notionId);
                
                if (!radioJaExiste) {
                    cidadeExistente.radios.push({
                        ...radioData_single,
                        originalIndex: index
                    });
                }
            } else {
                // Criar nova entrada para a cidade
                allCitiesMap.set(chaveUnica, {
                    nome: nomeCidade,
                    uf: uf,
                    nomeCompleto: chaveUnica,
                    radios: [{
                        ...radioData_single,
                        originalIndex: index
                    }]
                });
            }
        });
    });
    
    // Converter Map para Array e ordenar
    allCities = Array.from(allCitiesMap.values()).sort((a, b) => 
        a.nome.localeCompare(b.nome, 'pt-BR')
    );
    
    filteredCities = [...allCities];
    
    console.log('🏢 Cidades únicas processadas:', allCities.length);
    
    updateCidadesListProposta();
    setupCitySearchProposta();
    
    // Atualizar contador
    const cidadeCountElement = document.getElementById('cidade-count');
    if (cidadeCountElement) {
        cidadeCountElement.textContent = allCities.length;
    }
    
    // Mostrar seção
    const cidadesSectionElement = document.getElementById('cidades-section');
    if (cidadesSectionElement) {
        cidadesSectionElement.style.display = 'block';
    }
    
    console.log('✅ Seção de cidades renderizada (modo proposta):', allCities.length, 'cidades');
}

// =========================================================================
// 🔍 BUSCA DE CIDADES NO MODO PROPOSTA (ATUALIZADA)
// =========================================================================
function setupCitySearchProposta() {
    const searchInput = document.getElementById('city-search');
    
    if (!searchInput) {
        console.warn('⚠️ Campo de busca não encontrado');
        return;
    }
    
    // Remover listeners anteriores
    searchInput.removeEventListener('input', handleCitySearchProposta);
    
    // Adicionar novo listener
    searchInput.addEventListener('input', handleCitySearchProposta);
    
    console.log('�� Busca de cidades configurada (modo proposta)');
}

// =========================================================================
// �� BUSCA DE CIDADES NO MODO PROPOSTA (CORRIGIDA)
// =========================================================================
function handleCitySearchProposta(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // Mostrar todas as cidades que têm pelo menos uma rádio ativa
        filteredCities = allCities.filter(cidade => {
            return cidade.radios.some(radio => activeRadios[radio.originalIndex].active);
        });
    } else {
        // Buscar nas cidades que têm pelo menos uma rádio ativa
        const cidadesVisiveis = allCities.filter(cidade => {
            return cidade.radios.some(radio => activeRadios[radio.originalIndex].active);
        });
        
        filteredCities = cidadesVisiveis.filter(cidade => {
            const nomeMatch = cidade.nome.toLowerCase().includes(searchTerm);
            const ufMatch = cidade.uf.toLowerCase().includes(searchTerm);
            const radioMatch = cidade.radios.some(radio => 
                radio.name.toLowerCase().includes(searchTerm) ||
                radio.dial.toLowerCase().includes(searchTerm) ||
                radio.praca.toLowerCase().includes(searchTerm)
            );
            
            return nomeMatch || ufMatch || radioMatch;
        });
    }
    
    updateCidadesListPropostaVisibility(); // 🔧 USAR FUNÇÃO CORRIGIDA
    
    // Atualizar contador
    const cidadeCountElement = document.getElementById('cidade-count');
    if (cidadeCountElement) {
        cidadeCountElement.textContent = filteredCities.length;
    }
}

// =========================================================================
// �� DESTACAR CIDADE NO MODO PROPOSTA (CORRIGIDA)
// =========================================================================
function highlightCityProposta(cidadeNomeCompleto) {
    console.log('�� Destacando cidade no mapa (proposta):', cidadeNomeCompleto);
    
    // Encontrar a cidade nos dados
    const cidade = allCities.find(c => c.nomeCompleto === cidadeNomeCompleto);
    
    if (!cidade) {
        console.warn('⚠️ Cidade não encontrada:', cidadeNomeCompleto);
        return;
    }
    
    // Buscar coordenadas da cidade nos dados das rádios ATIVAS
    let cityCoordinates = null;
    let radioEncontrada = null;
    
    for (const radio of cidade.radios) {
        // 🔧 VERIFICAR SE A RÁDIO ESTÁ ATIVA
        if (!activeRadios[radio.originalIndex] || !activeRadios[radio.originalIndex].active) {
            continue;
        }
        
        if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0) {
            const placemark = radio.kmlPlacemarks.find(p => {
                const placemarkName = p.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const cityBaseName = cidade.nome.toLowerCase();
                const placemarkBaseName = placemarkName.toLowerCase();
                
                return placemarkBaseName.includes(cityBaseName) || 
                       cityBaseName.includes(placemarkBaseName) ||
                       placemarkName.toLowerCase() === cidadeNomeCompleto.toLowerCase();
            });
            
            if (placemark && placemark.coordinates) {
                cityCoordinates = placemark.coordinates;
                radioEncontrada = radio;
                break;
            }
        }
    }
    
    if (cityCoordinates) {
        const [lat, lng] = cityCoordinates;
        
        console.log('✅ Coordenadas encontradas:', lat, lng);
        
        // Centralizar mapa na cidade com animação suave
        map.flyTo([lat, lng], 12, {
            animate: true,
            duration: 1.5
        });
        
        // Criar popup temporário melhorado
        setTimeout(() => {
            const radiosAtivasCount = cidade.radios.filter(r => 
                activeRadios[r.originalIndex] && activeRadios[r.originalIndex].active
            ).length;
            
            const popup = L.popup()
                .setLatLng([lat, lng])
                .setContent(`
                    <div style="text-align: center; min-width: 220px; font-family: var(--font-primary);">
                        <h4 style="margin: 0 0 12px 0; color: var(--emidias-primary); font-size: 16px;">
                            📍 ${cidade.nome} - ${cidade.uf}
                        </h4>
                        <p style="margin: 6px 0; font-size: 13px; color: var(--emidias-gray);">
                            Coberta por <strong>${radiosAtivasCount}</strong> rádio${radiosAtivasCount > 1 ? 's' : ''} ativa${radiosAtivasCount > 1 ? 's' : ''}
                        </p>
                        <div style="display: flex; justify-content: center; gap: 6px; margin: 12px 0; flex-wrap: wrap;">
                            ${cidade.radios
                                .filter(r => activeRadios[r.originalIndex] && activeRadios[r.originalIndex].active)
                                .map(radio => {
                                    const colorIndex = radio.originalIndex % RADIO_COLORS.length;
                                    const color = RADIO_COLORS[colorIndex];
                                    return `
                                        <img src="${radio.imageUrl}" 
                                             alt="${radio.name} - ${radio.dial}"
                                             title="${radio.name} - ${radio.dial}"
                                             style="width: 32px; height: 32px; border-radius: 6px; border: 2px solid ${color}; cursor: pointer;"
                                             onclick="centerMapOnRadioList(${radio.originalIndex})"
                                             onerror="this.src='https://via.placeholder.com/32x32/${color.replace('#', '')}/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
                                    `;
                                }).join('')}
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 11px; color: var(--emidias-gray);">
                            💡 Clique nas logos para centralizar nas rádios
                        </p>
                    </div>
                `)
                .openOn(map);
            
            // Remover popup após 5 segundos
            setTimeout(() => {
                map.closePopup(popup);
            }, 5000);
            
        }, 1000);
        
        console.log('✅ Cidade destacada no mapa (proposta)');
    } else {
        console.warn('⚠️ Coordenadas da cidade não encontradas');
        
        // Fallback: centralizar na primeira rádio ativa da cidade
        const primeiraRadioAtiva = cidade.radios.find(r => 
            activeRadios[r.originalIndex] && activeRadios[r.originalIndex].active
        );
        
        if (primeiraRadioAtiva) {
            map.flyTo([primeiraRadioAtiva.latitude, primeiraRadioAtiva.longitude], 10, {
                animate: true,
                duration: 1.5
            });
            console.log('📍 Centralizado na rádio:', primeiraRadioAtiva.name);
        }
    }
}

// =========================================================================
// 🗺️ CONSTRUIR MAPEAMENTO CIDADE -> RÁDIOS (MODO PROPOSTA)
// =========================================================================
function buildCityRadioMapping() {
    cityRadioMapping = {};
    
    if (!radioData.radios) return;
    
    // Para cada rádio, adicionar suas cidades ao mapeamento
    radioData.radios.forEach((radio, originalIndex) => {
        const cities = radio.cidades || [];
        
        cities.forEach(cidade => {
            // Filtrar apenas cidades reais (não nomes de rádios)
            if (!isRealCity(cidade)) return;
            
            const cityName = cidade.split(' - ')[0]; // Remover UF para o nome base
            
            if (!cityRadioMapping[cityName]) {
                cityRadioMapping[cityName] = [];
            }
            
            // Adicionar rádio com índice original para cores
            cityRadioMapping[cityName].push({
                ...radio,
                originalIndex: originalIndex
            });
        });
    });
    
    console.log('🗺️ Mapeamento cidade->rádios construído:', Object.keys(cityRadioMapping).length, 'cidades');
}

// =========================================================================
// 🎯 FUNÇÕES AUXILIARES PARA HOVER DE RÁDIOS (MODO PROPOSTA)
// =========================================================================
function expandRadiosList(element, cidadeNome) {
    const collapsed = element.querySelector('.radios-collapsed');
    const expanded = element.querySelector('.radios-expanded');
    
    if (collapsed && expanded) {
        collapsed.style.display = 'none';
        expanded.style.display = 'flex';
    }
}

function collapseRadiosList(element) {
    const collapsed = element.querySelector('.radios-collapsed');
    const expanded = element.querySelector('.radios-expanded');
    
    if (collapsed && expanded) {
        collapsed.style.display = 'flex';
        expanded.style.display = 'none';
    }
}

// =========================================================================
// 🎯 FUNÇÕES AUXILIARES PARA PROPOSTA
// =========================================================================
function focusOnRadio(radioIndex) {
    if (!radioData.radios || radioIndex >= radioData.radios.length) {
        return;
    }
    
    const radio = radioData.radios[radioIndex];
    
    // Centralizar no mapa
    map.setView([radio.latitude, radio.longitude], 10);
    
    // Abrir popup do marcador
    if (radioMarkers[radioIndex]) {
        radioMarkers[radioIndex].openPopup();
    }
}

// =========================================================================
// 🔘 FUNÇÃO PARA TOGGLE DE RÁDIOS (CHECKBOXES)
// =========================================================================
function toggleRadio(radioIndex) {
    if (!radioData.radios || radioIndex >= radioData.radios.length) {
        return;
    }
    
    const checkbox = document.getElementById(`checkbox-${radioIndex}`);
    const radioItem = document.getElementById(`radio-item-${radioIndex}`);
    
    if (!checkbox || !radioItem) {
        return;
    }
    
    const isActive = checkbox.checked;
    
    // Atualizar array de rádios ativas
    activeRadios[radioIndex].active = isActive;
    
    // Atualizar visual do item
    if (isActive) {
        radioItem.classList.remove('disabled');
    } else {
        radioItem.classList.add('disabled');
    }
    
    // Atualizar mapa
    updateMapLayers();
    
    // Atualizar contador
    updateRadioCount();
    
    console.log(`📻 Rádio ${radioIndex} (${radioData.radios[radioIndex].name}): ${isActive ? 'Ativada' : 'Desativada'}`);
}

// =========================================================================
// 🎯 NOVA FUNÇÃO: AJUSTAR ZOOM APENAS PARA RÁDIOS ATIVAS
// =========================================================================
function fitMapToActiveCoverage() {
    try {
        let bounds = L.latLngBounds();
        let boundsCreated = false;
        
        // Coletar bounds apenas das rádios ativas
        activeRadios.forEach((radio, index) => {
            if (!radio.active || !radioData.radios[index]) return;
            
            const radioData_single = radioData.radios[index];
            
            // Adicionar coordenadas da rádio
            if (radioData_single.latitude && radioData_single.longitude) {
                bounds.extend([radioData_single.latitude, radioData_single.longitude]);
                boundsCreated = true;
            }
            
            // Adicionar bounds KML
            if (radioData_single.kmlBounds) {
                bounds.extend([radioData_single.kmlBounds.south, radioData_single.kmlBounds.west]);
                bounds.extend([radioData_single.kmlBounds.north, radioData_single.kmlBounds.east]);
                boundsCreated = true;
            }
            
            // Adicionar placemarks
            if (radioData_single.kmlPlacemarks) {
                radioData_single.kmlPlacemarks.forEach(placemark => {
                    if (placemark.coordinates && placemark.coordinates.length >= 2) {
                        const [lat, lng] = placemark.coordinates;
                        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                            bounds.extend([lat, lng]);
                            boundsCreated = true;
                        }
                    }
                });
            }
        });
        
        // Aplicar bounds se válido
        if (boundsCreated && bounds.isValid()) {
            map.fitBounds(bounds, { 
                padding: [40, 40],
                maxZoom: 10
            });
            console.log('🎯 Zoom ajustado para rádios ativas');
        }
        
    } catch (error) {
        console.error('Erro ao ajustar zoom para rádios ativas:', error);
    }
}

// =========================================================================
// 🗺️ ATUALIZAR CAMADAS DO MAPA (PROPOSTA)
// =========================================================================
function updateMapLayers() {
    if (!isPropostaMode) return;
    
    console.log('🗺️ Atualizando camadas do mapa...');
    
    // 1. MOSTRAR/OCULTAR MARCADORES DE RÁDIO
    radioMarkers.forEach((marker, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(marker)) {
                map.addLayer(marker);
                console.log(`📻 Rádio ${index} adicionada ao mapa`);
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
                console.log(`📻 Rádio ${index} removida do mapa`);
            }
        }
    });
    
    // 2. MOSTRAR/OCULTAR CAMADAS DE COBERTURA
    coverageLayers.forEach((layer, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
                console.log(`⭕ Cobertura ${index} adicionada ao mapa`);
            }
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                console.log(`⭕ Cobertura ${index} removida do mapa`);
            }
        }
    });
    
    // 3. 🆕 MOSTRAR/OCULTAR MARCADORES DE CIDADES
    updateCityMarkersVisibility();
    
    // 4. REAJUSTAR ZOOM PARA RÁDIOS ATIVAS
    setTimeout(() => {
        fitMapToActiveCoverage();
    }, 100);
    
    // 5. ATUALIZAR LISTA DE CIDADES
    updateCitiesForActiveRadios();
}

// =========================================================================
// 🏙️ NOVA FUNÇÃO: CONTROLAR VISIBILIDADE DOS MARCADORES DE CIDADES
// =========================================================================
function updateCityMarkersVisibility() {
    console.log('🏙️ Atualizando visibilidade dos marcadores de cidades...');
    
    // Remover todos os marcadores de cidades existentes
    cityMarkers.forEach(marker => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    cityMarkers = [];
    
    // Adicionar marcadores apenas das rádios ativas
    activeRadios.forEach((radio, index) => {
        if (radio.active && radioData.radios[index]) {
            const radioData_single = radioData.radios[index];
            
            // Adicionar marcadores de cidades desta rádio
            if (radioData_single.kmlPlacemarks && radioData_single.kmlPlacemarks.length > 0) {
                addCityMarkersForRadio(radioData_single, index);
            }
        }
    });
    
    console.log(`🏙️ ${cityMarkers.length} marcadores de cidades atualizados`);
}

// =========================================================================
// 🏙️ NOVA FUNÇÃO: ADICIONAR MARCADORES DE CIDADES PARA UMA RÁDIO ESPECÍFICA
// =========================================================================
function addCityMarkersForRadio(radio, radioIndex) {
    const colorIndex = radioIndex % RADIO_COLORS.length;
    const color = RADIO_COLORS[colorIndex];
    
    const cityIcon = L.divIcon({
        html: `
            <div style="
                width: 16px; 
                height: 16px; 
                background: ${color}; 
                border-radius: 50%; 
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            "></div>
        `,
        className: 'city-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    const radioLocation = radio.praca ? radio.praca.toLowerCase() : '';
    const radioName = radio.name ? radio.name.toLowerCase() : '';
    
    radio.kmlPlacemarks.forEach((placemark, index) => {
        const cityName = placemark.name.toLowerCase();
        
        // Filtros para evitar marcadores duplicados
        if (
            cityName.includes(radioLocation) || 
            placemark.description?.includes('0.0 km') ||
            placemark.description?.includes('0,0 km') ||
            cityName === radioLocation ||
            cityName.includes('origem') ||
            cityName.includes(radioName.replace('rádio', '').replace('fm', '').trim())
        ) {
            return;
        }
        
        const [lat, lng] = placemark.coordinates;
        
        const distanceFromRadio = calculateDistance(
            radio.latitude, radio.longitude,
            lat, lng
        );
        
        if (distanceFromRadio < 0.5) {
            return;
        }
        
        const cityMarker = L.marker([lat, lng], { icon: cityIcon })
            .bindPopup(`
                <div style="text-align: center; min-width: 160px; font-family: var(--font-primary);">
                    <h4 style="margin: 0 0 8px 0; color: ${color}; font-weight: 600;">${placemark.name}</h4>
                    <p style="margin: 4px 0; font-size: 12px; color: #64748B;">Cobertura de: ${radio.name}</p>
                    ${placemark.description ? `<p style="margin: 4px 0; font-size: 12px; color: #64748B;">${placemark.description}</p>` : ''}
                    <p style="margin: 4px 0; font-size: 11px; color: #9CA3AF;">
                        📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                </div>
            `)
            .addTo(map);
            
        cityMarkers.push(cityMarker);
    });
}

// =========================================================================
// 🏙️ ATUALIZAR CIDADES PARA RÁDIOS ATIVAS
// =========================================================================
function updateCitiesForActiveRadios() {
    const activeCities = new Set();
    
    // Coletar cidades de todas as rádios ativas
    activeRadios.forEach((radio, index) => {
        if (radio.active && radioData.radios[index]) {
            const cities = radioData.radios[index].cidades || [];
            cities.forEach(cidade => {
                // Filtrar apenas cidades reais
                if (isRealCity(cidade)) {
                    activeCities.add(cidade);
                }
            });
        }
    });
    
    // Atualizar lista filtrada
    allCities = Array.from(activeCities).sort();
    filteredCities = [...allCities];
    
    // Reconstruir mapeamento apenas para rádios ativas
    buildCityRadioMappingForActiveRadios();
    
    // Atualizar visual
    updateCidadesList();
    document.getElementById('cidade-count').textContent = allCities.length;
}

// =========================================================================
// 🗺️ MAPEAMENTO APENAS PARA RÁDIOS ATIVAS
// =========================================================================
function buildCityRadioMappingForActiveRadios() {
    cityRadioMapping = {};
    
    activeRadios.forEach((radio, index) => {
        if (!radio.active || !radioData.radios[index]) return;
        
        const radioData_single = radioData.radios[index];
        const cities = radioData_single.cidades || [];
        
        cities.forEach(cidade => {
            // Filtrar apenas cidades reais
            if (!isRealCity(cidade)) return;
            
            // 🔧 LIMPAR DISTÂNCIA DUPLICADA E EXTRAIR NOME BASE
            const cidadeLimpa = cleanDuplicateDistance(cidade);
            const cityName = cidadeLimpa.split(' - ')[0];
            const nomeBase = cityName.replace(/\s*\([^)]*\)\s*/g, '').trim(); // Remove parênteses
            
            if (!cityRadioMapping[nomeBase]) {
                cityRadioMapping[nomeBase] = [];
            }
            
            cityRadioMapping[nomeBase].push({
                ...radioData_single,
                originalIndex: index
            });
        });
    });
    
    console.log('🗺️ Mapeamento atualizado para rádios ativas:', Object.keys(cityRadioMapping).length, 'cidades');
}

// =========================================================================
// 📊 ATUALIZAR CONTADOR DE RÁDIOS ATIVAS
// =========================================================================
function updateRadioCount() {
    const activeCount = activeRadios.filter(radio => radio.active).length;
    const radiosCount = document.getElementById('radios-count');
    
    if (radiosCount) {
        radiosCount.textContent = `${activeCount}/${radioData.radios.length}`;
        
        // Mudança visual baseada na quantidade ativa
        if (activeCount === 0) {
            radiosCount.style.background = 'var(--emidias-gray)';
        } else if (activeCount === radioData.radios.length) {
            radiosCount.style.background = 'var(--gradient-accent)';
        } else {
            radiosCount.style.background = 'var(--gradient-primary)';
        }
    }
}


// =========================================================================
// ✅ SELECIONAR/DESMARCAR TODAS AS RÁDIOS (CORRIGIDAS)
// =========================================================================
function selectAllRadios() {
    radioData.radios.forEach((radio, index) => {
        const checkbox = document.getElementById(`checkbox-${index}`);
        const radioItem = document.getElementById(`radio-item-${index}`);
        
        if (checkbox && radioItem) {
            checkbox.checked = true;
            activeRadios[index].active = true;
            radioItem.classList.remove('disabled');
        }
    });
    
    // 🔧 USAR FUNÇÃO CORRIGIDA
    updateMapLayersOnly();
    updateRadioCount();
    updateCityListVisibility(); // 🆕 ATUALIZAR VISIBILIDADE
    
    console.log('✅ Todas as rádios selecionadas');
}

function deselectAllRadios() {
    radioData.radios.forEach((radio, index) => {
        const checkbox = document.getElementById(`checkbox-${index}`);
        const radioItem = document.getElementById(`radio-item-${index}`);
        
        if (checkbox && radioItem) {
            checkbox.checked = false;
            activeRadios[index].active = false;
            radioItem.classList.add('disabled');
        }
    });
    
    // 🔧 USAR FUNÇÃO CORRIGIDA
    updateMapLayersOnly();
    updateRadioCount();
    updateCityListVisibility(); // �� ATUALIZAR VISIBILIDADE
    
    console.log('❌ Todas as rádios desmarcadas');
}

// =========================================================================
// 🔍 EXPANDIR/RECOLHER MAPA
// =========================================================================
function toggleMapExpansion() {
    const mapContent = document.getElementById('map-content');
    const radiosSidebar = document.getElementById('radios-sidebar');
    const showRadiosBtn = document.getElementById('show-radios-btn');
    const expandBtn = document.querySelector('.expand-map-btn');
    
    if (!mapContent || !radiosSidebar || !showRadiosBtn) return;
    
    isMapExpanded = !isMapExpanded;
    
    if (isMapExpanded) {
        // Expandir mapa
        mapContent.classList.add('expanded');
        radiosSidebar.style.display = 'none';
        showRadiosBtn.style.display = 'block';
        
        console.log('🔍 Mapa expandido');
    } else {
        // Recolher mapa
        mapContent.classList.remove('expanded');
        radiosSidebar.style.display = 'flex';
        showRadiosBtn.style.display = 'none';
        
        console.log('📻 Lista de rádios restaurada');
    }
    
    // Atualizar texto do botão
    if (expandBtn) {
        expandBtn.textContent = isMapExpanded ? '📻 Mostrar Rádios' : '🔍 Expandir Mapa';
    }
    
    // Recalcular tamanho do mapa
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 300);
}

function showRadiosList() {
    toggleMapExpansion();
}

// =========================================================================
// 📋 ATUALIZAR LISTA DE CIDADES (CORRIGIDO PARA MODO INDIVIDUAL)
// =========================================================================
function updateCidadesList() {
    if (isPropostaMode) {
        updateCidadesListProposta();
        return;
    }
    
    // 🔧 MODO INDIVIDUAL CORRIGIDO
    const container = document.getElementById('cidades-list');
    
    if (!container) {
        console.error('❌ Container de cidades não encontrado');
        return;
    }
    
    if (filteredCities.length === 0) {
        container.innerHTML = `
            <div class="cidade-item" style="text-align: center; padding: 20px; color: var(--emidias-gray);">
                ❌ Nenhuma cidade encontrada
            </div>
        `;
        return;
    }
    
    console.log('📋 Atualizando lista com', filteredCities.length, 'cidades');
    
    container.innerHTML = filteredCities.map((cidade, index) => {
        // 🔧 PROCESSAR CIDADE SEM DUPLICAR DISTÂNCIA
        const processedCity = processCityForDisplay(cidade);
        
        return `
            <div class="cidade-item" onclick="highlightCity('${cidade}')" title="Clique para localizar no mapa">
                <div class="cidade-info">
                    <span class="cidade-name">${processedCity.nome}</span>
                    <span class="cidade-uf">${processedCity.uf}</span>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Lista de cidades atualizada');
}

// =========================================================================
// 🔧 NOVA FUNÇÃO: PROCESSAR CIDADE PARA EXIBIÇÃO
// =========================================================================
function processCityForDisplay(cidade) {
    // Primeiro, limpar distâncias duplicadas
    const cleanCity = cleanDuplicateDistance(cidade);
    
    // Separar nome, distância e UF
    let nome = cleanCity;
    let uf = radioData.uf || '';
    
    // Padrão: "Cidade (distância) - UF" ou "Cidade - UF"
    if (cleanCity.includes(' - ')) {
        const parts = cleanCity.split(' - ');
        nome = parts[0].trim();
        uf = parts[1].trim();
    }
    
    return {
        nome: nome,
        uf: uf
    };
}

// =========================================================================
// 🏢 ATUALIZAR LISTA DE CIDADES NO MODO PROPOSTA (CORRIGIDO - SEM DUPLICATAS)
// =========================================================================
function updateCidadesListProposta() {
    const container = document.getElementById('cidades-list');
    
    if (!container) {
        console.error('❌ Container de cidades não encontrado');
        return;
    }
    
    if (filteredCities.length === 0) {
        container.innerHTML = `
            <div class="cidade-item" style="text-align: center; padding: 20px; color: var(--emidias-gray);">
                ❌ Nenhuma cidade encontrada
            </div>
        `;
        return;
    }
    
    console.log('📋 Atualizando lista com', filteredCities.length, 'cidades únicas');
    
    // Usar a função corrigida
    updateCidadesListPropostaVisibility();
}

function setupCitySearch() {
    const searchInput = document.getElementById('city-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            filteredCities = allCities.filter(cidade => 
                cidade.toLowerCase().includes(query)
            );
            
            updateCidadesList();
        });
    }
}

// =========================================================================
// 🎯 DESTACAR CIDADE NO MAPA (UNIFICADO PARA AMBOS OS MODOS)
// =========================================================================
function highlightCity(cityName) {
    console.log('🎯 Destacando cidade:', cityName, 'Modo:', isPropostaMode ? 'Proposta' : 'Individual');
    
    if (isPropostaMode) {
        highlightCityProposta(cityName);
    } else {
        highlightCityIndividual(cityName);
    }
}

// =========================================================================
// 🎯 DESTACAR CIDADE NO MODO INDIVIDUAL (FUNÇÃO ORIGINAL RENOMEADA)
// =========================================================================
function highlightCityIndividual(cityName) {
    const cityBaseName = cityName.split(' - ')[0].toLowerCase();
    
    // Usar lógica original do modo individual
    if (window.cityPlacemarkMap && window.cityPlacemarkMap[cityBaseName]) {
        const cityData = window.cityPlacemarkMap[cityBaseName];
        const [lat, lng] = cityData.coordinates;
        
        map.flyTo([lat, lng], 11, {
            animate: true,
            duration: 1.5
        });
        
        if (cityMarkers[cityData.markerIndex]) {
            setTimeout(() => {
                cityMarkers[cityData.markerIndex].openPopup();
            }, 1000);
        }
        return;
    }
    
    // Fallback para busca em placemarks
    if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
        for (let i = 0; i < radioData.kmlPlacemarks.length; i++) {
            const placemark = radioData.kmlPlacemarks[i];
            const placemarkName = placemark.name.toLowerCase();
            
            if (placemarkName.includes(cityBaseName) || cityBaseName.includes(placemarkName)) {
                const mappedCity = window.cityPlacemarkMap[placemarkName];
                if (mappedCity) {
                    const [lat, lng] = mappedCity.coordinates;
                    
                    map.flyTo([lat, lng], 11, {
                        animate: true,
                        duration: 1.5
                    });
                    
                    if (cityMarkers[mappedCity.markerIndex]) {
                        setTimeout(() => {
                            cityMarkers[mappedCity.markerIndex].openPopup();
                        }, 1000);
                    }
                    return;
                }
            }
        }
    }
    
    // Fallback final
    map.flyTo([radioData.latitude, radioData.longitude], 8, {
        animate: true,
        duration: 1.5
    });
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    const infoElement = document.getElementById('info-section');
    const mapElement = document.getElementById('map-section');
    const radioNameElement = document.getElementById('radio-name');
    const radioInfoElement = document.getElementById('radio-info');
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (infoElement) infoElement.style.display = 'grid';
    if (mapElement) mapElement.style.display = 'block';
    
    // Atualizar header baseado no modo
    if (isPropostaMode) {
        // Modo Proposta: usar logo E-MÍDIAS e título "Cobertura do Plano"
        const sourceSuffix = radioData.source === 'example' ? ' (EXEMPLO)' : '';
        if (radioNameElement) {
            radioNameElement.innerHTML = `
                <img class="header-logo" src="./assets/logo E-MIDIAS png fundo branco.png" alt="Logo E-MÍDIAS" 
                        onerror="this.src='./assets/logo E-MIDIAS png fundo branco HORIZONTAL.png'; this.onerror=function(){this.style.display='none'};">
                Cobertura do Plano${sourceSuffix}
                <span class="type-indicator type-proposta">Proposta</span>
            `;
        }
        if (radioInfoElement) {
            radioInfoElement.textContent = `Mapa de Cobertura Interativo`;
        }
    } else {
        // Modo Individual: manter comportamento original
        const sourceSuffix = radioData.source === 'example' ? ' (EXEMPLO)' : '';
        if (radioNameElement) {
            radioNameElement.innerHTML = `
                <img class="header-logo" src="${radioData.imageUrl}" alt="Logo ${radioData.name}" 
                        onerror="this.style.display='none';">
                ${radioData.name}${sourceSuffix}
                <span class="type-indicator type-individual">Individual</span>
            `;
        }
        if (radioInfoElement) radioInfoElement.textContent = `${radioData.dial} • ${radioData.praca} - ${radioData.uf}`;
    }
        // 🔧 DEBUG: Verificar se é modo proposta e chamar debug
    if (isPropostaMode) {
        setTimeout(() => {
            console.log('🔍 Executando debug após hideLoading...');
            debugRadiosList();
        }, 1000);
    }
}

function showError(message, details = null) {
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const errorMessageElement = document.getElementById('error-message');
    const errorDetailsElement = document.getElementById('error-details');
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (errorMessageElement) errorMessageElement.textContent = message;
    
    if (details && errorDetailsElement) {
        errorDetailsElement.textContent = details;
        errorDetailsElement.style.display = 'block';
    }
    
    if (errorElement) errorElement.style.display = 'block';
}

function centerMapOnRadio(lat, lng, marker) {
    try {
        // 1. Obter dimensões do mapa
        const mapSize = map.getSize();
        const mapHeight = mapSize.y;
        
        // 2. Calcular offset baseado na altura do mapa (popup aparece acima)
        const popupHeight = 200; // Altura estimada do popup
        const offsetPixels = Math.min(popupHeight / 2, mapHeight * 0.2); // Máximo 20% da altura
        
        // 3. Converter offset de pixels para coordenadas
        const zoom = Math.max(map.getZoom(), 9); // Zoom mínimo para boa visualização
        const offsetLat = (offsetPixels * 360) / (256 * Math.pow(2, zoom)) / Math.cos(lat * Math.PI / 180);
        
        // 4. Calcular posição ajustada (mover para baixo para dar espaço ao popup)
        const adjustedLat = lat - offsetLat;
        
        // 5. Verificar se a posição ajustada está dentro dos bounds do mapa
        const mapBounds = map.getBounds();
        const targetLat = Math.max(mapBounds.getSouth(), Math.min(mapBounds.getNorth(), adjustedLat));
        const targetLng = Math.max(mapBounds.getWest(), Math.min(mapBounds.getEast(), lng));
        
        console.log('🎯 Centralizando rádio:', {
            original: [lat, lng],
            adjusted: [targetLat, targetLng],
            offset: offsetLat,
            zoom: zoom
        });
        
        // 6. Animar para a posição com callback para abrir popup
        map.once('moveend', () => {
            // Pequeno delay para garantir que a animação terminou
            setTimeout(() => {
                if (marker && marker.openPopup) {
                    marker.openPopup();
                }
            }, 100);
        });
        
        // 7. Executar movimento suave
        map.flyTo([targetLat, targetLng], zoom, {
            animate: true,
            duration: 0.8,
            easeLinearity: 0.25
        });
        
    } catch (error) {
        console.error('❌ Erro na centralização:', error);
        
        // Fallback simples em caso de erro
        try {
            map.setView([lat, lng], Math.max(map.getZoom(), 9));
            if (marker && marker.openPopup) {
                setTimeout(() => marker.openPopup(), 200);
            }
        } catch (fallbackError) {
            console.error('❌ Erro no fallback:', fallbackError);
        }
    }
}

// =========================================================================
// �� FUNÇÃO AUXILIAR: DETECTAR DISPOSITIVO MÓVEL
// =========================================================================
function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// =========================================================================
// �� VERSÃO OTIMIZADA PARA MOBILE (OPCIONAL)
// =========================================================================
function centerMapOnRadioMobile(lat, lng, marker) {
    if (!isMobileDevice()) {
        return centerMapOnRadio(lat, lng, marker);
    }
    
    // Em mobile, usar centralização mais simples
    const zoom = Math.max(map.getZoom(), 10);
    
    map.once('moveend', () => {
        setTimeout(() => {
            if (marker && marker.openPopup) {
                marker.openPopup();
            }
        }, 150);
    });
    
    map.flyTo([lat, lng], zoom, {
        animate: true,
        duration: 0.6
    });
}

// =========================================================================
// 🧹 FUNÇÃO AVANÇADA: LIMPAR MÚLTIPLAS DUPLICAÇÕES
// =========================================================================
function cleanAllDuplicateDistances(cityName) {
    let cleanName = cityName;
    
    // Remover múltiplas ocorrências de distâncias iguais
    const distanceRegex = /\(([0-9]+[.,]?[0-9]*)\s*km\)/gi;
    const distances = [];
    let match;
    
    // Encontrar todas as distâncias
    while ((match = distanceRegex.exec(cityName)) !== null) {
        distances.push({
            full: match[0],
            value: match[1]
        });
    }
    
    // Se há distâncias duplicadas
    if (distances.length > 1) {
        const uniqueDistances = [...new Set(distances.map(d => d.value))];
        
        if (uniqueDistances.length === 1) {
            // Todas as distâncias são iguais, manter apenas uma
            const baseCity = cityName.replace(distanceRegex, '').trim();
            cleanName = `${baseCity} (${uniqueDistances[0]} km)`;
            
            console.log('🧹 Múltiplas distâncias iguais removidas:', cityName, '→', cleanName);
        }
    }
    
    return cleanName;
}

// =========================================================================
// �� FUNÇÃO DE DEBUG PARA VERIFICAR ELEMENTOS
// =========================================================================
function debugRadiosList() {
    console.log('🔍 DEBUG - Verificando elementos da lista de rádios:');
    console.log('- isPropostaMode:', isPropostaMode);
    console.log('- radioData.radios:', radioData.radios ? radioData.radios.length : 'undefined');
    console.log('- activeRadios:', activeRadios ? activeRadios.length : 'undefined');
    
    const elements = {
        radiosList: document.getElementById('radios-list'),
        radiosSidebar: document.getElementById('radios-sidebar'),
        radiosCount: document.getElementById('radios-count'),
        mapSection: document.getElementById('map-section')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
        console.log(`- ${name}:`, element ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
        if (element) {
            console.log(`  - display:`, getComputedStyle(element).display);
            console.log(`  - visibility:`, getComputedStyle(element).visibility);
        }
    });
}

// =========================================================================
// 🎯 CENTRALIZAR MAPA EM RÁDIO ESPECÍFICA
// =========================================================================
function centerMapOnRadioList(radioIndex) {
    console.log('🎯 Centralizando mapa na rádio:', radioIndex);
    
    if (!radioData.radios || !radioData.radios[radioIndex]) {
        console.error('❌ Rádio não encontrada:', radioIndex);
        return;
    }
    
    const radio = radioData.radios[radioIndex];
    const lat = parseFloat(radio.latitude);
    const lng = parseFloat(radio.longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
        console.error('❌ Coordenadas da rádio inválidas:', lat, lng);
        return;
    }
    
    // Centralizar mapa na rádio com animação
    map.flyTo([lat, lng], 11, {
        animate: true,
        duration: 1.5
    });
    
    // Destacar o marcador da rádio
    const radioMarker = radioMarkers[radioIndex];
    if (radioMarker && map.hasLayer(radioMarker)) {
        // Abrir popup do marcador
        setTimeout(() => {
            radioMarker.openPopup();
        }, 1000);
        
        // Efeito visual no marcador
        setTimeout(() => {
            highlightRadioMarker(radioIndex);
        }, 1500);
    }
    
    console.log(`✅ Mapa centralizado na rádio: ${radio.name} (${radio.dial})`);
}

// =========================================================================
// 🎯 DESTACAR MARCADOR DE RÁDIO (FUNÇÃO AUXILIAR)
// =========================================================================
function highlightRadioMarker(radioIndex) {
    const radioMarker = radioMarkers[radioIndex];
    if (!radioMarker || !map.hasLayer(radioMarker)) return;
    
    // Obter elemento DOM do marcador
    const markerElement = radioMarker.getElement();
    if (markerElement) {
        // Adicionar classe de destaque
        markerElement.classList.add('marker-highlight');
        
        // Remover destaque após 2 segundos
        setTimeout(() => {
            markerElement.classList.remove('marker-highlight');
        }, 2000);
    }
}


// =========================================================================
// 🗺️ ATUALIZAR APENAS CAMADAS DO MAPA (SEM RECRIAR LISTA DE CIDADES)
// =========================================================================
function updateMapLayersOnly() {
    if (!isPropostaMode) return;
    
    console.log('🗺️ Atualizando apenas camadas do mapa...');
    
    // 1. MOSTRAR/OCULTAR MARCADORES DE RÁDIO
    radioMarkers.forEach((marker, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(marker)) {
                map.addLayer(marker);
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });
    
    // 2. MOSTRAR/OCULTAR CAMADAS DE COBERTURA
    coverageLayers.forEach((layer, index) => {
        if (activeRadios[index] && activeRadios[index].active) {
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
            }
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    });
    
    // 3. ATUALIZAR MARCADORES DE CIDADES
    updateCityMarkersVisibility();
    
    // 4. REAJUSTAR ZOOM PARA RÁDIOS ATIVAS
    setTimeout(() => {
        fitMapToActiveCoverage();
    }, 100);
}

// =========================================================================
// 🏙️ ATUALIZAR VISIBILIDADE DAS CIDADES NA LISTA (SEM RECRIAR)
// =========================================================================
function updateCityListVisibility() {
    if (!isPropostaMode) return;
    
    console.log('🏙️ Atualizando visibilidade das cidades na lista...');
    
    // Filtrar cidades que têm pelo menos uma rádio ativa
    const cidadesVisiveis = allCities.filter(cidade => {
        return cidade.radios.some(radio => activeRadios[radio.originalIndex].active);
    });
    
    // Atualizar array de cidades filtradas
    filteredCities = cidadesVisiveis;
    
    // Atualizar a exibição da lista
    updateCidadesListPropostaVisibility();
    
    // Atualizar contador
    const cidadeCountElement = document.getElementById('cidade-count');
    if (cidadeCountElement) {
        cidadeCountElement.textContent = filteredCities.length;
    }
    
    console.log(`🏙️ ${filteredCities.length} cidades visíveis de ${allCities.length} total`);
}

// =========================================================================
// 🏙️ ATUALIZAR EXIBIÇÃO DA LISTA (MANTENDO ESTRUTURA ORIGINAL)
// =========================================================================
function updateCidadesListPropostaVisibility() {
    const container = document.getElementById('cidades-list');
    
    if (!container) {
        console.error('❌ Container de cidades não encontrado');
        return;
    }
    
    if (filteredCities.length === 0) {
        container.innerHTML = `
            <div class="cidade-item" style="text-align: center; padding: 20px; color: var(--emidias-gray);">
                ❌ Nenhuma cidade visível (todas as rádios estão desmarcadas)
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredCities.map((cidade, index) => {
        // Filtrar apenas as rádios ativas desta cidade
        const radiosAtivas = cidade.radios.filter(radio => activeRadios[radio.originalIndex].active);
        
        // Gerar HTML apenas das logos das rádios ativas
        const radiosHtml = radiosAtivas.map(radio => {
            const colorIndex = radio.originalIndex % RADIO_COLORS.length;
            const color = RADIO_COLORS[colorIndex];
            const pmmFormatted = radio.pmm ? radio.pmm.toLocaleString() : '0';
            const universoFormatted = radio.universo ? radio.universo.toLocaleString() : '0';
            const cidadesCount = radio.cidades ? radio.cidades.length : 0;
            
            return `
                <div class="radio-logo-cidade" 
                     style="border-color: ${color};"
                     data-radio-index="${radio.originalIndex}">
                    
                    <img src="${radio.imageUrl}" 
                         alt="${radio.name} - ${radio.dial}"
                         onerror="this.src='https://via.placeholder.com/32x32/${color.replace('#', '')}/white?text=${encodeURIComponent(radio.dial || 'FM')}'">
                    
                    <!-- TOOLTIP -->
                    <div class="radio-tooltip">
                        <div class="tooltip-radio-name">${radio.name}</div>
                        <div class="tooltip-radio-details">
                            <strong>${radio.dial}</strong> • ${radio.praca} - ${radio.uf}
                        </div>
                        <div class="tooltip-radio-details">
                            ${radio.region || 'Região não informada'}
                        </div>
                        <div class="tooltip-radio-stats">
                            PMM: ${pmmFormatted} • Universo: ${universoFormatted}<br>
                            Cidades: ${cidadesCount} • Clique para centralizar
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="cidade-item" data-cidade="${cidade.nomeCompleto}">
                <div class="cidade-info">
                    <span class="cidade-name">${cidade.nome}</span>
                    <span class="cidade-uf">${cidade.uf}</span>
                </div>
                <div class="cidade-radios-logos">
                    ${radiosHtml}
                </div>
            </div>
        `;
    }).join('');
    
    // 🔧 ADICIONAR EVENT LISTENERS APÓS CRIAR O HTML
    setupCityItemEvents();
    
    console.log('✅ Visibilidade da lista de cidades atualizada com eventos');
}

// =========================================================================
// 🎯 CONFIGURAR EVENT LISTENERS PARA CIDADES E RÁDIOS (CORRIGIDA)
// =========================================================================
function setupCityItemEvents() {
    console.log('🎯 Configurando event listeners...');
    
    // Event listeners para clique nas cidades
    document.querySelectorAll('.cidade-item').forEach(item => {
        const cidadeNome = item.dataset.cidade;
        if (cidadeNome) {
            // Remover listeners anteriores
            item.removeEventListener('click', item._cityClickHandler);
            
            // Criar novo handler
            item._cityClickHandler = function(event) {
                // Verificar se o clique foi na logo da rádio
                if (!event.target.closest('.radio-logo-cidade')) {
                    console.log('🏙️ Clique na cidade:', cidadeNome);
                    highlightCity(cidadeNome);
                }
            };
            
            // Adicionar novo listener
            item.addEventListener('click', item._cityClickHandler);
        }
    });
    
    // Event listeners para clique nas logos das rádios
    document.querySelectorAll('.radio-logo-cidade').forEach(logo => {
        const radioIndex = parseInt(logo.dataset.radioIndex);
        if (!isNaN(radioIndex)) {
            // Remover listeners anteriores
            logo.removeEventListener('click', logo._radioClickHandler);
            
            // Criar novo handler
            logo._radioClickHandler = function(event) {
                event.stopPropagation(); // Impedir propagação para o item da cidade
                console.log('📻 Clique na rádio:', radioIndex);
                centerMapOnRadioList(radioIndex);
            };
            
            // Adicionar novo listener
            logo.addEventListener('click', logo._radioClickHandler);
        }
    });
    
    console.log('✅ Event listeners configurados para', 
                document.querySelectorAll('.cidade-item').length, 'cidades e',
                document.querySelectorAll('.radio-logo-cidade').length, 'rádios');
}

// =========================================================================
// 💬 POSICIONAMENTO DINÂMICO DO TOOLTIP
// =========================================================================
function setupTooltipPositioning() {
    // Adicionar event listeners para posicionamento dinâmico
    document.addEventListener('mouseover', function(event) {
        const logoElement = event.target.closest('.radio-logo-cidade');
        if (!logoElement) return;
        
        const tooltip = logoElement.querySelector('.radio-tooltip');
        if (!tooltip) return;
        
        // Calcular posição do elemento
        const rect = logoElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Posição inicial (acima do elemento)
        let top = rect.top - tooltipRect.height - 12;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Verificar se tooltip sai da tela (direita)
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        
        // Verificar se tooltip sai da tela (esquerda)
        if (left < 10) {
            left = 10;
        }
        
        // Verificar se tooltip sai da tela (topo)
        if (top < 10) {
            // Mostrar abaixo do elemento
            top = rect.bottom + 12;
            tooltip.style.setProperty('--arrow-position', 'top');
        } else {
            tooltip.style.setProperty('--arrow-position', 'bottom');
        }
        
        // Aplicar posição
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        
        // Posicionar seta
        const arrowLeft = rect.left + (rect.width / 2) - left;
        tooltip.style.setProperty('--arrow-left', arrowLeft + 'px');
    });
}

// Chamar a função após carregar a página
document.addEventListener('DOMContentLoaded', setupTooltipPositioning);

// =========================================================================
// 🔄 SISTEMA DE ALTERNÂNCIA DE MODOS (PARA DESENVOLVIMENTO)
// =========================================================================

// Adicionar botão de alternância após carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que tudo carregou
    setTimeout(() => {
        addModeToggleButton();
    }, 2000);
});

function addModeToggleButton() {
    // Verificar se já existe o botão
    if (document.getElementById('mode-toggle-btn')) return;
    
    // Criar botão
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'mode-toggle-btn';
    toggleBtn.innerHTML = `
        🔄 Alternar para ${isPropostaMode ? 'Individual' : 'Proposta'}
    `;
    toggleBtn.style.cssText = `
        position: fixed;
        top: 80px;
        left: 20px;
        z-index: 2000;
        background: linear-gradient(135deg, #FC1E75 0%, #D71E97 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: var(--font-primary);
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(252, 30, 117, 0.3);
        transition: all 0.3s ease;
    `;
    
    // Efeitos hover
    toggleBtn.addEventListener('mouseenter', () => {
        toggleBtn.style.transform = 'translateY(-2px)';
        toggleBtn.style.boxShadow = '0 6px 20px rgba(252, 30, 117, 0.4)';
    });
    
    toggleBtn.addEventListener('mouseleave', () => {
        toggleBtn.style.transform = 'translateY(0)';
        toggleBtn.style.boxShadow = '0 4px 15px rgba(252, 30, 117, 0.3)';
    });
    
    // Ação do clique
    toggleBtn.addEventListener('click', toggleMode);
    
    // Adicionar ao body
    document.body.appendChild(toggleBtn);
    
    console.log('🔄 Botão de alternância adicionado');
}

function toggleMode() {
    const currentMode = isPropostaMode ? 'proposta' : 'individual';
    const newMode = isPropostaMode ? 'individual' : 'proposta';
    
    console.log(`🔄 Alternando de ${currentMode} para ${newMode}`);
    
    // Mostrar loading
    showModeChangeLoading();
    
    // Aguardar um pouco e recarregar com dados do novo modo
    setTimeout(() => {
        switchToMode(newMode);
    }, 500);
}

function showModeChangeLoading() {
    // Criar overlay de loading
    const overlay = document.createElement('div');
    overlay.id = 'mode-change-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(6, 5, 91, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: var(--font-primary);
        color: white;
    `;
    
    overlay.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <h3 style="margin: 0; font-size: 18px;">🔄 Alternando Modo...</h3>
            <p style="margin: 8px 0 0 0; opacity: 0.8;">Aguarde um momento</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function switchToMode(newMode) {
    // Limpar mapa e dados atuais
    if (map) {
        map.remove();
        map = null;
    }
    
    // Resetar arrays
    radioMarkers = [];
    coverageLayers = [];
    cityMarkers = [];
    allCities = [];
    filteredCities = [];
    activeRadios = [];
    
    // Alterar dados baseado no modo
    if (newMode === 'proposta') {
        // Simular dados de proposta
        radioData = createPropostaTestData();
        isPropostaMode = true;
    } else {
        // Simular dados individuais
        radioData = createIndividualTestData();
        isPropostaMode = false;
    }
    
    // Remover overlay
    const overlay = document.getElementById('mode-change-overlay');
    if (overlay) overlay.remove();
    
    // Reinicializar
    setTimeout(async () => {
        try {
            if (isPropostaMode) {
                await initializePropostaMode();
            } else {
                await initializeIndividualMode();
            }
            
            // Atualizar botão
            const toggleBtn = document.getElementById('mode-toggle-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = `🔄 Alternar para ${isPropostaMode ? 'Individual' : 'Proposta'}`;
            }
            
            console.log(`✅ Modo alterado para: ${newMode}`);
            
        } catch (error) {
            console.error('❌ Erro ao alternar modo:', error);
            alert('Erro ao alternar modo. Verifique o console.');
        }
    }, 100);
}

// =========================================================================
// 🧪 DADOS DE TESTE PARA PROPOSTA
// =========================================================================
function createPropostaTestData() {
    return {
        type: 'proposta',
        name: 'Proposta E-MÍDIAS',
        source: 'example',
        radios: [
            {
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
                imageUrl: 'https://via.placeholder.com/56x56/06055B/white?text=107.3',
                coverageType: 'circle',
                notionId: 'radio-1',
                cidades: [
                    'Florianópolis - SC',
                    'São José - SC',
                    'Palhoça - SC',
                    'Biguaçu - SC',
                    'Santo Amaro da Imperatriz - SC'
                ],
                kmlPlacemarks: [
                    { name: 'São José', coordinates: [-27.1173, -48.6167], description: '15.2 km' },
                    { name: 'Palhoça', coordinates: [-27.6386, -48.6703], description: '22.8 km' },
                    { name: 'Biguaçu', coordinates: [-27.4939, -48.6581], description: '18.5 km' }
                ]
            },
            {
                name: 'RÁDIO TESTE AM',
                dial: '1200',
                latitude: -26.9194,
                longitude: -49.0661,
                radius: 60000,
                region: 'Sul',
                uf: 'SC',
                praca: 'Blumenau',
                universo: 850000,
                pmm: 8500,
                imageUrl: 'https://via.placeholder.com/56x56/FC1E75/white?text=1200',
                coverageType: 'circle',
                notionId: 'radio-2',
                cidades: [
                    'Blumenau - SC',
                    'Pomerode - SC',
                    'Timbó - SC',
                    'Indaial - SC'
                ],
                kmlPlacemarks: [
                    { name: 'Pomerode', coordinates: [-26.7406, -49.1764], description: '12.1 km' },
                    { name: 'Timbó', coordinates: [-26.8225, -49.2731], description: '18.7 km' },
                    { name: 'Indaial', coordinates: [-26.8989, -49.2331], description: '15.3 km' }
                ]
            },
            {
                name: 'RÁDIO DEMO FM',
                dial: '95.5',
                latitude: -26.3044,
                longitude: -48.8456,
                radius: 45000,
                region: 'Sul',
                uf: 'SC',
                praca: 'Joinville',
                universo: 720000,
                pmm: 9200,
                imageUrl: 'https://via.placeholder.com/56x56/D71E97/white?text=95.5',
                coverageType: 'circle',
                notionId: 'radio-3',
                cidades: [
                    'Joinville - SC',
                    'Araquari - SC',
                    'Guaramirim - SC',
                    'São Francisco do Sul - SC'
                ],
                kmlPlacemarks: [
                    { name: 'Araquari', coordinates: [-26.3708, -48.7217], description: '14.8 km' },
                    { name: 'Guaramirim', coordinates: [-26.4733, -49.0042], description: '19.2 km' }
                ]
            }
        ]
    };
}

// =========================================================================
// 🧪 DADOS DE TESTE PARA INDIVIDUAL
// =========================================================================
function createIndividualTestData() {
    return {
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
        imageUrl: 'https://via.placeholder.com/100x75/06055B/white?text=107.3',
        coverageType: 'circle',
        source: 'example',
        type: 'individual',
        cidades: [
            'Florianópolis - SC',
            'São José - SC',
            'Palhoça - SC',
            'Biguaçu - SC',
            'Santo Amaro da Imperatriz - SC',
            'Águas Mornas - SC',
            'Antônio Carlos - SC',
            'Governador Celso Ramos - SC',
            'Blumenau - SC',
            'Joinville - SC'
        ],
        kmlPlacemarks: [
            { name: 'São José', coordinates: [-27.1173, -48.6167], description: '15.2 km' },
            { name: 'Palhoça', coordinates: [-27.6386, -48.6703], description: '22.8 km' },
            { name: 'Biguaçu', coordinates: [-27.4939, -48.6581], description: '18.5 km' },
            { name: 'Santo Amaro da Imperatriz', coordinates: [-27.6889, -48.7806], description: '35.4 km' },
            { name: 'Blumenau', coordinates: [-26.9194, -49.0661], description: '85.2 km' },
            { name: 'Joinville', coordinates: [-26.3044, -48.8456], description: '120.8 km' }
        ]
    };
}