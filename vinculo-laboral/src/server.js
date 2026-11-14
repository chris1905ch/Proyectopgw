require('dotenv').config();
const app = require('./app');

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => {
  console.log(`Vínculo Laboral en http://localhost:${puerto}`);
});
