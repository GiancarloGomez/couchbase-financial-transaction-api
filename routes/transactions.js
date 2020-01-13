var express = require('express');
var router = express.Router();
var transactions = require('../controllers/transactions');

router.get('/',transactions.list);
router.get('/:id',transactions.get);
router.post('/',transactions.create);

module.exports = router;