-- ==========================================================
-- Malwa Solar CRM ? MySQL tables for phpMyAdmin
-- Target DB: u808821982_crm
-- How: phpMyAdmin -> select u808821982_crm -> Import -> this file -> Go
-- Structure only (+ django_migrations rows so migrate works)
-- ==========================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

DROP TABLE IF EXISTS `accounts_branch`;
CREATE TABLE `accounts_branch` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `city` varchar(100) NOT NULL,
  `address` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_account`;
CREATE TABLE `accounts_module_account` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `account_type` varchar(20) NOT NULL,
  `contact_person` varchar(200) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(254) NOT NULL,
  `city` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `balance` decimal(14,2) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_acco_created_by_id_a5cd5be2_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_acco_created_by_id_a5cd5be2_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_bankaccount`;
CREATE TABLE `accounts_module_bankaccount` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_name` varchar(200) NOT NULL,
  `bank_name` varchar(200) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc` varchar(20) NOT NULL,
  `account_type` varchar(30) NOT NULL,
  `branch` varchar(200) NOT NULL,
  `balance` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_bank_created_by_id_282f60c6_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_bank_created_by_id_282f60c6_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_chartofaccount`;
CREATE TABLE `accounts_module_chartofaccount` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) NOT NULL,
  `account_name` varchar(200) NOT NULL,
  `account_type` varchar(20) NOT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `parent_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_code` (`account_code`),
  KEY `accounts_module_char_parent_id_51fadef4_fk_accounts_` (`parent_id`),
  CONSTRAINT `accounts_module_char_parent_id_51fadef4_fk_accounts_` FOREIGN KEY (`parent_id`) REFERENCES `accounts_module_chartofaccount` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_cheque`;
CREATE TABLE `accounts_module_cheque` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cheque_no` varchar(50) NOT NULL,
  `cheque_date` date NOT NULL,
  `payee_name` varchar(200) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `cheque_type` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `cleared_date` date DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `bank_account_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `payment_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_id` (`payment_id`),
  KEY `accounts_module_cheq_bank_account_id_62e644ec_fk_accounts_` (`bank_account_id`),
  KEY `accounts_module_cheq_created_by_id_9b645498_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_cheq_bank_account_id_62e644ec_fk_accounts_` FOREIGN KEY (`bank_account_id`) REFERENCES `accounts_module_bankaccount` (`id`),
  CONSTRAINT `accounts_module_cheq_created_by_id_9b645498_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_cheq_payment_id_833220a6_fk_accounts_` FOREIGN KEY (`payment_id`) REFERENCES `accounts_module_payment` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_gstopeningbalance`;
CREATE TABLE `accounts_module_gstopeningbalance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `month` date NOT NULL,
  `igst_opening` decimal(14,2) NOT NULL,
  `cgst_opening` decimal(14,2) NOT NULL,
  `sgst_opening` decimal(14,2) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_payment`;
CREATE TABLE `accounts_module_payment` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `direction` varchar(10) NOT NULL,
  `reference_no` varchar(100) NOT NULL,
  `payment_date` date NOT NULL,
  `party_name` varchar(200) NOT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `project_ref` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `bank_account_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `party_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `project_payment_id` bigint(20) DEFAULT NULL,
  `advance_amount` decimal(14,2) DEFAULT NULL,
  `due_amount` decimal(14,2) DEFAULT NULL,
  `particulars` longtext NOT NULL,
  `receipt_source` varchar(30) NOT NULL,
  `received_from` varchar(200) NOT NULL,
  `related_staff_id` bigint(20) DEFAULT NULL,
  `settled_amount` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_payment_id` (`project_payment_id`),
  KEY `accounts_module_paym_bank_account_id_9f9b2d90_fk_accounts_` (`bank_account_id`),
  KEY `accounts_module_paym_created_by_id_c4972cf1_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_paym_party_id_92b05405_fk_accounts_` (`party_id`),
  KEY `accounts_module_paym_project_id_04d753c4_fk_projects_` (`project_id`),
  KEY `accounts_module_paym_related_staff_id_ea2e0bba_fk_accounts_` (`related_staff_id`),
  CONSTRAINT `accounts_module_paym_bank_account_id_9f9b2d90_fk_accounts_` FOREIGN KEY (`bank_account_id`) REFERENCES `accounts_module_bankaccount` (`id`),
  CONSTRAINT `accounts_module_paym_created_by_id_c4972cf1_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_paym_party_id_92b05405_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_paym_project_id_04d753c4_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `accounts_module_paym_project_payment_id_cc3035c8_fk_projects_` FOREIGN KEY (`project_payment_id`) REFERENCES `projects_projectpayment` (`id`),
  CONSTRAINT `accounts_module_paym_related_staff_id_ea2e0bba_fk_accounts_` FOREIGN KEY (`related_staff_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_paymentvoucher`;
CREATE TABLE `accounts_module_paymentvoucher` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `voucher_no` varchar(100) NOT NULL,
  `voucher_date` date NOT NULL,
  `entry_type` varchar(10) NOT NULL,
  `payee_type` varchar(20) NOT NULL,
  `payee_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `particulars` longtext NOT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `employee_voucher_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_paymentvoucher_voucher_no_6e146a85_uniq` (`voucher_no`),
  UNIQUE KEY `employee_voucher_id` (`employee_voucher_id`),
  KEY `accounts_module_paym_created_by_id_37059ad7_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_paym_project_id_63a5527a_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_paym_created_by_id_37059ad7_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_paym_employee_voucher_id_f53af025_fk_workforce` FOREIGN KEY (`employee_voucher_id`) REFERENCES `workforce_employeevoucher` (`id`),
  CONSTRAINT `accounts_module_paym_project_id_63a5527a_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_purchasechallan`;
CREATE TABLE `accounts_module_purchasechallan` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `challan_no` varchar(100) NOT NULL,
  `challan_date` date NOT NULL,
  `supplier_name` varchar(200) NOT NULL,
  `vehicle_no` varchar(30) NOT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `payment_amount` decimal(14,2) NOT NULL,
  `balance_due` decimal(14,2) NOT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `supplier_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_purchasechallan_challan_no_dd6b7b81_uniq` (`challan_no`),
  KEY `accounts_module_purc_created_by_id_74b6df7d_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_purc_project_id_af2ae6a8_fk_projects_` (`project_id`),
  KEY `accounts_module_purc_supplier_id_7581326e_fk_accounts_` (`supplier_id`),
  CONSTRAINT `accounts_module_purc_created_by_id_74b6df7d_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_purc_project_id_af2ae6a8_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `accounts_module_purc_supplier_id_7581326e_fk_accounts_` FOREIGN KEY (`supplier_id`) REFERENCES `accounts_module_account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_purchasechallanline`;
CREATE TABLE `accounts_module_purchasechallanline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `challan_id` bigint(20) NOT NULL,
  `inventory_item_id` bigint(20) DEFAULT NULL,
  `stock_movement_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_movement_id` (`stock_movement_id`),
  KEY `accounts_module_purc_challan_id_8f759789_fk_accounts_` (`challan_id`),
  KEY `accounts_module_purc_inventory_item_id_6bb8d693_fk_inventory` (`inventory_item_id`),
  CONSTRAINT `accounts_module_purc_challan_id_8f759789_fk_accounts_` FOREIGN KEY (`challan_id`) REFERENCES `accounts_module_purchasechallan` (`id`),
  CONSTRAINT `accounts_module_purc_inventory_item_id_6bb8d693_fk_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`),
  CONSTRAINT `accounts_module_purc_stock_movement_id_a4beb62a_fk_inventory` FOREIGN KEY (`stock_movement_id`) REFERENCES `inventory_stockmovement` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_purchaseinvoice`;
CREATE TABLE `accounts_module_purchaseinvoice` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `gst_type` varchar(12) NOT NULL,
  `cgst_percent` decimal(5,2) NOT NULL,
  `sgst_percent` decimal(5,2) NOT NULL,
  `igst_percent` decimal(5,2) NOT NULL,
  `subtotal` decimal(14,2) NOT NULL,
  `gst_amount` decimal(14,2) NOT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `invoice_no` varchar(100) NOT NULL,
  `invoice_date` date NOT NULL,
  `supplier_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `payment_amount` decimal(14,2) NOT NULL,
  `balance_due` decimal(14,2) NOT NULL,
  `extra_charges_total` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `supplier_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_purchaseinvoice_invoice_no_11a051fe_uniq` (`invoice_no`),
  KEY `accounts_module_purc_created_by_id_4a8a0e26_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_purc_project_id_c1ab9c7a_fk_projects_` (`project_id`),
  KEY `accounts_module_purc_supplier_id_4b1daff8_fk_accounts_` (`supplier_id`),
  CONSTRAINT `accounts_module_purc_created_by_id_4a8a0e26_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_purc_project_id_c1ab9c7a_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `accounts_module_purc_supplier_id_4b1daff8_fk_accounts_` FOREIGN KEY (`supplier_id`) REFERENCES `accounts_module_account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceextracharge`;
CREATE TABLE `accounts_module_purchaseinvoiceextracharge` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `description` varchar(200) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `invoice_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_purc_invoice_id_e8999806_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_purc_invoice_id_e8999806_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_purchaseinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceline`;
CREATE TABLE `accounts_module_purchaseinvoiceline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `invoice_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_purc_invoice_id_4765f1ad_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_purc_invoice_id_4765f1ad_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_purchaseinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_sellchallan`;
CREATE TABLE `accounts_module_sellchallan` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `challan_no` varchar(100) NOT NULL,
  `challan_date` date NOT NULL,
  `party_name` varchar(200) NOT NULL,
  `vehicle_no` varchar(30) NOT NULL,
  `site_address` varchar(300) NOT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `party_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_sellchallan_challan_no_2e9fd0d9_uniq` (`challan_no`),
  KEY `accounts_module_sell_created_by_id_c1565687_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_sell_party_id_44f76c80_fk_accounts_` (`party_id`),
  KEY `accounts_module_sell_project_id_8097b129_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_sell_created_by_id_c1565687_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_sell_party_id_44f76c80_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_sell_project_id_8097b129_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_sellchallanline`;
CREATE TABLE `accounts_module_sellchallanline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `challan_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_sell_challan_id_d23faeef_fk_accounts_` (`challan_id`),
  CONSTRAINT `accounts_module_sell_challan_id_d23faeef_fk_accounts_` FOREIGN KEY (`challan_id`) REFERENCES `accounts_module_sellchallan` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_sellinvoice`;
CREATE TABLE `accounts_module_sellinvoice` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `gst_type` varchar(12) NOT NULL,
  `cgst_percent` decimal(5,2) NOT NULL,
  `sgst_percent` decimal(5,2) NOT NULL,
  `igst_percent` decimal(5,2) NOT NULL,
  `subtotal` decimal(14,2) NOT NULL,
  `gst_amount` decimal(14,2) NOT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `invoice_no` varchar(100) NOT NULL,
  `invoice_date` date NOT NULL,
  `party_name` varchar(200) NOT NULL,
  `gst_number` varchar(20) NOT NULL,
  `branch` varchar(100) NOT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `payment_amount` decimal(14,2) NOT NULL,
  `balance_due` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `party_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_sellinvoice_invoice_no_eda651af_uniq` (`invoice_no`),
  KEY `accounts_module_sell_created_by_id_b839de56_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_sell_party_id_a71441c0_fk_accounts_` (`party_id`),
  KEY `accounts_module_sell_project_id_85b185f7_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_sell_created_by_id_b839de56_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_sell_party_id_a71441c0_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_sell_project_id_85b185f7_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_sellinvoiceline`;
CREATE TABLE `accounts_module_sellinvoiceline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `invoice_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_sell_invoice_id_22050d50_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_sell_invoice_id_22050d50_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_sellinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_module_transaction`;
CREATE TABLE `accounts_module_transaction` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `transaction_date` date NOT NULL,
  `transaction_type` varchar(30) NOT NULL,
  `reference_number` varchar(100) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `credit_account_id` bigint(20) DEFAULT NULL,
  `debit_account_id` bigint(20) DEFAULT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `bank_account_id` bigint(20) DEFAULT NULL,
  `party_id` bigint(20) DEFAULT NULL,
  `source_payment_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `source_payment_id` (`source_payment_id`),
  KEY `accounts_module_tran_created_by_id_ae904fb3_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_tran_credit_account_id_4d0f5e2c_fk_accounts_` (`credit_account_id`),
  KEY `accounts_module_tran_debit_account_id_fd9101be_fk_accounts_` (`debit_account_id`),
  KEY `accounts_module_tran_bank_account_id_14453160_fk_accounts_` (`bank_account_id`),
  KEY `accounts_module_tran_party_id_8ec15104_fk_accounts_` (`party_id`),
  CONSTRAINT `accounts_module_tran_bank_account_id_14453160_fk_accounts_` FOREIGN KEY (`bank_account_id`) REFERENCES `accounts_module_bankaccount` (`id`),
  CONSTRAINT `accounts_module_tran_created_by_id_ae904fb3_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_tran_credit_account_id_4d0f5e2c_fk_accounts_` FOREIGN KEY (`credit_account_id`) REFERENCES `accounts_module_chartofaccount` (`id`),
  CONSTRAINT `accounts_module_tran_debit_account_id_fd9101be_fk_accounts_` FOREIGN KEY (`debit_account_id`) REFERENCES `accounts_module_chartofaccount` (`id`),
  CONSTRAINT `accounts_module_tran_party_id_8ec15104_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_tran_source_payment_id_93ceeb69_fk_accounts_` FOREIGN KEY (`source_payment_id`) REFERENCES `accounts_module_payment` (`id`),
  CONSTRAINT `positive_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_role`;
CREATE TABLE `accounts_role` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `role_type` varchar(10) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_rolepermission`;
CREATE TABLE `accounts_rolepermission` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `module` varchar(40) NOT NULL,
  `can_view` tinyint(1) NOT NULL,
  `can_add` tinyint(1) NOT NULL,
  `can_edit` tinyint(1) NOT NULL,
  `can_delete` tinyint(1) NOT NULL,
  `can_export` tinyint(1) NOT NULL,
  `can_import` tinyint(1) NOT NULL,
  `can_approve` tinyint(1) NOT NULL,
  `full_access` tinyint(1) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `role_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_rolepermission_role_id_module_c10ff386_uniq` (`role_id`,`module`),
  CONSTRAINT `accounts_rolepermission_role_id_db688956_fk_accounts_role_id` FOREIGN KEY (`role_id`) REFERENCES `accounts_role` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_user`;
CREATE TABLE `accounts_user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `email` varchar(254) NOT NULL,
  `name` varchar(200) NOT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `branch_id` bigint(20) DEFAULT NULL,
  `role_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `unique_email_mobile_pair` (`email`,`mobile`),
  UNIQUE KEY `accounts_user_mobile_68a76a25_uniq` (`mobile`),
  KEY `accounts_user_branch_id_38ec6caf_fk_accounts_branch_id` (`branch_id`),
  KEY `accounts_user_role_id_a6dd19b0_fk_accounts_role_id` (`role_id`),
  KEY `accounts_us_email_a5896a_idx` (`email`,`mobile`),
  KEY `accounts_us_email_74c8d6_idx` (`email`),
  KEY `accounts_us_mobile_646276_idx` (`mobile`),
  CONSTRAINT `accounts_user_branch_id_38ec6caf_fk_accounts_branch_id` FOREIGN KEY (`branch_id`) REFERENCES `accounts_branch` (`id`),
  CONSTRAINT `accounts_user_role_id_a6dd19b0_fk_accounts_role_id` FOREIGN KEY (`role_id`) REFERENCES `accounts_role` (`id`),
  CONSTRAINT `mobile_length_or_blank` CHECK (`mobile` = '' or `mobile` regexp cast('^\\d{10}$' as char charset binary))
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_user_groups`;
CREATE TABLE `accounts_user_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_user_groups_user_id_group_id_59c0b32f_uniq` (`user_id`,`group_id`),
  KEY `accounts_user_groups_group_id_bd11a704_fk_auth_group_id` (`group_id`),
  CONSTRAINT `accounts_user_groups_group_id_bd11a704_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `accounts_user_groups_user_id_52b62117_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `accounts_user_user_permissions`;
CREATE TABLE `accounts_user_user_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_user_user_permi_user_id_permission_id_2ab516c2_uniq` (`user_id`,`permission_id`),
  KEY `accounts_user_user_p_permission_id_113bb443_fk_auth_perm` (`permission_id`),
  CONSTRAINT `accounts_user_user_p_permission_id_113bb443_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `accounts_user_user_p_user_id_e4f0a161_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcclaim`;
CREATE TABLE `amc_amcclaim` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `claim_date` date DEFAULT NULL,
  `claim_amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `warranty_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcclaim_created_by_id_bb327f79_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcclaim_project_id_5cce7368_fk_projects_project_id` (`project_id`),
  KEY `amc_amcclaim_warranty_id_867cdc2f_fk_amc_amcwarranty_id` (`warranty_id`),
  CONSTRAINT `amc_amcclaim_created_by_id_bb327f79_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcclaim_project_id_5cce7368_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcclaim_warranty_id_867cdc2f_fk_amc_amcwarranty_id` FOREIGN KEY (`warranty_id`) REFERENCES `amc_amcwarranty` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amccontract`;
CREATE TABLE `amc_amccontract` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(200) NOT NULL,
  `site` varchar(255) NOT NULL,
  `contract_type` varchar(30) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `annual_value` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `next_renewal_date` date DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amccontract_created_by_id_1566c1af_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amccontract_project_id_6ab70fe3_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amccontract_created_by_id_1566c1af_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amccontract_project_id_6ab70fe3_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcdocument`;
CREATE TABLE `amc_amcdocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `document_type` varchar(30) NOT NULL,
  `category` varchar(100) NOT NULL,
  `file` varchar(100) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `contract_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcdocument_contract_id_2db46400_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcdocument_project_id_a099973c_fk_projects_project_id` (`project_id`),
  KEY `amc_amcdocument_uploaded_by_id_1be975d1_fk_accounts_user_id` (`uploaded_by_id`),
  CONSTRAINT `amc_amcdocument_contract_id_2db46400_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcdocument_project_id_a099973c_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcdocument_uploaded_by_id_1be975d1_fk_accounts_user_id` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcrenewal`;
CREATE TABLE `amc_amcrenewal` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `renewal_date` date DEFAULT NULL,
  `new_end_date` date DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `contract_id` bigint(20) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcrenewal_contract_id_8546b0ab_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcrenewal_created_by_id_d3865fee_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `amc_amcrenewal_contract_id_8546b0ab_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcrenewal_created_by_id_d3865fee_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcservicerequest`;
CREATE TABLE `amc_amcservicerequest` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `requested_date` date DEFAULT NULL,
  `assigned_engineer` varchar(200) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `contract_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcservicerequest_contract_id_4253001b_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcservicerequest_created_by_id_7936c359_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcservicerequest_project_id_afb9b49d_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amcservicerequest_contract_id_4253001b_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcservicerequest_created_by_id_7936c359_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcservicerequest_project_id_afb9b49d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcvisit`;
CREATE TABLE `amc_amcvisit` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `visit_date` date DEFAULT NULL,
  `engineer` varchar(200) NOT NULL,
  `visit_type` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `findings` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `service_request_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcvisit_created_by_id_72f82321_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcvisit_project_id_40e14866_fk_projects_project_id` (`project_id`),
  KEY `amc_amcvisit_service_request_id_35622af0_fk_amc_amcse` (`service_request_id`),
  CONSTRAINT `amc_amcvisit_created_by_id_72f82321_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcvisit_project_id_40e14866_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcvisit_service_request_id_35622af0_fk_amc_amcse` FOREIGN KEY (`service_request_id`) REFERENCES `amc_amcservicerequest` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `amc_amcwarranty`;
CREATE TABLE `amc_amcwarranty` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `asset_type` varchar(100) NOT NULL,
  `manufacturer` varchar(200) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `warranty_start` date DEFAULT NULL,
  `warranty_end` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `coverage_details` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcwarranty_created_by_id_c5765854_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcwarranty_project_id_f56600ec_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amcwarranty_created_by_id_c5765854_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcwarranty_project_id_f56600ec_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `auth_group`;
CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `auth_group_permissions`;
CREATE TABLE `auth_group_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `auth_permission`;
CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_appsetting`;
CREATE TABLE `crm_settings_appsetting` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `category` varchar(50) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`value`)),
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_appsetting_category_key_95122d25_uniq` (`category`,`key`),
  KEY `crm_settings_appsetting_category_863f6191` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=122 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_companyprofile`;
CREATE TABLE `crm_settings_companyprofile` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_documentnumberseries`;
CREATE TABLE `crm_settings_documentnumberseries` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `document_type` varchar(100) NOT NULL,
  `prefix` varchar(30) NOT NULL,
  `next_number` int(10) unsigned NOT NULL CHECK (`next_number` >= 0),
  `padding` smallint(5) unsigned NOT NULL CHECK (`padding` >= 0),
  `suffix` varchar(30) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_documentnum_document_type_prefix_a3d748cb_uniq` (`document_type`,`prefix`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_financialyear`;
CREATE TABLE `crm_settings_financialyear` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `label` varchar(20) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `is_current` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_ipaccessrule`;
CREATE TABLE `crm_settings_ipaccessrule` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `ip_range` varchar(100) NOT NULL,
  `rule_type` varchar(10) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_ipblockedattempt`;
CREATE TABLE `crm_settings_ipblockedattempt` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ip_address` char(39) NOT NULL,
  `username` varchar(200) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `attempted_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=346 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_masterrecord`;
CREATE TABLE `crm_settings_masterrecord` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `master_type` varchar(40) NOT NULL,
  `name` varchar(200) NOT NULL,
  `code` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_masterrecord_master_type_code_83eb31a1_uniq` (`master_type`,`code`),
  KEY `crm_settings_masterrecord_master_type_4cd3e611` (`master_type`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_paymentmode`;
CREATE TABLE `crm_settings_paymentmode` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(30) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL CHECK (`sort_order` >= 0),
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_systembackuplog`;
CREATE TABLE `crm_settings_systembackuplog` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `file_size` varchar(50) NOT NULL,
  `backup_type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_settings_systemb_created_by_id_5bc2af75_fk_accounts_` (`created_by_id`),
  CONSTRAINT `crm_settings_systemb_created_by_id_5bc2af75_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `crm_settings_useractivitylog`;
CREATE TABLE `crm_settings_useractivitylog` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_name` varchar(200) NOT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `ip_address` char(39) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_settings_useract_user_id_bc035427_fk_accounts_` (`user_id`),
  CONSTRAINT `crm_settings_useract_user_id_bc035427_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `daily_tasks_dailytask`;
CREATE TABLE `daily_tasks_dailytask` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `category` varchar(30) NOT NULL,
  `task_date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`details`)),
  `summary_text` varchar(500) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `daily_tasks_dailytask_created_by_id_93c90fff_fk_accounts_user_id` (`created_by_id`),
  KEY `daily_tasks_dailytas_assigned_to_id_a4938daa_fk_workforce` (`assigned_to_id`),
  CONSTRAINT `daily_tasks_dailytas_assigned_to_id_a4938daa_fk_workforce` FOREIGN KEY (`assigned_to_id`) REFERENCES `workforce_employee` (`id`),
  CONSTRAINT `daily_tasks_dailytask_created_by_id_93c90fff_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `django_admin_log`;
CREATE TABLE `django_admin_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext DEFAULT NULL,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint(5) unsigned NOT NULL CHECK (`action_flag` >= 0),
  `change_message` longtext NOT NULL,
  `content_type_id` int(11) DEFAULT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_accounts_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `django_content_type`;
CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `django_migrations`;
CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `django_session`;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `inventory_inventorycategory`;
CREATE TABLE `inventory_inventorycategory` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `inventory_inventoryitem`;
CREATE TABLE `inventory_inventoryitem` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `hsn_code` varchar(20) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `current_stock` decimal(12,2) NOT NULL,
  `minimum_stock` decimal(12,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `warehouse_id` bigint(20) DEFAULT NULL,
  `item_code` varchar(30) DEFAULT NULL,
  `location` varchar(200) NOT NULL,
  `selling_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_inventoryitem_item_code_4cc3502b_uniq` (`item_code`),
  KEY `inventory_inventoryi_warehouse_id_b629e162_fk_inventory` (`warehouse_id`),
  CONSTRAINT `inventory_inventoryi_warehouse_id_b629e162_fk_inventory` FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `inventory_stockmovement`;
CREATE TABLE `inventory_stockmovement` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `movement_type` varchar(20) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `reference` varchar(100) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `from_warehouse_id` bigint(20) DEFAULT NULL,
  `item_id` bigint(20) NOT NULL,
  `to_warehouse_id` bigint(20) DEFAULT NULL,
  `reference_no` varchar(100) NOT NULL,
  `reference_type` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_stockmovem_created_by_id_9a39cb99_fk_accounts_` (`created_by_id`),
  KEY `inventory_stockmovem_from_warehouse_id_6ba809a0_fk_inventory` (`from_warehouse_id`),
  KEY `inventory_stockmovem_item_id_dc9becf8_fk_inventory` (`item_id`),
  KEY `inventory_stockmovem_to_warehouse_id_a3872d26_fk_inventory` (`to_warehouse_id`),
  CONSTRAINT `inventory_stockmovem_created_by_id_9a39cb99_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `inventory_stockmovem_from_warehouse_id_6ba809a0_fk_inventory` FOREIGN KEY (`from_warehouse_id`) REFERENCES `inventory_warehouse` (`id`),
  CONSTRAINT `inventory_stockmovem_item_id_dc9becf8_fk_inventory` FOREIGN KEY (`item_id`) REFERENCES `inventory_inventoryitem` (`id`),
  CONSTRAINT `inventory_stockmovem_to_warehouse_id_a3872d26_fk_inventory` FOREIGN KEY (`to_warehouse_id`) REFERENCES `inventory_warehouse` (`id`),
  CONSTRAINT `sm_positive_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `sm_non_negative_rate` CHECK (`rate` >= 0),
  CONSTRAINT `sm_inward_warehouses` CHECK (`movement_type` <> 'Inward' or `from_warehouse_id` is null and `to_warehouse_id` is not null),
  CONSTRAINT `sm_outward_warehouses` CHECK (`movement_type` <> 'Outward' or `from_warehouse_id` is not null and `to_warehouse_id` is null),
  CONSTRAINT `sm_transfer_warehouses` CHECK (`movement_type` <> 'Transfer' or `from_warehouse_id` is not null and `to_warehouse_id` is not null and (`from_warehouse_id` <> `to_warehouse_id` or `from_warehouse_id` is null or `to_warehouse_id` is null)),
  CONSTRAINT `sm_adjustment_requires_warehouse` CHECK (`movement_type` <> 'Adjustment' or `from_warehouse_id` is not null or `to_warehouse_id` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `inventory_warehouse`;
CREATE TABLE `inventory_warehouse` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `location` varchar(200) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_adminapproval`;
CREATE TABLE `leads_adminapproval` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ivrs_number` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `reason` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `approved_by_id` bigint(20) DEFAULT NULL,
  `duplicate_of_id` bigint(20) DEFAULT NULL,
  `lead_id` bigint(20) NOT NULL,
  `requested_by_id` bigint(20) DEFAULT NULL,
  `requested_customer_name` varchar(255) NOT NULL,
  `requested_mobile_number` varchar(20) NOT NULL,
  `requested_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`requested_payload`)),
  `requested_project_name` varchar(255) NOT NULL,
  `requested_project_type` varchar(50) NOT NULL,
  `created_lead_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_adminapproval_approved_by_id_e3794c4b_fk_accounts_user_id` (`approved_by_id`),
  KEY `leads_adminapproval_duplicate_of_id_f35539b4_fk_leads_lead_id` (`duplicate_of_id`),
  KEY `leads_adminapproval_lead_id_fceb6503_fk_leads_lead_id` (`lead_id`),
  KEY `leads_adminapproval_requested_by_id_48d6a056_fk_accounts_user_id` (`requested_by_id`),
  KEY `leads_adminapproval_created_lead_id_778f8481_fk_leads_lead_id` (`created_lead_id`),
  CONSTRAINT `leads_adminapproval_approved_by_id_e3794c4b_fk_accounts_user_id` FOREIGN KEY (`approved_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_adminapproval_created_lead_id_778f8481_fk_leads_lead_id` FOREIGN KEY (`created_lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_adminapproval_duplicate_of_id_f35539b4_fk_leads_lead_id` FOREIGN KEY (`duplicate_of_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_adminapproval_lead_id_fceb6503_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_adminapproval_requested_by_id_48d6a056_fk_accounts_user_id` FOREIGN KEY (`requested_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_followup`;
CREATE TABLE `leads_followup` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `follow_up_type` varchar(20) NOT NULL,
  `scheduled_at` datetime(6) NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `lead_id` bigint(20) NOT NULL,
  `reminder` varchar(30) NOT NULL,
  `status_after` varchar(20) NOT NULL,
  `outcome` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_followup_created_by_id_920e0b07_fk_accounts_user_id` (`created_by_id`),
  KEY `leads_followup_lead_id_1af7cd17_fk_leads_lead_id` (`lead_id`),
  CONSTRAINT `leads_followup_created_by_id_920e0b07_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_followup_lead_id_1af7cd17_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=210 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_lead`;
CREATE TABLE `leads_lead` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(200) NOT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `ivrs_number` varchar(50) NOT NULL,
  `project_name` varchar(200) NOT NULL,
  `estimated_capacity` varchar(50) NOT NULL,
  `address` longtext NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `source` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `category` varchar(10) NOT NULL,
  `next_follow_up` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `alternate_number` varchar(15) NOT NULL,
  `email` varchar(254) NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `project_type` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `requirement_details` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ivrs_number` (`ivrs_number`),
  KEY `leads_lead_assigned_to_id_d7a91e6c_fk_accounts_user_id` (`assigned_to_id`),
  KEY `leads_lead_created_by_id_bd2e8097_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `leads_lead_assigned_to_id_d7a91e6c_fk_accounts_user_id` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_lead_created_by_id_bd2e8097_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_leadsequencecounter`;
CREATE TABLE `leads_leadsequencecounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_leadsitesurvey`;
CREATE TABLE `leads_leadsitesurvey` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site_address` longtext NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `mounting_type` varchar(30) NOT NULL,
  `site_size_sqft` varchar(50) NOT NULL,
  `customer_feedback` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `survey_date` date DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `lead_id` bigint(20) NOT NULL,
  `surveyed_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lead_id` (`lead_id`),
  KEY `leads_leadsitesurvey_surveyed_by_id_a1ede0e7_fk_accounts_user_id` (`surveyed_by_id`),
  CONSTRAINT `leads_leadsitesurvey_lead_id_01608056_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_leadsitesurvey_surveyed_by_id_a1ede0e7_fk_accounts_user_id` FOREIGN KEY (`surveyed_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_leadsurveyphoto`;
CREATE TABLE `leads_leadsurveyphoto` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `image` varchar(100) NOT NULL,
  `caption` varchar(200) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `survey_id` bigint(20) NOT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_leadsurveyphot_survey_id_e53a47c9_fk_leads_lea` (`survey_id`),
  KEY `leads_leadsurveyphot_uploaded_by_id_b784dafc_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `leads_leadsurveyphot_survey_id_e53a47c9_fk_leads_lea` FOREIGN KEY (`survey_id`) REFERENCES `leads_leadsitesurvey` (`id`),
  CONSTRAINT `leads_leadsurveyphot_uploaded_by_id_b784dafc_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_quotation`;
CREATE TABLE `leads_quotation` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `subtotal` decimal(12,2) NOT NULL,
  `gst_percent` decimal(5,2) NOT NULL,
  `gst_amount` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) NOT NULL,
  `grand_total` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `lead_id` bigint(20) NOT NULL,
  `ac_cable` varchar(200) NOT NULL,
  `acdb` varchar(200) NOT NULL,
  `address` longtext NOT NULL,
  `advance_percent` decimal(5,2) DEFAULT NULL,
  `alternate_number` varchar(15) NOT NULL,
  `city` varchar(100) NOT NULL,
  `commissioning_percent` decimal(5,2) DEFAULT NULL,
  `company_name` varchar(200) NOT NULL,
  `connectors` varchar(200) NOT NULL,
  `customer_contribution` decimal(12,2) NOT NULL,
  `dc_cable` varchar(200) NOT NULL,
  `dcdb` varchar(200) NOT NULL,
  `discom_name` varchar(100) NOT NULL,
  `earthing_kit` varchar(200) NOT NULL,
  `email` varchar(254) NOT NULL,
  `estimated_annual_generation` decimal(10,2) DEFAULT NULL,
  `exclusions` longtext NOT NULL,
  `foundation_type` varchar(100) NOT NULL,
  `gst_number` varchar(20) NOT NULL,
  `installation_cost` decimal(12,2) NOT NULL,
  `installation_percent` decimal(5,2) DEFAULT NULL,
  `installation_type` varchar(30) NOT NULL,
  `inverter_brand` varchar(100) NOT NULL,
  `inverter_capacity` varchar(50) NOT NULL,
  `inverter_model` varchar(100) NOT NULL,
  `inverter_quantity` int(10) unsigned DEFAULT NULL CHECK (`inverter_quantity` >= 0),
  `inverter_warranty` varchar(100) NOT NULL,
  `liaisoning_charges` decimal(12,2) NOT NULL,
  `lightning_arrester` varchar(200) NOT NULL,
  `material_cost` decimal(12,2) NOT NULL,
  `material_dispatch_percent` decimal(5,2) DEFAULT NULL,
  `module_orientation` varchar(50) NOT NULL,
  `monthly_electricity_bill` decimal(10,2) DEFAULT NULL,
  `net_metering_charges` decimal(12,2) NOT NULL,
  `number_of_panels` int(10) unsigned DEFAULT NULL CHECK (`number_of_panels` >= 0),
  `other_charges` decimal(12,2) NOT NULL,
  `panel_brand` varchar(100) NOT NULL,
  `panel_model` varchar(100) NOT NULL,
  `panel_warranty` varchar(100) NOT NULL,
  `panel_wattage` decimal(8,2) DEFAULT NULL,
  `pincode` varchar(10) NOT NULL,
  `plant_capacity_kw` decimal(8,2) DEFAULT NULL,
  `project_type` varchar(30) NOT NULL,
  `quotation_date` date DEFAULT NULL,
  `quotation_number` varchar(30) DEFAULT NULL,
  `sales_executive_id` bigint(20) DEFAULT NULL,
  `sanctioned_load_kw` decimal(8,2) DEFAULT NULL,
  `scope_of_work` longtext NOT NULL,
  `shadow_free_area` varchar(100) NOT NULL,
  `special_instructions` longtext NOT NULL,
  `state` varchar(100) NOT NULL,
  `structure_cost` decimal(12,2) NOT NULL,
  `structure_material` varchar(20) NOT NULL,
  `structure_type` varchar(100) NOT NULL,
  `structure_warranty` varchar(100) NOT NULL,
  `subsidy_amount` decimal(12,2) NOT NULL,
  `subsidy_applicable` tinyint(1) NOT NULL,
  `template` varchar(30) NOT NULL,
  `total_dc_capacity` decimal(8,2) DEFAULT NULL,
  `transportation_cost` decimal(12,2) NOT NULL,
  `valid_till` date DEFAULT NULL,
  `wind_speed_rating` varchar(50) NOT NULL,
  `workmanship_warranty` varchar(100) NOT NULL,
  `aadhaar_number` varchar(20) NOT NULL,
  `cable_tray` varchar(200) NOT NULL,
  `connection_type` varchar(50) NOT NULL,
  `consumer_number` varchar(50) NOT NULL,
  `existing_meter_number` varchar(50) NOT NULL,
  `fasteners` varchar(200) NOT NULL,
  `inverter_type` varchar(30) NOT NULL,
  `mc4_connector` varchar(200) NOT NULL,
  `panel_type` varchar(30) NOT NULL,
  `pvc_pipe` varchar(200) NOT NULL,
  `coating_details` varchar(100) NOT NULL,
  `execution_timeline` varchar(100) NOT NULL,
  `annual_saving_amount` decimal(12,2) DEFAULT NULL,
  `cleaning_solution_including` tinyint(1) NOT NULL,
  `cover_letter` longtext NOT NULL,
  `govt_liasoning_details` varchar(255) NOT NULL,
  `gst_18_amount` decimal(12,2) NOT NULL,
  `gst_5_amount` decimal(12,2) NOT NULL,
  `infra_items` longtext NOT NULL,
  `lt_panel_including` tinyint(1) NOT NULL,
  `monthly_production_units` decimal(12,2) DEFAULT NULL,
  `net_meter_details` longtext NOT NULL,
  `net_metering_including` tinyint(1) NOT NULL,
  `payment_terms_text` longtext NOT NULL,
  `plant_life_years` int(10) unsigned DEFAULT NULL CHECK (`plant_life_years` >= 0),
  `project_cost_with_gst` decimal(12,2) DEFAULT NULL,
  `structure_spec_details` longtext NOT NULL,
  `subject` varchar(255) NOT NULL,
  `tariff_rate_per_unit` decimal(8,2) DEFAULT NULL,
  `taxable_value` decimal(12,2) NOT NULL,
  `terms_and_conditions` longtext NOT NULL,
  `tilt_angle_range` varchar(50) NOT NULL,
  `use_split_gst` tinyint(1) NOT NULL,
  `validity_text` varchar(255) NOT NULL,
  `walkway_including` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_number` (`quotation_number`),
  KEY `leads_quotation_created_by_id_799a0f93_fk_accounts_user_id` (`created_by_id`),
  KEY `leads_quotation_lead_id_942dbc52_fk_leads_lead_id` (`lead_id`),
  KEY `leads_quotation_sales_executive_id_e8ad03f1_fk_accounts_user_id` (`sales_executive_id`),
  CONSTRAINT `leads_quotation_created_by_id_799a0f93_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_quotation_lead_id_942dbc52_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_quotation_sales_executive_id_e8ad03f1_fk_accounts_user_id` FOREIGN KEY (`sales_executive_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leads_quotationitem`;
CREATE TABLE `leads_quotationitem` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `quantity` varchar(50) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `quotation_id` bigint(20) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `specification` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leads_quotationitem_quotation_id_item_name_974cd60f_uniq` (`quotation_id`,`item_name`),
  CONSTRAINT `leads_quotationitem_quotation_id_3929e00a_fk_leads_quotation_id` FOREIGN KEY (`quotation_id`) REFERENCES `leads_quotation` (`id`),
  CONSTRAINT `quantity_numeric` CHECK (`quantity` regexp cast('^\\d+(\\.\\d+)?$' as char charset binary)),
  CONSTRAINT `rate_non_negative` CHECK (`rate` >= 0),
  CONSTRAINT `amount_non_negative` CHECK (`amount` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisonapplication`;
CREATE TABLE `liaisoning_liaisonapplication` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `application_number` varchar(100) NOT NULL,
  `application_type` varchar(50) NOT NULL,
  `capacity_kw` decimal(10,2) DEFAULT NULL,
  `discom` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `submitted_date` date DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonap_created_by_id_c5ca468a_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonap_project_id_614e7f06_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonap_created_by_id_c5ca468a_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_project_id_614e7f06_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisonapproval`;
CREATE TABLE `liaisoning_liaisonapproval` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `approval_type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `due_date` date DEFAULT NULL,
  `description` longtext NOT NULL,
  `remarks` longtext NOT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `rejection_reason` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `approved_by_id` bigint(20) DEFAULT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonap_approved_by_id_454fa86b_fk_accounts_` (`approved_by_id`),
  KEY `liaisoning_liaisonap_assigned_to_id_ec1c7e3a_fk_accounts_` (`assigned_to_id`),
  KEY `liaisoning_liaisonap_created_by_id_e5f7522d_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonap_project_id_f7123cb6_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonap_approved_by_id_454fa86b_fk_accounts_` FOREIGN KEY (`approved_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_assigned_to_id_ec1c7e3a_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_created_by_id_e5f7522d_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_project_id_f7123cb6_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisoncommissioning`;
CREATE TABLE `liaisoning_liaisoncommissioning` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `engineer` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`checklist`)),
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonco_created_by_id_d20b1557_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonco_project_id_91f60917_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonco_created_by_id_d20b1557_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonco_project_id_91f60917_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisoncompliance`;
CREATE TABLE `liaisoning_liaisoncompliance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `compliance_type` varchar(50) NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonco_created_by_id_eb3e42bf_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonco_project_id_5917d850_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonco_created_by_id_eb3e42bf_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonco_project_id_5917d850_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisondocument`;
CREATE TABLE `liaisoning_liaisondocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `module` varchar(20) NOT NULL,
  `related_id` int(11) DEFAULT NULL,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisondo_project_id_2de1b433_fk_projects_` (`project_id`),
  KEY `liaisoning_liaisondo_uploaded_by_id_177e0b7a_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `liaisoning_liaisondo_project_id_2de1b433_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `liaisoning_liaisondo_uploaded_by_id_177e0b7a_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `liaisoning_liaisoninspection`;
CREATE TABLE `liaisoning_liaisoninspection` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `inspector` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`checklist`)),
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonin_created_by_id_0e591e16_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonin_project_id_c8645660_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonin_created_by_id_0e591e16_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonin_project_id_c8645660_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_omasset`;
CREATE TABLE `om_omasset` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `asset_type` varchar(50) NOT NULL,
  `site` varchar(255) NOT NULL,
  `capacity` varchar(100) NOT NULL,
  `manufacturer` varchar(200) NOT NULL,
  `status` varchar(30) NOT NULL,
  `installed_on` date DEFAULT NULL,
  `energy_generated_kwh` decimal(14,2) DEFAULT NULL,
  `energy_consumed_kwh` decimal(14,2) DEFAULT NULL,
  `performance_ratio` decimal(6,2) DEFAULT NULL,
  `specific_yield` decimal(10,2) DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omasset_created_by_id_8804e375_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omasset_project_id_c619b90e_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_omasset_created_by_id_8804e375_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omasset_project_id_c619b90e_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_ombreakdownticket`;
CREATE TABLE `om_ombreakdownticket` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL,
  `site` varchar(255) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `issue_description` longtext NOT NULL,
  `resolution` longtext NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `asset_id` bigint(20) DEFAULT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_ombreakdownticket_asset_id_7146afdc_fk_om_omasset_id` (`asset_id`),
  KEY `om_ombreakdownticket_assigned_to_id_f523c605_fk_accounts_user_id` (`assigned_to_id`),
  KEY `om_ombreakdownticket_created_by_id_4ee284b6_fk_accounts_user_id` (`created_by_id`),
  KEY `om_ombreakdownticket_project_id_6a29210f_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_ombreakdownticket_asset_id_7146afdc_fk_om_omasset_id` FOREIGN KEY (`asset_id`) REFERENCES `om_omasset` (`id`),
  CONSTRAINT `om_ombreakdownticket_assigned_to_id_f523c605_fk_accounts_user_id` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ombreakdownticket_created_by_id_4ee284b6_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ombreakdownticket_project_id_6a29210f_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_omdocument`;
CREATE TABLE `om_omdocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `module` varchar(20) NOT NULL,
  `related_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omdocument_uploaded_by_id_122686c7_fk_accounts_user_id` (`uploaded_by_id`),
  CONSTRAINT `om_omdocument_uploaded_by_id_122686c7_fk_accounts_user_id` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_ommaintenancetask`;
CREATE TABLE `om_ommaintenancetask` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `site` varchar(255) NOT NULL,
  `task_type` varchar(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `engineer` varchar(200) NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `work_details` longtext NOT NULL,
  `checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`checklist`)),
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_ommaintenancetask_created_by_id_6a030753_fk_accounts_user_id` (`created_by_id`),
  KEY `om_ommaintenancetask_project_id_c122bdfc_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_ommaintenancetask_created_by_id_6a030753_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ommaintenancetask_project_id_c122bdfc_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_omreport`;
CREATE TABLE `om_omreport` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `report_type` varchar(50) NOT NULL,
  `file` varchar(100) DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `generated_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omreport_generated_by_id_86616fde_fk_accounts_user_id` (`generated_by_id`),
  CONSTRAINT `om_omreport_generated_by_id_86616fde_fk_accounts_user_id` FOREIGN KEY (`generated_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_omsitevisit`;
CREATE TABLE `om_omsitevisit` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site` varchar(255) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `engineer` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`checklist`)),
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omsitevisit_created_by_id_da3796c5_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omsitevisit_project_id_9a3e3c2d_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_omsitevisit_created_by_id_da3796c5_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omsitevisit_project_id_9a3e3c2d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `om_omsparepart`;
CREATE TABLE `om_omsparepart` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `category` varchar(50) NOT NULL,
  `site` varchar(255) NOT NULL,
  `stock_qty` int(11) NOT NULL,
  `min_stock` int(11) NOT NULL,
  `unit` varchar(50) NOT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `supplier` varchar(200) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `linked_inventory_item_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omsparepart_created_by_id_c305d6b5_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omsparepart_linked_inventory_ite_d14bae66_fk_inventory` (`linked_inventory_item_id`),
  CONSTRAINT `om_omsparepart_created_by_id_c305d6b5_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omsparepart_linked_inventory_ite_d14bae66_fk_inventory` FOREIGN KEY (`linked_inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_installationmaterial`;
CREATE TABLE `projects_installationmaterial` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `required_qty` decimal(12,2) NOT NULL,
  `issued_qty` decimal(12,2) NOT NULL,
  `consumed_qty` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `inventory_item_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_installatio_inventory_item_id_6635745b_fk_inventory` (`inventory_item_id`),
  KEY `projects_installatio_project_id_1ab4d2a1_fk_projects_` (`project_id`),
  CONSTRAINT `projects_installatio_inventory_item_id_6635745b_fk_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`),
  CONSTRAINT `projects_installatio_project_id_1ab4d2a1_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_materialplan`;
CREATE TABLE `projects_materialplan` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `category` varchar(100) NOT NULL,
  `items` varchar(50) NOT NULL,
  `uom` varchar(20) NOT NULL,
  `planned_qty` varchar(50) NOT NULL,
  `planned_value` varchar(50) NOT NULL,
  `status` varchar(30) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_materialplan_project_id_f5c60e74_fk_projects_project_id` (`project_id`),
  CONSTRAINT `projects_materialplan_project_id_f5c60e74_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_project`;
CREATE TABLE `projects_project` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `project_id` varchar(50) NOT NULL,
  `project_name` varchar(200) NOT NULL,
  `customer_name` varchar(200) NOT NULL,
  `site` varchar(200) NOT NULL,
  `site_address` longtext NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `project_type` varchar(20) NOT NULL,
  `capacity_kwp` decimal(8,2) NOT NULL,
  `system_type` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `progress_percent` int(11) NOT NULL,
  `start_date` date DEFAULT NULL,
  `target_date` date DEFAULT NULL,
  `contract_date` date DEFAULT NULL,
  `actual_completion` date DEFAULT NULL,
  `po_number` varchar(100) NOT NULL,
  `total_value` decimal(12,2) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `lead_id` bigint(20) DEFAULT NULL,
  `manager_id` bigint(20) DEFAULT NULL,
  `site_engineer_id` bigint(20) DEFAULT NULL,
  `project_image` varchar(100) DEFAULT NULL,
  `meter_number` varchar(50) NOT NULL,
  `site_size` varchar(100) NOT NULL,
  `consumer_number` varchar(50) NOT NULL,
  `discom_name` varchar(100) NOT NULL,
  `meter_type` varchar(50) NOT NULL,
  `sales_executive_id` bigint(20) DEFAULT NULL,
  `sanction_load` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `projects_project_created_by_id_c49d7b6d_fk_accounts_user_id` (`created_by_id`),
  KEY `projects_project_lead_id_f0322889_fk_leads_lead_id` (`lead_id`),
  KEY `projects_project_manager_id_d3b083b7_fk_accounts_user_id` (`manager_id`),
  KEY `projects_project_site_engineer_id_f4606725_fk_accounts_user_id` (`site_engineer_id`),
  KEY `projects_project_sales_executive_id_b6bcdcdd_fk_accounts_user_id` (`sales_executive_id`),
  CONSTRAINT `projects_project_created_by_id_c49d7b6d_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_project_lead_id_f0322889_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `projects_project_manager_id_d3b083b7_fk_accounts_user_id` FOREIGN KEY (`manager_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_project_sales_executive_id_b6bcdcdd_fk_accounts_user_id` FOREIGN KEY (`sales_executive_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_project_site_engineer_id_f4606725_fk_accounts_user_id` FOREIGN KEY (`site_engineer_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectactivity`;
CREATE TABLE `projects_projectactivity` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `activity_type` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectacti_assigned_to_id_48a84359_fk_accounts_` (`assigned_to_id`),
  KEY `projects_projectacti_created_by_id_ef350a4c_fk_accounts_` (`created_by_id`),
  KEY `projects_projectacti_project_id_9e2c6343_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectacti_assigned_to_id_48a84359_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectacti_created_by_id_ef350a4c_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectacti_project_id_9e2c6343_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectapproval`;
CREATE TABLE `projects_projectapproval` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `approval_type` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `description` longtext NOT NULL,
  `requested_by` varchar(200) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `remarks` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `rejection_reason` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `approved_by_id` bigint(20) DEFAULT NULL,
  `assigned_to_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectappr_approved_by_id_dd5d9ef2_fk_accounts_` (`approved_by_id`),
  KEY `projects_projectappr_assigned_to_id_c17763a8_fk_accounts_` (`assigned_to_id`),
  KEY `projects_projectappr_created_by_id_31384c8a_fk_accounts_` (`created_by_id`),
  KEY `projects_projectappr_project_id_14268cc5_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectappr_approved_by_id_dd5d9ef2_fk_accounts_` FOREIGN KEY (`approved_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_assigned_to_id_c17763a8_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_created_by_id_31384c8a_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_project_id_14268cc5_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectapprovaldocument`;
CREATE TABLE `projects_projectapprovaldocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `approval_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectappr_approval_id_d20d5e23_fk_projects_` (`approval_id`),
  CONSTRAINT `projects_projectappr_approval_id_d20d5e23_fk_projects_` FOREIGN KEY (`approval_id`) REFERENCES `projects_projectapproval` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectchecklistitem`;
CREATE TABLE `projects_projectchecklistitem` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `phase` varchar(20) NOT NULL,
  `category` varchar(100) NOT NULL,
  `label` varchar(200) NOT NULL,
  `is_checked` tinyint(1) NOT NULL,
  `notes` varchar(300) NOT NULL,
  `checked_at` datetime(6) DEFAULT NULL,
  `checked_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectchec_checked_by_id_5a976e6e_fk_accounts_` (`checked_by_id`),
  KEY `projects_projectchec_project_id_2591910f_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectchec_checked_by_id_5a976e6e_fk_accounts_` FOREIGN KEY (`checked_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectchec_project_id_2591910f_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectdocument`;
CREATE TABLE `projects_projectdocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectdocu_project_id_41155174_fk_projects_` (`project_id`),
  KEY `projects_projectdocu_uploaded_by_id_2e43c47e_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `projects_projectdocu_project_id_41155174_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectdocu_uploaded_by_id_2e43c47e_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectexpense`;
CREATE TABLE `projects_projectexpense` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `category` varchar(30) NOT NULL,
  `description` varchar(200) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  `payment_mode` varchar(30) NOT NULL,
  `paid_by` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectexpe_created_by_id_49123dff_fk_accounts_` (`created_by_id`),
  KEY `projects_projectexpe_project_id_d1ea1ba9_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectexpe_created_by_id_49123dff_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectexpe_project_id_d1ea1ba9_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectexpensedocument`;
CREATE TABLE `projects_projectexpensedocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `expense_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectexpe_expense_id_e0469d38_fk_projects_` (`expense_id`),
  CONSTRAINT `projects_projectexpe_expense_id_e0469d38_fk_projects_` FOREIGN KEY (`expense_id`) REFERENCES `projects_projectexpense` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectmilestone`;
CREATE TABLE `projects_projectmilestone` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `progress_percent` int(11) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `sequence` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `owner_id` bigint(20) DEFAULT NULL,
  `parent_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectmilestone_owner_id_4eccc6c9_fk_accounts_user_id` (`owner_id`),
  KEY `projects_projectmile_parent_id_89acea20_fk_projects_` (`parent_id`),
  KEY `projects_projectmile_project_id_f92bcb15_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectmile_parent_id_89acea20_fk_projects_` FOREIGN KEY (`parent_id`) REFERENCES `projects_projectmilestone` (`id`),
  CONSTRAINT `projects_projectmile_project_id_f92bcb15_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectmilestone_owner_id_4eccc6c9_fk_accounts_user_id` FOREIGN KEY (`owner_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectnote`;
CREATE TABLE `projects_projectnote` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `content` longtext NOT NULL,
  `is_pinned` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectnote_created_by_id_870a5061_fk_accounts_user_id` (`created_by_id`),
  KEY `projects_projectnote_project_id_cd2837aa_fk_projects_project_id` (`project_id`),
  CONSTRAINT `projects_projectnote_created_by_id_870a5061_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectnote_project_id_cd2837aa_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectpayment`;
CREATE TABLE `projects_projectpayment` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(30) NOT NULL,
  `payment_date` date NOT NULL,
  `reference` varchar(100) NOT NULL,
  `notes` varchar(300) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectpaym_created_by_id_7cf2bbfa_fk_accounts_` (`created_by_id`),
  KEY `projects_projectpaym_project_id_1f061a60_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectpaym_created_by_id_7cf2bbfa_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectpaym_project_id_1f061a60_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectsystemconfig`;
CREATE TABLE `projects_projectsystemconfig` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `inverter_brand` varchar(100) NOT NULL,
  `inverter_model` varchar(100) NOT NULL,
  `inverter_capacity_kw` decimal(8,2) DEFAULT NULL,
  `panel_brand` varchar(100) NOT NULL,
  `panel_model` varchar(100) NOT NULL,
  `panel_wattage_w` decimal(8,2) DEFAULT NULL,
  `panel_count` int(11) DEFAULT NULL,
  `string_count` int(11) DEFAULT NULL,
  `protection_devices` longtext NOT NULL,
  `notes` longtext NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  CONSTRAINT `projects_projectsyst_project_id_5380026e_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_projectteammember`;
CREATE TABLE `projects_projectteammember` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `role_title` varchar(100) NOT NULL,
  `added_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `access_level` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_member_per_project` (`project_id`,`user_id`),
  KEY `projects_projectteammember_user_id_02f41cbc_fk_accounts_user_id` (`user_id`),
  CONSTRAINT `projects_projectteam_project_id_dde7d02b_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectteammember_user_id_02f41cbc_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_sequencecounter`;
CREATE TABLE `projects_sequencecounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_sitesurvey`;
CREATE TABLE `projects_sitesurvey` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `survey_id` varchar(50) NOT NULL,
  `survey_date` date DEFAULT NULL,
  `building_type` varchar(100) NOT NULL,
  `floor_count` varchar(20) NOT NULL,
  `roof_type` varchar(30) NOT NULL,
  `site_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`site_details`)),
  `roof_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`roof_details`)),
  `electrical_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`electrical_details`)),
  `roof_stats` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`roof_stats`)),
  `feasibility` varchar(30) NOT NULL,
  `summary_notes` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  `surveyed_by_id` bigint(20) DEFAULT NULL,
  `available_area_sqft` varchar(50) NOT NULL,
  `customer_budget` decimal(12,2) DEFAULT NULL,
  `electricity_bill_amount` decimal(12,2) DEFAULT NULL,
  `financial_remarks` longtext NOT NULL,
  `rooftop_area_sqft` varchar(50) NOT NULL,
  `shadow_free_area_sqft` varchar(50) NOT NULL,
  `subsidy_applicable` tinyint(1) NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `ac_cable_length_approx` varchar(50) NOT NULL,
  `ac_cable_route` varchar(255) NOT NULL,
  `approx_plant_capacity` varchar(50) NOT NULL,
  `conduit_length_approx` varchar(50) NOT NULL,
  `conduit_route_description` longtext NOT NULL,
  `connection_point_after_commissioning` varchar(255) NOT NULL,
  `dc_cable_length_approx` varchar(50) NOT NULL,
  `dc_cable_route` varchar(255) NOT NULL,
  `earthing_count` varchar(20) NOT NULL,
  `earthing_location` varchar(200) NOT NULL,
  `earthing_remarks` longtext NOT NULL,
  `earthing_required` tinyint(1) NOT NULL,
  `earthing_type` varchar(100) NOT NULL,
  `existing_mcb` varchar(100) NOT NULL,
  `future_expansion` tinyint(1) NOT NULL,
  `inverter_distance_from_roof` varchar(50) NOT NULL,
  `inverter_location_description` varchar(255) NOT NULL,
  `inverter_mounting` varchar(20) NOT NULL,
  `inverter_placement` varchar(20) NOT NULL,
  `meter_capacity` varchar(50) NOT NULL,
  `meter_phase` varchar(20) NOT NULL,
  `meter_remarks` longtext NOT NULL,
  `meter_type` varchar(100) NOT NULL,
  `module_orientation` varchar(20) NOT NULL,
  `obstacle_present` tinyint(1) NOT NULL,
  `roof_height_ft` varchar(20) NOT NULL,
  `roof_length_ft` varchar(20) NOT NULL,
  `roof_remarks` longtext NOT NULL,
  `roof_width_ft` varchar(20) NOT NULL,
  `safety_all_photos_uploaded` tinyint(1) NOT NULL,
  `safety_cable_route_final` tinyint(1) NOT NULL,
  `safety_customer_approval_taken` tinyint(1) NOT NULL,
  `safety_earthing_finalized` tinyint(1) NOT NULL,
  `safety_gps_captured` tinyint(1) NOT NULL,
  `safety_inverter_location_final` tinyint(1) NOT NULL,
  `safety_meter_verified` tinyint(1) NOT NULL,
  `safety_roof_safe` tinyint(1) NOT NULL,
  `safety_shadow_checked` tinyint(1) NOT NULL,
  `safety_tank_checked` tinyint(1) NOT NULL,
  `shadow_present` tinyint(1) NOT NULL,
  `structure_columns` varchar(20) NOT NULL,
  `structure_rows` varchar(20) NOT NULL,
  `tilt_angle` varchar(20) NOT NULL,
  `tree_nearby` tinyint(1) NOT NULL,
  `water_tank_present` tinyint(1) NOT NULL,
  `ac_cable_entry_point` varchar(200) NOT NULL,
  `additional_observations` longtext NOT NULL,
  `alternate_mobile` varchar(20) NOT NULL,
  `average_monthly_bill` varchar(50) NOT NULL,
  `back_leg_height_ft` varchar(20) NOT NULL,
  `cable_route_distance_m` varchar(30) NOT NULL,
  `capacity_required_kw` varchar(30) NOT NULL,
  `customer_confirmation_date` date DEFAULT NULL,
  `customer_confirmation_name` varchar(150) NOT NULL,
  `email_id` varchar(254) NOT NULL,
  `existing_connection` tinyint(1) NOT NULL,
  `extend_sanction_load_kw` varchar(30) NOT NULL,
  `front_leg_height_ft` varchar(20) NOT NULL,
  `ivrs_number` varchar(50) NOT NULL,
  `la_wire_length_m` varchar(30) NOT NULL,
  `last_termination_point` varchar(30) NOT NULL,
  `main_db_location` varchar(200) NOT NULL,
  `main_supply_from` varchar(200) NOT NULL,
  `material_checklist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`material_checklist`)),
  `meter_location` varchar(200) NOT NULL,
  `no_of_sets` varchar(20) NOT NULL,
  `obstacle_building` tinyint(1) NOT NULL,
  `obstacle_electric_pole` tinyint(1) NOT NULL,
  `obstacle_mobile_tower` tinyint(1) NOT NULL,
  `obstacle_other` tinyint(1) NOT NULL,
  `obstacle_other_text` varchar(200) NOT NULL,
  `panels_in_one_row` varchar(20) NOT NULL,
  `project_category` varchar(30) NOT NULL,
  `purpose` varchar(20) NOT NULL,
  `roof_condition` varchar(20) NOT NULL,
  `roof_direction` varchar(20) NOT NULL,
  `roof_tilt_angle` varchar(20) NOT NULL,
  `sanction_load_kw` varchar(30) NOT NULL,
  `shadow_afternoon_from` varchar(20) NOT NULL,
  `shadow_afternoon_percent` varchar(20) NOT NULL,
  `shadow_afternoon_to` varchar(20) NOT NULL,
  `shadow_analysis_remarks` longtext NOT NULL,
  `shadow_evening_from` varchar(20) NOT NULL,
  `shadow_evening_percent` varchar(20) NOT NULL,
  `shadow_evening_to` varchar(20) NOT NULL,
  `shadow_morning_from` varchar(20) NOT NULL,
  `shadow_morning_percent` varchar(20) NOT NULL,
  `shadow_morning_to` varchar(20) NOT NULL,
  `site_drawing` varchar(100) DEFAULT NULL,
  `structure_type` varchar(10) NOT NULL,
  `supply_voltage` varchar(20) NOT NULL,
  `survey_engineer_date` date DEFAULT NULL,
  `survey_engineer_name` varchar(150) NOT NULL,
  `tariff_category` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `survey_id` (`survey_id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` (`surveyed_by_id`),
  CONSTRAINT `projects_sitesurvey_project_id_1a5f1f7d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` FOREIGN KEY (`surveyed_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_sitesurveyphoto`;
CREATE TABLE `projects_sitesurveyphoto` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `slot` varchar(30) NOT NULL,
  `image` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `survey_id` bigint(20) NOT NULL,
  `uploaded_by_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `projects_sitesurveyphoto_survey_id_slot_67842d08_uniq` (`survey_id`,`slot`),
  KEY `projects_sitesurveyp_uploaded_by_id_ff881ee0_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `projects_sitesurveyp_survey_id_b986d0f1_fk_projects_` FOREIGN KEY (`survey_id`) REFERENCES `projects_sitesurvey` (`id`),
  CONSTRAINT `projects_sitesurveyp_uploaded_by_id_ff881ee0_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_subsidyapplication`;
CREATE TABLE `projects_subsidyapplication` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `application_number` varchar(100) NOT NULL,
  `application_date` date DEFAULT NULL,
  `discom` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint(20) NOT NULL,
  `assigned_employee_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_subcdapplic_project_id_67695f97_fk_projects_` (`project_id`),
  KEY `projects_subsidyappl_assigned_employee_id_1d72e14e_fk_workforce` (`assigned_employee_id`),
  CONSTRAINT `projects_subcdapplic_project_id_67695f97_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_subsidyappl_assigned_employee_id_1d72e14e_fk_workforce` FOREIGN KEY (`assigned_employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_subsidydocument`;
CREATE TABLE `projects_subsidydocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `subsidy_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_subsidydocu_subsidy_id_54fc808d_fk_projects_` (`subsidy_id`),
  CONSTRAINT `projects_subsidydocu_subsidy_id_54fc808d_fk_projects_` FOREIGN KEY (`subsidy_id`) REFERENCES `projects_subsidyapplication` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `projects_workorder`;
CREATE TABLE `projects_workorder` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `task` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `assignee_id` bigint(20) DEFAULT NULL,
  `created_by_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  UNIQUE KEY `unique_task_per_project` (`project_id`,`task`),
  KEY `projects_workorder_assignee_id_469d23ca_fk_accounts_user_id` (`assignee_id`),
  KEY `projects_workorder_created_by_id_c4e48e25_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `projects_workorder_assignee_id_469d23ca_fk_accounts_user_id` FOREIGN KEY (`assignee_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_workorder_created_by_id_c4e48e25_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_workorder_project_id_f94d85a5_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `token_blacklist_blacklistedtoken`;
CREATE TABLE `token_blacklist_blacklistedtoken` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `blacklisted_at` datetime(6) NOT NULL,
  `token_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_id` (`token_id`),
  CONSTRAINT `token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk` FOREIGN KEY (`token_id`) REFERENCES `token_blacklist_outstandingtoken` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `token_blacklist_outstandingtoken`;
CREATE TABLE `token_blacklist_outstandingtoken` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `token` longtext NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) NOT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `jti` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq` (`jti`),
  KEY `token_blacklist_outs_user_id_83bc629a_fk_accounts_` (`user_id`),
  CONSTRAINT `token_blacklist_outs_user_id_83bc629a_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employee`;
CREATE TABLE `workforce_employee` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `mobile` varchar(20) NOT NULL,
  `email` varchar(254) NOT NULL,
  `department` varchar(100) NOT NULL,
  `role` varchar(100) NOT NULL,
  `joining_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `present_days` int(11) NOT NULL,
  `absent_days` int(11) NOT NULL,
  `leave_balance` int(11) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `aadhaar_number` varchar(255) NOT NULL,
  `address` longtext NOT NULL,
  `daily_rate` decimal(12,2) NOT NULL,
  `opening_balance` decimal(12,2) NOT NULL,
  `skill_trade` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employeeassignment`;
CREATE TABLE `workforce_employeeassignment` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `task_name` varchar(200) NOT NULL,
  `assigned_date` date NOT NULL,
  `expected_completion` date DEFAULT NULL,
  `priority` varchar(20) NOT NULL,
  `progress_percent` int(11) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `employee_id` bigint(20) NOT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeeas_employee_id_cd07a2b6_fk_workforce` (`employee_id`),
  KEY `workforce_employeeas_project_id_b92ff6e9_fk_projects_` (`project_id`),
  CONSTRAINT `workforce_employeeas_employee_id_cd07a2b6_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`),
  CONSTRAINT `workforce_employeeas_project_id_b92ff6e9_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employeeattendance`;
CREATE TABLE `workforce_employeeattendance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `hours` decimal(5,2) NOT NULL,
  `ot_hours` decimal(5,2) NOT NULL,
  `payment` decimal(12,2) NOT NULL,
  `voucher_amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `employee_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workforce_employeeattendance_employee_id_date_9756d691_uniq` (`employee_id`,`date`),
  CONSTRAINT `workforce_employeeat_employee_id_7cae3d24_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employeedocument`;
CREATE TABLE `workforce_employeedocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `employee_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeedo_employee_id_06894013_fk_workforce` (`employee_id`),
  CONSTRAINT `workforce_employeedo_employee_id_06894013_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employeeidcounter`;
CREATE TABLE `workforce_employeeidcounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workforce_employeevoucher`;
CREATE TABLE `workforce_employeevoucher` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `voucher_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL,
  `notes` longtext NOT NULL,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `employee_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeevo_employee_id_c71a54d7_fk_workforce` (`employee_id`),
  CONSTRAINT `workforce_employeevo_employee_id_c71a54d7_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed migration history from live CRM DB
DELETE FROM `django_migrations`;
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (1,'contenttypes','0001_initial','2026-07-18 06:48:23.028129');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (2,'contenttypes','0002_remove_content_type_name','2026-07-18 06:48:23.063644');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (3,'auth','0001_initial','2026-07-18 06:48:23.141897');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (4,'auth','0002_alter_permission_name_max_length','2026-07-18 06:48:23.159672');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (5,'auth','0003_alter_user_email_max_length','2026-07-18 06:48:23.167837');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (6,'auth','0004_alter_user_username_opts','2026-07-18 06:48:23.175265');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (7,'auth','0005_alter_user_last_login_null','2026-07-18 06:48:23.184255');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (8,'auth','0006_require_contenttypes_0002','2026-07-18 06:48:23.190835');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (9,'auth','0007_alter_validators_add_error_messages','2026-07-18 06:48:23.199966');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (10,'auth','0008_alter_user_username_max_length','2026-07-18 06:48:23.208167');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (11,'auth','0009_alter_user_last_name_max_length','2026-07-18 06:48:23.216067');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (12,'auth','0010_alter_group_name_max_length','2026-07-18 06:48:23.236643');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (13,'auth','0011_update_proxy_permissions','2026-07-18 06:48:23.255633');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (14,'auth','0012_alter_user_first_name_max_length','2026-07-18 06:48:23.265573');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (15,'accounts','0001_initial','2026-07-18 06:48:23.392451');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (16,'accounts','0002_rolepermission_alter_user_options_and_more','2026-07-18 06:48:23.687563');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (17,'accounts','0003_alter_rolepermission_module','2026-07-18 06:48:23.697302');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (18,'accounts','0004_alter_rolepermission_module','2026-07-18 06:48:23.705767');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (19,'accounts','0005_seed_workforce_permission','2026-07-18 06:48:23.764928');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (20,'accounts','0006_alter_user_mobile','2026-07-18 06:48:23.822843');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (21,'accounts','0007_alter_rolepermission_module_daily_tasks','2026-07-18 06:48:23.832579');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (22,'accounts','0008_seed_daily_tasks_permission','2026-07-18 06:48:23.857804');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (23,'accounts','0009_seed_baseline_roles_branch','2026-07-18 06:48:24.938240');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (24,'accounts','0010_seed_tele_sales_executive_role','2026-07-18 06:48:25.036998');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (25,'accounts','0011_grant_followup_delete_sales_tele','2026-07-18 06:48:25.081885');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (26,'leads','0001_initial','2026-07-18 06:48:25.337893');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (27,'projects','0001_initial','2026-07-18 06:48:25.687343');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (28,'inventory','0001_initial','2026-07-18 06:48:25.816399');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (29,'inventory','0002_alter_stockmovement_created_by','2026-07-18 06:48:25.837037');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (30,'projects','0002_installationmaterial_projectchecklistitem_and_more','2026-07-18 06:48:26.578296');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (31,'projects','0003_add_project_payment','2026-07-18 06:48:26.633497');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (32,'projects','0004_project_project_image','2026-07-18 06:48:26.659415');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (33,'projects','0005_add_access_level_to_team_member','2026-07-18 06:48:26.689424');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (34,'projects','0006_project_meter_number_site_size','2026-07-18 06:48:26.768718');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (35,'projects','0007_project_consumer_number_project_discom_name_and_more','2026-07-18 06:48:27.155798');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (36,'projects','0008_add_material_plan','2026-07-18 06:48:27.192161');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (37,'projects','0009_team_member_status','2026-07-18 06:48:27.221600');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (38,'workforce','0001_initial','2026-07-18 06:48:27.305441');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (39,'workforce','0002_employee_attendance_ledger','2026-07-18 06:48:27.461048');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (40,'workforce','0003_alter_employeedocument_file','2026-07-18 06:48:27.471989');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (41,'workforce','0004_alter_employeeattendance_employee_and_more','2026-07-18 06:48:27.507147');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (42,'workforce','0005_employeeidcounter_alter_employee_department','2026-07-18 06:48:27.531572');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (43,'inventory','0003_alter_stockmovement_options_and_more','2026-07-18 06:48:27.699582');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (44,'projects','0010_add_sub_cd_models','2026-07-18 06:48:27.861253');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (45,'projects','0011_rename_subcd_to_subsidy','2026-07-18 06:48:30.247687');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (46,'projects','0012_add_expense_fields','2026-07-18 06:48:30.400531');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (47,'projects','0013_alter_projectexpense_paid_by_and_more','2026-07-18 06:48:30.482474');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (48,'projects','0014_add_project_approval','2026-07-18 06:48:30.634285');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (49,'projects','0015_sitesurvey_latitude_sitesurvey_longitude','2026-07-18 06:48:30.692555');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (50,'projects','0016_sitesurvey_ac_cable_length_approx_and_more','2026-07-18 06:48:32.680921');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (51,'projects','0017_migrate_draft_survey_status','2026-07-18 06:48:32.718826');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (52,'projects','0018_alter_sitesurveyphoto_image','2026-07-18 06:48:32.742864');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (53,'accounts_module','0001_initial','2026-07-18 06:48:32.840839');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (54,'accounts_module','0002_alter_transaction_options_and_more','2026-07-18 06:48:32.898600');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (55,'accounts_module','0003_account_bankaccount_cheque_payment_and_more','2026-07-18 06:48:36.033909');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (56,'accounts_module','0004_account_opening_balance_bankaccount_opening_balance_and_more','2026-07-18 06:48:36.380162');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (57,'accounts_module','0005_accounts_documents','2026-07-18 06:48:37.286812');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (58,'accounts_module','0006_alter_paymentvoucher_voucher_no_and_more','2026-07-18 06:48:37.422840');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (59,'accounts_module','0007_purchasechallanline_stock_movement','2026-07-18 06:48:37.545505');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (60,'admin','0001_initial','2026-07-18 06:48:37.610378');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (61,'admin','0002_logentry_remove_auto_add','2026-07-18 06:48:37.738837');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (62,'admin','0003_logentry_add_action_flag_choices','2026-07-18 06:48:37.761374');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (63,'amc','0001_initial','2026-07-18 06:48:38.218836');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (64,'amc','0002_alter_amcdocument_file','2026-07-18 06:48:38.250092');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (65,'crm_settings','0001_initial','2026-07-18 06:48:38.431304');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (66,'crm_settings','0002_financialyear_ipaccessrule_and_more','2026-07-18 06:48:38.573049');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (67,'workforce','0006_bug_fixes','2026-07-18 06:48:38.591581');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (68,'daily_tasks','0001_initial','2026-07-18 06:48:38.644951');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (69,'daily_tasks','0002_solar_categories_assigned_to','2026-07-18 06:48:38.797042');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (70,'inventory','0004_inventorycategory_inventoryitem_item_code_and_more','2026-07-18 06:48:39.243227');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (71,'leads','0002_lead_alternate_number_lead_email_lead_latitude_and_more','2026-07-18 06:48:39.594597');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (72,'leads','0003_alter_lead_ivrs_number','2026-07-18 06:48:39.620879');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (73,'leads','0004_adminapproval_request_snapshot','2026-07-18 06:48:39.782568');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (74,'leads','0005_alter_quotationitem_options_and_more','2026-07-18 06:48:39.963297');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (75,'leads','0006_quotation_ac_cable_quotation_acdb_quotation_address_and_more','2026-07-18 06:48:42.816431');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (76,'leads','0007_quotation_aadhaar_number_quotation_cable_tray_and_more','2026-07-18 06:48:43.405785');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (77,'leads','0008_quotation_coating_details_and_more','2026-07-18 06:48:43.493158');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (78,'leads','0009_leadsitesurvey_leadsurveyphoto','2026-07-18 06:48:43.621637');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (79,'leads','0010_alter_leadsitesurvey_status','2026-07-18 06:48:43.650188');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (80,'leads','0011_alter_leadsurveyphoto_image','2026-07-18 06:48:43.691755');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (81,'leads','0012_alter_leadsurveyphoto_image','2026-07-18 06:48:43.731225');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (82,'leads','0013_leadsequencecounter_adminapproval_created_lead','2026-07-18 06:48:43.803882');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (83,'leads','0014_followup_reminder_followup_status_after','2026-07-18 06:48:43.979676');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (84,'leads','0015_unassign_self_assigned_leads','2026-07-18 06:48:44.027505');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (85,'leads','0016_followup_outcome','2026-07-18 06:48:44.069923');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (86,'liaisoning','0001_initial','2026-07-18 06:48:44.673951');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (87,'liaisoning','0002_alter_liaisondocument_file','2026-07-18 06:48:44.707653');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (88,'om','0001_initial','2026-07-18 06:48:45.255824');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (89,'om','0002_alter_omdocument_file_alter_omreport_file','2026-07-18 06:48:45.323752');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (90,'om','0003_omsparepart_linked_inventory_item','2026-07-18 06:48:45.375507');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (91,'projects','0019_alter_project_project_image_and_more','2026-07-18 06:48:45.558640');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (92,'projects','0020_sequencecounter_alter_projectexpense_project_and_more','2026-07-18 06:48:45.881234');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (93,'sessions','0001_initial','2026-07-18 06:48:45.908112');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (94,'token_blacklist','0001_initial','2026-07-18 06:48:46.018573');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (95,'token_blacklist','0002_outstandingtoken_jti_hex','2026-07-18 06:48:46.061608');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (96,'token_blacklist','0003_auto_20171017_2007','2026-07-18 06:48:46.125668');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (97,'token_blacklist','0004_auto_20171017_2013','2026-07-18 06:48:46.180391');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (98,'token_blacklist','0005_remove_outstandingtoken_jti','2026-07-18 06:48:46.479219');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (99,'token_blacklist','0006_auto_20171017_2113','2026-07-18 06:48:46.523930');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (100,'token_blacklist','0007_auto_20171017_2214','2026-07-18 06:48:47.842967');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (101,'token_blacklist','0008_migrate_to_bigautofield','2026-07-18 06:48:49.096948');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (102,'token_blacklist','0010_fix_migrate_to_bigautofield','2026-07-18 06:48:49.140862');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (103,'token_blacklist','0011_linearizes_history','2026-07-18 06:48:49.147823');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (104,'token_blacklist','0012_alter_outstandingtoken_user','2026-07-18 06:48:49.293721');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (105,'token_blacklist','0013_alter_blacklistedtoken_options_and_more','2026-07-18 06:48:49.336843');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (106,'leads','0017_quotation_client_pdf_fields','2026-07-18 12:45:56.416465');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (107,'projects','0021_sitesurvey_client_form_fields','2026-07-18 12:45:59.294967');
INSERT INTO `django_migrations` (`id`,`app`,`name`,`applied`) VALUES (108,'projects','0022_sitesurvey_photo_site_drawing_slot','2026-07-18 12:45:59.436755');

SET FOREIGN_KEY_CHECKS=1;
