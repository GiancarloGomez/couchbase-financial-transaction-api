# Couchbase Sample Customer + Transaction App
This project consist of a RESTFUL API built using express.js and a static front end client app for demonstrating working with Couchbase using the Node SDK provided.

The application is a simple credit card terminal that allows a user to manage customers and their credit card transactions. The credit payments are done via Stripe.

## Project Structure
* :file_folder: __config__ <br />*for .env files - view readme in folder for more details*
* :file_folder: __controllers__
* :file_folder: __models__
* :file_folder: __public__<br />*static front end app*
* :file_folder: __routes__
* :file_folder: __services__

## Getting Started
* Have access to a Couchbase Server to work with<br />*download and run locally or in the cloud*
* clone or download repo
* run `npm install` at project root to install all packages
* review `config/readme.md` and generate required files as specified
* run `npm run dev` at project root to run the development server on port `3000`
* browse to http://localhost:3000

## Postman Collection and Environment
A basic collection and environment is available in the `/public/postman/` folder

## Indexes Created
```sql
CREATE PRIMARY INDEX `def_transaction_app_primary` ON `transaction-app`;

CREATE INDEX `def_trx_customer_id` ON `transaction-app`(`id`) WHERE (`_type` = "customer") WITH { "defer_build":true

CREATE INDEX `def_transaction_app_type` ON `transaction-app`(`type`);
```