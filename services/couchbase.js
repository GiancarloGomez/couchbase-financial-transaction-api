const couchbase = require('couchbase');
const cluster = new couchbase.Cluster(process.env.COUCHBASE_SERVER);
const moment = require('moment');

cluster.authenticate(process.env.COUCHBASE_USER,process.env.COUCHBASE_PASSWORD);

const bucket = cluster.openBucket(process.env.COUCHBASE_BUCKET);

const CouchbaseService = {

    get : async (key) => {
        // get document
        let promise = new Promise ((resolve,reject) => {
            bucket.get(key,(err,result) => {
                resolve(err ? err : result.value);
            });
        });
        let result = await promise;
        return result;
    },

    save : async (key,document,doGet = true) => {
        let now  = moment.utc().format();
        // set created on if emoty
        if (document.createdOn === '')
            document.createdOn = now;
        // only set updated on if it is part of the model
        if (document.updatedOn !== undefined)
            document.updatedOn = now;
         // save document
         let promise = new Promise ((resolve,reject) => {
            bucket.upsert(key, document, (err,result) => {
                if (err) {
                    resolve(err);
                }
                else if (!doGet){
                    resolve(err ? err : result);
                }
                else {
                    bucket.get(key,(err,result) => {
                        resolve(err ? err : result.value);
                    });
                }
            });
        });
        let result = await promise;
        return result;
    },

    delete : (key) => {
        // no response as we are ok if error on delete
        bucket.remove(key,(err,result)=>{});
    },

    uuid : async () => {
        let promise = new Promise ((resolve,reject) => {
            bucket.query(couchbase.N1qlQuery.fromString('SELECT UUID() AS id'),(err,rows)=>{
                resolve(rows ? rows[0].id : err);
            });
        });
        let result = await promise;
        return result;
    },

    /*
    * Customer Specific Functions
    */

    list_customers : async (offset=0, limit=10, searchparams = {}) => {
        let total   = 0;
        let where   = 'FROM `transaction-app` WHERE type=\'customer\'';
        let paged   = parseInt(limit) !== 0;
        let query;
        let promise;
        let result;
        let searchValue;
        let keys;
        let searchQuery;

        // get count since we are requesting a paged resultset
        // not currently used in search
        if (paged && !searchparams.value){
            query = couchbase.N1qlQuery.fromString(`SELECT COUNT(id) AS total ${where}`);

            promise = new Promise ((resolve,reject) => {
                bucket.query(query,(err,rows)=>{
                resolve(err ? err : rows[0]);
                });
            });

            result = await promise;

            if (!result.code && result.total)
                total = result.total;
        }

        // FTS Search
        if (searchparams.value){
            searchValue = searchparams.value.toString();
            searchQuery = couchbase.SearchQuery;
            switch (searchparams.type){
                case 'id':
                case 'email':
                    query = searchQuery.new(`customer-search-${searchparams.type}`, searchQuery.matchPhrase(searchValue));
                break;
                case 'name':
                    if (searchValue.indexOf(' ') !== -1)
                        query = searchQuery.new(`customer-search-${searchparams.type}`, searchQuery.match(searchValue));
                    else
                        query = searchQuery.new(`customer-search-${searchparams.type}`, searchQuery.wildcard(`${searchValue.toLowerCase()}*`));
                break;
                case 'address':
                    query = searchQuery.new('address-search', searchQuery.matchPhrase(searchValue));
                break;
            }
            promise = new Promise ((resolve,reject) => {
                bucket.query(query,(err,rows)=>{
                   resolve(err ? err : rows);
                });
            });

            result = await promise;

            if (searchparams.type === 'address')
                keys = JSON.stringify(result.map( a => a.id.replace('address::','') ));
            else
                keys = JSON.stringify(result.map( a => a.id ));
        }

        // fetch records ( full or paged )
        if (!paged || (!result.code && result.total)){
            if (searchparams.value) {
                switch (searchparams.type){
                    case 'id':
                    case 'email':
                    case 'name':
                        where = `FROM \`transaction-app\` USE KEYS ${keys}`;
                    break;

                    default:
                        where += `
                        AND ANY v in addresses SATISFIES v.id IN (
                            ${keys}
                        ) END`;
                    break;
                }
            }

            query = `
                SELECT  id,firstName,lastName,phone,email,type,version
                ${where}
                ORDER BY firstName,lastName
            `;

            if (paged)
                query += `OFFSET ${offset} LIMIT ${limit}`;

            query = couchbase.N1qlQuery.fromString(query);

            promise = new Promise ((resolve,reject) => {
                bucket.query(query,(err,rows)=>{
                   resolve(err ? err : rows);
                });
            });

            result = await promise;

            // now we prepare for return
            if (!result.code){
                result = {
                    'customers' : result,
                    'total'     : paged ? total : result.length
                };
            }
        }
        return result;
    },

    get_customer_via_N1ql : async (id,request_plus = false) => {
        // use N1QL to fetch record and NEST to join the addresses to the return object
        let query = couchbase.N1qlQuery.fromString(`
            SELECT  a.id,a.firstName,a.lastName,a.phone,a.email,a.type,a.version,b AS addresses
            FROM   \`transaction-app\` AS a
            NEST   \`transaction-app\` AS b
            ON KEYS ARRAY 'address::'||TO_STRING(x.id) FOR x IN a.addresses END
            WHERE  a.type='customer' AND a.id = '${id}'
       `);
       // the query service will ensure that the indexes are synchronized with the data service before querying
        if (request_plus)
            query = query.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);
        // get document
        let promise = new Promise ((resolve,reject) => {
            bucket.query(query,(err,rows)=>{
                if (err) {
                    resolve(err)
                }
                else {
                    resolve(rows.length ? rows[0] : {code:13,message:'The key does not exist on the server'});
                }

            });
        });
        let result = await promise;
        return result;
    },

    save_customer : async (customer) => {
        let result = await CouchbaseService.save(`customer::${customer.id}`,customer,false);
        if (!result.code)
            result = await CouchbaseService.get_customer_via_N1ql(customer.id,true);
        return result;
    },

    /*
    * Transaction Specific Functions
    */

    list_transactions : async (offset=0, limit=10, searchparams = {}) => {
        let total   = 0;
        let where   = 'WHERE a.type=\'transaction\'';
        let paged   = parseInt(limit) !== 0;
        let query;
        let promise;
        let result;

        // get count since we are requesting a paged resultset
        if (paged){
            query = couchbase.N1qlQuery.fromString(`
                SELECT  COUNT(a.id) AS total
                FROM    \`transaction-app\` a
                ${where}
            `);

            promise = new Promise ((resolve,reject) => {
                 bucket.query(query,(err,rows)=>{
                     resolve(err ? err : rows[0]);
                 });
             });

             result = await promise;

             if (!result.code && result.total)
                 total = result.total;
        }

        // fetch records ( full or paged )
        if (!paged || (!result.code && result.total)){
            query = `
                SELECT  a.id,a.transactionID,a.card,a.amount,a.success,a.createdOn,
                        {
                            'id'        : b.id,
                            'firstName' : b.firstName,
                            'lastName'  : b.lastName,
                            'email'     : b.email,
                            'phone'     : b.phone
                        } AS customer
                FROM    \`transaction-app\` a
                JOIN    \`transaction-app\` b ON KEYS ('customer::'||TO_STRING(a.customerID))
                ${where}
            `;

            // set up search
            if (searchparams.from && searchparams.to)
                query += `AND a.createdOn BETWEEN '${searchparams.from}' AND '${searchparams.to}'`;
            else if (searchparams.from)
                query += `AND a.createdOn BETWEEN '${searchparams.from}' AND '${moment().add(1,'d').utc().format()}'`;
            else if (searchparams.to)
                query += `AND a.createdOn <= '${searchparams.to}'`;

            // on single lookup field lookup remove order by to shave off some ms
            if (searchparams.id && searchparams.field)
                query += `AND a.${searchparams.field} = '${searchparams.id}'`;
            else
                query += ' ORDER BY a.createdOn DESC ';

            if (paged)
                query += `OFFSET ${offset} LIMIT ${limit}`;

            query = couchbase.N1qlQuery.fromString(query);
            query = query.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);

            promise = new Promise ((resolve,reject) => {
                bucket.query(query,(err,rows)=>{
                    resolve(err ? err : rows);
                });
            });

            result = await promise;

            // now we prepare for return
            if (!result.code){
                result = {
                    'transactions' : result,
                    'total'        : paged ? total : result.length
                };
            }
        }
        return result;
    },

    has_transactions : async (id) => {
        let query = couchbase.N1qlQuery.fromString(`
            SELECT  COUNT(id) AS total
            FROM    \`transaction-app\`
            WHERE   type = 'transaction' AND customerID = '${id}'
        `);

        let promise = new Promise ((resolve,reject) => {
            bucket.query(query,(err,rows)=>{
                resolve(err ? err : rows[0].total);
            });
        });

        let result = await promise;

        // now we prepare for return
        if (!result.code){
            result = result > 0 ? true : false;
        }

        return result;
    }
}

module.exports = CouchbaseService;