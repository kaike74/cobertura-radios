
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
// 📊 FUNÇÃO EXPORT EXCEL (.XLSX) - E-MÍDIAS (MELHORADA PARA PROPOSTA)
// =========================================================================
function exportToExcel() {
    let citiesToExport = [];
    
    if (isPropostaMode) {
        // Modo proposta: usar apenas cidades únicas (sem nomes de rádios)
        citiesToExport = getUniqueCitiesOnly() || [];
    } else {
        // Modo individual: usar radioData.cidades
        citiesToExport = radioData.cidades || [];
    }
    
    if (!citiesToExport || citiesToExport.length === 0) {
        alert('❌ Nenhuma cidade disponível para exportar.');
        return;
    }
    
    try {
        // Preparar dados para Excel
        const excelData = [];
        
        // Cabeçalho
        if (isPropostaMode) {
            excelData.push(['Cidade', 'UF', 'Rádios', 'Impactos', 'Universo']);
        } else {
            excelData.push(['Cidade', 'UF', 'Região', 'Distância (km)']);
        }
        
        // Dados das cidades
        citiesToExport.forEach(cidadeOriginal => {
            let nomeCidade = cidadeOriginal;
            let uf = '';
            
            // Separar UF se houver " - UF"
            if (cidadeOriginal.includes(' - ')) {
                const parts = cidadeOriginal.split(' - ');
                nomeCidade = parts[0];
                uf = parts[1];
            }
            
            if (isPropostaMode) {
                // Buscar rádios que cobrem esta cidade
                const radiosQueCobrema = cityRadioMapping[nomeCidade] || [];
                const radiosTexto = radiosQueCobrema.map(radio => 
                    `${radio.name} ${radio.dial}`
                ).join(', ');
                
                // Calcular impactos e universo desta cidade
                const totalImpactos = radiosQueCobrema.reduce((sum, radio) => 
                    sum + (radio.impactos || radio.pmm || 0), 0);
                const maxUniverso = Math.max(...radiosQueCobrema.map(radio => 
                    radio.universo || 0), 0);
                
                excelData.push([
                    nomeCidade,
                    uf,
                    radiosTexto,
                    totalImpactos.toLocaleString(),
                    maxUniverso.toLocaleString()
                ]);
            } else {
                // Modo individual (lógica original)
                let distanciaKm = 0;
                
                // Extrair distância se houver parênteses
                if (nomeCidade.includes('(') && nomeCidade.includes('km')) {
                    const regex = /^(.*?)\s*\((\d+\.?\d*)\s*km\)$/;
                    const match = nomeCidade.match(regex);
                    
                    if (match) {
                        nomeCidade = match[1].trim();
                        distanciaKm = parseFloat(match[2]);
                    }
                }
                
                excelData.push([
                    nomeCidade,
                    uf || radioData.uf,
                    radioData.region || 'N/A',
                    distanciaKm
                ]);
            }
        });
        
        // Criar workbook usando SheetJS
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Configurar largura das colunas
        if (isPropostaMode) {
            ws['!cols'] = [
                { width: 30 }, // Cidade
                { width: 8 },  // UF
                { width: 50 }, // Rádios
                { width: 15 }, // Impactos
                { width: 15 }  // Universo
            ];
        } else {
            ws['!cols'] = [
                { width: 30 }, // Cidade
                { width: 8 },  // UF
                { width: 15 }, // Região
                { width: 15 }  // Distância (km)
            ];
        }
        
        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, "Cobertura");
        
        // Gerar nome do arquivo
        let fileName;
        if (isPropostaMode) {
            const dateStr = new Date().toISOString().split('T')[0];
            const activeCount = activeRadios.filter(r => r.active).length;
            fileName = `cobertura-proposta-${activeCount}radios-${dateStr}.xlsx`;
        } else {
            const radioName = radioData.name ? radioData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'radio';
            fileName = `cobertura-${radioName}-${new Date().toISOString().split('T')[0]}.xlsx`;
        }
        
        // Baixar arquivo Excel
        XLSX.writeFile(wb, fileName);
        
        // Feedback visual
        const btn = document.querySelector('.excel-export-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Exportado!';
            btn.style.background = 'var(--gradient-success)';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = 'var(--gradient-success)';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Erro detalhado:', error);
        alert('❌ Erro ao exportar arquivo. Tente novamente.');
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
// 🎯 MODO INDIVIDUAL (ORIGINAL)
// =========================================================================
async function initializeIndividualMode() {
    console.log('🔍 Modo Individual ativado');
    renderInfoIndividual();
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
                
                console.log('🗺️ Criando mapa individual...');
                
                // Criar mapa COM POSIÇÃO INICIAL
                map = L.map('map').setView([radioData.latitude, radioData.longitude], 8);
                
                // Adicionar camada de tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18
                }).addTo(map);
                
                console.log('🗺️ Mapa criado, adicionando elementos...');
                
                // Invalidar tamanho após criação
                setTimeout(() => {
                    map.invalidateSize();
                    
                    // Adicionar elementos do mapa
                    addRadioMarkerIndividual();
                    addCoverageIndividual();
                    
                    // Ajustar zoom após elementos serem adicionados
                    setTimeout(() => {
                        fitMapToCoverageIndividual();
                        resolve();
                    }, 200);
                    
                }, 100);
                
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
                        onerror="this.src='https://via.placeholder.com/90x68/06055B/white?text=${encodeURIComponent(radioData.dial || 'FM')}'">
                <h3>${radioData.name}</h3>
                <p><strong>${radioData.dial}</strong></p>
                <p>${radioData.praca} - ${radioData.uf}</p>
            </div>
        `;
        
        const radioMarker = L.marker([radioData.latitude, radioData.longitude], { icon: radioIcon })
            .bindPopup(popupContent)
            .addTo(map);
            
        radioMarkers.push(radioMarker);
        console.log('✅ Marcador da rádio adicionado');
        
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


function renderInfoIndividual() {
    const container = document.getElementById('info-section');
    
    const pmmFormatted = radioData.pmm ? radioData.pmm.toLocaleString() : 'N/A';
    const universoFormatted = radioData.universo ? radioData.universo.toLocaleString() : 'N/A';
    
    container.innerHTML = `
        <!-- TÉCNICAS -->
        <div class="info-card">
            <h3 class="card-title">📻 Informações Técnicas</h3>
            <div class="info-item">
                <span class="info-label">Dial:</span>
                <span class="info-value">${radioData.dial}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Praça:</span>
                <span class="info-value">${radioData.praca} - ${radioData.uf}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Região:</span>
                <span class="info-value">${radioData.region}</span>
            </div>
        </div>
        
        <!-- ALCANCE -->
        <div class="info-card">
            <h3 class="card-title">🌐 Alcance e Cobertura</h3>
            <div class="info-item">
                <span class="info-label">PMM:</span>
                <span class="info-value">${pmmFormatted}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Universo:</span>
                <span class="info-value">${universoFormatted}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Cidades:</span>
                <span class="info-value">${radioData.cidades ? radioData.cidades.length : 0}</span>
            </div>
        </div>
    `;
    
    container.style.display = 'grid';
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
        // Filtrar cidades válidas (remover nomes de rádios)
        allCities = radioData.cidades.filter(cidade => {
            const cityName = cidade.toLowerCase();
            const radioName = (radioData.name || '').toLowerCase();
            const radioLocation = (radioData.praca || '').toLowerCase();
            
            // Não incluir se for o nome da rádio ou localização da rádio
            return !cityName.includes(radioName.replace('rádio', '').replace('fm', '').trim()) &&
                   !cityName.includes(radioLocation);
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
// 🎯 MODO PROPOSTA (NOVO)
// =========================================================================
async function initializePropostaMode() {
    console.log('🏢 Modo Proposta ativado');
    
    // Validar dados básicos
    if (!radioData.radios || radioData.radios.length === 0) {
        throw new Error('Nenhuma rádio encontrada na proposta');
    }
    
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
    
    console.log('📊 Rádios validadas:', radioData.radios.length);
    
    renderInfoProposta();
    await initializeMapProposta();
    renderCidadesProposta();
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

function addRadioMarkerProposta(radio, index, color, adjustedPosition = null) {
    // Usar posição ajustada se fornecida, senão usar posição original
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

function renderInfoProposta() {
    const container = document.getElementById('info-section');
    container.className = 'info-grid proposta'; // Adicionar classe especial
    
    // Calcular Impactos totais (somar campo "impactos" ao invés de PMM)
    const totalImpactos = radioData.radios.reduce((sum, radio) => {
        return sum + (radio.impactos || radio.pmm || 0); // Fallback para PMM se impactos não existir
    }, 0);
    
    // Calcular universo único por cidade
    const universosPorCidade = {};
    radioData.radios.forEach(radio => {
        const cidade = radio.praca;
        if (cidade) {
            if (!universosPorCidade[cidade] || radio.universo > universosPorCidade[cidade]) {
                universosPorCidade[cidade] = radio.universo || 0;
            }
        }
    });
    const universoUnicoTotal = Object.values(universosPorCidade).reduce((sum, val) => sum + val, 0);
    
    const totalImpactosFormatted = totalImpactos ? totalImpactos.toLocaleString() : 'N/A';
    const universoUnicoFormatted = universoUnicoTotal ? universoUnicoTotal.toLocaleString() : 'N/A';
    const totalCidades = radioData.stats?.totalCidades || 0;
    
    // Inicializar array de rádios ativas (todas marcadas por padrão)
    activeRadios = radioData.radios.map((radio, index) => ({
        ...radio,
        index: index,
        active: true
    }));
    
    // Lista de rádios para o card com checkboxes
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
    
    container.innerHTML = `
        <!-- ALCANCE TOTAL -->
        <div class="info-card">
            <h3 class="card-title">🌐 Alcance Total</h3>
            <div class="info-item">
                <span class="info-label">Impactos Totais:</span>
                <span class="info-value">${totalImpactosFormatted}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Universo Único:</span>
                <span class="info-value">${universoUnicoFormatted}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Cidades Únicas:</span>
                <span class="info-value">${totalCidades}</span>
            </div>
        </div>
        
        <!-- LISTA DE RÁDIOS -->
        <div class="info-card" style="position: relative;">
            <h3 class="card-title">📻 Rádios do Plano</h3>
            <span class="radio-count-badge" id="radio-count-badge">${radioData.totalRadios}</span>
            <div class="radios-list">
                ${radiosListHtml}
            </div>
        </div>
    `;
    
    container.style.display = 'grid';
}

function renderCidadesProposta() {
    // Usar apenas cidades únicas (filtrar nomes de rádios)
    const allRealCities = new Set();
    
    // Coletar cidades de todas as rádios, filtrando nomes de rádios
    radioData.radios.forEach(radio => {
        const cities = radio.cidades || [];
        cities.forEach(cidade => {
            if (isRealCity(cidade)) {
                allRealCities.add(cidade);
            }
        });
    });
    
    allCities = Array.from(allRealCities).sort();
    filteredCities = [...allCities];
    
    // CONSTRUIR MAPEAMENTO CIDADE -> RÁDIOS (apenas para cidades reais)
    buildCityRadioMapping();
    
    updateCidadesList();
    setupCitySearch();
    
    // Atualizar contador
    document.getElementById('cidade-count').textContent = allCities.length;
    document.getElementById('cidades-section').style.display = 'block';
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
    
    // Mostrar/ocultar marcadores de rádio
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
    
    // Mostrar/ocultar camadas de cobertura
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
    
    // 🆕 REAJUSTAR ZOOM PARA RÁDIOS ATIVAS
    setTimeout(() => {
        fitMapToActiveCoverage();
    }, 100);
    
    // Atualizar lista de cidades (mostrar apenas cidades das rádios ativas)
    updateCitiesForActiveRadios();
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
            
            const cityName = cidade.split(' - ')[0];
            
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

// =========================================================================
// 📊 ATUALIZAR CONTADOR DE RÁDIOS ATIVAS
// =========================================================================
function updateRadioCount() {
    const activeCount = activeRadios.filter(radio => radio.active).length;
    const badge = document.getElementById('radio-count-badge');
    
    if (badge) {
        badge.textContent = `${activeCount}/${radioData.totalRadios}`;
        
        // Mudança visual baseada na quantidade ativa
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
        const parts = cidade.split(' - ');
        const nome = parts[0];
        const uf = parts[1] || radioData.uf || '';
        
        return `
            <div class="cidade-item" onclick="highlightCity('${cidade}')" title="Clique para localizar no mapa">
                <div class="cidade-info">
                    <span class="cidade-name">${nome}</span>
                    <span class="cidade-uf">${uf}</span>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Lista de cidades atualizada');
}

// =========================================================================
// 🏢 FUNÇÃO PARA ATUALIZAR LISTA DE CIDADES NO MODO PROPOSTA
// =========================================================================
function updateCidadesListProposta() {
    const container = document.getElementById('cidades-list');
    
    if (filteredCities.length === 0) {
        container.innerHTML = '<div class="cidade-item">❌ Nenhuma cidade encontrada</div>';
        return;
    }
    
    container.innerHTML = filteredCities.map(cidade => {
        const parts = cidade.split(' - ');
        const nome = parts[0];
        const uf = parts[1] || '';
        
        // Buscar rádios que cobrem esta cidade
        const radiosQueCobrema = cityRadioMapping[nome] || [];
        
        // Gerar HTML das rádios
        let radiosHtml = '';
        if (radiosQueCobrema.length === 1) {
            // Uma rádio: mostrar expandido
            const radio = radiosQueCobrema[0];
            radiosHtml = `
                <div class="radio-expanded">
                    <img src="${radio.imageUrl}" 
                            alt="${radio.name}"
                            onerror="this.src='https://via.placeholder.com/36x27/${RADIO_COLORS[radio.originalIndex % RADIO_COLORS.length].replace('#', '')}/white?text=FM'">
                    <div class="radio-expanded-info">
                        <div class="radio-expanded-name">${radio.name}</div>
                        <div class="radio-expanded-details">${radio.dial} • ${radio.praca}</div>
                    </div>
                </div>
            `;
        } else if (radiosQueCobrema.length > 1) {
            // Múltiplas rádios: mostrar logos lado a lado com hover
            radiosHtml = `
                <div class="cidade-radios-container" 
                        onmouseenter="expandRadiosList(this, '${nome}')"
                        onmouseleave="collapseRadiosList(this)">
                    <div class="radios-collapsed">
                        ${radiosQueCobrema.slice(0, 3).map(radio => `
                            <img class="radio-logo-mini" 
                                    src="${radio.imageUrl}" 
                                    alt="${radio.name}"
                                    title="${radio.name} ${radio.dial}"
                                    onerror="this.src='https://via.placeholder.com/36x27/${RADIO_COLORS[radio.originalIndex % RADIO_COLORS.length].replace('#', '')}/white?text=FM'">
                        `).join('')}
                        ${radiosQueCobrema.length > 3 ? `<span class="radio-count-extra">+${radiosQueCobrema.length - 3}</span>` : ''}
                    </div>
                    <div class="radios-expanded" style="display: none;">
                        ${radiosQueCobrema.map(radio => `
                            <div class="radio-expanded">
                                <img src="${radio.imageUrl}" 
                                        alt="${radio.name}"
                                        onerror="this.src='https://via.placeholder.com/36x27/${RADIO_COLORS[radio.originalIndex % RADIO_COLORS.length].replace('#', '')}/white?text=FM'">
                                <div class="radio-expanded-info">
                                    <div class="radio-expanded-name">${radio.name}</div>
                                    <div class="radio-expanded-details">${radio.dial} • ${radio.praca}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="cidade-item" onclick="highlightCity('${cidade}')">
                <div class="cidade-info">
                    <span class="cidade-name">${nome}</span>
                    <span class="cidade-uf">${uf}</span>
                </div>
                <div class="cidade-radios">
                    ${radiosHtml}
                </div>
            </div>
        `;
    }).join('');
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

function highlightCity(cityName) {
    const cityBaseName = cityName.split(' - ')[0].toLowerCase();
    
    // Modo individual: usar lógica original
    if (!isPropostaMode) {
        if (window.cityPlacemarkMap && window.cityPlacemarkMap[cityBaseName]) {
            const cityData = window.cityPlacemarkMap[cityBaseName];
            const [lat, lng] = cityData.coordinates;
            
            map.setView([lat, lng], 11);
            
            if (cityMarkers[cityData.markerIndex]) {
                cityMarkers[cityData.markerIndex].openPopup();
                return;
            }
        }
        
        if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
            for (let i = 0; i < radioData.kmlPlacemarks.length; i++) {
                const placemark = radioData.kmlPlacemarks[i];
                const placemarkName = placemark.name.toLowerCase();
                
                if (placemarkName.includes(cityBaseName) || cityBaseName.includes(placemarkName)) {
                    const mappedCity = window.cityPlacemarkMap[placemarkName];
                    if (mappedCity) {
                        const [lat, lng] = mappedCity.coordinates;
                        map.setView([lat, lng], 11);
                        
                        if (cityMarkers[mappedCity.markerIndex]) {
                            cityMarkers[mappedCity.markerIndex].openPopup();
                            return;
                        }
                    }
                }
            }
        }
        
        map.setView([radioData.latitude, radioData.longitude], 8);
    } else {
        // Modo proposta: tentar encontrar a cidade em qualquer rádio
        let cityFound = false;
        
        for (const radio of radioData.radios) {
            if (radio.kmlPlacemarks && radio.kmlPlacemarks.length > 0) {
                for (const placemark of radio.kmlPlacemarks) {
                    const placemarkName = placemark.name.toLowerCase();
                    
                    if (placemarkName.includes(cityBaseName) || cityBaseName.includes(placemarkName)) {
                        const [lat, lng] = placemark.coordinates;
                        map.setView([lat, lng], 11);
                        cityFound = true;
                        break;
                    }
                }
                if (cityFound) break;
            }
        }
        
        // Se não encontrou, centralizar na primeira rádio
        if (!cityFound && radioData.radios.length > 0) {
            const firstRadio = radioData.radios[0];
            map.setView([firstRadio.latitude, firstRadio.longitude], 8);
        }
    }
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
