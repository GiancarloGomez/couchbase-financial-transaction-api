(function(){
    'use strict'

    let initialLoad = 'transactions';

    feather.replace();

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        switch (e.target.id.replace('-tab','')) {
            case 'customers':
                if(!Customers.loaded)
                    Customers.fetch();
            break;

            default:
                if(!Transactions.loaded)
                    Transactions.fetch();
            break;
        }
    });

    /**
    * Transactions Namespace
    */
    const Transactions = {
        apiEndpoint     : '/api/transactions/',
        customerSelect  : null,
        datatable       : null,
        filterForm      : null,
        filterReset     : null,
        form            : null,
        loaded          : false,
        modal           : null,
        modalLink       : null,
        tab             : null,
        table           : null,
        view            : null,
        changeEvent     : new Event('change'),

        init : function () {
            let _this = this;

            _this.tab = $('#transactions-tab');
            _this.modal = $('#transaction-create-modal').modal({backdrop:'static',keyboard:false,show:false});
            _this.view = $('#transaction-modal').modal({show:false});
            _this.form = _this.modal.find('form');

            _this.filterForm = $('#transactions-filter').on('submit',function(){
                _this.filter();
                return false;
            });

            _this.filterReset = _this.filterForm.find('[data-reset]').on('click',function(){
                _this.filterReset.addClass('invisible');
                _this.filterForm.get(0).reset();
                _this.filter();
                return false;
            });

            _this.table = $('#transactions-data').on('click','button[data-id]',function(e){
                e.preventDefault();
                _this.openModal(this.dataset);
            });

            _this.customerSelect = $('#customer-select').on('change',function(){
                let ccname = document.getElementById('cc-name');
                ccname.value = this.options[this.selectedIndex].innerHTML;
                ccname.dispatchEvent(_this.changeEvent);
            });

            _this.modalLink = $('#new-transaction').on('click',function(e) {
                e.preventDefault();
                if (!Customers.data)
                    Customers.fetch(Transactions.openChargeModal);
                else
                    _this.openChargeModal()
            });

            _this.form
                .on('submit',function(){
                    _this.charge();
                    return false;
                })
                .card({
                    container: '.card-wrapper',
                    placeholders: {
                        number: '•••• •••• •••• ••••',
                        name: 'Select Customer',
                        expiry: '••/••',
                        cvc: '•••'
                    }
                });
        },

        load : function() {
            let _this = this;
            if (!_this.tab)
                _this.init();
            _this.tab.click();
        },

        filter : function() {
            let _this   = this;
            let params  = {};
            let _form   = _this.filterForm.get(0);

            if (_form.trx_sch_id.value){
                params.field = _form.trx_sch_type.value;
                params.id = _form.trx_sch_id.value;
            }
            if (_form.trx_sch_date_from.value)
                params.from = moment(_form.trx_sch_date_from.value).utc().format();
            if (_form.trx_sch_date_to.value)
                params.to = moment(_form.trx_sch_date_to.value + ' 23:59:59').utc().format();

            if (Object.keys(params).length)
                _this.filterReset.removeClass('invisible');
            else
                _this.filterReset.addClass('invisible');

            _this.fetch(params);
        },

        fetch : function(params={}) {
            let _this = this;
            if (!_this.table)
                _this.init();
            _this.loaded = true;
            // set to 0 for no paging
            params.limit = 0;
            $.ajax({
                url : _this.apiEndpoint,
                cache : false,
                data : params
            })
            .done ( (response) => {
                _this.createTable(response.transactions)
            } );
        },

        createTable : function(data) {
            if (!this.datatable){
                this.datatable = this.table.DataTable( {
                    searching: false,
                    lengthChange: false,
                    pageLength: 25,
                    data: data,
                    order : [[ 3, "desc" ]],
                    columns: [
                        {
                            data: 'amount',
                            title:'AMOUNT',
                            orderable : false,
                            render: $.fn.dataTable.render.number( ',', '.', 2 ,'$ ')
                        },
                        {
                            data: 'transactionID',
                            title:'TRANSACTION',
                            orderable : false,
                            render: (data, type, row, meta) => {
                                return `${row.id}
                                <small class="d-block text-muted">${row.transactionID}</small>
                                `;
                            }
                        },
                        {
                            data: 'customer',
                            title:'CUSTOMER',
                            orderable : false,
                            render: (data, type, row, meta) => {
                                return `${data.firstName} ${data.lastName}
                                <small class="d-block text-muted">${data.email}</small>
                                `;
                            }
                        },
                        {
                            data: 'createdOn',
                            title:'DATE',
                            class:'text-right',
                            render: (data, type, row, meta) => {
                                return type === 'sort' ? data : moment(data).format('MMM D, YYYY h:mm A');
                            }
                        },
                        {
                            orderable : false,
                            class:'text-right',
                            render: (data, type, row, meta) => {
                                return type === 'display' ? `<button type="button" class="btn btn-sm btn-primary" data-id="${row.id}" data-row="${meta.row}">VIEW</button>` : '';
                            }
                        }
                    ]
                });
            }
            else {
                this.datatable.clear().draw();
                this.datatable.rows.add(data);
                this.datatable.columns.adjust().draw();
            }
        },

        openModal : function(data) {
            let _this = this;
            $.ajax({
                url : _this.apiEndpoint + data.id
            })
            .done( response => {
                let data = response;
                let str = `
                    <div>
                        <div class="form-group">
                            <label>STRIPE TRANSACTION</label>
                            <input type="text" readonly class="form-control-plaintext" value="${data.transactionID}">
                        </div>
                        <div class="form-group">
                            <label>CARD</label>
                            <input type="text" readonly class="form-control-plaintext" value="${data.card.brand} ${data.card.last4}">
                        </div>
                        <div class="form-group">
                            <label>AMOUNT</label>
                            <input type="text" readonly class="form-control-plaintext" value="$${data.amount}">
                        </div>
                        <div class="form-group">
                            <label>REQUEST</label>
                            <pre class="card card-body bg-light mb-2">${JSON.stringify(data.request, undefined, 2)}</pre>
                        </div>
                    </div>
                    <div>
                        <label>RESPONSE</label>
                        <pre class="card card-body bg-light mb-2">${JSON.stringify(data.response, undefined, 2)}</pre>
                    </div>
                `;
                _this.view.find('.modal-title').html(`TRANSACTION <small class="d-block">${data.id}</small>`).end().find('.modal-body').html(str).end().modal('show');
            })
            .fail( error => {
                Notification.toast(error.responseJSON.message);
            });
        },

        openChargeModal : function() {
            if (Customers.data.length){
                // because of use as callback reference namespace
                let _this = Transactions;
                let str = '<option value="">SELECT CUSTOMER</option>';
                for (let customer of Customers.data){
                    str += `<option value="${customer.id}">${customer.firstName} ${customer.lastName}</option>`;
                }
                let name      = document.getElementById('cc-name');
                let number    = document.getElementById('cc-number');
                let expiry    = document.getElementById('cc-expiry');
                let cvc       = document.getElementById('cc-cvc');
                let amount    = document.getElementById('cc-amount');

                name.value = '';
                number.value = '';
                expiry.value = '';
                cvc.value = '';
                amount.value = '';

                name.dispatchEvent(_this.changeEvent);
                number.dispatchEvent(_this.changeEvent);
                expiry.dispatchEvent(_this.changeEvent);
                cvc.dispatchEvent(_this.changeEvent);

                _this.customerSelect.html(str);
                _this.modal.modal('show');
            }
            else {
                Notification.alert('There must be at least one customer in the database in order to create a new charge');
            }
        },

        charge : function() {
            let _this = this;
            let _form = _this.form.get(0);
            let exp  = _form.expiry.value.toString().split('/').map( a => a.toString().trim() );
            let data = {
                customerID  : _form.customer.value,
                amount      : _form.amount.value,
                card        : {
                    number	    : _form.number.value,
                    exp_month   : exp[0],
                    exp_year    : exp[1],
                    cvc         : _form.cvc.value
                }
            }
            let submitBtn = _this.modal.find('[type="submit"]');
            submitBtn.text('PROCESSING ...').attr('disabled',true);
            $.ajax({
                url         : _this.apiEndpoint,
                contentType : 'application/json',
                data        : JSON.stringify(data),
                method      : 'post'
            })
            .done ( response => {
                Notification.toast(`Charge for $${_form.amount.value} successfully processed.`,'CHARGE',6000,true);
                // fetch updated records
                _this.fetch();
                _this.modal.modal('hide');
            })
            .fail( error => {
                Notification.alert(error.responseJSON.message);
            })
            .always( () => {
                submitBtn.text('CHARGE').attr('disabled',false);
            });
        }
    };

    /**
    * Customers Namespace
    */
    const Customers = {
        apiEndpoint     : '/api/customers/',
        data            : null,
        datatable       : null,
        deleteModal     : null,
        filterForm      : null,
        filterReset     : null,
        form            : null,
        loaded          : false,
        modal           : null,
        modalLink       : null,
        recordToDelete  : null,
        tab             : null,
        table           : null,
        addressPurposes : [
            { value : 'billing', label : 'Billing'},
            { value : 'home', label : 'Home'},
            { value : 'shipping', label : 'Shipping'},
            { value : 'work', label : 'Work'},
            { value : 'other', label : 'Other'}
        ],

        init : function () {
            let _this = this;

            _this.tab = $('#customers-tab');

            _this.filterForm = $('#customers-filter').on('submit',function(){
                _this.filter();
                return false;
            });

            _this.filterReset = _this.filterForm.find('[data-reset]').on('click',function(){
                _this.filterReset.addClass('invisible');
                _this.filterForm.get(0).reset();
                _this.filter();
                return false;
            });

            _this.deleteModal = $('#delete-modal')
                                .modal({backdrop:'static',keyboard:false,show:false})
                                .on('click','button[data-delete]',function(){
                                    _this.delete(_this.recordToDelete,false);
                                });

            _this.modal = $('#customer-modal')
                            .modal({backdrop:'static',keyboard:false,show:false});

            _this.table = $('#customers-data').on('click','button[data-id]',function(e){
                                e.preventDefault();
                                if (this.dataset.action === 'edit')
                                    _this.openModal(this.dataset);
                                else
                                    _this.delete(this,true);
                            });

            _this.modalLink = $('#new-customer').on('click',function(e) {
                                    e.preventDefault();
                                    _this.openModal();
                                });

            _this.form  = _this.modal.find('form')
                            .on('submit',function(e){
                                e.preventDefault();
                                _this.save();
                            })
                            .on('click','button[data-action]',function(e){
                                e.preventDefault();
                                let totalAddresses = _this.form.find('fieldset').length;
                                switch (this.dataset.action) {
                                    case 'delete-address':
                                    if (totalAddresses > 1){
                                        $(this).parents('fieldset').remove();
                                        if (totalAddresses === 2)
                                            _this.form.find('fieldset button[data-action]').attr('disabled',true).addClass('d-none');
                                    }
                                    break;
                                    default:
                                    if (totalAddresses === 1)
                                        _this.form.find('fieldset button[data-action]').attr('disabled',false).removeClass('d-none');
                                    _this.form.find('#customer_addresses').append(_this.buildAddress({},totalAddresses));
                                    break;
                                }
                            });
        },

        load : function() {
            let _this = this;
            if (!_this.tab)
            _this.init();
            _this.tab.click();
        },

        filter : function() {
            let _this   = this;
            let params  = {};
            let _form   = _this.filterForm.get(0);

            if (_form.cst_sch_value.value){
                params.type = _form.cst_sch_type.value;
                params.value = _form.cst_sch_value.value;
            }

            if (Object.keys(params).length)
                _this.filterReset.removeClass('invisible');
            else
                _this.filterReset.addClass('invisible');

            _this.fetch(null,params);
        },

        fetch : function(callback,params={}) {
            let _this = this;
            if (!_this.table)
                _this.init();
            if (!callback)
                _this.loaded = true;
            // set to 0 for no paging
            params.limit = 0;
            $.ajax({
                url : _this.apiEndpoint,
                data : params
            })
            .done ( response => {
                _this.data = response.customers;
                if (callback)
                    callback();
                else
                    _this.createTable(_this.data)
            })
            .fail( error => {
                Notification.toast(error.responseJSON.message);
            });
        },

        createTable : function(data) {
            if (!this.datatable){
                this.datatable = this.table.DataTable({
                    searching: false,
                    lengthChange: false,
                    scrollX: true,
                    pageLength: 25,
                    data: data,
                    order : [[ 0, "asc" ]],
                    columns: [
                        {
                            title:'CUSTOMER',
                            render: (data, type, row, meta) => {
                                return `${row.firstName} ${row.lastName}`;
                            }
                        },
                        {
                            data: 'email',
                            title:'EMAIL'
                        },
                        {
                            data: 'phone',
                            title:'PHONE'
                        },
                        {
                            data: 'createdOn',
                            title:'CREATED',
                            class:'text-right text-nowrap',
                            render: (data, type, row, meta) => {
                                return type === 'display' ? moment(data).format('MMM D, YYYY h:mm A') : '';
                            }
                        },
                        {
                            data: 'modifiedOn',
                            title:'MODIFIED',
                            class:'text-right text-nowrap',
                            render: (data, type, row, meta) => {
                                return type === 'display' ? moment(data).format('MMM D, YYYY h:mm A') : '';
                            }
                        },
                        {
                            data : null,
                            orderable : false,
                            class:'text-right text-nowrap',
                            render: (data, type, row, meta) => {
                                return type === 'display' ? `
                                    <button type="button" class="btn btn-sm btn-primary" data-id="${row.id}" data-row="${meta.row}" data-action="edit">EDIT</button>
                                    <button type="button" class="btn btn-sm btn-danger" data-id="${row.id}" data-row="${meta.row}" data-action="delete">DELETE</button>
                                ` : '';
                            }
                        }
                    ]
                });
            }
            else {
                this.datatable.clear().draw();
                this.datatable.rows.add(data);
                this.datatable.columns.adjust().draw();
            }
        },

        openModal : function(data = {}){
            let _this = this;
            // create customer
            if (!data.id){
                _this.buildForm(data);
            }
            // edit customer
            else {
                $.ajax({
                    url : _this.apiEndpoint + data.id
                })
                .done( response => {
                    _this.buildForm(response);
                })
                .fail( error => {
                    Notification.toast(error.responseJSON.message);
                });
            }
        },

        buildForm : function (data) {
            let _this = this;
            let _form = _this.form.get(0);
            _form._id.value = data.id || '';
            _form.firstName.value = data.firstName || '';
            _form.lastName.value = data.lastName || '';
            _form.email.value = data.email || '';
            _form.phone.value = data.phone || '';
            // handle title
            _this.modal.find('.modal-title').html(data.id ? `EDIT CUSTOMER <small class="d-block">${data.id}</small>` : `CREATE CUSTOMER`)
            // handle addresses
            _this.initAddressEditor(data.addresses || []);
            // set delete button state
            if (_this.form.find('fieldset').length === 1)
                _this.form.find('fieldset button[data-action]').attr('disabled',true).addClass('d-none');
            this.modal.modal('show');
        },

        initAddressEditor : function (addresses) {
            let str = '<h6 class="text-muted">ADDRESSES</h6>';
            let _this = this;
            if (addresses.length){
                addresses.forEach(function(address,index){
                    str += _this.buildAddress(address,index);
                });
            }
            else {
                str += _this.buildAddress({},0);
            }
            this.form.find('#customer_addresses').html(str);
        },

        buildAddress : function (address,index) {
            return `
            <fieldset class="card card-body bg-light">
                <input type="hidden" name="id_${index}" value="${address.id || ''}" />
                ${this.buildAddressPurpose(address.purpose,index)}
                <div class="form-group">
                    <input type="text" name="street_${index}" id="street_${index}" value="${address.street || ''}" class="form-control form-control-sm" placeholder="Street" aria-label="Street" />
                </div>
                <div class="form-group">
                    <input type="text" name="city_${index}" id="city_${index}" value="${address.city || ''}" class="form-control form-control-sm" placeholder="City" aria-label="City" />
                </div>
                <div class="form-group">
                    <input type="text" name="state_${index}" id="state_${index}" value="${address.state || ''}" class="form-control form-control-sm" placeholder="State" aria-label="State" />
                </div>
                <div class="form-group">
                    <input type="text" name="postcode_${index}" id="postcode_${index}" value="${address.postcode || ''}" class="form-control form-control-sm" placeholder="Zip Code" aria-label="Zip Code" />
                </div>
                <div class="form-group">
                    <input type="text" name="country_${index}" id="country_${index}" value="${address.country || ''}" class="form-control form-control-sm" placeholder="Country" aria-label="Country" maxlength="2" />
                </div>
                <div class="text-right">
                    <button type="button" class="btn btn-sm btn-link text-danger" data-action="delete-address">DELETE</button>
                </div>
            </fieldset>
            `;
        },

        buildAddressPurpose : function(purpose,index) {
            let str = `<div class="form-group"><select name="purpose_${index}" id="purpose_${index}" class="form-control form-control-sm">`;
            for (let _purpose of this.addressPurposes){
                str += `<option value="${_purpose.value}"${_purpose.value === purpose ? ' selected' : ''}>${_purpose.label}</option>`;
            }
            str += '</select></div>';
            return str;
        },

        save : function () {
            let _this = this;
            let _form = _this.form.get(0);
            let data = {
                id          : _form._id.value,
                firstName   : _form.firstName.value,
                lastName    : _form.lastName.value,
                email       : _form.email.value,
                phone       : _form.phone.value,
                addresses   : []
            };
            _this.form.find('fieldset').each(function(index){
                data.addresses.push({
                    id          : _form['id_' + index].value,
                    purpose     : _form['purpose_' + index].value,
                    street      : _form['street_' + index].value,
                    city        : _form['city_' + index].value,
                    state       : _form['state_' + index].value,
                    postcode    : _form['postcode_' + index].value,
                    country     : _form['country_' + index].value
                });
            });
            let submitBtn = _this.modal.find('[type="submit"]');

            submitBtn.text('PROCESSING ...').attr('disabled',true);

            $.ajax({
                url         : _this.apiEndpoint + data.id,
                contentType : 'application/json',
                data        : JSON.stringify(data),
                method      : data.id !== '' ? 'put' : 'post'
            })
            .done ( response => {
                // fetch updated records
                _this.fetch();
                _this.modal.modal('hide');
            })
            .fail( error => {
                Notification.toast(error.responseJSON.message);
            })
            .always( () => {
                submitBtn.text('CHARGE').attr('disabled',false);
            });
        },

        delete : function(record,confirm) {
            let _this = this;
            if (confirm){
                let name = $(record).parents('tr').find('td:first-child').text();
                _this.recordToDelete = record;
                _this.deleteModal.find('.modal-body').html(`Are you sure you want to delete the customer record for ${name}?`).end().modal('show');
            }
            else {
                let submitBtn = _this.deleteModal.find('[data-delete]');
                submitBtn.text('PROCESSING ...').attr('disabled',true);
                // delete record
                $.ajax({
                    url         : _this.apiEndpoint + this.recordToDelete.dataset.id,
                    method      : 'delete'
                })
                .done ( response => {
                    let position = _this.data.findIndex( a => a.id === _this.recordToDelete.dataset.id);
                    _this.data.splice(position,1);
                    _this.datatable.row($(_this.recordToDelete).parents('tr')).remove().draw();
                })
                .fail( error => {
                    Notification.alert(error.responseJSON.message);
                })
                .always( () => {
                    _this.deleteModal.modal('hide');
                    submitBtn.text('CONTINUE').attr('disabled',false);
                });
            }
        }
    };

    const Notification = {
        alertModal : null,

        alert : function(message) {
            if (!this.alertModal)
                this.alertModal = $('#alert-modal').modal({show:false});
            this.alertModal.find('.modal-body').html(message).end().modal('show');
        },

        toast : function(message,title="Error",delay=5000,autohide=false) {
            let toast = `<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                            <div class="toast-header">
                                <strong class="mr-auto">${title}</strong>
                                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="toast-body">${message}</div>
                        </div>`;

            $('#toasts')
                .append(toast)
                .find('.toast')
                .toast({autohide:autohide,delay:delay})
                .on('hidden.bs.toast',function() {
                    $(this).remove()
                })
                .toast('show');
        }
    }

    if (location.hash)
        initialLoad = location.hash.replace('#','');

    switch(initialLoad){
        case 'customers':
            Customers.load();
        break;

        default:
            Transactions.load();
        break;
    }
}())