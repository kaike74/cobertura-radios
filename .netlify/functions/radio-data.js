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

    // NOVO: PROCESSAR KML SE DISPONÍVEL
    if (radioData.kmlUrl) {
      console.log('🗺️ Processando KML:', radioData.kmlUrl);
      try {
        const kmlData = await processKML(radioData.kmlUrl);
        if (kmlData.coordinates && kmlData.coordinates.length > 0) {
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
        }
      } catch (error) {
        console.error('❌ Erro ao processar KML:', error);
        radioData.coverageType = 'circle';
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
      cidadesCount: radioData.cidades.length
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

// NOVA FUNÇÃO: Processar KML do Google Drive
async function processKML(driveUrl) {
  try {
    console.log('🔄 Convertendo URL do Google Drive:', driveUrl);
    
    // Converter URL do Google Drive para download direto
    const directUrl = convertGoogleDriveUrl(driveUrl);
    console.log('🔗 URL direta:', directUrl);
    
    // Baixar o KML
    const response = await fetch(directUrl);
    if (!response.ok) {
      throw new Error(`Erro ao baixar KML: ${response.status}`);
    }
    
    const kmlText = await response.text();
    console.log('📄 KML baixado, tamanho:', kmlText.length);
    
    // Parsear coordenadas do KML
    return parseKMLCoordinates(kmlText);
    
  } catch (error) {
    console.error('❌ Erro ao processar KML:', error);
    throw error;
  }
}

// Converter URL do Google Drive para download direto
function convertGoogleDriveUrl(url) {
  // Extrair ID do arquivo da URL
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (!fileIdMatch) {
    throw new Error('URL do Google Drive inválida');
  }
  
  const fileId = fileIdMatch[1];
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Parsear coordenadas do KML
function parseKMLCoordinates(kmlText) {
  const coordinates = [];
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  // Regex para encontrar coordenadas no KML
  const coordRegex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match;
  
  while ((match = coordRegex.exec(kmlText)) !== null) {
    const coordText = match[1].trim();
    console.log('🎯 Coordenadas encontradas:', coordText.substring(0, 100) + '...');
    
    // Parsear coordenadas (formato: lng,lat,alt lng,lat,alt ...)
    const coordPairs = coordText.split(/\s+/).filter(pair => pair.trim());
    
    const polygonCoords = [];
    
    for (const pair of coordPairs) {
      const parts = pair.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          polygonCoords.push([lat, lng]); // Leaflet usa [lat, lng]
          
          // Atualizar bounds
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }
      }
    }
    
    if (polygonCoords.length > 0) {
      coordinates.push(polygonCoords);
    }
  }
  
  console.log('📊 Parsing concluído:', {
    polygonCount: coordinates.length,
    totalPoints: coordinates.reduce((sum, poly) => sum + poly.length, 0)
  });
  
  return {
    coordinates,
    bounds: coordinates.length > 0 ? {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    } : null
  };
}

// FUNÇÃO EXISTENTE: Buscar cidades de múltiplas fontes
async function fetchCitiesFromMultipleSources(radioData, notionToken) {
  console.log('🔍 Buscando cidades de múltiplas fontes...');
  
  // Estratégia 1: Tentar buscar do campo original de cobertura
  try {
    const cities = await tryFetchFromNotionCoverageField(radioData.notionId, notionToken);
    if (cities && cities.length > 0) {
      console.log('✅ Cidades encontradas no campo Cobertura do Notion');
      return cities;
    }
  } catch (error) {
    console.log('⚠️ Não foi possível buscar do campo Cobertura:', error.message);
  }
  
  // Estratégia 2: Gerar lista baseada na região/UF (fallback)
  const fallbackCities = generateCitiesByRegion(radioData.region, radioData.uf, radioData.praca);
  console.log(`🏙️ Usando ${fallbackCities.length} cidades como fallback para ${radioData.region}/${radioData.uf}`);
  
  return fallbackCities;
}

// Tentar buscar do campo Cobertura original
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

// Gerar cidades baseado na região/UF
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
