# Mapa Interativo — gerador de mapas de espaços

Aplicação web para transformar uma planta ou mapa ilustrado em um guia clicável. O administrador envia uma imagem, posiciona pins, configura nomes, categorias, tags, descrições e links. O visitante abre um endereço público, pesquisa e filtra os locais. O projeto usa Google Sheets para os dados e Google Drive para imagens.

O repositório inclui uma imagem de demonstração do resort anexado e alguns pins de exemplo. Para uso real, salve uma cópia do mapa no seu Google Drive através do editor.

## O que já está incluído

- Editor com imagem de fundo e pins arrastáveis.
- Categorias iniciais para piscinas, hospedagem, alimentação, esportes, lazer, serviços, acesso e outros.
- Busca por nome, categoria, tags e descrição; filtros por categoria.
- Painel para editar nome, categoria, tags, descrição e link externo.
- Modo público somente leitura em `?map=identificador`.
- Compartilhamento por link e código `<iframe>`.
- Upload e compressão de imagens antes do envio ao Drive.
- Rascunho local no navegador para demonstração sem Apps Script.
- Backend Apps Script que cria a planilha e a pasta do Drive na primeira configuração.

## Estrutura do projeto

```text
mapa-interativo-generator/
├── Index.html                    # Aplicação/editor/visualizador
├── Code.gs                       # Web app e integração Sheets/Drive
├── appsscript.json               # Configuração do Google Apps Script
├── assets/
│   └── mapa-resort-inicial.png   # Imagem de demonstração fornecida
└── README.md
```

## Subir o código no GitHub

1. Crie um repositório no GitHub, por exemplo `mapa-interativo-generator`.
2. Envie todos os arquivos e a pasta `assets/` deste pacote para a raiz do repositório.
3. A aplicação usa Apps Script como hospedagem e backend quando conectada ao Google. O GitHub guarda o código e o histórico das alterações. O modo local do `Index.html` serve para pré-visualizar a interface e mantém dados apenas no navegador.

## Configurar Google Sheets e Google Drive

### 1. Criar o projeto Apps Script

1. Abra [script.google.com](https://script.google.com/) e crie um projeto novo.
2. No editor do Apps Script, crie um arquivo HTML chamado `Index` e cole o conteúdo de `Index.html`.
3. No arquivo `Code.gs`, cole o conteúdo de `Code.gs` deste repositório.
4. Abra **Configurações do projeto** e habilite a exibição do arquivo de manifesto `appsscript.json`; substitua o conteúdo pelo manifesto deste pacote.

### 2. Inicializar o banco de dados

1. No editor Apps Script, selecione a função `setupDatabase` e clique em **Executar**.
2. Autorize o acesso solicitado ao Google Sheets e ao Google Drive.
3. Consulte o resultado da execução. O script cria a planilha `Banco de Mapas Interativos`, a pasta `Arquivos dos Mapas Interativos` e as abas `MAPAS`, `LOCAIS` e `ARQUIVOS`.
4. As imagens enviadas pelo editor são guardadas na pasta do Drive. A planilha armazena IDs, URLs, metadados e posições dos pins.

### 3. Definir a chave de edição

1. Em **Configurações do projeto → Propriedades do script**, adicione a propriedade `EDITOR_KEY`.
2. Use uma chave longa, única e difícil de adivinhar. Não coloque essa chave no repositório nem em arquivos públicos.
3. O campo **Chave do editor** aparece no topo do app. Informe a chave para salvar. Ela não é gravada no banco de dados.

O visualizador continua público. A chave protege as operações de gravação. Quem tiver a chave poderá editar qualquer mapa desta instância, então compartilhe-a apenas com administradores.

### 4. Publicar como aplicação web

1. No Apps Script, selecione **Implantar → Nova implantação → Aplicativo da Web**.
2. Em **Executar como**, selecione sua conta.
3. Em **Quem pode acessar**, escolha a opção que permite acesso anônimo/público. Essa configuração é necessária para que os links públicos e iframes funcionem sem login.
4. Clique em **Implantar** e copie a URL terminada em `/exec`.
5. Abra a URL. Envie a imagem pelo botão **Imagem**, adicione os locais e salve.

O manifesto já configura o app para executar como o proprietário e aceitar acesso anônimo. Algumas contas Google Workspace podem bloquear essa modalidade; nesse caso, o administrador do Workspace precisa permitir a publicação pública.

## Usar o mapa do resort incluído

O arquivo `assets/mapa-resort-inicial.png` é a imagem fornecida para iniciar o projeto. Abra o gerador no computador e envie esse arquivo pelo botão **Imagem** (ou arraste-o sobre a área do mapa). Em uma implantação do Apps Script, o arquivo selecionado é copiado para o Drive configurado e a URL resultante fica salva em `MAPAS`.

O exemplo local carrega a imagem e mostra pins demonstrativos. Esses pins servem para testar interação e busca; edite ou remova-os conforme a localização real dos ambientes.

## Dados gravados

| Aba | Conteúdo |
|---|---|
| `MAPAS` | Identificador, nome, descrição, imagem, dimensões, publicação e datas. |
| `LOCAIS` | Um registro por pin: categoria, tags, descrição, link e posição percentual na imagem. |
| `ARQUIVOS` | Referências às imagens armazenadas no Drive, incluindo tipo e MIME. |

As coordenadas `x_pct` e `y_pct` vão de 0 a 100. Isso mantém os pins na mesma posição quando o mapa é redimensionado.

## Compartilhar e incorporar

Depois de salvar, clique em **Compartilhar**. O app gera um endereço similar a:

```text
https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec?map=mapa-do-resort-a1b2c3d4
```

O botão **Copiar código iframe** gera um snippet responsivo para incorporar em um site. A página pública oculta os controles de edição e permite busca, filtros e detalhes dos pins.

## Observações de segurança e uso

- A planilha e a chave de edição não devem ser compartilhadas publicamente.
- Imagens de mapas públicos ficam acessíveis a qualquer pessoa com o link, para que sejam exibidas no visualizador.
- A chave `EDITOR_KEY` é única por implantação: não há usuários ou permissões individuais neste MVP.
- O Apps Script tem cotas e limites de execução do Google. Este MVP atende protótipos e volumes modestos; monitore as cotas se o uso crescer.
- O app aceita imagem PNG, JPG ou WebP e reduz a maior dimensão para até 2.200 px antes do upload. O tamanho máximo enviado ao Apps Script é 8 MB após compressão.
- Para múltiplos pisos, autenticação individual, histórico/versionamento ou grande volume de acessos, amplie o modelo antes de uso em produção.

## Licença

O código deste projeto é fornecido sob licença MIT. A imagem demonstrativa é material fornecido pelo usuário para este projeto; ela não é um asset genérico para redistribuição em outros projetos.
