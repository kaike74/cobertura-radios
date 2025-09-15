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
    const { id, radio } = event.queryStringParameters || {};
    
    if (!id && !radio) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID ou nome da rádio é obrigatório' })
      };
    }

    console.log('Buscando dados para:', id || radio);

    // POR ENQUANTO: Dados de exemplo
    // FUTURO: Integrar com Google Apps Script
    const radioData = getExampleRadioData(id || radio);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(radioData)
    };

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

// FUNÇÃO PARA DADOS DE EXEMPLO
function getExampleRadioData(identifier) {
  // Base de dados de exemplo - simula diferentes rádios
  const exampleRadios = {
    'exemplo1': {
      name: 'RÁDIO EXEMPLO FM',
      dial: '94.3 FM',
      latitude: -23.5505,
      longitude: -46.6333,
      radius: 50000,
      region: 'Sudeste',
      uf: 'SP',
      praca: 'São Paulo',
      classe: 'A',
      universo: 45000,
      pmm: 1500,
      imageUrl: 'https://via.placeholder.com/100x75/dc2626/white?text=94.3',
      cidades: [
        'São Paulo - SP',
        'Guarulhos - SP',
        'Osasco - SP',
        'Santo André - SP',
        'São Bernardo do Campo - SP',
        'São Caetano do Sul - SP',
        'Diadema - SP',
        'Mauá - SP',
        'Ribeirão Pires - SP',
        'Rio Grande da Serra - SP',
        'Ferraz de Vasconcelos - SP',
        'Poá - SP',
        'Suzano - SP',
        'Itaquaquecetuba - SP',
        'Arujá - SP'
      ]
    },
    'exemplo2': {
      name: 'RÁDIO NORDESTE AM',
      dial: '1240 AM',
      latitude: -8.0578,
      longitude: -34.8828,
      radius: 75000,
      region: 'Nordeste',
      uf: 'PE',
      praca: 'Recife',
      classe: 'B',
      universo: 65000,
      pmm: 2200,
      imageUrl: 'https://via.placeholder.com/100x75/059669/white?text=1240',
      cidades: [
        'Recife - PE',
        'Olinda - PE',
        'Jaboatão dos Guararapes - PE',
        'Camaragibe - PE',
        'São Lourenço da Mata - PE',
        'Abreu e Lima - PE',
        'Igarassu - PE',
        'Paulista - PE',
        'Cabo de Santo Agostinho - PE',
        'Ipojuca - PE',
        'Moreno - PE',
        'Vitória de Santo Antão - PE',
        'Paudalho - PE',
        'Glória do Goitá - PE',
        'Chã de Alegria - PE'
      ]
    }
  };

  // Retornar rádio específica ou a primeira como padrão
  return exampleRadios[identifier] || exampleRadios['exemplo1'];
}

// FUTURO: Função para integrar com Google Apps Script
async function fetchRadioFromGoogleSheets(radioId) {
  // TODO: Implementar chamada para o Google Apps Script
  // que vai buscar os dados reais da planilha
  
  /*
  const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getRadio&id=${radioId}`);
  const data = await response.json();
  
  return {
    name: data.emissora,
    dial: data.dial,
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    radius: parseFloat(data.radius) * 1000, // converter para metros
    region: data.regiao,
    uf: data.uf,
    praca: data.praca,
    classe: data.classe,
    universo: parseInt(data.universo),
    pmm: parseInt(data.pmm),
    imageUrl: data.imageUrl,
    cidades: data.cobertura.split(',').map(c => c.trim())
  };
  */
  
  throw new Error('Integração com Google Apps Script ainda não implementada');
}
