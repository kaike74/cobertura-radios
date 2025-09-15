# 📻 Cobertura Rádios - Mapa Interativo

Sistema para visualização interativa da cobertura geográfica das rádios com mapas, informações técnicas e lista completa de cidades.

## 🎯 Funcionalidades

- **🗺️ Mapa Interativo** - OpenStreetMap com Leaflet
- **📍 Localização da Rádio** - Marker personalizado com popup
- **⭕ Círculo de Cobertura** - Visualização do alcance
- **📊 Informações Técnicas** - Dial, classe, potência, etc.
- **🌐 Dados de Alcance** - PMM, universo, área de cobertura
- **🏙️ Lista de Cidades** - Todas as cidades cobertas
- **🔍 Busca de Cidades** - Filtro em tempo real
- **📱 Responsivo** - Funciona em celular e desktop
- **🔗 Compartilhamento** - Link direto para cada rádio

## 🚀 Como Usar

### Visualizar Exemplo
```
https://seu-site.netlify.app/
```

### Visualizar Rádio Específica (Futuro)
```
https://seu-site.netlify.app/?id=NOTION_ID
https://seu-site.netlify.app/?radio=NOME_RADIO
```

## 🛠️ Estrutura do Projeto

```
cobertura-radios/
├── index.html              # Página principal
├── netlify.toml            # Configuração Netlify
├── .netlify/
│   └── functions/
│       └── radio-data.js   # API para dados das rádios
└── README.md               # Este arquivo
```

## 📋 Próximos Passos

### ✅ Implementado
- [x] Interface básica com mapa
- [x] Marker da rádio com popup
- [x] Círculo de cobertura
- [x] Cards de informações
- [x] Lista de cidades com busca
- [x] Design responsivo
- [x] Dados de exemplo

### 🚧 Em Desenvolvimento
- [ ] Integração com Google Apps Script
- [ ] Busca por Notion ID
- [ ] Download de KML
- [ ] Múltiplas rádios no mesmo mapa
- [ ] Destaque de cidades no mapa
- [ ] Player de rádio online
- [ ] QR Code para compartilhamento

### 🎨 Melhorias Futuras
- [ ] Animações no mapa
- [ ] Heatmap de intensidade de sinal
- [ ] Comparação entre rádios
- [ ] Estatísticas de cobertura
- [ ] Exportar dados (Excel, CSV)
- [ ] Modo escuro
- [ ] Múltiplos idiomas

## 🔧 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Mapas**: Leaflet + OpenStreetMap
- **Backend**: Netlify Functions
- **Deploy**: Netlify
- **APIs**: Google Apps Script (futuro)

## 📱 Responsividade

O sistema foi desenvolvido para funcionar perfeitamente em:
- 📱 Smartphones (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)
- 🖥️ Monitores grandes (1200px+)

## 🎨 Design System

### Cores Principais
- **Vermelho**: `#dc2626` (Primary)
- **Verde**: `#059669` (Secondary)
- **Cinza**: `#64748b` (Text)
- **Branco**: `#ffffff` (Background)

### Tipografia
- **Família**: Arial, sans-serif
- **Tamanhos**: 12px - 28px
- **Pesos**: 400, 500, 600, 700

## 🔗 Links Úteis

- [Leaflet Documentation](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)

## 📄 Licença

Este projeto é proprietário e destinado ao uso interno.
