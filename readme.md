
# INDEXES
```
CREATE PRIMARY INDEX `def_transaction_app_primary` ON `transaction-app`;

CREATE INDEX `def_trx_customer_id` ON `transaction-app`(`id`) WHERE (`_type` = "customer") WITH { "defer_build":true }

CREATE INDEX `def_transaction_app_type` ON `transaction-app`(`type`);
```

```
SELECT `id`,`firstName`,`lastName`,`phone`,`type`,`version`
FROM   `transaction-app`
WHERE  `type`='customer'
```