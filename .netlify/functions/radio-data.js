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

    // Buscar dados da página no Notion (MESMO CÓDIGO da distribuição)
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

    // Mapear propriedades do Notion (SEGUINDO PADRÃO da distribuição)
    const properties = notionData.properties || {};
    
    // Função helper para extrair valores (MESMA LÓGICA da distribuição)
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
        default:
          console.log(`⚠️ Tipo de propriedade não reconhecido para "${propName}": ${prop.type}`);
          return defaultValue;
      }
    };

    // MAPEAR DADOS ESPECÍFICOS PARA COBERTURA
    const radioData = {
      // Informações básicas
      name: extractValue(properties['Emissora'] || properties['emissora'], 'Rádio Desconhecida', 'Emissora'),
      dial: extractValue(properties['Dial'] || properties['dial'], 'N/A', 'Dial'),
      
      // Coordenadas (CRÍTICO para o mapa)
      latitude: parseFloat(extractValue(properties['Latitude'] || properties['latitude'], -23.5505, 'Latitude')),
      longitude: parseFloat(extractValue(properties['Longitude'] || properties['longitude'], -46.6333, 'Longitude')),
      
      // Raio de cobertura (converter para metros se necessário)
      radius: parseFloat(extractValue(properties['Raio'] || properties['raio'] || properties['Alcance'], 50, 'Raio')) * 1000,
      
      // Localização
      region: extractValue(properties['Região'] || properties['regiao'], 'N/A', 'Região'),
      uf: extractValue(properties['UF'] || properties['uf'], 'N/A', 'UF'),
      praca: extractValue(properties['Praça'] || properties['praca'], 'N/A', 'Praça'),
      
      // Técnicas (sem classe)
      universo: parseInt(extractValue(properties['Universo'] || properties['universo'], 0, 'Universo')),
      pmm: parseInt(extractValue(properties['PMM'] || properties['pmm'], 1000, 'PMM')),
      
      // URLs e mídias
      imageUrl: extractValue(properties['Imagem'] || properties['imagem'], 'https://via.placeholder.com/100x75/dc2626/white?text=FM', 'Imagem'),
      
      // Metadata
      source: 'notion',
      notionId: id,
      lastUpdate: new Date().toISOString()
    };

    // BUSCAR CIDADES DE FONTES ALTERNATIVAS
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
      radius: `${radioData.radius / 1000}km`,
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

// NOVA FUNÇÃO: Buscar cidades de múltiplas fontes
async function fetchCitiesFromMultipleSources(radioData, notionToken) {
  console.log('🔍 Buscando cidades de múltiplas fontes...');
  
  // Estratégia 1: Tentar buscar do campo original de cobertura (se ainda existir)
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

// Tentar buscar do campo Cobertura original (pode ter dados antigos)
async function tryFetchFromNotionCoverageField(pageId, token) {
  try {
    // Buscar novamente a página para tentar pegar campo Cobertura
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
        
        // Se não é um link, tentar extrair cidades
        if (!fullText.includes('Ver mapa de cobertura') && !fullText.includes('http')) {
          const cities = fullText
            .split(/[,\n;]/)
            .map(city => city.trim())
            .filter(city => city.length > 0)
            .map(city => {
              // Garantir formato "Cidade - UF"
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

// Gerar cidades baseado na região/UF (fallback robusto)
function generateCitiesByRegion(region, uf, praca) {
  const citiesByRegion = {
    'Sul': {
      'SC': [
        'Florianópolis - SC', 'São José - SC', 'Palhoça - SC', 'Biguaçu - SC',
        'Blumenau - SC', 'Joinville - SC', 'Chapecó - SC', 'Criciúma - SC',
        'Itajaí - SC', 'Lages - SC', 'Balneário Camboriú - SC', 'Tubarão - SC',
        'Santo Amaro da Imperatriz - SC', 'Governador Celso Ramos - SC',
        'Antônio Carlos - SC', 'Águas Mornas - SC', 'São Pedro de Alcântara - SC'
      ],
      'RS': [
        'Porto Alegre - RS', 'Caxias do Sul - RS', 'Pelotas - RS', 'Santa Maria - RS',
        'Gravataí - RS', 'Viamão - RS', 'Novo Hamburgo - RS', 'São Leopoldo - RS',
        'Rio Grande - RS', 'Alvorada - RS', 'Passo Fundo - RS', 'Sapucaia do Sul - RS'
      ],
      'PR': [
        'Curitiba - PR', 'Londrina - PR', 'Maringá - PR', 'Foz do Iguaçu - PR',
        'São José dos Pinhais - PR', 'Cascavel - PR', 'Guarapuava - PR', 'Paranaguá - PR'
      ]
    },
    'Sudeste': {
      'SP': [
        'São Paulo - SP', 'Guarulhos - SP', 'Campinas - SP', 'São Bernardo do Campo - SP',
        'Santo André - SP', 'Osasco - SP', 'São José dos Campos - SP', 'Ribeirão Preto - SP',
        'Santos - SP', 'Mauá - SP', 'São José do Rio Preto - SP', 'Diadema - SP'
      ],
      'RJ': [
        'Rio de Janeiro - RJ', 'São Gonçalo - RJ', 'Duque de Caxias - RJ', 'Nova Iguaçu - RJ',
        'Niterói - RJ', 'Campos dos Goytacazes - RJ', 'Petrópolis - RJ', 'Volta Redonda - RJ'
      ],
      'MG': [
        'Belo Horizonte - MG', 'Uberlândia - MG', 'Contagem - MG', 'Juiz de Fora - MG',
        'Betim - MG', 'Montes Claros - MG', 'Ribeirão das Neves - MG', 'Uberaba - MG'
      ],
      'ES': [
        'Vitória - ES', 'Vila Velha - ES', 'Cariacica - ES', 'Serra - ES',
        'Cachoeiro de Itapemirim - ES', 'Linhares - ES', 'São Mateus - ES'
      ]
    },
    'Nordeste': {
      'PE': [
        'Recife - PE', 'Jaboatão dos Guararapes - PE', 'Olinda - PE', 'Caruaru - PE',
        'Petrolina - PE', 'Paulista - PE', 'Cabo de Santo Agostinho - PE', 'Camaragibe - PE'
      ],
      'BA': [
        'Salvador - BA', 'Feira de Santana - BA', 'Vitória da Conquista - BA', 'Camaçari - BA',
        'Juazeiro - BA', 'Ilhéus - BA', 'Itabuna - BA', 'Lauro de Freitas - BA'
      ],
      'CE': [
        'Fortaleza - CE', 'Caucaia - CE', 'Juazeiro do Norte - CE', 'Maracanaú - CE',
        'Sobral - CE', 'Crato - CE', 'Itapipoca - CE', 'Maranguape - CE'
      ]
    },
    'Norte': {
      'AM': [
        'Manaus - AM', 'Parintins - AM', 'Itacoatiara - AM', 'Manacapuru - AM'
      ],
      'PA': [
        'Belém - PA', 'Ananindeua - PA', 'Santarém - PA', 'Marabá - PA'
      ]
    },
    'Centro-Oeste': {
      'DF': [
        'Brasília - DF', 'Gama - DF', 'Taguatinga - DF', 'Ceilândia - DF'
      ],
      'GO': [
        'Goiânia - GO', 'Aparecida de Goiânia - GO', 'Anápolis - GO', 'Rio Verde - GO'
      ]
    }
  };
  
  // Buscar cidades da região/UF
  const regionCities = citiesByRegion[region];
  if (regionCities && regionCities[uf]) {
    let cities = [...regionCities[uf]];
    
    // Garantir que a praça principal esteja na lista
    const pracaFormatted = `${praca} - ${uf}`;
    if (!cities.includes(pracaFormatted)) {
      cities.unshift(pracaFormatted);
    }
    
    return cities;
  }
  
  // Fallback final: apenas a praça principal
  return [`${praca} - ${uf}`];
}
