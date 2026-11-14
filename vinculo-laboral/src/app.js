const path = require('path');
const express = require('express');
const { noEncontrado, manejador } = require('./middleware/errors');

const app = express();
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/publico', require('./routes/publico'));
app.use('/api/candidato', require('./routes/candidato'));
app.use('/api/empresa', require('./routes/empresa'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', noEncontrado);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(manejador);

module.exports = app;
