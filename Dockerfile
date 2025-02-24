# Use uma imagem base Node (versão Alpine para ser mais leve)
FROM node:18-alpine

# Define o diretório de trabalho no container
WORKDIR /app

# Copia os arquivos de package.json e package-lock.json (se existirem)
COPY package*.json ./

# Instala as dependências de desenvolvimento necessárias (incluindo polyfills e os tipos para React e ReactDOM) e depois as dependências do projeto
RUN npm install --save-dev @craco/craco stream-browserify buffer crypto-browserify path-browserify @types/react @types/react-dom \
    && npm install

# Copia todo o restante do código para o container
COPY . .

# Define a variável de ambiente para que a aplicação escute em todas as interfaces
ENV HOST=0.0.0.0

# Expõe a porta que a aplicação utilizará (padrão do Create React App é 3000)
EXPOSE 3000

# Inicia a aplicação
CMD ["npm", "start"]
