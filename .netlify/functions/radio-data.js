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
    console.log('🔑 Token (primeiros 10 chars):', notionToken ? notionToken.substring(0, 10) + '...' : 'TOKEN_NAO_ENCONTRADO');

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
      
      // Técnicas
      classe: extractValue(properties['Classe'] || properties['classe'], 'N/A', 'Classe'),
      universo: parseInt(extractValue(properties['Universo'] || properties['universo'], 0, 'Universo')),
      pmm: parseInt(extractValue(properties['PMM'] || properties['pmm'], 1000, 'PMM')),
      
      // Valores comerciais (opcionais)
      spot30: parseFloat(extractValue(properties['Valor spot 30ʺ (Tabela)'] || properties['Spot 30'], 0, 'Spot 30')),
      test60: parseFloat(extractValue(properties['Valor test. 60ʺ (Tabela)'] || properties['Test 60'], 0, 'Test 60')),
      
      // URLs e mídias
      imageUrl: extractValue(properties['Imagem'] || properties['imagem'], 'https://via.placeholder.com/100x75/dc2626/white?text=FM', 'Imagem'),
      
      // COBERTURA COMPLETA (SEM TRUNCAMENTO - principal diferença!)
      coverageText: extractValue(properties['Cobertura'] || properties['cobertura'], '', 'Cobertura'),
      
      // Metadata
      source: 'notion',
      notionId: id,
      lastUpdate: new Date().toISOString()
    };

    // Processar lista de cidades da cobertura
    if (radioData.coverageText) {
      // Dividir por vírgulas, quebras de linha, ou outros separadores
      radioData.cidades = radioData.coverageText
        .split(/[,\n;]/)
        .map(cidade => cidade.trim())
        .filter(cidade => cidade.length > 0)
        .map(cidade => {
          // Garantir formato "Cidade - UF"
          if (!cidade.includes(' - ') && radioData.uf !== 'N/A') {
            return `${cidade} - ${radioData.uf}`;
          }
          return cidade;
        });
    } else {
      radioData.cidades = [`${radioData.praca} - ${radioData.uf}`];
    }

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
