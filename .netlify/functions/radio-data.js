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
    const { id } = event.queryStringParameters || {};
    
    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID do registro é obrigatório' })
      };
    }

    // MESMO TOKEN usado no sistema de distribuição
    const notionToken = process.env.DistribuicaoHTML;
    if (!notionToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Token do Notion não configurado' })
      };
    }

    console.log('🔍 Buscando rádio no Notion:', id);

    // Buscar dados da página no Notion
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
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
    console.log('✅ Dados recebidos do Notion:', {
      id: notionData.id,
      object: notionData.object,
      propertiesKeys: Object.keys(notionData.properties || {})
    });

    // Mapear propriedades do Notion
    const properties = notionData.properties || {};
    
    // Função helper para extrair valores
    const extractValue = (prop, defaultValue = '', propName = '') => {
      if (!prop) {
        console.log(`❌ Propriedade "${propName}" não encontrada`);
        return defaultValue;
      }
      
      console.log(`✅ Extraindo propriedade "${propName}" tipo: ${prop.type}`);
      
      switch (prop.type) {
        case 'number':
          const numberValue = prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
          console.log(`📊 Valor numérico para "${propName}": ${numberValue}`);
          return numberValue;
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
          console.log(`⚠️ Tipo de propriedade não reconhecido para "${propName}": ${prop.type}`);
          return defaultValue;
      }
    };

    // MAPEAR DADOS BÁSICOS
    const radioData = {
      // Informações básicas
      name: extractValue(properties['Emissora'] || properties['emissora'], 'Rádio Desconhecida', 'Emissora'),
      dial: extractValue(properties['Dial'] || properties['dial'], 'N/A', 'Dial'),
      
      // Coordenadas (fallback caso KML falhe)
      latitude: parseFloat(extractValue(properties['Latitude'] || properties['latitude'], -23.5505, 'Latitude')),
      longitude: parseFloat(extractValue(properties['Longitude'] || properties['longitude'], -46.6333, 'Longitude')),
      
      // Raio de cobertura (fallback)
      radius: parseFloat(extractValue(properties['Raio'] || properties['raio'] || properties['Alcance'], 50, 'Raio')) * 1000,
      
      // NOVO: URL do KML
      kmlUrl: extractValue(properties['KML'] || properties['kml'], '', 'KML'),
      
      // Localização
      region: extractValue(properties['Região'] || properties['regiao'], 'N/A', 'Região'),
      uf: extractValue(properties['UF'] || properties['uf'], 'N/A', 'UF'),
      praca: extractValue(properties['Praça'] || properties['praca'], 'N/A', 'Praça'),
      
      // Técnicas
      universo: parseInt(extractValue(properties['Universo'] || properties['universo'], 0, 'Universo')),
      pmm: parseInt(extractValue(properties['PMM'] || properties['pmm'], 1000, 'PMM')),
      
      // URLs e mídias
      imageUrl: extractValue(properties['Imagem'] || properties['imagem'], 'https://via.placeholder.com/100x75/dc2626/white?text=FM', 'Imagem'),
      
      // Metadata
      source: 'notion',
      notionId: id,
      lastUpdate: new Date().toISOString()
    };

    // PROCESSAR KML SE DISPONÍVEL
    if (radioData.kmlUrl && radioData.kmlUrl.trim()) {
      console.log('🗺️ Processando KML:', radioData.kmlUrl);
      try {
        const kmlData = await processKMLWithFallback(radioData.kmlUrl);
        if (kmlData && kmlData.coordinates && kmlData.coordinates.length > 0) {
          radioData.kmlCoordinates = kmlData.coordinates;
          radioData.kmlBounds = kmlData.bounds;
          radioData.coverageType = 'kml';
          console.log('✅ KML processado com sucesso:', {
            coordCount: kmlData.coordinates.length,
            bounds: kmlData.bounds
          });
        } else {
          console.log('⚠️ KML não contém coordenadas válidas, usando círculo padrão');
          radioData.coverageType = 'circle';
          radioData.kmlError = 'KML vazio ou inválido';
        }
      } catch (error) {
        console.error('❌ Erro ao processar KML:', error);
        radioData.coverageType = 'circle';
        radioData.kmlError = error.message;
      }
    } else {
      console.log('⚠️ Nenhuma URL KML fornecida, usando círculo padrão');
      radioData.coverageType = 'circle';
    }

    // BUSCAR CIDADES
    radioData.cidades = await fetchCitiesFromMultipleSources(radioData, notionToken);

    // Validações básicas
    if (isNaN(radioData.latitude) || isNaN(radioData.longitude)) {
      console.log('⚠️ Coordenadas inválidas, usando São Paulo como padrão');
      radioData.latitude = -23.5505;
      radioData.longitude = -46.6333;
    }

    if (radioData.radius <= 0) {
      console.log('⚠️ Raio inválido, usando 50km como padrão');
      radioData.radius = 50000;
    }

    console.log('📋 Dados finais mapeados:', {
      name: radioData.name,
      dial: radioData.dial,
      coordinates: `${radioData.latitude}, ${radioData.longitude}`,
      coverageType: radioData.coverageType,
      kmlCoordinates: radioData.kmlCoordinates ? radioData.kmlCoordinates.length : 0,
      cidadesCount: radioData.cidades.length,
      kmlError: radioData.kmlError || 'N/A'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(radioData)
    };

  } catch (error) {
    console.error('💥 Erro na função (catch geral):', error);
    console.error('📋 Stack trace:', error.stack);
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

// PROCESSAR KML COM MÚLTIPLAS TENTATIVAS
async function processKMLWithFallback(driveUrl) {
  console.log('🔄 Iniciando processamento KML:', driveUrl);
  
  const attempts = [
    () => processKMLMethod1(driveUrl), // Método original
    () => processKMLMethod2(driveUrl), // Método alternativo  
    () => processKMLMethod3(driveUrl), // Método com proxy
  ];

  let lastError;
  
  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log(`🔄 Tentativa ${i + 1} de processar KML`);
      const result = await attempts[i]();
      if (result && result.coordinates && result.coordinates.length > 0) {
        console.log(`✅ Sucesso na tentativa ${i + 1}`);
        return result;
      } else {
        console.log(`⚠️ Tentativa ${i + 1} retornou dados vazios`);
      }
    } catch (error) {
      console.error(`❌ Tentativa ${i + 1} falhou:`, error.message);
      lastError = error;
      
      // Pequena pausa entre tentativas
      if (i < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error('Todas as tentativas de processar KML falharam');
}

// MÉTODO 1: Download direto via Google Drive
async function processKMLMethod1(driveUrl) {
  console.log('🔄 Método 1: Download direto do Google Drive');
  
  const directUrl = convertGoogleDriveUrl(driveUrl);
  console.log('🔗 URL direta:', directUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
  
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
    console.log('📄 KML baixado, tamanho:', kmlText.length);
    
    if (kmlText.length < 50) {
      throw new Error('KML muito pequeno ou vazio');
    }
    
    // Verificar se não é página de erro do Google
    if (kmlText.includes('<!DOCTYPE html>') || kmlText.includes('<html')) {
      throw new Error('Recebido HTML ao invés de KML - arquivo pode não estar público');
    }
    
    return parseKMLCoordinates(kmlText);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// MÉTODO 2: URL alternativa docs.google.com
async function processKMLMethod2(driveUrl) {
  console.log('🔄 Método 2: URL alternativa docs.google.com');
  
  const fileId = extractFileId(driveUrl);
  const altUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
  
  console.log('🔗 URL alternativa:', altUrl);
  
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
    
    // Verificar se não é página de erro
    if (kmlText.includes('<!DOCTYPE html>') || kmlText.includes('<html')) {
      throw new Error('Recebido HTML ao invés de KML');
    }
    
    return parseKMLCoordinates(kmlText);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// MÉTODO 3: Usando proxy CORS
async function processKMLMethod3(driveUrl) {
  console.log('🔄 Método 3: Proxy CORS');
  
  const directUrl = convertGoogleDriveUrl(driveUrl);
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;
  
  console.log('🔗 URL com proxy:', proxyUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // Mais tempo para proxy
  
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
    
    // Verificar se não é HTML
    if (data.contents.includes('<!DOCTYPE html>') || data.contents.includes('<html')) {
      throw new Error('Proxy retornou HTML ao invés de KML');
    }
    
    return parseKMLCoordinates(data.contents);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Extrair ID do arquivo do Google Drive
function extractFileId(url) {
  console.log('🔍 Extraindo File ID de:', url);
  
  // Diferentes padrões de URL do Google Drive
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /open\?id=([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log('✅ File ID encontrado:', match[1]);
      return match[1];
    }
  }
  
  throw new Error('Não foi possível extrair ID do arquivo da URL');
}

// Converter URL do Google Drive para download direto
function convertGoogleDriveUrl(url) {
  const fileId = extractFileId(url);
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Parsear coordenadas do KML (melhorado)
function parseKMLCoordinates(kmlText) {
  console.log('📊 Iniciando parsing do KML...');
  
  const coordinates = [];
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  // Verificar se é realmente KML
  if (!kmlText.includes('<kml') && !kmlText.includes('<coordinates') && !kmlText.includes('<?xml')) {
    throw new Error('Arquivo não parece ser KML válido');
  }
  
  // Remover espaços e quebras de linha desnecessárias
  const cleanKml = kmlText.replace(/\s+/g, ' ').trim();
  
  // Regex melhorado para encontrar coordenadas no KML
  const coordRegex = /<coordinates[^>]*>(.*?)<\/coordinates>/gi;
  let match;
  let totalPoints = 0;
  
  while ((match = coordRegex.exec(cleanKml)) !== null) {
    const coordText = match[1].trim();
    console.log('🎯 Bloco de coordenadas encontrado, tamanho:', coordText.length);
    
    if (coordText.length === 0) {
      console.log('⚠️ Bloco de coordenadas vazio, pulando...');
      continue;
    }
    
    // Parsear coordenadas (formato: lng,lat,alt lng,lat,alt ...)
    const coordPairs = coordText
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(pair => pair.trim() && pair.includes(','));
    
    console.log(`📍 Encontrados ${coordPairs.length} pares de coordenadas neste bloco`);
    
    const polygonCoords = [];
    
    for (const pair of coordPairs) {
      const parts = pair.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        // Validar coordenadas (Brasil: lat -35 a 5, lng -75 a -30 aproximadamente)
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          
          polygonCoords.push([lat, lng]); // Leaflet usa [lat, lng]
          totalPoints++;
          
          // Atualizar bounds
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        } else {
          console.log(`⚠️ Coordenada inválida ignorada: ${lat}, ${lng}`);
        }
      }
    }
    
    if (polygonCoords.length > 2) { // Mínimo 3 pontos para um polígono válido
      coordinates.push(polygonCoords);
      console.log(`✅ Polígono adicionado com ${polygonCoords.length} pontos`);
    } else {
      console.log(`⚠️ Polígono com poucos pontos ignorado: ${polygonCoords.length} pontos`);
    }
  }
  
  console.log('📊 Parsing concluído:', {
    polygonCount: coordinates.length,
    totalPoints: totalPoints,
    bounds: {
      north: maxLat === -Infinity ? 0 : maxLat,
      south: minLat === Infinity ? 0 : minLat,
      east: maxLng === -Infinity ? 0 : maxLng,
      west: minLng === Infinity ? 0 : minLng
    }
  });
  
  if (coordinates.length === 0) {
    throw new Error('Nenhuma coordenada válida encontrada no KML');
  }
  
  return {
    coordinates,
    bounds: {
      north: maxLat === -Infinity ? 0 : maxLat,
      south: minLat === Infinity ? 0 : minLat,
      east: maxLng === -Infinity ? 0 : maxLng,
      west: minLng === Infinity ? 0 : minLng
    }
  };
}

// BUSCAR CIDADES DE MÚLTIPLAS FONTES
async function fetchCitiesFromMultipleSources(radioData, notionToken) {
  console.log('🔍 Buscando cidades de múltiplas fontes...');
  
  try {
    const cities = await tryFetchFromNotionCoverageField(radioData.notionId, notionToken);
    if (cities && cities.length > 0) {
      console.log('✅ Cidades encontradas no campo Cobertura do Notion');
      return cities;
    }
  } catch (error) {
    console.log('⚠️ Não foi possível buscar do campo Cobertura:', error.message);
  }
  
  const fallbackCities = generateCitiesByRegion(radioData.region, radioData.uf, radioData.praca);
  console.log(`🏙️ Usando ${fallbackCities.length} cidades como fallback para ${radioData.region}/${radioData.uf}`);
  
  return fallbackCities;
}

async function tryFetchFromNotionCoverageField(pageId, token) {
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const coberturaField = data.properties?.['Cobertura'];
      
      if (coberturaField?.rich_text?.[0]?.text?.content) {
        const fullText = coberturaField.rich_text[0].text.content;
        
        if (!fullText.includes('Ver mapa de cobertura') && !fullText.includes('http')) {
          const cities = fullText
            .split(/[,\n;]/)
            .map(city => city.trim())
            .filter(city => city.length > 0)
            .map(city => {
              if (!city.includes(' - ')) {
                return `${city} - ${data.properties?.UF?.rich_text?.[0]?.text?.content || 'BR'}`;
              }
              return city;
            });
          
          if (cities.length > 0) {
            return cities;
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Erro ao buscar campo Cobertura:', error);
  }
  
  return null;
}

function generateCitiesByRegion(region, uf, praca) {
  const citiesByRegion = {
    'Sul': {
      'SC': [
        'Florianópolis - SC', 'São José - SC', 'Palhoça - SC', 'Biguaçu - SC',
        'Blumenau - SC', 'Joinville - SC', 'Chapecó - SC', 'Criciúma - SC',
        'Itajaí - SC', 'Lages - SC', 'Balneário Camboriú - SC', 'Tubarão - SC'
      ],
      'RS': [
        'Porto Alegre - RS', 'Caxias do Sul - RS', 'Pelotas - RS', 'Santa Maria - RS',
        'Gravataí - RS', 'Viamão - RS', 'Novo Hamburgo - RS', 'São Leopoldo - RS'
      ],
      'PR': [
        'Curitiba - PR', 'Londrina - PR', 'Maringá - PR', 'Foz do Iguaçu - PR',
        'São José dos Pinhais - PR', 'Cascavel - PR', 'Guarapuava - PR'
      ]
    },
    'Sudeste': {
      'SP': [
        'São Paulo - SP', 'Guarulhos - SP', 'Campinas - SP', 'São Bernardo do Campo - SP',
        'Santo André - SP', 'Osasco - SP', 'São José dos Campos - SP', 'Ribeirão Preto - SP'
      ],
      'RJ': [
        'Rio de Janeiro - RJ', 'São Gonçalo - RJ', 'Duque de Caxias - RJ', 'Nova Iguaçu - RJ',
        'Niterói - RJ', 'Campos dos Goytacazes - RJ', 'Petrópolis - RJ'
      ],
      'MG': [
        'Belo Horizonte - MG', 'Uberlândia - MG', 'Contagem - MG', 'Juiz de Fora - MG',
        'Betim - MG', 'Montes Claros - MG', 'Ribeirão das Neves - MG'
      ]
    },
    'Nordeste': {
      'PE': [
        'Recife - PE', 'Jaboatão dos Guararapes - PE', 'Olinda - PE', 'Caruaru - PE'
      ],
      'BA': [
        'Salvador - BA', 'Feira de Santana - BA', 'Vitória da Conquista - BA', 'Camaçari - BA'
      ],
      'CE': [
        'Fortaleza - CE', 'Caucaia - CE', 'Juazeiro do Norte - CE', 'Maracanaú - CE'
      ]
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
