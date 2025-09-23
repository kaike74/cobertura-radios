exports.handler = async (event, context) => {
  // Permitir CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Responder OPTIONS para CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { id, proposta, database } = event.queryStringParameters || {};
    
    // Detectar tipo de consulta
    const isProposta = proposta || database;
    const queryId = id || isProposta;
    
    if (!queryId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID do registro ou ID da proposta é obrigatório' })
      };
    }

    // TOKEN do Notion
    const notionToken = process.env.DistribuicaoHTML;
    if (!notionToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Token do Notion não configurado' })
      };
    }

    if (isProposta) {
      console.log('🎯 Modo PROPOSTA - Buscando todas as rádios do database:', queryId);
      return await handlePropostaMode(queryId, notionToken, headers);
    } else {
      console.log('🔍 Modo INDIVIDUAL - Buscando rádio específica:', queryId);
      return await handleIndividualMode(queryId, notionToken, headers);
    }

  } catch (error) {
    console.error('💥 Erro na função:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message
      })
    };
  }
};

// FUNÇÃO PARA MODO PROPOSTA (MÚLTIPLAS RÁDIOS)
async function handlePropostaMode(databaseId, notionToken, headers) {
  try {
    console.log('📊 Consultando database:', databaseId);
    
    const allRadios = await queryNotionDatabase(databaseId, notionToken);
    
    if (!allRadios || allRadios.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Nenhuma rádio encontrada nesta proposta',
          type: 'proposta',
          radios: []
        })
      };
    }

    console.log(`✅ Encontradas ${allRadios.length} rádios na proposta`);

    // Processar cada rádio
    const processedRadios = [];
    let totalUniverso = 0;
    let totalPMM = 0;
    let totalImpactos = 0;
    const allCidades = new Set();
    const regions = new Set();
    const ufs = new Set();

    for (const radioPage of allRadios) {
      try {
        const radioData = await processRadioData(radioPage, notionToken);
        if (radioData) {
          processedRadios.push(radioData);
          
          // Agregar estatísticas
          totalUniverso += radioData.universo || 0;
          totalPMM += radioData.pmm || 0;
          totalImpactos += radioData.impactos || 0;
          
          // Coletar cidades únicas (filtro melhorado)
          if (radioData.cidades) {
            radioData.cidades.forEach(cidade => {
              if (isValidCity(cidade)) {
                allCidades.add(cidade);
              }
            });
          }
          
          regions.add(radioData.region);
          ufs.add(radioData.uf);
        }
      } catch (error) {
        console.error(`⚠️ Erro ao processar rádio ${radioPage.id}:`, error);
      }
    }

    // Preparar resposta da proposta
    const propostaData = {
      type: 'proposta',
      databaseId: databaseId,
      totalRadios: processedRadios.length,
      radios: processedRadios,
      stats: {
        totalUniverso: totalUniverso,
        totalPMM: totalPMM,
        totalImpactos: totalImpactos,
        totalCidades: allCidades.size,
        regions: Array.from(regions),
        ufs: Array.from(ufs)
      },
      allCidades: Array.from(allCidades).sort(),
      lastUpdate: new Date().toISOString(),
      source: 'notion-proposta'
    };

    console.log('📋 Proposta processada:', {
      radios: propostaData.totalRadios,
      universo: propostaData.stats.totalUniverso.toLocaleString(),
      pmm: propostaData.stats.totalPMM.toLocaleString(),
      impactos: propostaData.stats.totalImpactos.toLocaleString(),
      cidades: propostaData.stats.totalCidades
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(propostaData)
    };

  } catch (error) {
    console.error('❌ Erro no modo proposta:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro ao processar proposta',
        details: error.message
      })
    };
  }
}

// FUNÇÃO PARA MODO INDIVIDUAL
async function handleIndividualMode(radioId, notionToken, headers) {
  console.log('🔍 Buscando rádio individual no Notion:', radioId);

  const response = await fetch(`https://api.notion.com/v1/pages/${radioId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  });

  console.log('📡 Status da resposta Notion:', response.status);

  if (!response.ok) {
    console.error('❌ Erro da API Notion:', response.status, response.statusText);
    
    let errorDetails = response.statusText;
    try {
      const errorBody = await response.text();
      console.log('📄 Corpo do erro:', errorBody);
      errorDetails = errorBody;
    } catch (e) {
      console.log('⚠️ Não foi possível ler corpo do erro');
    }
    
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify({ 
        error: `Erro ao buscar dados do Notion: ${response.status}`,
        details: errorDetails
      })
    };
  }

  const notionData = await response.json();
  const radioData = await processRadioData(notionData, notionToken);
  
  radioData.type = 'individual';

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(radioData)
  };
}

// FUNÇÃO PARA CONSULTAR DATABASE DO NOTION
async function queryNotionDatabase(databaseId, notionToken) {
  const allResults = [];
  let hasMore = true;
  let nextCursor = null;

  while (hasMore) {
    const queryPayload = {
      page_size: 100,
      filter: {
        property: "Emissora",
        title: {
          is_not_empty: true
        }
      }
    };

    if (nextCursor) {
      queryPayload.start_cursor = nextCursor;
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryPayload)
    });

    if (!response.ok) {
      throw new Error(`Erro ao consultar database: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    allResults.push(...data.results);
    
    hasMore = data.has_more;
    nextCursor = data.next_cursor;

    console.log(`📄 Página processada: ${data.results.length} rádios. Total: ${allResults.length}`);
  }

  return allResults;
}

// FUNÇÃO MELHORADA PARA PROCESSAR DADOS DE UMA RÁDIO
async function processRadioData(notionData, notionToken) {
  console.log('✅ Processando rádio:', {
    id: notionData.id,
    object: notionData.object,
    propertiesKeys: Object.keys(notionData.properties || {})
  });

  const properties = notionData.properties || {};
  
  // 🔧 BUSCA MELHORADA DO CAMPO IMPACTOS
  const impactosProperty = findImpactosProperty(properties);
  
  // Função helper para extrair valores (simplificada)
  const extractValue = (prop, defaultValue = '', propName = '') => {
    if (!prop) {
      return defaultValue;
    }
    
    switch (prop.type) {
      case 'number':
        return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
      case 'title':
        return prop.title?.[0]?.text?.content || defaultValue;
      case 'rich_text':
        return prop.rich_text?.[0]?.text?.content || defaultValue;
      case 'date':
        return prop.date?.start || defaultValue;
      case 'multi_select':
        return prop.multi_select?.map(item => item.name).join(',') || defaultValue;
      case 'select':
        return prop.select?.name || defaultValue;
      case 'url':
        return prop.url || defaultValue;
      default:
        return defaultValue;
    }
  };

  // MAPEAR DADOS BÁSICOS
  const radioData = {
    // Informações básicas
    name: extractValue(properties['Emissora'] || properties['emissora'], 'Rádio Desconhecida', 'Emissora'),
    dial: extractValue(properties['Dial'] || properties['dial'], 'N/A', 'Dial'),
    
    // Coordenadas
    latitude: parseFloat(extractValue(properties['Latitude'] || properties['latitude'], -23.5505, 'Latitude')),
    longitude: parseFloat(extractValue(properties['Longitude'] || properties['longitude'], -46.6333, 'Longitude')),
    
    // Raio de cobertura
    radius: parseFloat(extractValue(properties['Raio'] || properties['raio'] || properties['Alcance'], 50, 'Raio')) * 1000,
    
    // URL do KML
    kmlUrl: extractValue(properties['KML'] || properties['kml'], '', 'KML'),
    
    // Localização
    region: extractValue(properties['Região'] || properties['regiao'], 'N/A', 'Região'),
    uf: extractValue(properties['UF'] || properties['uf'], 'N/A', 'UF'),
    praca: extractValue(properties['Praça'] || properties['praca'], 'N/A', 'Praça'),
    
    // Técnicas
    universo: parseInt(extractValue(properties['Universo'] || properties['universo'], 0, 'Universo')),
    pmm: parseInt(extractValue(properties['PMM'] || properties['pmm'], 1000, 'PMM')),
    
    // 🎯 IMPACTOS CORRIGIDO
    impactos: parseInt(extractValue(impactosProperty, 0, 'Impactos')),
    
    // URLs e mídias
    imageUrl: extractValue(properties['Imagem'] || properties['imagem'], 'https://via.placeholder.com/100x75/dc2626/white?text=FM', 'Imagem'),
    
    // Metadata
    source: 'notion',
    notionId: notionData.id,
    lastUpdate: new Date().toISOString()
  };

  console.log('📊 Valores extraídos:', {
    name: radioData.name,
    dial: radioData.dial,
    universo: radioData.universo,
    pmm: radioData.pmm,
    impactos: radioData.impactos
  });

  // PROCESSAR KML SE DISPONÍVEL
  if (radioData.kmlUrl && radioData.kmlUrl.trim()) {
    console.log('🗺️ Processando KML:', radioData.kmlUrl);
    try {
      const kmlData = await processKMLWithFallback(radioData.kmlUrl);
      if (kmlData && (kmlData.coordinates.length > 0 || kmlData.placemarks.length > 0)) {
        radioData.kmlCoordinates = kmlData.coordinates;
        radioData.kmlPlacemarks = kmlData.placemarks;
        radioData.kmlBounds = kmlData.bounds;
        radioData.coverageType = 'kml';
        
        if (kmlData.imageUrl) {
          radioData.imageUrl = kmlData.imageUrl;
          radioData.imageSource = 'kml';
        }
      } else {
        radioData.coverageType = 'circle';
        radioData.kmlError = 'KML vazio ou inválido';
      }
    } catch (error) {
      console.error('❌ Erro ao processar KML:', error);
      radioData.coverageType = 'circle';
      radioData.kmlError = error.message;
    }
  } else {
    radioData.coverageType = 'circle';
  }

  // BUSCAR CIDADES (filtro melhorado)
  radioData.cidades = await fetchCitiesFromMultipleSources(radioData, notionToken);

  console.log('🏙️ Cidades encontradas:', {
    total: radioData.cidades ? radioData.cidades.length : 0,
    amostra: radioData.cidades ? radioData.cidades.slice(0, 5) : []
  });

  // Validações básicas
  if (isNaN(radioData.latitude) || isNaN(radioData.longitude)) {
    radioData.latitude = -23.5505;
    radioData.longitude = -46.6333;
  }

  if (radioData.radius <= 0) {
    radioData.radius = 50000;
  }

  return radioData;
}

// 🔍 FUNÇÃO MELHORADA PARA ENCONTRAR CAMPO IMPACTOS
function findImpactosProperty(properties) {
  console.log('🔍 Procurando campo Impactos...');
  console.log('📋 Propriedades disponíveis:', Object.keys(properties));
  
  // Lista de possíveis nomes para o campo Impactos
  const possibleNames = [
    'Impactos', 'impactos', 'IMPACTOS',
    'Impacto', 'impacto', 'IMPACTO',
    'Impact', 'impact', 'IMPACT',
    'Impacts', 'impacts', 'IMPACTS'
  ];
  
  for (const name of possibleNames) {
    if (properties[name]) {
      console.log(`✅ Campo Impactos encontrado como: "${name}"`);
      console.log('📊 Valor do campo:', properties[name]);
      return properties[name];
    }
  }
  
  // Se não encontrou, procurar por campos que contenham a palavra "impacto"
  for (const [key, value] of Object.entries(properties)) {
    if (key.toLowerCase().includes('impacto')) {
      console.log(`✅ Campo similar encontrado: "${key}"`);
      console.log('📊 Valor do campo:', value);
      return value;
    }
  }
  
  console.log('❌ Campo Impactos não encontrado');
  return null;
}

// 🏙️ FUNÇÃO MELHORADA PARA VALIDAR CIDADES (MENOS RESTRITIVA)
function isValidCity(cityName) {
  if (!cityName || typeof cityName !== 'string') return false;
  
  const cityNameTrim = cityName.trim();
  
  // Filtros básicos (menos restritivos)
  if (cityNameTrim.length < 2) return false;
  if (cityNameTrim.length > 80) return false; // Aumentado de 50 para 80
  
  const lowerCityName = cityNameTrim.toLowerCase();
  
  // Rejeitar apenas padrões óbvios de não-cidade
  const obviousRejects = [
    /^\d+[\.,]\d+$/, // Frequências: 107.3, 90.5
    /^www\.|\.com|\.br|http|@/, // URLs e emails
    /^\d+$/, // Apenas números
    /^(fm|am|radio|rádio|stereo|mix|hits|music|station)$/i // Palavras isoladas de rádio
  ];
  
  for (const pattern of obviousRejects) {
    if (pattern.test(cityNameTrim)) {
      return false;
    }
  }
  
  console.log(`✅ Cidade aceita: "${cityName}"`);
  return true;
}

// FUNÇÕES DE KML MANTIDAS (sem alterações grandes)
async function processKMLWithFallback(driveUrl) {
  console.log('🔄 Iniciando processamento KML:', driveUrl);
  
  const attempts = [
    () => processKMLMethod1(driveUrl),
    () => processKMLMethod2(driveUrl),
    () => processKMLMethod3(driveUrl),
  ];

  let lastError;
  
  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = await attempts[i]();
      if (result && (result.coordinates.length > 0 || result.placemarks.length > 0 || result.imageUrl)) {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (i < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error('Todas as tentativas de processar KML falharam');
}

async function processKMLMethod1(driveUrl) {
  const directUrl = convertGoogleDriveUrl(driveUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/vnd.google-earth.kml+xml,application/xml,text/xml,text/plain,*/*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const kmlText = await response.text();
    
    if (kmlText.length < 50) {
      throw new Error('KML muito pequeno ou vazio');
    }
    
    if (kmlText.includes('<!DOCTYPE html>') || kmlText.includes('<html')) {
      throw new Error('Recebido HTML ao invés de KML - arquivo pode não estar público');
    }
    
    return parseKMLContent(kmlText);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function processKMLMethod2(driveUrl) {
  const fileId = extractFileId(driveUrl);
  const altUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(altUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const kmlText = await response.text();
    
    if (kmlText.includes('<!DOCTYPE html>') || kmlText.includes('<html')) {
      throw new Error('Recebido HTML ao invés de KML');
    }
    
    return parseKMLContent(kmlText);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function processKMLMethod3(driveUrl) {
  const directUrl = convertGoogleDriveUrl(driveUrl);
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch(proxyUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Proxy falhou: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.contents) {
      throw new Error('Proxy não retornou conteúdo');
    }
    
    if (data.contents.includes('<!DOCTYPE html>') || data.contents.includes('<html')) {
      throw new Error('Proxy retornou HTML ao invés de KML');
    }
    
    return parseKMLContent(data.contents);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function extractFileId(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /open\?id=([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  throw new Error('Não foi possível extrair ID do arquivo da URL');
}

function convertGoogleDriveUrl(url) {
  const fileId = extractFileId(url);
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function parseKMLContent(kmlText) {
  const polygons = [];
  const placemarks = [];
  let imageUrl = null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  if (!kmlText.includes('<kml') && !kmlText.includes('<coordinates') && !kmlText.includes('<?xml')) {
    throw new Error('Arquivo não parece ser KML válido');
  }
  
  // Extrair URL da imagem
  const styleRegex = /<Style[^>]*id\s*=\s*["']([^"']*)["'][^>]*>(.*?)<\/Style>/gsi;
  let styleMatch;
  
  while ((styleMatch = styleRegex.exec(kmlText)) !== null) {
    const styleContent = styleMatch[2];
    const iconMatch = styleContent.match(/<IconStyle[^>]*>.*?<Icon[^>]*>.*?<href[^>]*>(.*?)<\/href>.*?<\/Icon>.*?<\/IconStyle>/si);
    
    if (iconMatch) {
      let foundImageUrl = iconMatch[1].trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      if (foundImageUrl.includes('http') && 
          (foundImageUrl.includes('appsheet.com') || 
           foundImageUrl.includes('googleapis.com') || 
           foundImageUrl.includes('drive.google.com'))) {
        imageUrl = foundImageUrl;
        break;
      }
    }
  }
  
  const updateBounds = (lat, lng) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  };
  
  // Processar polígonos
  const coordRegex = /<coordinates[^>]*>(.*?)<\/coordinates>/gi;
  let match;
  
  while ((match = coordRegex.exec(kmlText)) !== null) {
    const coordText = match[1].trim();
    if (coordText.length === 0) continue;
    
    const coordPairs = coordText
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(pair => pair.trim() && pair.includes(','));
    
    const polygonCoords = [];
    
    for (const pair of coordPairs) {
      const parts = pair.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          polygonCoords.push([lat, lng]);
          updateBounds(lat, lng);
        }
      }
    }
    
    if (polygonCoords.length > 2) {
      polygons.push(polygonCoords);
    }
  }
  
  // Processar placemarks
  const placemarkRegex = /<Placemark[^>]*>(.*?)<\/Placemark>/gsi;
  let placemarkMatch;
  
  while ((placemarkMatch = placemarkRegex.exec(kmlText)) !== null) {
    const placemarkContent = placemarkMatch[1];
    
    const nameMatch = placemarkContent.match(/<name[^>]*>(.*?)<\/name>/i);
    const name = nameMatch ? nameMatch[1].trim() : 'Cidade';
    
    const descMatch = placemarkContent.match(/<description[^>]*>(.*?)<\/description>/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    const pointMatch = placemarkContent.match(/<Point[^>]*>.*?<coordinates[^>]*>(.*?)<\/coordinates>.*?<\/Point>/si);
    
    if (pointMatch) {
      const coordText = pointMatch[1].trim();
      const parts = coordText.split(',');
      
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          
          placemarks.push({
            name: name,
            description: description,
            coordinates: [lat, lng]
          });
          
          updateBounds(lat, lng);
        }
      }
    }
  }
  
  return {
    coordinates: polygons,
    placemarks: placemarks,
    imageUrl: imageUrl,
    bounds: {
      north: maxLat === -Infinity ? 0 : maxLat,
      south: minLat === Infinity ? 0 : minLat,
      east: maxLng === -Infinity ? 0 : maxLng,
      west: minLng === Infinity ? 0 : minLng
    }
  };
}

async function fetchCitiesFromMultipleSources(radioData, notionToken) {
  // Priorizar KML placemarks
  if (radioData.kmlPlacemarks && radioData.kmlPlacemarks.length > 0) {
    const kmlCities = radioData.kmlPlacemarks
      .map(placemark => {
        const cityName = placemark.name;
        if (cityName.includes(' - ')) {
          return cityName;
        }
        return `${cityName} - ${radioData.uf}`;
      })
      .filter(cidade => isValidCity(cidade)); // Aplicar filtro melhorado
    
    return kmlCities;
  }
  
  // Fallback por região
  return generateCitiesByRegion(radioData.region, radioData.uf, radioData.praca);
}

function generateCitiesByRegion(region, uf, praca) {
  const citiesByRegion = {
    'Sul': {
      'SC': ['Florianópolis - SC', 'São José - SC', 'Palhoça - SC', 'Biguaçu - SC', 'Blumenau - SC', 'Joinville - SC'],
      'RS': ['Porto Alegre - RS', 'Caxias do Sul - RS', 'Pelotas - RS', 'Santa Maria - RS'],
      'PR': ['Curitiba - PR', 'Londrina - PR', 'Maringá - PR', 'Foz do Iguaçu - PR']
    },
    'Sudeste': {
      'SP': ['São Paulo - SP', 'Guarulhos - SP', 'Campinas - SP', 'Santos - SP'],
      'RJ': ['Rio de Janeiro - RJ', 'São Gonçalo - RJ', 'Duque de Caxias - RJ', 'Nova Iguaçu - RJ'],
      'MG': ['Belo Horizonte - MG', 'Uberlândia - MG', 'Contagem - MG', 'Juiz de Fora - MG']
    },
    'Nordeste': {
      'PE': ['Recife - PE', 'Jaboatão dos Guararapes - PE', 'Olinda - PE', 'Caruaru - PE'],
      'BA': ['Salvador - BA', 'Feira de Santana - BA', 'Vitória da Conquista - BA', 'Camaçari - BA'],
      'CE': ['Fortaleza - CE', 'Caucaia - CE', 'Juazeiro do Norte - CE', 'Maracanaú - CE']
    }
  };
  
  const regionCities = citiesByRegion[region];
  if (regionCities && regionCities[uf]) {
    let cities = [...regionCities[uf]];
    const pracaFormatted = `${praca} - ${uf}`;
    if (!cities.includes(pracaFormatted)) {
      cities.unshift(pracaFormatted);
    }
    return cities;
  }
  
  return [`${praca} - ${uf}`];
}
