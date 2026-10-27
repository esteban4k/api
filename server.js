const { crearApp } = require('./src/app');
const { PUERTO } = require('./src/config');

const app = crearApp({ registrarPeticiones: true });

const servidor = app.listen(PUERTO, () => {
  console.log('PedalVerde API en marcha');
  console.log(`  Consola web:      http://localhost:${PUERTO}/`);
  console.log(`  Índice de la API: http://localhost:${PUERTO}/api`);
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PUERTO} está ocupado. Cierra el otro proceso o usa otro puerto: PORT=4001 npm start`);
    process.exit(1);
  }
  throw error;
});
