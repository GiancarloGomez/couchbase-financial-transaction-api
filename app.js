var express = require('express');
var customersRouter = require('./routes/customers');
var transactionsRouter = require('./routes/transactions');
var port = process.env.PORT || 3000;
var app = express();
var path = require('path');


app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/customers', customersRouter);
app.use('/api/transactions', transactionsRouter);

app.listen(port);