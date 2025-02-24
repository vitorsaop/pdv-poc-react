# PDVLocal - Sistema de PDV Local com React, TypeScript e SQL.js

Este projeto é uma prova de conceito de um sistema de PDV (Ponto de Venda) local, desenvolvido com React e TypeScript. A aplicação utiliza o SQL.js para gerenciar um banco de dados SQLite no navegador (via WebAssembly) e IndexedDB para persistir os dados entre sessões. Além disso, o sistema foi containerizado com Docker, permitindo que você o execute sem precisar instalar todas as dependências localmente.

## Funcionalidades
- Cadastro de Produtos:
    - Produtos pré-cadastrados são inseridos na tabela produtos com código de barras, descrição, valor unitário e URL da imagem.

## Adição de Itens na Venda:
- Ao digitar um código de barras, o sistema consulta a tabela de produtos e, se o produto for encontrado, adiciona-o à venda. Se o mesmo produto já estiver na venda, a quantidade é incrementada e o subtotal é atualizado.

## Cálculo do Total da Venda:
- O total é calculado automaticamente somando os subtotais dos itens da venda.

## Encerramento da Venda:
- Ao encerrar a venda, o total é atualizado na tabela venda, os dados são salvos no IndexedDB e a tela é reinicializada para permitir o início de uma nova venda.

## Exportação do Banco de Dados:
- Disponibiliza um botão para exportar o banco de dados SQLite, facilitando backup e análise.

## Tecnologias Utilizadas
- React & TypeScript: Interface de usuário.
- SQL.js: Execução de SQLite no navegador (via WebAssembly).
- IndexedDB: Persistência local dos dados.
- Docker: Containerização da aplicação para facilitar a execução sem instalação local de dependências.
- CRACO: Customização da configuração do Webpack para o ambiente de navegador.


## Executando com Docker
Siga os passos abaixo para construir e executar o container Docker:

Build da Imagem Docker

No diretório raiz do projeto, execute:

```bash
'docker build -t pdvlocal .
```
Esse comando:

Usa o Dockerfile para instalar as dependências (incluindo os polyfills e definições de tipos),
Copia os arquivos do projeto para o container,
Define a variável de ambiente HOST=0.0.0.0 para que a aplicação seja acessível externamente,
Expõe a porta 3000 e inicia a aplicação com npm start.
Executar o Container

Após o build da imagem, execute o container mapeando a porta 3000:

```bash
docker run -p 3000:3000 pdvlocal
```

Agora, acesse a aplicação em http://localhost:3000.

## Estrutura do Projeto
```
pgsql
Copiar
pdvlocal/
├── Dockerfile
├── package.json
├── tsconfig.json
├── craco.config.js
├── README.md
├── public/
│   └── index.html
└── src/
    ├── App.tsx
    ├── declarations.d.ts
    ├── App.css
    └── index.tsx
```    

- Dockerfile: Configuração para build e execução do container Docker.
- craco.config.js: Customiza a configuração do Webpack para fornecer polyfills (ex.: stream, buffer).
- declarations.d.ts: Declarações de tipos para o SQL.js.
- App.tsx: Componente principal com a lógica do PDV.
- App.css: Arquivo de estilos que reproduz o layout do sistema de PDV.
- index.tsx: Ponto de entrada da aplicação React.

## Considerações
- Persistência: Os dados são salvos no IndexedDB sob o nome pdvlocal_database, garantindo que as informações não se percam ao fechar o navegador.

- Simulação de Venda: O sistema possui produtos pré-cadastrados e permite a adição de itens na venda. Se um produto já foi adicionado, a quantidade é incrementada.

- Reinicialização da Venda: Ao encerrar a venda, o total é atualizado, os dados são salvos e a tela é reinicializada para permitir uma nova venda.

- Exportação do Banco de Dados: Um botão permite o download do banco de dados em formato SQLite.