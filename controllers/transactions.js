const models = require('../models/');
const couchbaseService = require('../services/couchbase');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const TransactionsController = {
    /**
     * Returns an array of transactions along with total count for use in paging
     */
    list : async (req, res) => {
        let search  =  Object.assign({}, req.query);
        // clean up search params
        delete search.limit;
        delete search.offset;
        delete search._;
        let limit   = req.query.limit && !isNaN(req.query.limit) ? req.query.limit : 10;
        let offset  = req.query.offset && !isNaN(req.query.offset) ? req.query.offset : 0;
        let results = await couchbaseService.list_transactions(offset, limit, search);
        res.send(results);
    },

    /**
     * Retrieves a transaction
     */
    get : async (req, res) => {
        let transaction = await couchbaseService.get(`transaction::${req.params.id}`);

        if (transaction.code)
            res.status(404).send({'message':transaction.message});
        else
            res.send(transaction);
    },

    /**
     * Posts a charge to Stripe and creates the transaction for a Customer
     */
    create : async (req, res) => {
        let customer = await couchbaseService.get(`customer::${req.body.customerID}`);
        stripe.tokens
            .create({'card' : req.body.card })
            .then(token => {
                let _request = {
                    'amount'        : Math.floor(req.body.amount * 100),
                    'currency'      : 'usd',
                    'source'        : token.id,
                    'description'   : 'Couchbase Transaction API Charge',
                    'receipt_email' : customer.email
                };
                // now go ahead an create the charge
                stripe.charges
                    .create(_request)
                    .then( async charge => {
                        let uuid = await couchbaseService.uuid();
                        let transaction = Object.assign(models.Transaction(),{
                            'id'            : uuid,
                            'customerID'    : customer.id,
                            'transactionID' : charge.id,
                            'amount'        : req.body.amount,
                            'card'          : {
                                'brand' : charge.payment_method_details.card.brand,
                                'last4' : charge.payment_method_details.card.last4
                            },
                            'success'       : charge.captured || false,
                            'request'       : _request,
                            'response'      : charge
                        });
                        transaction = await couchbaseService.save(`transaction::${uuid}`,transaction,true);
                        // return error or transaction
                        if (transaction.code)
                            res.status(500).send({'message':transaction.message || transaction.raw.message});
                        else
                            res.send(transaction);
                    })
                    .catch(error => {
                        res.status(error.statusCode || 500).send(error.raw || error)
                    });
            })
            .catch(error => {
                res.status(error.statusCode || 500).send(error.raw || error)
            });
    }
}

module.exports = TransactionsController;