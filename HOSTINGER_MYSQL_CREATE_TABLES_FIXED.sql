-- FIXED for Hostinger phpMyAdmin
-- Removed CHECK / regexp_like constraints (not supported)
-- Collation: utf8mb4_unicode_ci
-- Import: select DB u808821982_Solar_CRM -> Import -> this file -> Go

-- Malwa Solar CRM - MySQL CREATE TABLES
-- Target Hostinger DB: u808821982_Solar_CRM
-- How: phpMyAdmin -> left click u808821982_Solar_CRM -> SQL tab -> paste ALL -> Go

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: malwa_crm
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accounts_branch`
--

DROP TABLE IF EXISTS `accounts_branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_branch` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `city` varchar(100) NOT NULL,
  `address` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_account`
--

DROP TABLE IF EXISTS `accounts_module_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_account` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_acco_created_by_id_a5cd5be2_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_acco_created_by_id_a5cd5be2_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_bankaccount`
--

DROP TABLE IF EXISTS `accounts_module_bankaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_bankaccount` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_bank_created_by_id_282f60c6_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_bank_created_by_id_282f60c6_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_chartofaccount`
--

DROP TABLE IF EXISTS `accounts_module_chartofaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_chartofaccount` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) NOT NULL,
  `account_name` varchar(200) NOT NULL,
  `account_type` varchar(20) NOT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `parent_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_code` (`account_code`),
  KEY `accounts_module_char_parent_id_51fadef4_fk_accounts_` (`parent_id`),
  CONSTRAINT `accounts_module_char_parent_id_51fadef4_fk_accounts_` FOREIGN KEY (`parent_id`) REFERENCES `accounts_module_chartofaccount` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_cheque`
--

DROP TABLE IF EXISTS `accounts_module_cheque`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_cheque` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `bank_account_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `payment_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_id` (`payment_id`),
  KEY `accounts_module_cheq_bank_account_id_62e644ec_fk_accounts_` (`bank_account_id`),
  KEY `accounts_module_cheq_created_by_id_9b645498_fk_accounts_` (`created_by_id`),
  CONSTRAINT `accounts_module_cheq_bank_account_id_62e644ec_fk_accounts_` FOREIGN KEY (`bank_account_id`) REFERENCES `accounts_module_bankaccount` (`id`),
  CONSTRAINT `accounts_module_cheq_created_by_id_9b645498_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_cheq_payment_id_833220a6_fk_accounts_` FOREIGN KEY (`payment_id`) REFERENCES `accounts_module_payment` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_gstopeningbalance`
--

DROP TABLE IF EXISTS `accounts_module_gstopeningbalance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_gstopeningbalance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_payment`
--

DROP TABLE IF EXISTS `accounts_module_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_payment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `bank_account_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `party_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `project_payment_id` bigint DEFAULT NULL,
  `advance_amount` decimal(14,2) DEFAULT NULL,
  `due_amount` decimal(14,2) DEFAULT NULL,
  `particulars` longtext NOT NULL DEFAULT (_utf8mb4''),
  `receipt_source` varchar(30) NOT NULL,
  `received_from` varchar(200) NOT NULL,
  `related_staff_id` bigint DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_paymentvoucher`
--

DROP TABLE IF EXISTS `accounts_module_paymentvoucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_paymentvoucher` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `employee_voucher_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_paymentvoucher_voucher_no_6e146a85_uniq` (`voucher_no`),
  UNIQUE KEY `employee_voucher_id` (`employee_voucher_id`),
  KEY `accounts_module_paym_created_by_id_37059ad7_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_paym_project_id_63a5527a_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_paym_created_by_id_37059ad7_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_paym_employee_voucher_id_f53af025_fk_workforce` FOREIGN KEY (`employee_voucher_id`) REFERENCES `workforce_employeevoucher` (`id`),
  CONSTRAINT `accounts_module_paym_project_id_63a5527a_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_purchasechallan`
--

DROP TABLE IF EXISTS `accounts_module_purchasechallan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_purchasechallan` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `supplier_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_purchasechallan_challan_no_dd6b7b81_uniq` (`challan_no`),
  KEY `accounts_module_purc_created_by_id_74b6df7d_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_purc_project_id_af2ae6a8_fk_projects_` (`project_id`),
  KEY `accounts_module_purc_supplier_id_7581326e_fk_accounts_` (`supplier_id`),
  CONSTRAINT `accounts_module_purc_created_by_id_74b6df7d_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_purc_project_id_af2ae6a8_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `accounts_module_purc_supplier_id_7581326e_fk_accounts_` FOREIGN KEY (`supplier_id`) REFERENCES `accounts_module_account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_purchasechallanline`
--

DROP TABLE IF EXISTS `accounts_module_purchasechallanline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_purchasechallanline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint unsigned NOT NULL,
  `challan_id` bigint NOT NULL,
  `inventory_item_id` bigint DEFAULT NULL,
  `stock_movement_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_movement_id` (`stock_movement_id`),
  KEY `accounts_module_purc_challan_id_8f759789_fk_accounts_` (`challan_id`),
  KEY `accounts_module_purc_inventory_item_id_6bb8d693_fk_inventory` (`inventory_item_id`),
  CONSTRAINT `accounts_module_purc_challan_id_8f759789_fk_accounts_` FOREIGN KEY (`challan_id`) REFERENCES `accounts_module_purchasechallan` (`id`),
  CONSTRAINT `accounts_module_purc_inventory_item_id_6bb8d693_fk_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`),
  CONSTRAINT `accounts_module_purc_stock_movement_id_a4beb62a_fk_inventory` FOREIGN KEY (`stock_movement_id`) REFERENCES `inventory_stockmovement` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_purchaseinvoice`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_purchaseinvoice` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `supplier_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_purchaseinvoice_invoice_no_11a051fe_uniq` (`invoice_no`),
  KEY `accounts_module_purc_created_by_id_4a8a0e26_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_purc_project_id_c1ab9c7a_fk_projects_` (`project_id`),
  KEY `accounts_module_purc_supplier_id_4b1daff8_fk_accounts_` (`supplier_id`),
  CONSTRAINT `accounts_module_purc_created_by_id_4a8a0e26_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_purc_project_id_c1ab9c7a_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `accounts_module_purc_supplier_id_4b1daff8_fk_accounts_` FOREIGN KEY (`supplier_id`) REFERENCES `accounts_module_account` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_purchaseinvoiceextracharge`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceextracharge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_purchaseinvoiceextracharge` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` varchar(200) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `sort_order` smallint unsigned NOT NULL,
  `invoice_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_purc_invoice_id_e8999806_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_purc_invoice_id_e8999806_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_purchaseinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_purchaseinvoiceline`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_purchaseinvoiceline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint unsigned NOT NULL,
  `invoice_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_purc_invoice_id_4765f1ad_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_purc_invoice_id_4765f1ad_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_purchaseinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_sellchallan`
--

DROP TABLE IF EXISTS `accounts_module_sellchallan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_sellchallan` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `party_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_sellchallan_challan_no_2e9fd0d9_uniq` (`challan_no`),
  KEY `accounts_module_sell_created_by_id_c1565687_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_sell_party_id_44f76c80_fk_accounts_` (`party_id`),
  KEY `accounts_module_sell_project_id_8097b129_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_sell_created_by_id_c1565687_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_sell_party_id_44f76c80_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_sell_project_id_8097b129_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_sellchallanline`
--

DROP TABLE IF EXISTS `accounts_module_sellchallanline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_sellchallanline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint unsigned NOT NULL,
  `challan_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_sell_challan_id_d23faeef_fk_accounts_` (`challan_id`),
  CONSTRAINT `accounts_module_sell_challan_id_d23faeef_fk_accounts_` FOREIGN KEY (`challan_id`) REFERENCES `accounts_module_sellchallan` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_sellinvoice`
--

DROP TABLE IF EXISTS `accounts_module_sellinvoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_sellinvoice` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `party_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_module_sellinvoice_invoice_no_eda651af_uniq` (`invoice_no`),
  KEY `accounts_module_sell_created_by_id_b839de56_fk_accounts_` (`created_by_id`),
  KEY `accounts_module_sell_party_id_a71441c0_fk_accounts_` (`party_id`),
  KEY `accounts_module_sell_project_id_85b185f7_fk_projects_` (`project_id`),
  CONSTRAINT `accounts_module_sell_created_by_id_b839de56_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `accounts_module_sell_party_id_a71441c0_fk_accounts_` FOREIGN KEY (`party_id`) REFERENCES `accounts_module_account` (`id`),
  CONSTRAINT `accounts_module_sell_project_id_85b185f7_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_sellinvoiceline`
--

DROP TABLE IF EXISTS `accounts_module_sellinvoiceline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_sellinvoiceline` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `material_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `rate` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `sort_order` smallint unsigned NOT NULL,
  `invoice_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `accounts_module_sell_invoice_id_22050d50_fk_accounts_` (`invoice_id`),
  CONSTRAINT `accounts_module_sell_invoice_id_22050d50_fk_accounts_` FOREIGN KEY (`invoice_id`) REFERENCES `accounts_module_sellinvoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_module_transaction`
--

DROP TABLE IF EXISTS `accounts_module_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_module_transaction` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_date` date NOT NULL,
  `transaction_type` varchar(30) NOT NULL,
  `reference_number` varchar(100) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `credit_account_id` bigint DEFAULT NULL,
  `debit_account_id` bigint DEFAULT NULL,
  `payment_mode` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `bank_account_id` bigint DEFAULT NULL,
  `party_id` bigint DEFAULT NULL,
  `source_payment_id` bigint DEFAULT NULL,
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
  CONSTRAINT `accounts_module_tran_source_payment_id_93ceeb69_fk_accounts_` FOREIGN KEY (`source_payment_id`) REFERENCES `accounts_module_payment` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_role`
--

DROP TABLE IF EXISTS `accounts_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_role` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `role_type` varchar(10) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_rolepermission`
--

DROP TABLE IF EXISTS `accounts_rolepermission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_rolepermission` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `role_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_rolepermission_role_id_module_c10ff386_uniq` (`role_id`,`module`),
  CONSTRAINT `accounts_rolepermission_role_id_db688956_fk_accounts_role_id` FOREIGN KEY (`role_id`) REFERENCES `accounts_role` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_user`
--

DROP TABLE IF EXISTS `accounts_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `branch_id` bigint DEFAULT NULL,
  `role_id` bigint DEFAULT NULL,
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
  CONSTRAINT `accounts_user_role_id_a6dd19b0_fk_accounts_role_id` FOREIGN KEY (`role_id`) REFERENCES `accounts_role` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_user_groups`
--

DROP TABLE IF EXISTS `accounts_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_user_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_user_groups_user_id_group_id_59c0b32f_uniq` (`user_id`,`group_id`),
  KEY `accounts_user_groups_group_id_bd11a704_fk_auth_group_id` (`group_id`),
  CONSTRAINT `accounts_user_groups_group_id_bd11a704_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `accounts_user_groups_user_id_52b62117_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `accounts_user_user_permissions`
--

DROP TABLE IF EXISTS `accounts_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_user_user_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_user_user_permi_user_id_permission_id_2ab516c2_uniq` (`user_id`,`permission_id`),
  KEY `accounts_user_user_p_permission_id_113bb443_fk_auth_perm` (`permission_id`),
  CONSTRAINT `accounts_user_user_p_permission_id_113bb443_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `accounts_user_user_p_user_id_e4f0a161_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcclaim`
--

DROP TABLE IF EXISTS `amc_amcclaim`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcclaim` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `claim_date` date DEFAULT NULL,
  `claim_amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `warranty_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcclaim_created_by_id_bb327f79_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcclaim_project_id_5cce7368_fk_projects_project_id` (`project_id`),
  KEY `amc_amcclaim_warranty_id_867cdc2f_fk_amc_amcwarranty_id` (`warranty_id`),
  CONSTRAINT `amc_amcclaim_created_by_id_bb327f79_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcclaim_project_id_5cce7368_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcclaim_warranty_id_867cdc2f_fk_amc_amcwarranty_id` FOREIGN KEY (`warranty_id`) REFERENCES `amc_amcwarranty` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amccontract`
--

DROP TABLE IF EXISTS `amc_amccontract`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amccontract` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amccontract_created_by_id_1566c1af_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amccontract_project_id_6ab70fe3_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amccontract_created_by_id_1566c1af_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amccontract_project_id_6ab70fe3_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcdocument`
--

DROP TABLE IF EXISTS `amc_amcdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcdocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `document_type` varchar(30) NOT NULL,
  `category` varchar(100) NOT NULL,
  `file` varchar(100) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `contract_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcdocument_contract_id_2db46400_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcdocument_project_id_a099973c_fk_projects_project_id` (`project_id`),
  KEY `amc_amcdocument_uploaded_by_id_1be975d1_fk_accounts_user_id` (`uploaded_by_id`),
  CONSTRAINT `amc_amcdocument_contract_id_2db46400_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcdocument_project_id_a099973c_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcdocument_uploaded_by_id_1be975d1_fk_accounts_user_id` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcrenewal`
--

DROP TABLE IF EXISTS `amc_amcrenewal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcrenewal` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `renewal_date` date DEFAULT NULL,
  `new_end_date` date DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `contract_id` bigint NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcrenewal_contract_id_8546b0ab_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcrenewal_created_by_id_d3865fee_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `amc_amcrenewal_contract_id_8546b0ab_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcrenewal_created_by_id_d3865fee_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcservicerequest`
--

DROP TABLE IF EXISTS `amc_amcservicerequest`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcservicerequest` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `requested_date` date DEFAULT NULL,
  `assigned_engineer` varchar(200) NOT NULL,
  `description` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `contract_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcservicerequest_contract_id_4253001b_fk_amc_amccontract_id` (`contract_id`),
  KEY `amc_amcservicerequest_created_by_id_7936c359_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcservicerequest_project_id_afb9b49d_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amcservicerequest_contract_id_4253001b_fk_amc_amccontract_id` FOREIGN KEY (`contract_id`) REFERENCES `amc_amccontract` (`id`),
  CONSTRAINT `amc_amcservicerequest_created_by_id_7936c359_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcservicerequest_project_id_afb9b49d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcvisit`
--

DROP TABLE IF EXISTS `amc_amcvisit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcvisit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `visit_date` date DEFAULT NULL,
  `engineer` varchar(200) NOT NULL,
  `visit_type` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `findings` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  `service_request_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcvisit_created_by_id_72f82321_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcvisit_project_id_40e14866_fk_projects_project_id` (`project_id`),
  KEY `amc_amcvisit_service_request_id_35622af0_fk_amc_amcse` (`service_request_id`),
  CONSTRAINT `amc_amcvisit_created_by_id_72f82321_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcvisit_project_id_40e14866_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `amc_amcvisit_service_request_id_35622af0_fk_amc_amcse` FOREIGN KEY (`service_request_id`) REFERENCES `amc_amcservicerequest` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amc_amcwarranty`
--

DROP TABLE IF EXISTS `amc_amcwarranty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amc_amcwarranty` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `asset_type` varchar(100) NOT NULL,
  `manufacturer` varchar(200) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `warranty_start` date DEFAULT NULL,
  `warranty_end` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `coverage_details` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `amc_amcwarranty_created_by_id_c5765854_fk_accounts_user_id` (`created_by_id`),
  KEY `amc_amcwarranty_project_id_f56600ec_fk_projects_project_id` (`project_id`),
  CONSTRAINT `amc_amcwarranty_created_by_id_c5765854_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `amc_amcwarranty_project_id_f56600ec_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_appsetting`
--

DROP TABLE IF EXISTS `crm_settings_appsetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_appsetting` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(50) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` json NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_appsetting_category_key_95122d25_uniq` (`category`,`key`),
  KEY `crm_settings_appsetting_category_863f6191` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_companyprofile`
--

DROP TABLE IF EXISTS `crm_settings_companyprofile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_companyprofile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `data` json NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_documentnumberseries`
--

DROP TABLE IF EXISTS `crm_settings_documentnumberseries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_documentnumberseries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `document_type` varchar(100) NOT NULL,
  `prefix` varchar(30) NOT NULL,
  `next_number` int unsigned NOT NULL,
  `padding` smallint unsigned NOT NULL,
  `suffix` varchar(30) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_documentnum_document_type_prefix_a3d748cb_uniq` (`document_type`,`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_financialyear`
--

DROP TABLE IF EXISTS `crm_settings_financialyear`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_financialyear` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `label` varchar(20) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `is_current` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_ipaccessrule`
--

DROP TABLE IF EXISTS `crm_settings_ipaccessrule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_ipaccessrule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `ip_range` varchar(100) NOT NULL,
  `rule_type` varchar(10) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_ipblockedattempt`
--

DROP TABLE IF EXISTS `crm_settings_ipblockedattempt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_ipblockedattempt` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` char(39) NOT NULL,
  `username` varchar(200) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `attempted_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_masterrecord`
--

DROP TABLE IF EXISTS `crm_settings_masterrecord`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_masterrecord` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `master_type` varchar(40) NOT NULL,
  `name` varchar(200) NOT NULL,
  `code` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `sort_order` int unsigned NOT NULL,
  `metadata` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_masterrecord_master_type_code_83eb31a1_uniq` (`master_type`,`code`),
  KEY `crm_settings_masterrecord_master_type_4cd3e611` (`master_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_paymentmode`
--

DROP TABLE IF EXISTS `crm_settings_paymentmode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_paymentmode` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(30) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `sort_order` int unsigned NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_systembackuplog`
--

DROP TABLE IF EXISTS `crm_settings_systembackuplog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_systembackuplog` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `file_size` varchar(50) NOT NULL,
  `backup_type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_settings_systemb_created_by_id_5bc2af75_fk_accounts_` (`created_by_id`),
  CONSTRAINT `crm_settings_systemb_created_by_id_5bc2af75_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crm_settings_useractivitylog`
--

DROP TABLE IF EXISTS `crm_settings_useractivitylog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_useractivitylog` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_name` varchar(200) NOT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `ip_address` char(39) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_settings_useract_user_id_bc035427_fk_accounts_` (`user_id`),
  CONSTRAINT `crm_settings_useract_user_id_bc035427_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `daily_tasks_dailytask`
--

DROP TABLE IF EXISTS `daily_tasks_dailytask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_tasks_dailytask` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(30) NOT NULL,
  `task_date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `details` json NOT NULL,
  `summary_text` varchar(500) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `assigned_to_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `daily_tasks_dailytask_created_by_id_93c90fff_fk_accounts_user_id` (`created_by_id`),
  KEY `daily_tasks_dailytas_assigned_to_id_a4938daa_fk_workforce` (`assigned_to_id`),
  CONSTRAINT `daily_tasks_dailytas_assigned_to_id_a4938daa_fk_workforce` FOREIGN KEY (`assigned_to_id`) REFERENCES `workforce_employee` (`id`),
  CONSTRAINT `daily_tasks_dailytask_created_by_id_93c90fff_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_admin_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint unsigned NOT NULL,
  `change_message` longtext NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_accounts_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_inventorycategory`
--

DROP TABLE IF EXISTS `inventory_inventorycategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_inventorycategory` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_inventoryitem`
--

DROP TABLE IF EXISTS `inventory_inventoryitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_inventoryitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `warehouse_id` bigint DEFAULT NULL,
  `item_code` varchar(30) DEFAULT NULL,
  `location` varchar(200) NOT NULL,
  `selling_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_inventoryitem_item_code_4cc3502b_uniq` (`item_code`),
  KEY `inventory_inventoryi_warehouse_id_b629e162_fk_inventory` (`warehouse_id`),
  CONSTRAINT `inventory_inventoryi_warehouse_id_b629e162_fk_inventory` FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_stockmovement`
--

DROP TABLE IF EXISTS `inventory_stockmovement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_stockmovement` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `movement_type` varchar(20) NOT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `reference` varchar(100) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `from_warehouse_id` bigint DEFAULT NULL,
  `item_id` bigint NOT NULL,
  `to_warehouse_id` bigint DEFAULT NULL,
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
  CONSTRAINT `sm_adjustment_requires_warehouse` CHECK (((`movement_type` <> _utf8mb4'Adjustment') or (`from_warehouse_id` is not null) or (`to_warehouse_id` is not null))),
  CONSTRAINT `sm_inward_warehouses` CHECK (((`movement_type` <> _utf8mb4'Inward') or ((`from_warehouse_id` is null) and (`to_warehouse_id` is not null)))),
  CONSTRAINT `sm_outward_warehouses` CHECK (((`movement_type` <> _utf8mb4'Outward') or ((`from_warehouse_id` is not null) and (`to_warehouse_id` is null)))),
  CONSTRAINT `sm_transfer_warehouses` CHECK (((`movement_type` <> _utf8mb4'Transfer') or ((`from_warehouse_id` is not null) and (`to_warehouse_id` is not null) and ((`from_warehouse_id` <> `to_warehouse_id`) or (`from_warehouse_id` is null) or (`to_warehouse_id` is null)))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_warehouse`
--

DROP TABLE IF EXISTS `inventory_warehouse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_warehouse` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `location` varchar(200) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_adminapproval`
--

DROP TABLE IF EXISTS `leads_adminapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_adminapproval` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ivrs_number` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `reason` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `approved_by_id` bigint DEFAULT NULL,
  `duplicate_of_id` bigint DEFAULT NULL,
  `lead_id` bigint NOT NULL,
  `requested_by_id` bigint DEFAULT NULL,
  `requested_customer_name` varchar(255) NOT NULL,
  `requested_mobile_number` varchar(20) NOT NULL,
  `requested_payload` json NOT NULL DEFAULT (_utf8mb4'{}'),
  `requested_project_name` varchar(255) NOT NULL,
  `requested_project_type` varchar(50) NOT NULL,
  `created_lead_id` bigint DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_followup`
--

DROP TABLE IF EXISTS `leads_followup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_followup` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `follow_up_type` varchar(20) NOT NULL,
  `scheduled_at` datetime(6) NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `lead_id` bigint NOT NULL,
  `reminder` varchar(30) NOT NULL,
  `status_after` varchar(20) NOT NULL,
  `outcome` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_followup_created_by_id_920e0b07_fk_accounts_user_id` (`created_by_id`),
  KEY `leads_followup_lead_id_1af7cd17_fk_leads_lead_id` (`lead_id`),
  CONSTRAINT `leads_followup_created_by_id_920e0b07_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_followup_lead_id_1af7cd17_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_lead`
--

DROP TABLE IF EXISTS `leads_lead`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_lead` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `assigned_to_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `alternate_number` varchar(15) NOT NULL,
  `email` varchar(254) NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `project_type` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
  `requirement_details` longtext NOT NULL DEFAULT (_utf8mb4''),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ivrs_number` (`ivrs_number`),
  KEY `leads_lead_assigned_to_id_d7a91e6c_fk_accounts_user_id` (`assigned_to_id`),
  KEY `leads_lead_created_by_id_bd2e8097_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `leads_lead_assigned_to_id_d7a91e6c_fk_accounts_user_id` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_lead_created_by_id_bd2e8097_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_leadsequencecounter`
--

DROP TABLE IF EXISTS `leads_leadsequencecounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_leadsequencecounter` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_leadsitesurvey`
--

DROP TABLE IF EXISTS `leads_leadsitesurvey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_leadsitesurvey` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `lead_id` bigint NOT NULL,
  `surveyed_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lead_id` (`lead_id`),
  KEY `leads_leadsitesurvey_surveyed_by_id_a1ede0e7_fk_accounts_user_id` (`surveyed_by_id`),
  CONSTRAINT `leads_leadsitesurvey_lead_id_01608056_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_leadsitesurvey_surveyed_by_id_a1ede0e7_fk_accounts_user_id` FOREIGN KEY (`surveyed_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_leadsurveyphoto`
--

DROP TABLE IF EXISTS `leads_leadsurveyphoto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_leadsurveyphoto` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `image` varchar(100) NOT NULL,
  `caption` varchar(200) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `survey_id` bigint NOT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leads_leadsurveyphot_survey_id_e53a47c9_fk_leads_lea` (`survey_id`),
  KEY `leads_leadsurveyphot_uploaded_by_id_b784dafc_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `leads_leadsurveyphot_survey_id_e53a47c9_fk_leads_lea` FOREIGN KEY (`survey_id`) REFERENCES `leads_leadsitesurvey` (`id`),
  CONSTRAINT `leads_leadsurveyphot_uploaded_by_id_b784dafc_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_quotation`
--

DROP TABLE IF EXISTS `leads_quotation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_quotation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `subtotal` decimal(12,2) NOT NULL,
  `gst_percent` decimal(5,2) NOT NULL,
  `gst_amount` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) NOT NULL,
  `grand_total` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `lead_id` bigint NOT NULL,
  `ac_cable` varchar(200) NOT NULL,
  `acdb` varchar(200) NOT NULL,
  `address` longtext NOT NULL DEFAULT (_utf8mb4''),
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
  `exclusions` longtext NOT NULL DEFAULT (_utf8mb4''),
  `foundation_type` varchar(100) NOT NULL,
  `gst_number` varchar(20) NOT NULL,
  `installation_cost` decimal(12,2) NOT NULL,
  `installation_percent` decimal(5,2) DEFAULT NULL,
  `installation_type` varchar(30) NOT NULL,
  `inverter_brand` varchar(100) NOT NULL,
  `inverter_capacity` varchar(50) NOT NULL,
  `inverter_model` varchar(100) NOT NULL,
  `inverter_quantity` int unsigned DEFAULT NULL,
  `inverter_warranty` varchar(100) NOT NULL,
  `liaisoning_charges` decimal(12,2) NOT NULL,
  `lightning_arrester` varchar(200) NOT NULL,
  `material_cost` decimal(12,2) NOT NULL,
  `material_dispatch_percent` decimal(5,2) DEFAULT NULL,
  `module_orientation` varchar(50) NOT NULL,
  `monthly_electricity_bill` decimal(10,2) DEFAULT NULL,
  `net_metering_charges` decimal(12,2) NOT NULL,
  `number_of_panels` int unsigned DEFAULT NULL,
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
  `sales_executive_id` bigint DEFAULT NULL,
  `sanctioned_load_kw` decimal(8,2) DEFAULT NULL,
  `scope_of_work` longtext NOT NULL DEFAULT (_utf8mb4''),
  `shadow_free_area` varchar(100) NOT NULL,
  `special_instructions` longtext NOT NULL DEFAULT (_utf8mb4''),
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_number` (`quotation_number`),
  KEY `leads_quotation_created_by_id_799a0f93_fk_accounts_user_id` (`created_by_id`),
  KEY `leads_quotation_lead_id_942dbc52_fk_leads_lead_id` (`lead_id`),
  KEY `leads_quotation_sales_executive_id_e8ad03f1_fk_accounts_user_id` (`sales_executive_id`),
  CONSTRAINT `leads_quotation_created_by_id_799a0f93_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `leads_quotation_lead_id_942dbc52_fk_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `leads_lead` (`id`),
  CONSTRAINT `leads_quotation_sales_executive_id_e8ad03f1_fk_accounts_user_id` FOREIGN KEY (`sales_executive_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads_quotationitem`
--

DROP TABLE IF EXISTS `leads_quotationitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_quotationitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `quantity` varchar(50) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `quotation_id` bigint NOT NULL,
  `brand` varchar(100) NOT NULL,
  `specification` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leads_quotationitem_quotation_id_item_name_974cd60f_uniq` (`quotation_id`,`item_name`),
  CONSTRAINT `leads_quotationitem_quotation_id_3929e00a_fk_leads_quotation_id` FOREIGN KEY (`quotation_id`) REFERENCES `leads_quotation` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisonapplication`
--

DROP TABLE IF EXISTS `liaisoning_liaisonapplication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisonapplication` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_number` varchar(100) NOT NULL,
  `application_type` varchar(50) NOT NULL,
  `capacity_kw` decimal(10,2) DEFAULT NULL,
  `discom` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `submitted_date` date DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonap_created_by_id_c5ca468a_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonap_project_id_614e7f06_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonap_created_by_id_c5ca468a_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_project_id_614e7f06_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisonapproval`
--

DROP TABLE IF EXISTS `liaisoning_liaisonapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisonapproval` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approval_type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL,
  `due_date` date DEFAULT NULL,
  `description` longtext NOT NULL,
  `remarks` longtext NOT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `rejection_reason` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `approved_by_id` bigint DEFAULT NULL,
  `assigned_to_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonap_approved_by_id_454fa86b_fk_accounts_` (`approved_by_id`),
  KEY `liaisoning_liaisonap_assigned_to_id_ec1c7e3a_fk_accounts_` (`assigned_to_id`),
  KEY `liaisoning_liaisonap_created_by_id_e5f7522d_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonap_project_id_f7123cb6_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonap_approved_by_id_454fa86b_fk_accounts_` FOREIGN KEY (`approved_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_assigned_to_id_ec1c7e3a_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_created_by_id_e5f7522d_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonap_project_id_f7123cb6_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisoncommissioning`
--

DROP TABLE IF EXISTS `liaisoning_liaisoncommissioning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisoncommissioning` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `engineer` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` json NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonco_created_by_id_d20b1557_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonco_project_id_91f60917_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonco_created_by_id_d20b1557_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonco_project_id_91f60917_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisoncompliance`
--

DROP TABLE IF EXISTS `liaisoning_liaisoncompliance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisoncompliance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `compliance_type` varchar(50) NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonco_created_by_id_eb3e42bf_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonco_project_id_5917d850_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonco_created_by_id_eb3e42bf_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonco_project_id_5917d850_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisondocument`
--

DROP TABLE IF EXISTS `liaisoning_liaisondocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisondocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `module` varchar(20) NOT NULL,
  `related_id` int DEFAULT NULL,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `project_id` bigint DEFAULT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisondo_project_id_2de1b433_fk_projects_` (`project_id`),
  KEY `liaisoning_liaisondo_uploaded_by_id_177e0b7a_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `liaisoning_liaisondo_project_id_2de1b433_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `liaisoning_liaisondo_uploaded_by_id_177e0b7a_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `liaisoning_liaisoninspection`
--

DROP TABLE IF EXISTS `liaisoning_liaisoninspection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `liaisoning_liaisoninspection` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inspector` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` json NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `liaisoning_liaisonin_created_by_id_0e591e16_fk_accounts_` (`created_by_id`),
  KEY `liaisoning_liaisonin_project_id_c8645660_fk_projects_` (`project_id`),
  CONSTRAINT `liaisoning_liaisonin_created_by_id_0e591e16_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `liaisoning_liaisonin_project_id_c8645660_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_omasset`
--

DROP TABLE IF EXISTS `om_omasset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_omasset` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omasset_created_by_id_8804e375_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omasset_project_id_c619b90e_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_omasset_created_by_id_8804e375_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omasset_project_id_c619b90e_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_ombreakdownticket`
--

DROP TABLE IF EXISTS `om_ombreakdownticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_ombreakdownticket` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL,
  `site` varchar(255) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `issue_description` longtext NOT NULL,
  `resolution` longtext NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `asset_id` bigint DEFAULT NULL,
  `assigned_to_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_ombreakdownticket_asset_id_7146afdc_fk_om_omasset_id` (`asset_id`),
  KEY `om_ombreakdownticket_assigned_to_id_f523c605_fk_accounts_user_id` (`assigned_to_id`),
  KEY `om_ombreakdownticket_created_by_id_4ee284b6_fk_accounts_user_id` (`created_by_id`),
  KEY `om_ombreakdownticket_project_id_6a29210f_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_ombreakdownticket_asset_id_7146afdc_fk_om_omasset_id` FOREIGN KEY (`asset_id`) REFERENCES `om_omasset` (`id`),
  CONSTRAINT `om_ombreakdownticket_assigned_to_id_f523c605_fk_accounts_user_id` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ombreakdownticket_created_by_id_4ee284b6_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ombreakdownticket_project_id_6a29210f_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_omdocument`
--

DROP TABLE IF EXISTS `om_omdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_omdocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `module` varchar(20) NOT NULL,
  `related_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omdocument_uploaded_by_id_122686c7_fk_accounts_user_id` (`uploaded_by_id`),
  CONSTRAINT `om_omdocument_uploaded_by_id_122686c7_fk_accounts_user_id` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_ommaintenancetask`
--

DROP TABLE IF EXISTS `om_ommaintenancetask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_ommaintenancetask` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `site` varchar(255) NOT NULL,
  `task_type` varchar(20) NOT NULL,
  `priority` varchar(10) NOT NULL,
  `engineer` varchar(200) NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `work_details` longtext NOT NULL,
  `checklist` json NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_ommaintenancetask_created_by_id_6a030753_fk_accounts_user_id` (`created_by_id`),
  KEY `om_ommaintenancetask_project_id_c122bdfc_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_ommaintenancetask_created_by_id_6a030753_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_ommaintenancetask_project_id_c122bdfc_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_omreport`
--

DROP TABLE IF EXISTS `om_omreport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_omreport` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `report_type` varchar(50) NOT NULL,
  `file` varchar(100) DEFAULT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `generated_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omreport_generated_by_id_86616fde_fk_accounts_user_id` (`generated_by_id`),
  CONSTRAINT `om_omreport_generated_by_id_86616fde_fk_accounts_user_id` FOREIGN KEY (`generated_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_omsitevisit`
--

DROP TABLE IF EXISTS `om_omsitevisit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_omsitevisit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `site` varchar(255) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `engineer` varchar(200) NOT NULL,
  `date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `checklist` json NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omsitevisit_created_by_id_da3796c5_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omsitevisit_project_id_9a3e3c2d_fk_projects_project_id` (`project_id`),
  CONSTRAINT `om_omsitevisit_created_by_id_da3796c5_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omsitevisit_project_id_9a3e3c2d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `om_omsparepart`
--

DROP TABLE IF EXISTS `om_omsparepart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `om_omsparepart` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `category` varchar(50) NOT NULL,
  `site` varchar(255) NOT NULL,
  `stock_qty` int NOT NULL,
  `min_stock` int NOT NULL,
  `unit` varchar(50) NOT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `supplier` varchar(200) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `linked_inventory_item_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `om_omsparepart_created_by_id_c305d6b5_fk_accounts_user_id` (`created_by_id`),
  KEY `om_omsparepart_linked_inventory_ite_d14bae66_fk_inventory` (`linked_inventory_item_id`),
  CONSTRAINT `om_omsparepart_created_by_id_c305d6b5_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `om_omsparepart_linked_inventory_ite_d14bae66_fk_inventory` FOREIGN KEY (`linked_inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_installationmaterial`
--

DROP TABLE IF EXISTS `projects_installationmaterial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_installationmaterial` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `required_qty` decimal(12,2) NOT NULL,
  `issued_qty` decimal(12,2) NOT NULL,
  `consumed_qty` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL,
  `inventory_item_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_installatio_inventory_item_id_6635745b_fk_inventory` (`inventory_item_id`),
  KEY `projects_installatio_project_id_1ab4d2a1_fk_projects_` (`project_id`),
  CONSTRAINT `projects_installatio_inventory_item_id_6635745b_fk_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_inventoryitem` (`id`),
  CONSTRAINT `projects_installatio_project_id_1ab4d2a1_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_materialplan`
--

DROP TABLE IF EXISTS `projects_materialplan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_materialplan` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(100) NOT NULL,
  `items` varchar(50) NOT NULL,
  `uom` varchar(20) NOT NULL,
  `planned_qty` varchar(50) NOT NULL,
  `planned_value` varchar(50) NOT NULL,
  `status` varchar(30) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_materialplan_project_id_f5c60e74_fk_projects_project_id` (`project_id`),
  CONSTRAINT `projects_materialplan_project_id_f5c60e74_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_project`
--

DROP TABLE IF EXISTS `projects_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_project` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `progress_percent` int NOT NULL,
  `start_date` date DEFAULT NULL,
  `target_date` date DEFAULT NULL,
  `contract_date` date DEFAULT NULL,
  `actual_completion` date DEFAULT NULL,
  `po_number` varchar(100) NOT NULL,
  `total_value` decimal(12,2) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `lead_id` bigint DEFAULT NULL,
  `manager_id` bigint DEFAULT NULL,
  `site_engineer_id` bigint DEFAULT NULL,
  `project_image` varchar(100) DEFAULT NULL,
  `meter_number` varchar(50) NOT NULL,
  `site_size` varchar(100) NOT NULL,
  `consumer_number` varchar(50) NOT NULL,
  `discom_name` varchar(100) NOT NULL,
  `meter_type` varchar(50) NOT NULL,
  `sales_executive_id` bigint DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectactivity`
--

DROP TABLE IF EXISTS `projects_projectactivity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectactivity` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `activity_type` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `assigned_to_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  `priority` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectacti_assigned_to_id_48a84359_fk_accounts_` (`assigned_to_id`),
  KEY `projects_projectacti_created_by_id_ef350a4c_fk_accounts_` (`created_by_id`),
  KEY `projects_projectacti_project_id_9e2c6343_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectacti_assigned_to_id_48a84359_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectacti_created_by_id_ef350a4c_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectacti_project_id_9e2c6343_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectapproval`
--

DROP TABLE IF EXISTS `projects_projectapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectapproval` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `approved_by_id` bigint DEFAULT NULL,
  `assigned_to_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectappr_approved_by_id_dd5d9ef2_fk_accounts_` (`approved_by_id`),
  KEY `projects_projectappr_assigned_to_id_c17763a8_fk_accounts_` (`assigned_to_id`),
  KEY `projects_projectappr_created_by_id_31384c8a_fk_accounts_` (`created_by_id`),
  KEY `projects_projectappr_project_id_14268cc5_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectappr_approved_by_id_dd5d9ef2_fk_accounts_` FOREIGN KEY (`approved_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_assigned_to_id_c17763a8_fk_accounts_` FOREIGN KEY (`assigned_to_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_created_by_id_31384c8a_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectappr_project_id_14268cc5_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectapprovaldocument`
--

DROP TABLE IF EXISTS `projects_projectapprovaldocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectapprovaldocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `approval_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectappr_approval_id_d20d5e23_fk_projects_` (`approval_id`),
  CONSTRAINT `projects_projectappr_approval_id_d20d5e23_fk_projects_` FOREIGN KEY (`approval_id`) REFERENCES `projects_projectapproval` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectchecklistitem`
--

DROP TABLE IF EXISTS `projects_projectchecklistitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectchecklistitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `phase` varchar(20) NOT NULL,
  `category` varchar(100) NOT NULL,
  `label` varchar(200) NOT NULL,
  `is_checked` tinyint(1) NOT NULL,
  `notes` varchar(300) NOT NULL,
  `checked_at` datetime(6) DEFAULT NULL,
  `checked_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectchec_checked_by_id_5a976e6e_fk_accounts_` (`checked_by_id`),
  KEY `projects_projectchec_project_id_2591910f_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectchec_checked_by_id_5a976e6e_fk_accounts_` FOREIGN KEY (`checked_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectchec_project_id_2591910f_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectdocument`
--

DROP TABLE IF EXISTS `projects_projectdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectdocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectdocu_project_id_41155174_fk_projects_` (`project_id`),
  KEY `projects_projectdocu_uploaded_by_id_2e43c47e_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `projects_projectdocu_project_id_41155174_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectdocu_uploaded_by_id_2e43c47e_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectexpense`
--

DROP TABLE IF EXISTS `projects_projectexpense`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectexpense` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(30) NOT NULL,
  `description` varchar(200) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  `payment_mode` varchar(30) NOT NULL,
  `paid_by` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
  PRIMARY KEY (`id`),
  KEY `projects_projectexpe_created_by_id_49123dff_fk_accounts_` (`created_by_id`),
  KEY `projects_projectexpe_project_id_d1ea1ba9_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectexpe_created_by_id_49123dff_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectexpe_project_id_d1ea1ba9_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectexpensedocument`
--

DROP TABLE IF EXISTS `projects_projectexpensedocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectexpensedocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `expense_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectexpe_expense_id_e0469d38_fk_projects_` (`expense_id`),
  CONSTRAINT `projects_projectexpe_expense_id_e0469d38_fk_projects_` FOREIGN KEY (`expense_id`) REFERENCES `projects_projectexpense` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectmilestone`
--

DROP TABLE IF EXISTS `projects_projectmilestone`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectmilestone` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `progress_percent` int NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `sequence` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `owner_id` bigint DEFAULT NULL,
  `parent_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectmilestone_owner_id_4eccc6c9_fk_accounts_user_id` (`owner_id`),
  KEY `projects_projectmile_parent_id_89acea20_fk_projects_` (`parent_id`),
  KEY `projects_projectmile_project_id_f92bcb15_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectmile_parent_id_89acea20_fk_projects_` FOREIGN KEY (`parent_id`) REFERENCES `projects_projectmilestone` (`id`),
  CONSTRAINT `projects_projectmile_project_id_f92bcb15_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectmilestone_owner_id_4eccc6c9_fk_accounts_user_id` FOREIGN KEY (`owner_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectnote`
--

DROP TABLE IF EXISTS `projects_projectnote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectnote` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `content` longtext NOT NULL,
  `is_pinned` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectnote_created_by_id_870a5061_fk_accounts_user_id` (`created_by_id`),
  KEY `projects_projectnote_project_id_cd2837aa_fk_projects_project_id` (`project_id`),
  CONSTRAINT `projects_projectnote_created_by_id_870a5061_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectnote_project_id_cd2837aa_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectpayment`
--

DROP TABLE IF EXISTS `projects_projectpayment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectpayment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(30) NOT NULL,
  `payment_date` date NOT NULL,
  `reference` varchar(100) NOT NULL,
  `notes` varchar(300) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectpaym_created_by_id_7cf2bbfa_fk_accounts_` (`created_by_id`),
  KEY `projects_projectpaym_project_id_1f061a60_fk_projects_` (`project_id`),
  CONSTRAINT `projects_projectpaym_created_by_id_7cf2bbfa_fk_accounts_` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_projectpaym_project_id_1f061a60_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectsystemconfig`
--

DROP TABLE IF EXISTS `projects_projectsystemconfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectsystemconfig` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inverter_brand` varchar(100) NOT NULL,
  `inverter_model` varchar(100) NOT NULL,
  `inverter_capacity_kw` decimal(8,2) DEFAULT NULL,
  `panel_brand` varchar(100) NOT NULL,
  `panel_model` varchar(100) NOT NULL,
  `panel_wattage_w` decimal(8,2) DEFAULT NULL,
  `panel_count` int DEFAULT NULL,
  `string_count` int DEFAULT NULL,
  `protection_devices` longtext NOT NULL,
  `notes` longtext NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  CONSTRAINT `projects_projectsyst_project_id_5380026e_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_projectteammember`
--

DROP TABLE IF EXISTS `projects_projectteammember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectteammember` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `role_title` varchar(100) NOT NULL,
  `added_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `access_level` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_member_per_project` (`project_id`,`user_id`),
  KEY `projects_projectteammember_user_id_02f41cbc_fk_accounts_user_id` (`user_id`),
  CONSTRAINT `projects_projectteam_project_id_dde7d02b_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_projectteammember_user_id_02f41cbc_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_sequencecounter`
--

DROP TABLE IF EXISTS `projects_sequencecounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_sequencecounter` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_sitesurvey`
--

DROP TABLE IF EXISTS `projects_sitesurvey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_sitesurvey` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `survey_id` varchar(50) NOT NULL,
  `survey_date` date DEFAULT NULL,
  `building_type` varchar(100) NOT NULL,
  `floor_count` varchar(20) NOT NULL,
  `roof_type` varchar(30) NOT NULL,
  `site_details` json NOT NULL,
  `roof_details` json NOT NULL,
  `electrical_details` json NOT NULL,
  `roof_stats` json NOT NULL,
  `feasibility` varchar(30) NOT NULL,
  `summary_notes` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  `surveyed_by_id` bigint DEFAULT NULL,
  `available_area_sqft` varchar(50) NOT NULL,
  `customer_budget` decimal(12,2) DEFAULT NULL,
  `electricity_bill_amount` decimal(12,2) DEFAULT NULL,
  `financial_remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
  `rooftop_area_sqft` varchar(50) NOT NULL,
  `shadow_free_area_sqft` varchar(50) NOT NULL,
  `subsidy_applicable` tinyint(1) NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `ac_cable_length_approx` varchar(50) NOT NULL,
  `ac_cable_route` varchar(255) NOT NULL,
  `approx_plant_capacity` varchar(50) NOT NULL,
  `conduit_length_approx` varchar(50) NOT NULL,
  `conduit_route_description` longtext NOT NULL DEFAULT (_utf8mb4''),
  `connection_point_after_commissioning` varchar(255) NOT NULL,
  `dc_cable_length_approx` varchar(50) NOT NULL,
  `dc_cable_route` varchar(255) NOT NULL,
  `earthing_count` varchar(20) NOT NULL,
  `earthing_location` varchar(200) NOT NULL,
  `earthing_remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
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
  `meter_remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
  `meter_type` varchar(100) NOT NULL,
  `module_orientation` varchar(20) NOT NULL,
  `obstacle_present` tinyint(1) NOT NULL,
  `roof_height_ft` varchar(20) NOT NULL,
  `roof_length_ft` varchar(20) NOT NULL,
  `roof_remarks` longtext NOT NULL DEFAULT (_utf8mb4''),
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `survey_id` (`survey_id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` (`surveyed_by_id`),
  CONSTRAINT `projects_sitesurvey_project_id_1a5f1f7d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` FOREIGN KEY (`surveyed_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_sitesurveyphoto`
--

DROP TABLE IF EXISTS `projects_sitesurveyphoto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_sitesurveyphoto` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `slot` varchar(30) NOT NULL,
  `image` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `survey_id` bigint NOT NULL,
  `uploaded_by_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `projects_sitesurveyphoto_survey_id_slot_67842d08_uniq` (`survey_id`,`slot`),
  KEY `projects_sitesurveyp_uploaded_by_id_ff881ee0_fk_accounts_` (`uploaded_by_id`),
  CONSTRAINT `projects_sitesurveyp_survey_id_b986d0f1_fk_projects_` FOREIGN KEY (`survey_id`) REFERENCES `projects_sitesurvey` (`id`),
  CONSTRAINT `projects_sitesurveyp_uploaded_by_id_ff881ee0_fk_accounts_` FOREIGN KEY (`uploaded_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_subsidyapplication`
--

DROP TABLE IF EXISTS `projects_subsidyapplication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_subsidyapplication` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_number` varchar(100) NOT NULL,
  `application_date` date DEFAULT NULL,
  `discom` varchar(200) NOT NULL,
  `status` varchar(20) NOT NULL,
  `remarks` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `project_id` bigint NOT NULL,
  `assigned_employee_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_subcdapplic_project_id_67695f97_fk_projects_` (`project_id`),
  KEY `projects_subsidyappl_assigned_employee_id_1d72e14e_fk_workforce` (`assigned_employee_id`),
  CONSTRAINT `projects_subcdapplic_project_id_67695f97_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_subsidyappl_assigned_employee_id_1d72e14e_fk_workforce` FOREIGN KEY (`assigned_employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_subsidydocument`
--

DROP TABLE IF EXISTS `projects_subsidydocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_subsidydocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `subsidy_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_subsidydocu_subsidy_id_54fc808d_fk_projects_` (`subsidy_id`),
  CONSTRAINT `projects_subsidydocu_subsidy_id_54fc808d_fk_projects_` FOREIGN KEY (`subsidy_id`) REFERENCES `projects_subsidyapplication` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_workorder`
--

DROP TABLE IF EXISTS `projects_workorder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_workorder` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `task` varchar(200) NOT NULL,
  `category` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `assignee_id` bigint DEFAULT NULL,
  `created_by_id` bigint DEFAULT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  UNIQUE KEY `unique_task_per_project` (`project_id`,`task`),
  KEY `projects_workorder_assignee_id_469d23ca_fk_accounts_user_id` (`assignee_id`),
  KEY `projects_workorder_created_by_id_c4e48e25_fk_accounts_user_id` (`created_by_id`),
  CONSTRAINT `projects_workorder_assignee_id_469d23ca_fk_accounts_user_id` FOREIGN KEY (`assignee_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_workorder_created_by_id_c4e48e25_fk_accounts_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `accounts_user` (`id`),
  CONSTRAINT `projects_workorder_project_id_f94d85a5_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `token_blacklist_blacklistedtoken`
--

DROP TABLE IF EXISTS `token_blacklist_blacklistedtoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_blacklist_blacklistedtoken` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `blacklisted_at` datetime(6) NOT NULL,
  `token_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_id` (`token_id`),
  CONSTRAINT `token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk` FOREIGN KEY (`token_id`) REFERENCES `token_blacklist_outstandingtoken` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `token_blacklist_outstandingtoken`
--

DROP TABLE IF EXISTS `token_blacklist_outstandingtoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_blacklist_outstandingtoken` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` longtext NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `jti` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq` (`jti`),
  KEY `token_blacklist_outs_user_id_83bc629a_fk_accounts_` (`user_id`),
  CONSTRAINT `token_blacklist_outs_user_id_83bc629a_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employee`
--

DROP TABLE IF EXISTS `workforce_employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employee` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `mobile` varchar(20) NOT NULL,
  `email` varchar(254) NOT NULL,
  `department` varchar(100) NOT NULL,
  `role` varchar(100) NOT NULL,
  `joining_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `present_days` int NOT NULL,
  `absent_days` int NOT NULL,
  `leave_balance` int NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `aadhaar_number` varchar(255) NOT NULL,
  `address` longtext NOT NULL DEFAULT (_utf8mb4''),
  `daily_rate` decimal(12,2) NOT NULL,
  `opening_balance` decimal(12,2) NOT NULL,
  `skill_trade` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employeeassignment`
--

DROP TABLE IF EXISTS `workforce_employeeassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeeassignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_name` varchar(200) NOT NULL,
  `assigned_date` date NOT NULL,
  `expected_completion` date DEFAULT NULL,
  `priority` varchar(20) NOT NULL,
  `progress_percent` int NOT NULL,
  `status` varchar(20) NOT NULL,
  `notes` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `employee_id` bigint NOT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeeas_employee_id_cd07a2b6_fk_workforce` (`employee_id`),
  KEY `workforce_employeeas_project_id_b92ff6e9_fk_projects_` (`project_id`),
  CONSTRAINT `workforce_employeeas_employee_id_cd07a2b6_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`),
  CONSTRAINT `workforce_employeeas_project_id_b92ff6e9_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employeeattendance`
--

DROP TABLE IF EXISTS `workforce_employeeattendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeeattendance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  `employee_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workforce_employeeattendance_employee_id_date_9756d691_uniq` (`employee_id`,`date`),
  CONSTRAINT `workforce_employeeat_employee_id_7cae3d24_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employeedocument`
--

DROP TABLE IF EXISTS `workforce_employeedocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeedocument` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `doc_type` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `employee_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeedo_employee_id_06894013_fk_workforce` (`employee_id`),
  CONSTRAINT `workforce_employeedo_employee_id_06894013_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employeeidcounter`
--

DROP TABLE IF EXISTS `workforce_employeeidcounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeeidcounter` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workforce_employeevoucher`
--

DROP TABLE IF EXISTS `workforce_employeevoucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeevoucher` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `voucher_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(50) NOT NULL,
  `notes` longtext NOT NULL,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `employee_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workforce_employeevo_employee_id_c71a54d7_fk_workforce` (`employee_id`),
  CONSTRAINT `workforce_employeevo_employee_id_c71a54d7_fk_workforce` FOREIGN KEY (`employee_id`) REFERENCES `workforce_employee` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-17 11:27:22

SET FOREIGN_KEY_CHECKS=1;