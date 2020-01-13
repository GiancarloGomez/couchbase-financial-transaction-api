const models = require('../models/');
const couchbaseService = require('../services/couchbase');

const CustomersController = {
    /**
     * Returns an array of customers along with total count for use in paging
     */
    list : async (req, res) => {
        let search  =  Object.assign({}, req.query);
        // clean up search params
        delete search.limit;
        delete search.offset;
        delete search._;
        let limit   = req.query.limit && !isNaN(req.query.limit) ? req.query.limit : 10;
        let offset  = req.query.offset && !isNaN(req.query.offset) ? req.query.offset : 0;
        let results = await couchbaseService.list_customers(offset, limit, search);
        res.send(results);
    },

    /**
     * Retrieves a customer
     */
    get : async (req, res) => {
        let customer = await couchbaseService.get_customer_via_N1ql(req.params.id);

        if (customer.code)
            res.status(404).send({'message':customer.message});
        else
            res.send(customer);
    },

    /**
     * Creates a customer and addresses
     */
    create : async (req, res) => {
        let uuid        = await couchbaseService.uuid();
        let addresses   = [];
        let customer    = Object.assign(models.Customer(),req.body);

        // assign customer id for save
        customer.id = uuid;

        // create address records
        if (customer.addresses) {
            for (let address of customer.addresses){
                uuid        = await couchbaseService.uuid();
                address     = Object.assign(models.Address(),address);
                address.id  = uuid;
                address     = await couchbaseService.save(`address::${address.id}`,address,true);
                addresses.push(address);
            }
            // rewrite records to insert for customer object
            customer.addresses = addresses.map((a) => {
                return {
                    'id'    : a.id,
                    'type'  : `address::${a.purpose}`
                }
            })
        }

        // do save
        customer = await couchbaseService.save_customer(customer);

        // return error or customer
        if (customer.code)
            res.status(500).send({'message':customer.message});
        else
            res.send(customer);
    },

    /**
     * Updates a customer, creates/updates addresses, deletes addresses
     */
    update : async (req, res) => {
        let customer = await couchbaseService.get(`customer::${req.params.id}`);
        let addresses = [];
        let uuid;
        let address_ids;

        // handle error
        if (customer.code){
            res.status(customer.code === couchbase.errors.keyNotFound ? 404 : 500).send({'message':customer.message});
        }
        // continue with update
        else {
            // save current address ids to delete any that no longer exists after update
            address_ids = customer.addresses.map( a => a.id );

            // remove addresses from current object
            delete customer.addresses;

            // update object
            customer = Object.assign(customer,req.body);

            // create or update address records
            if (customer.addresses) {
                for (let address of customer.addresses){
                    // made sure object at least the minimum required keys
                    address = Object.assign(models.Address(),address);
                    // if address does not have id passed then it is new
                    if (address.id === ''){
                        uuid        = await couchbaseService.uuid();
                        address.id  = uuid;
                    }
                    address     = await couchbaseService.save(`address::${address.id}`,address,true);
                    addresses.push(address);
                }
                // rewrite records for customer object update
                customer.addresses = addresses.map((a) => {
                    return {
                        'id'    : a.id,
                        'type'  : `address::${a.purpose}`
                    }
                })
            }

            // do address clean up
            address_ids.forEach(id => {
                if (!customer.addresses || !customer.addresses.find( a => a.id === id ))
                    couchbaseService.delete(`address::${id}`);
            });

            // do save
            customer = await couchbaseService.save_customer(customer);

            // return error or customer
            if (customer.code)
                res.status(500).send({'message':customer.message});
            else
                res.send(customer);
        }
    },

    /**
     * Deletes a customer and addresses
     */
    delete : async (req, res) => {
        let customer = await couchbaseService.get(`customer::${req.params.id}`);
        let has_transactions = await couchbaseService.has_transactions(req.params.id);
        // do not delete if it has transactions
        if (customer && !has_transactions){
            // delete addresses
            for (let address of customer.addresses)
                couchbaseService.delete(`address::${address.id}`);
            // delete customer
            couchbaseService.delete(`customer::${req.params.id}`);
        }

        if (customer && has_transactions)
            res.status(500).send({'message':'Can not delete customer as they have transactions recorded.'});
        else
            res.send({'success':true});
    }
};

module.exports = CustomersController;