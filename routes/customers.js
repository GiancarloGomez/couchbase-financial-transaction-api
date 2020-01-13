var express = require('express');
var router = express.Router();
var customers = require('../controllers/customers');

router.get('/',customers.list);
router.get('/:id',customers.get);
router.post('/',customers.create);
router.put('/:id',customers.update);
router.delete('/:id',customers.delete);

module.exports = router;