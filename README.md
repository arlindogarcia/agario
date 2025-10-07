 1. Instalar PM2 globalmente

npm install -g pm2

2. Iniciar a aplicação com PM2

# No diretório do projeto
pm2 start server/index.js --name "agario"

3. Configurar para iniciar automaticamente no boot

pm2 startup systemd
# Vai gerar um comando, copie e execute-o

pm2 save

Pronto! Agora a aplicação:
- ✓ Roda 24h ininterruptamente
- ✓ Reinicia automaticamente se crashar
- ✓ Inicia automaticamente quando o servidor reiniciar
- ✓ Não precisa ficar iniciando manualmente

Comandos úteis do PM2

pm2 list           # Ver aplicações rodando
pm2 logs agario    # Ver logs em tempo real
pm2 restart agario # Reiniciar a aplicação
pm2 stop agario    # Parar a aplicação
pm2 monit          # Monitor de recursos