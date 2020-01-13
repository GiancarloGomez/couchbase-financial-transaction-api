module.exports = () => {
    return {
        'id'            : '',
        'version'       : process.env.SCHEMA_VERSION,
        'type'          : 'transaction',
        'customerID'    : '',
        'transactionID' : '',
        'card'          : {
            'brand' : '',
            'last4' : ''
        },
        'amount'        : 0,
        'success'       : true,
        'request'       : {},
        'response'      : {},
        'createdOn'     : ''
    }
}