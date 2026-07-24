-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: srv1668.hstgr.io    Database: u808821982_ecomalwa
-- ------------------------------------------------------
-- Server version	11.8.8-MariaDB-log

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
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `city` varchar(100) NOT NULL,
  `address` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_branch`
--

LOCK TABLES `accounts_branch` WRITE;
/*!40000 ALTER TABLE `accounts_branch` DISABLE KEYS */;
INSERT INTO `accounts_branch` VALUES (1,'Head Office','Indore','',1,'2026-07-18 06:48:24.924763');
/*!40000 ALTER TABLE `accounts_branch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_account`
--

DROP TABLE IF EXISTS `accounts_module_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_account`
--

LOCK TABLES `accounts_module_account` WRITE;
/*!40000 ALTER TABLE `accounts_module_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_bankaccount`
--

DROP TABLE IF EXISTS `accounts_module_bankaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_bankaccount`
--

LOCK TABLES `accounts_module_bankaccount` WRITE;
/*!40000 ALTER TABLE `accounts_module_bankaccount` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_bankaccount` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_chartofaccount`
--

DROP TABLE IF EXISTS `accounts_module_chartofaccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_chartofaccount`
--

LOCK TABLES `accounts_module_chartofaccount` WRITE;
/*!40000 ALTER TABLE `accounts_module_chartofaccount` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_chartofaccount` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_cheque`
--

DROP TABLE IF EXISTS `accounts_module_cheque`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_cheque`
--

LOCK TABLES `accounts_module_cheque` WRITE;
/*!40000 ALTER TABLE `accounts_module_cheque` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_cheque` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_gstopeningbalance`
--

DROP TABLE IF EXISTS `accounts_module_gstopeningbalance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_gstopeningbalance`
--

LOCK TABLES `accounts_module_gstopeningbalance` WRITE;
/*!40000 ALTER TABLE `accounts_module_gstopeningbalance` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_gstopeningbalance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_payment`
--

DROP TABLE IF EXISTS `accounts_module_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_payment`
--

LOCK TABLES `accounts_module_payment` WRITE;
/*!40000 ALTER TABLE `accounts_module_payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_payment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_paymentvoucher`
--

DROP TABLE IF EXISTS `accounts_module_paymentvoucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_paymentvoucher`
--

LOCK TABLES `accounts_module_paymentvoucher` WRITE;
/*!40000 ALTER TABLE `accounts_module_paymentvoucher` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_paymentvoucher` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_purchasechallan`
--

DROP TABLE IF EXISTS `accounts_module_purchasechallan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_purchasechallan`
--

LOCK TABLES `accounts_module_purchasechallan` WRITE;
/*!40000 ALTER TABLE `accounts_module_purchasechallan` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_purchasechallan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_purchasechallanline`
--

DROP TABLE IF EXISTS `accounts_module_purchasechallanline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_purchasechallanline`
--

LOCK TABLES `accounts_module_purchasechallanline` WRITE;
/*!40000 ALTER TABLE `accounts_module_purchasechallanline` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_purchasechallanline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_purchaseinvoice`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_purchaseinvoice`
--

LOCK TABLES `accounts_module_purchaseinvoice` WRITE;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoice` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_purchaseinvoiceextracharge`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceextracharge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_purchaseinvoiceextracharge`
--

LOCK TABLES `accounts_module_purchaseinvoiceextracharge` WRITE;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoiceextracharge` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoiceextracharge` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_purchaseinvoiceline`
--

DROP TABLE IF EXISTS `accounts_module_purchaseinvoiceline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_purchaseinvoiceline`
--

LOCK TABLES `accounts_module_purchaseinvoiceline` WRITE;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoiceline` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_purchaseinvoiceline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_sellchallan`
--

DROP TABLE IF EXISTS `accounts_module_sellchallan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_sellchallan`
--

LOCK TABLES `accounts_module_sellchallan` WRITE;
/*!40000 ALTER TABLE `accounts_module_sellchallan` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_sellchallan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_sellchallanline`
--

DROP TABLE IF EXISTS `accounts_module_sellchallanline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_sellchallanline`
--

LOCK TABLES `accounts_module_sellchallanline` WRITE;
/*!40000 ALTER TABLE `accounts_module_sellchallanline` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_sellchallanline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_sellinvoice`
--

DROP TABLE IF EXISTS `accounts_module_sellinvoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_sellinvoice`
--

LOCK TABLES `accounts_module_sellinvoice` WRITE;
/*!40000 ALTER TABLE `accounts_module_sellinvoice` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_sellinvoice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_sellinvoiceline`
--

DROP TABLE IF EXISTS `accounts_module_sellinvoiceline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_sellinvoiceline`
--

LOCK TABLES `accounts_module_sellinvoiceline` WRITE;
/*!40000 ALTER TABLE `accounts_module_sellinvoiceline` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_sellinvoiceline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_module_transaction`
--

DROP TABLE IF EXISTS `accounts_module_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_module_transaction`
--

LOCK TABLES `accounts_module_transaction` WRITE;
/*!40000 ALTER TABLE `accounts_module_transaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_module_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_role`
--

DROP TABLE IF EXISTS `accounts_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_role`
--

LOCK TABLES `accounts_role` WRITE;
/*!40000 ALTER TABLE `accounts_role` DISABLE KEYS */;
INSERT INTO `accounts_role` VALUES (1,'Super Admin','system','',1,'2026-07-18 06:48:23.879295'),(2,'Admin','system','',1,'2026-07-18 06:48:24.124775'),(3,'Branch Manager','system','',1,'2026-07-18 06:48:24.365289'),(4,'Team Leader','system','',1,'2026-07-18 06:48:24.580832'),(5,'Sales Executive','system','',1,'2026-07-18 06:48:24.718657'),(6,'Viewer','system','',1,'2026-07-18 06:48:24.830766'),(7,'Tele Sales Executive','system','Tele Executive portal — calls, follow-ups and updates on own assigned leads only.',1,'2026-07-18 06:48:24.955645');
/*!40000 ALTER TABLE `accounts_role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_rolepermission`
--

DROP TABLE IF EXISTS `accounts_rolepermission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_rolepermission`
--

LOCK TABLES `accounts_rolepermission` WRITE;
/*!40000 ALTER TABLE `accounts_rolepermission` DISABLE KEYS */;
INSERT INTO `accounts_rolepermission` VALUES (1,'Dashboard',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.892010',1),(2,'Leads',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.907217',1),(3,'Follow-ups',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.923304',1),(4,'IVRS Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.938059',1),(5,'Approvals',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.952552',1),(6,'Project Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.967428',1),(7,'Workforce',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.982798',1),(8,'Liaisoning & Commissioning',0,0,0,0,0,0,0,1,'2026-07-18 06:48:23.996013',1),(9,'O&M',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.009384',1),(10,'Accounts',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.023165',1),(11,'Inventory',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.038291',1),(12,'Daily Tasks',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.052754',1),(13,'AMC & Warranty',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.065836',1),(14,'Reports',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.079580',1),(15,'User Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.093525',1),(16,'Settings',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.107956',1),(17,'Dashboard',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.139476',2),(18,'Leads',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.152958',2),(19,'Follow-ups',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.167012',2),(20,'IVRS Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.180195',2),(21,'Approvals',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.192441',2),(22,'Project Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.205816',2),(23,'Workforce',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.221781',2),(24,'Liaisoning & Commissioning',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.236373',2),(25,'O&M',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.249195',2),(26,'Accounts',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.261352',2),(27,'Inventory',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.274338',2),(28,'Daily Tasks',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.287258',2),(29,'AMC & Warranty',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.301877',2),(30,'Reports',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.316231',2),(31,'User Management',0,0,0,0,0,0,0,0,'2026-07-18 06:48:24.332746',2),(32,'Settings',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.347896',2),(33,'Dashboard',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.378761',3),(34,'Leads',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.393277',3),(35,'Follow-ups',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.406031',3),(36,'IVRS Management',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.420807',3),(37,'Approvals',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.436192',3),(38,'Project Management',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.449751',3),(39,'Workforce',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.465218',3),(40,'Liaisoning & Commissioning',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.479115',3),(41,'O&M',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.491421',3),(42,'Accounts',1,0,0,0,1,0,0,0,'2026-07-18 06:48:24.505872',3),(43,'Inventory',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.524124',3),(44,'Daily Tasks',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.537978',3),(45,'AMC & Warranty',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.552968',3),(46,'Reports',1,0,0,0,1,0,0,0,'2026-07-18 06:48:24.566239',3),(47,'Dashboard',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.594078',4),(48,'Leads',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.606861',4),(49,'Follow-ups',0,0,0,0,0,0,0,1,'2026-07-18 06:48:24.621774',4),(50,'Approvals',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.636702',4),(51,'Project Management',1,0,1,0,0,0,0,0,'2026-07-18 06:48:24.649360',4),(52,'Inventory',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.663827',4),(53,'Daily Tasks',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.678186',4),(54,'AMC & Warranty',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.691894',4),(55,'Reports',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.705399',4),(56,'Dashboard',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.732579',5),(57,'Leads',1,1,1,0,0,0,0,0,'2026-07-18 06:48:24.745712',5),(58,'Follow-ups',1,1,1,1,0,0,0,0,'2026-07-18 06:48:24.760554',5),(59,'Inventory',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.773890',5),(60,'Daily Tasks',1,1,0,0,0,0,0,0,'2026-07-18 06:48:24.788230',5),(61,'AMC & Warranty',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.802106',5),(62,'Reports',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.815354',5),(63,'Dashboard',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.843771',6),(64,'Leads',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.858716',6),(65,'Follow-ups',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.872284',6),(66,'Project Management',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.884920',6),(67,'Accounts',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.898095',6),(68,'Reports',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.912048',6),(69,'Dashboard',1,0,0,0,0,0,0,0,'2026-07-18 06:48:24.969962',7),(70,'Leads',1,1,1,1,0,0,0,0,'2026-07-18 06:48:24.983464',7),(71,'Follow-ups',1,1,1,1,0,0,0,0,'2026-07-18 06:48:24.996052',7),(72,'Reports',1,0,0,0,0,0,0,0,'2026-07-18 06:48:25.010414',7);
/*!40000 ALTER TABLE `accounts_rolepermission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_user`
--

DROP TABLE IF EXISTS `accounts_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_user`
--

LOCK TABLES `accounts_user` WRITE;
/*!40000 ALTER TABLE `accounts_user` DISABLE KEYS */;
INSERT INTO `accounts_user` VALUES (1,'pbkdf2_sha256$600000$LWUNBrz9kA4AjO0x5J06am$glNGSBgG6v66cpioFTDbdrGZww1uecIrgAbQnDhjNiE=',NULL,1,'Ecomalwa@poer.in','Super Admin',NULL,1,1,'2026-07-18 06:49:37.806041','2026-07-18 06:49:37.806100',NULL,1),(2,'pbkdf2_sha256$600000$cD9pABUj1J70Ba7nAzfNXO$tR5GHe7mE+LmV0PHiUDDFHjqgiIpj7K1fyrUg6hhWDw=',NULL,0,'ridwan786@gmail.com','Ridvan Hussain','9893313715',1,0,'2026-07-18 06:58:04.525473','2026-07-18 06:58:04.525505',1,7),(3,'pbkdf2_sha256$600000$C3KT2ag0q0gnxEVBkKB4C1$2Lousi7wbO1jkR0yC51ezTAW4qGGYGqmSl7c31Wg9DE=',NULL,0,'sales1@poer.in','Sales Executive 1','9876500001',1,0,'2026-07-18 07:56:39.781038','2026-07-18 07:56:39.781074',1,5),(4,'pbkdf2_sha256$600000$9Tscf9jKjsGtMA2cXDSwxq$Dh2otYqoizVgoEquy4MVTlAnGiVM/VWGmkIp2B6Yr24=',NULL,0,'sales2@poer.in','Sales Executive 2','9876500002',1,0,'2026-07-18 07:56:39.915210','2026-07-18 07:56:39.915239',1,5),(5,'pbkdf2_sha256$600000$5osTEvISWRT65v1CbLBs4w$Q1RQWy3XmxF7z0ZqHNI2RfBFNPcpoRWkw8CsYue5Scc=',NULL,0,'shoaibm@lwa.in','Shoaib Multani','8223000824',1,0,'2026-07-18 09:26:16.987240','2026-07-18 09:26:16.987270',1,3);
/*!40000 ALTER TABLE `accounts_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_user_groups`
--

DROP TABLE IF EXISTS `accounts_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_user_groups`
--

LOCK TABLES `accounts_user_groups` WRITE;
/*!40000 ALTER TABLE `accounts_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_user_user_permissions`
--

DROP TABLE IF EXISTS `accounts_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_user_user_permissions`
--

LOCK TABLES `accounts_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `accounts_user_user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcclaim`
--

DROP TABLE IF EXISTS `amc_amcclaim`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcclaim`
--

LOCK TABLES `amc_amcclaim` WRITE;
/*!40000 ALTER TABLE `amc_amcclaim` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcclaim` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amccontract`
--

DROP TABLE IF EXISTS `amc_amccontract`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amccontract`
--

LOCK TABLES `amc_amccontract` WRITE;
/*!40000 ALTER TABLE `amc_amccontract` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amccontract` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcdocument`
--

DROP TABLE IF EXISTS `amc_amcdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcdocument`
--

LOCK TABLES `amc_amcdocument` WRITE;
/*!40000 ALTER TABLE `amc_amcdocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcdocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcrenewal`
--

DROP TABLE IF EXISTS `amc_amcrenewal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcrenewal`
--

LOCK TABLES `amc_amcrenewal` WRITE;
/*!40000 ALTER TABLE `amc_amcrenewal` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcrenewal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcservicerequest`
--

DROP TABLE IF EXISTS `amc_amcservicerequest`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcservicerequest`
--

LOCK TABLES `amc_amcservicerequest` WRITE;
/*!40000 ALTER TABLE `amc_amcservicerequest` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcservicerequest` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcvisit`
--

DROP TABLE IF EXISTS `amc_amcvisit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcvisit`
--

LOCK TABLES `amc_amcvisit` WRITE;
/*!40000 ALTER TABLE `amc_amcvisit` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcvisit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `amc_amcwarranty`
--

DROP TABLE IF EXISTS `amc_amcwarranty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `amc_amcwarranty`
--

LOCK TABLES `amc_amcwarranty` WRITE;
/*!40000 ALTER TABLE `amc_amcwarranty` DISABLE KEYS */;
/*!40000 ALTER TABLE `amc_amcwarranty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add log entry',1,'add_logentry'),(2,'Can change log entry',1,'change_logentry'),(3,'Can delete log entry',1,'delete_logentry'),(4,'Can view log entry',1,'view_logentry'),(5,'Can add permission',2,'add_permission'),(6,'Can change permission',2,'change_permission'),(7,'Can delete permission',2,'delete_permission'),(8,'Can view permission',2,'view_permission'),(9,'Can add group',3,'add_group'),(10,'Can change group',3,'change_group'),(11,'Can delete group',3,'delete_group'),(12,'Can view group',3,'view_group'),(13,'Can add content type',4,'add_contenttype'),(14,'Can change content type',4,'change_contenttype'),(15,'Can delete content type',4,'delete_contenttype'),(16,'Can view content type',4,'view_contenttype'),(17,'Can add session',5,'add_session'),(18,'Can change session',5,'change_session'),(19,'Can delete session',5,'delete_session'),(20,'Can view session',5,'view_session'),(21,'Can add Blacklisted Token',6,'add_blacklistedtoken'),(22,'Can change Blacklisted Token',6,'change_blacklistedtoken'),(23,'Can delete Blacklisted Token',6,'delete_blacklistedtoken'),(24,'Can view Blacklisted Token',6,'view_blacklistedtoken'),(25,'Can add Outstanding Token',7,'add_outstandingtoken'),(26,'Can change Outstanding Token',7,'change_outstandingtoken'),(27,'Can delete Outstanding Token',7,'delete_outstandingtoken'),(28,'Can view Outstanding Token',7,'view_outstandingtoken'),(29,'Can add branch',8,'add_branch'),(30,'Can change branch',8,'change_branch'),(31,'Can delete branch',8,'delete_branch'),(32,'Can view branch',8,'view_branch'),(33,'Can add role',9,'add_role'),(34,'Can change role',9,'change_role'),(35,'Can delete role',9,'delete_role'),(36,'Can view role',9,'view_role'),(37,'Can add user',10,'add_user'),(38,'Can change user',10,'change_user'),(39,'Can delete user',10,'delete_user'),(40,'Can view user',10,'view_user'),(41,'Can add role permission',11,'add_rolepermission'),(42,'Can change role permission',11,'change_rolepermission'),(43,'Can delete role permission',11,'delete_rolepermission'),(44,'Can view role permission',11,'view_rolepermission'),(45,'Can add lead',12,'add_lead'),(46,'Can change lead',12,'change_lead'),(47,'Can delete lead',12,'delete_lead'),(48,'Can view lead',12,'view_lead'),(49,'Can add quotation',13,'add_quotation'),(50,'Can change quotation',13,'change_quotation'),(51,'Can delete quotation',13,'delete_quotation'),(52,'Can view quotation',13,'view_quotation'),(53,'Can add quotation item',14,'add_quotationitem'),(54,'Can change quotation item',14,'change_quotationitem'),(55,'Can delete quotation item',14,'delete_quotationitem'),(56,'Can view quotation item',14,'view_quotationitem'),(57,'Can add follow up',15,'add_followup'),(58,'Can change follow up',15,'change_followup'),(59,'Can delete follow up',15,'delete_followup'),(60,'Can view follow up',15,'view_followup'),(61,'Can add admin approval',16,'add_adminapproval'),(62,'Can change admin approval',16,'change_adminapproval'),(63,'Can delete admin approval',16,'delete_adminapproval'),(64,'Can view admin approval',16,'view_adminapproval'),(65,'Can add lead site survey',17,'add_leadsitesurvey'),(66,'Can change lead site survey',17,'change_leadsitesurvey'),(67,'Can delete lead site survey',17,'delete_leadsitesurvey'),(68,'Can view lead site survey',17,'view_leadsitesurvey'),(69,'Can add lead survey photo',18,'add_leadsurveyphoto'),(70,'Can change lead survey photo',18,'change_leadsurveyphoto'),(71,'Can delete lead survey photo',18,'delete_leadsurveyphoto'),(72,'Can view lead survey photo',18,'view_leadsurveyphoto'),(73,'Can add lead sequence counter',19,'add_leadsequencecounter'),(74,'Can change lead sequence counter',19,'change_leadsequencecounter'),(75,'Can delete lead sequence counter',19,'delete_leadsequencecounter'),(76,'Can view lead sequence counter',19,'view_leadsequencecounter'),(77,'Can add project',20,'add_project'),(78,'Can change project',20,'change_project'),(79,'Can delete project',20,'delete_project'),(80,'Can view project',20,'view_project'),(81,'Can add work order',21,'add_workorder'),(82,'Can change work order',21,'change_workorder'),(83,'Can delete work order',21,'delete_workorder'),(84,'Can view work order',21,'view_workorder'),(85,'Can add project note',22,'add_projectnote'),(86,'Can change project note',22,'change_projectnote'),(87,'Can delete project note',22,'delete_projectnote'),(88,'Can view project note',22,'view_projectnote'),(89,'Can add project expense',23,'add_projectexpense'),(90,'Can change project expense',23,'change_projectexpense'),(91,'Can delete project expense',23,'delete_projectexpense'),(92,'Can view project expense',23,'view_projectexpense'),(93,'Can add project document',24,'add_projectdocument'),(94,'Can change project document',24,'change_projectdocument'),(95,'Can delete project document',24,'delete_projectdocument'),(96,'Can view project document',24,'view_projectdocument'),(97,'Can add project activity',25,'add_projectactivity'),(98,'Can change project activity',25,'change_projectactivity'),(99,'Can delete project activity',25,'delete_projectactivity'),(100,'Can view project activity',25,'view_projectactivity'),(101,'Can add installation material',26,'add_installationmaterial'),(102,'Can change installation material',26,'change_installationmaterial'),(103,'Can delete installation material',26,'delete_installationmaterial'),(104,'Can view installation material',26,'view_installationmaterial'),(105,'Can add project checklist item',27,'add_projectchecklistitem'),(106,'Can change project checklist item',27,'change_projectchecklistitem'),(107,'Can delete project checklist item',27,'delete_projectchecklistitem'),(108,'Can view project checklist item',27,'view_projectchecklistitem'),(109,'Can add project milestone',28,'add_projectmilestone'),(110,'Can change project milestone',28,'change_projectmilestone'),(111,'Can delete project milestone',28,'delete_projectmilestone'),(112,'Can view project milestone',28,'view_projectmilestone'),(113,'Can add project system config',29,'add_projectsystemconfig'),(114,'Can change project system config',29,'change_projectsystemconfig'),(115,'Can delete project system config',29,'delete_projectsystemconfig'),(116,'Can view project system config',29,'view_projectsystemconfig'),(117,'Can add project team member',30,'add_projectteammember'),(118,'Can change project team member',30,'change_projectteammember'),(119,'Can delete project team member',30,'delete_projectteammember'),(120,'Can view project team member',30,'view_projectteammember'),(121,'Can add site survey',31,'add_sitesurvey'),(122,'Can change site survey',31,'change_sitesurvey'),(123,'Can delete site survey',31,'delete_sitesurvey'),(124,'Can view site survey',31,'view_sitesurvey'),(125,'Can add project payment',32,'add_projectpayment'),(126,'Can change project payment',32,'change_projectpayment'),(127,'Can delete project payment',32,'delete_projectpayment'),(128,'Can view project payment',32,'view_projectpayment'),(129,'Can add material plan',33,'add_materialplan'),(130,'Can change material plan',33,'change_materialplan'),(131,'Can delete material plan',33,'delete_materialplan'),(132,'Can view material plan',33,'view_materialplan'),(133,'Can add subsidy application',34,'add_subsidyapplication'),(134,'Can change subsidy application',34,'change_subsidyapplication'),(135,'Can delete subsidy application',34,'delete_subsidyapplication'),(136,'Can view subsidy application',34,'view_subsidyapplication'),(137,'Can add subsidy document',35,'add_subsidydocument'),(138,'Can change subsidy document',35,'change_subsidydocument'),(139,'Can delete subsidy document',35,'delete_subsidydocument'),(140,'Can view subsidy document',35,'view_subsidydocument'),(141,'Can add project expense document',36,'add_projectexpensedocument'),(142,'Can change project expense document',36,'change_projectexpensedocument'),(143,'Can delete project expense document',36,'delete_projectexpensedocument'),(144,'Can view project expense document',36,'view_projectexpensedocument'),(145,'Can add project approval',37,'add_projectapproval'),(146,'Can change project approval',37,'change_projectapproval'),(147,'Can delete project approval',37,'delete_projectapproval'),(148,'Can view project approval',37,'view_projectapproval'),(149,'Can add project approval document',38,'add_projectapprovaldocument'),(150,'Can change project approval document',38,'change_projectapprovaldocument'),(151,'Can delete project approval document',38,'delete_projectapprovaldocument'),(152,'Can view project approval document',38,'view_projectapprovaldocument'),(153,'Can add site survey photo',39,'add_sitesurveyphoto'),(154,'Can change site survey photo',39,'change_sitesurveyphoto'),(155,'Can delete site survey photo',39,'delete_sitesurveyphoto'),(156,'Can view site survey photo',39,'view_sitesurveyphoto'),(157,'Can add sequence counter',40,'add_sequencecounter'),(158,'Can change sequence counter',40,'change_sequencecounter'),(159,'Can delete sequence counter',40,'delete_sequencecounter'),(160,'Can view sequence counter',40,'view_sequencecounter'),(161,'Can add inventory item',41,'add_inventoryitem'),(162,'Can change inventory item',41,'change_inventoryitem'),(163,'Can delete inventory item',41,'delete_inventoryitem'),(164,'Can view inventory item',41,'view_inventoryitem'),(165,'Can add warehouse',42,'add_warehouse'),(166,'Can change warehouse',42,'change_warehouse'),(167,'Can delete warehouse',42,'delete_warehouse'),(168,'Can view warehouse',42,'view_warehouse'),(169,'Can add stock movement',43,'add_stockmovement'),(170,'Can change stock movement',43,'change_stockmovement'),(171,'Can delete stock movement',43,'delete_stockmovement'),(172,'Can view stock movement',43,'view_stockmovement'),(173,'Can add inventory category',44,'add_inventorycategory'),(174,'Can change inventory category',44,'change_inventorycategory'),(175,'Can delete inventory category',44,'delete_inventorycategory'),(176,'Can view inventory category',44,'view_inventorycategory'),(177,'Can add chart of account',45,'add_chartofaccount'),(178,'Can change chart of account',45,'change_chartofaccount'),(179,'Can delete chart of account',45,'delete_chartofaccount'),(180,'Can view chart of account',45,'view_chartofaccount'),(181,'Can add transaction',46,'add_transaction'),(182,'Can change transaction',46,'change_transaction'),(183,'Can delete transaction',46,'delete_transaction'),(184,'Can view transaction',46,'view_transaction'),(185,'Can add account',47,'add_account'),(186,'Can change account',47,'change_account'),(187,'Can delete account',47,'delete_account'),(188,'Can view account',47,'view_account'),(189,'Can add bank account',48,'add_bankaccount'),(190,'Can change bank account',48,'change_bankaccount'),(191,'Can delete bank account',48,'delete_bankaccount'),(192,'Can view bank account',48,'view_bankaccount'),(193,'Can add cheque',49,'add_cheque'),(194,'Can change cheque',49,'change_cheque'),(195,'Can delete cheque',49,'delete_cheque'),(196,'Can view cheque',49,'view_cheque'),(197,'Can add payment',50,'add_payment'),(198,'Can change payment',50,'change_payment'),(199,'Can delete payment',50,'delete_payment'),(200,'Can view payment',50,'view_payment'),(201,'Can add gst opening balance',51,'add_gstopeningbalance'),(202,'Can change gst opening balance',51,'change_gstopeningbalance'),(203,'Can delete gst opening balance',51,'delete_gstopeningbalance'),(204,'Can view gst opening balance',51,'view_gstopeningbalance'),(205,'Can add purchase challan',52,'add_purchasechallan'),(206,'Can change purchase challan',52,'change_purchasechallan'),(207,'Can delete purchase challan',52,'delete_purchasechallan'),(208,'Can view purchase challan',52,'view_purchasechallan'),(209,'Can add purchase invoice',53,'add_purchaseinvoice'),(210,'Can change purchase invoice',53,'change_purchaseinvoice'),(211,'Can delete purchase invoice',53,'delete_purchaseinvoice'),(212,'Can view purchase invoice',53,'view_purchaseinvoice'),(213,'Can add sell challan',54,'add_sellchallan'),(214,'Can change sell challan',54,'change_sellchallan'),(215,'Can delete sell challan',54,'delete_sellchallan'),(216,'Can view sell challan',54,'view_sellchallan'),(217,'Can add sell invoice',55,'add_sellinvoice'),(218,'Can change sell invoice',55,'change_sellinvoice'),(219,'Can delete sell invoice',55,'delete_sellinvoice'),(220,'Can view sell invoice',55,'view_sellinvoice'),(221,'Can add sell invoice line',56,'add_sellinvoiceline'),(222,'Can change sell invoice line',56,'change_sellinvoiceline'),(223,'Can delete sell invoice line',56,'delete_sellinvoiceline'),(224,'Can view sell invoice line',56,'view_sellinvoiceline'),(225,'Can add sell challan line',57,'add_sellchallanline'),(226,'Can change sell challan line',57,'change_sellchallanline'),(227,'Can delete sell challan line',57,'delete_sellchallanline'),(228,'Can view sell challan line',57,'view_sellchallanline'),(229,'Can add purchase invoice line',58,'add_purchaseinvoiceline'),(230,'Can change purchase invoice line',58,'change_purchaseinvoiceline'),(231,'Can delete purchase invoice line',58,'delete_purchaseinvoiceline'),(232,'Can view purchase invoice line',58,'view_purchaseinvoiceline'),(233,'Can add purchase invoice extra charge',59,'add_purchaseinvoiceextracharge'),(234,'Can change purchase invoice extra charge',59,'change_purchaseinvoiceextracharge'),(235,'Can delete purchase invoice extra charge',59,'delete_purchaseinvoiceextracharge'),(236,'Can view purchase invoice extra charge',59,'view_purchaseinvoiceextracharge'),(237,'Can add purchase challan line',60,'add_purchasechallanline'),(238,'Can change purchase challan line',60,'change_purchasechallanline'),(239,'Can delete purchase challan line',60,'delete_purchasechallanline'),(240,'Can view purchase challan line',60,'view_purchasechallanline'),(241,'Can add payment voucher',61,'add_paymentvoucher'),(242,'Can change payment voucher',61,'change_paymentvoucher'),(243,'Can delete payment voucher',61,'delete_paymentvoucher'),(244,'Can view payment voucher',61,'view_paymentvoucher'),(245,'Can add employee',62,'add_employee'),(246,'Can change employee',62,'change_employee'),(247,'Can delete employee',62,'delete_employee'),(248,'Can view employee',62,'view_employee'),(249,'Can add employee document',63,'add_employeedocument'),(250,'Can change employee document',63,'change_employeedocument'),(251,'Can delete employee document',63,'delete_employeedocument'),(252,'Can view employee document',63,'view_employeedocument'),(253,'Can add employee assignment',64,'add_employeeassignment'),(254,'Can change employee assignment',64,'change_employeeassignment'),(255,'Can delete employee assignment',64,'delete_employeeassignment'),(256,'Can view employee assignment',64,'view_employeeassignment'),(257,'Can add employee voucher',65,'add_employeevoucher'),(258,'Can change employee voucher',65,'change_employeevoucher'),(259,'Can delete employee voucher',65,'delete_employeevoucher'),(260,'Can view employee voucher',65,'view_employeevoucher'),(261,'Can add employee attendance',66,'add_employeeattendance'),(262,'Can change employee attendance',66,'change_employeeattendance'),(263,'Can delete employee attendance',66,'delete_employeeattendance'),(264,'Can view employee attendance',66,'view_employeeattendance'),(265,'Can add employee id counter',67,'add_employeeidcounter'),(266,'Can change employee id counter',67,'change_employeeidcounter'),(267,'Can delete employee id counter',67,'delete_employeeidcounter'),(268,'Can view employee id counter',67,'view_employeeidcounter'),(269,'Can add liaison inspection',68,'add_liaisoninspection'),(270,'Can change liaison inspection',68,'change_liaisoninspection'),(271,'Can delete liaison inspection',68,'delete_liaisoninspection'),(272,'Can view liaison inspection',68,'view_liaisoninspection'),(273,'Can add liaison document',69,'add_liaisondocument'),(274,'Can change liaison document',69,'change_liaisondocument'),(275,'Can delete liaison document',69,'delete_liaisondocument'),(276,'Can view liaison document',69,'view_liaisondocument'),(277,'Can add liaison compliance',70,'add_liaisoncompliance'),(278,'Can change liaison compliance',70,'change_liaisoncompliance'),(279,'Can delete liaison compliance',70,'delete_liaisoncompliance'),(280,'Can view liaison compliance',70,'view_liaisoncompliance'),(281,'Can add liaison commissioning',71,'add_liaisoncommissioning'),(282,'Can change liaison commissioning',71,'change_liaisoncommissioning'),(283,'Can delete liaison commissioning',71,'delete_liaisoncommissioning'),(284,'Can view liaison commissioning',71,'view_liaisoncommissioning'),(285,'Can add liaison approval',72,'add_liaisonapproval'),(286,'Can change liaison approval',72,'change_liaisonapproval'),(287,'Can delete liaison approval',72,'delete_liaisonapproval'),(288,'Can view liaison approval',72,'view_liaisonapproval'),(289,'Can add liaison application',73,'add_liaisonapplication'),(290,'Can change liaison application',73,'change_liaisonapplication'),(291,'Can delete liaison application',73,'delete_liaisonapplication'),(292,'Can view liaison application',73,'view_liaisonapplication'),(293,'Can add om asset',74,'add_omasset'),(294,'Can change om asset',74,'change_omasset'),(295,'Can delete om asset',74,'delete_omasset'),(296,'Can view om asset',74,'view_omasset'),(297,'Can add om spare part',75,'add_omsparepart'),(298,'Can change om spare part',75,'change_omsparepart'),(299,'Can delete om spare part',75,'delete_omsparepart'),(300,'Can view om spare part',75,'view_omsparepart'),(301,'Can add om site visit',76,'add_omsitevisit'),(302,'Can change om site visit',76,'change_omsitevisit'),(303,'Can delete om site visit',76,'delete_omsitevisit'),(304,'Can view om site visit',76,'view_omsitevisit'),(305,'Can add om report',77,'add_omreport'),(306,'Can change om report',77,'change_omreport'),(307,'Can delete om report',77,'delete_omreport'),(308,'Can view om report',77,'view_omreport'),(309,'Can add om maintenance task',78,'add_ommaintenancetask'),(310,'Can change om maintenance task',78,'change_ommaintenancetask'),(311,'Can delete om maintenance task',78,'delete_ommaintenancetask'),(312,'Can view om maintenance task',78,'view_ommaintenancetask'),(313,'Can add om document',79,'add_omdocument'),(314,'Can change om document',79,'change_omdocument'),(315,'Can delete om document',79,'delete_omdocument'),(316,'Can view om document',79,'view_omdocument'),(317,'Can add om breakdown ticket',80,'add_ombreakdownticket'),(318,'Can change om breakdown ticket',80,'change_ombreakdownticket'),(319,'Can delete om breakdown ticket',80,'delete_ombreakdownticket'),(320,'Can view om breakdown ticket',80,'view_ombreakdownticket'),(321,'Can add amc contract',81,'add_amccontract'),(322,'Can change amc contract',81,'change_amccontract'),(323,'Can delete amc contract',81,'delete_amccontract'),(324,'Can view amc contract',81,'view_amccontract'),(325,'Can add amc service request',82,'add_amcservicerequest'),(326,'Can change amc service request',82,'change_amcservicerequest'),(327,'Can delete amc service request',82,'delete_amcservicerequest'),(328,'Can view amc service request',82,'view_amcservicerequest'),(329,'Can add amc warranty',83,'add_amcwarranty'),(330,'Can change amc warranty',83,'change_amcwarranty'),(331,'Can delete amc warranty',83,'delete_amcwarranty'),(332,'Can view amc warranty',83,'view_amcwarranty'),(333,'Can add amc visit',84,'add_amcvisit'),(334,'Can change amc visit',84,'change_amcvisit'),(335,'Can delete amc visit',84,'delete_amcvisit'),(336,'Can view amc visit',84,'view_amcvisit'),(337,'Can add amc renewal',85,'add_amcrenewal'),(338,'Can change amc renewal',85,'change_amcrenewal'),(339,'Can delete amc renewal',85,'delete_amcrenewal'),(340,'Can view amc renewal',85,'view_amcrenewal'),(341,'Can add amc document',86,'add_amcdocument'),(342,'Can change amc document',86,'change_amcdocument'),(343,'Can delete amc document',86,'delete_amcdocument'),(344,'Can view amc document',86,'view_amcdocument'),(345,'Can add amc claim',87,'add_amcclaim'),(346,'Can change amc claim',87,'change_amcclaim'),(347,'Can delete amc claim',87,'delete_amcclaim'),(348,'Can view amc claim',87,'view_amcclaim'),(349,'Can add Company Profile',88,'add_companyprofile'),(350,'Can change Company Profile',88,'change_companyprofile'),(351,'Can delete Company Profile',88,'delete_companyprofile'),(352,'Can view Company Profile',88,'view_companyprofile'),(353,'Can add app setting',89,'add_appsetting'),(354,'Can change app setting',89,'change_appsetting'),(355,'Can delete app setting',89,'delete_appsetting'),(356,'Can view app setting',89,'view_appsetting'),(357,'Can add payment mode',90,'add_paymentmode'),(358,'Can change payment mode',90,'change_paymentmode'),(359,'Can delete payment mode',90,'delete_paymentmode'),(360,'Can view payment mode',90,'view_paymentmode'),(361,'Can add master record',91,'add_masterrecord'),(362,'Can change master record',91,'change_masterrecord'),(363,'Can delete master record',91,'delete_masterrecord'),(364,'Can view master record',91,'view_masterrecord'),(365,'Can add document number series',92,'add_documentnumberseries'),(366,'Can change document number series',92,'change_documentnumberseries'),(367,'Can delete document number series',92,'delete_documentnumberseries'),(368,'Can view document number series',92,'view_documentnumberseries'),(369,'Can add financial year',93,'add_financialyear'),(370,'Can change financial year',93,'change_financialyear'),(371,'Can delete financial year',93,'delete_financialyear'),(372,'Can view financial year',93,'view_financialyear'),(373,'Can add ip access rule',94,'add_ipaccessrule'),(374,'Can change ip access rule',94,'change_ipaccessrule'),(375,'Can delete ip access rule',94,'delete_ipaccessrule'),(376,'Can view ip access rule',94,'view_ipaccessrule'),(377,'Can add ip blocked attempt',95,'add_ipblockedattempt'),(378,'Can change ip blocked attempt',95,'change_ipblockedattempt'),(379,'Can delete ip blocked attempt',95,'delete_ipblockedattempt'),(380,'Can view ip blocked attempt',95,'view_ipblockedattempt'),(381,'Can add system backup log',96,'add_systembackuplog'),(382,'Can change system backup log',96,'change_systembackuplog'),(383,'Can delete system backup log',96,'delete_systembackuplog'),(384,'Can view system backup log',96,'view_systembackuplog'),(385,'Can add user activity log',97,'add_useractivitylog'),(386,'Can change user activity log',97,'change_useractivitylog'),(387,'Can delete user activity log',97,'delete_useractivitylog'),(388,'Can view user activity log',97,'view_useractivitylog'),(389,'Can add daily task',98,'add_dailytask'),(390,'Can change daily task',98,'change_dailytask'),(391,'Can delete daily task',98,'delete_dailytask'),(392,'Can view daily task',98,'view_dailytask');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_appsetting`
--

DROP TABLE IF EXISTS `crm_settings_appsetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_appsetting` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `category` varchar(50) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`value`)),
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_settings_appsetting_category_key_95122d25_uniq` (`category`,`key`),
  KEY `crm_settings_appsetting_category_863f6191` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_appsetting`
--

LOCK TABLES `crm_settings_appsetting` WRITE;
/*!40000 ALTER TABLE `crm_settings_appsetting` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_appsetting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_companyprofile`
--

DROP TABLE IF EXISTS `crm_settings_companyprofile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_companyprofile` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_companyprofile`
--

LOCK TABLES `crm_settings_companyprofile` WRITE;
/*!40000 ALTER TABLE `crm_settings_companyprofile` DISABLE KEYS */;
INSERT INTO `crm_settings_companyprofile` VALUES (1,'{\"companyName\": \"Malwa Solar Energy Pvt. Ltd.\", \"shortName\": \"Malwa Solar\", \"companyType\": \"Private Limited\", \"gstNumber\": \"03AAGCM1234A1Z5\", \"panNumber\": \"AAGCM1234A\", \"tanNumber\": \"PTLM12345G\", \"cin\": \"U40106PB2021PTC045678\", \"phone\": \"+91 98765 43210\", \"secondaryPhone\": \"+91 98765 43211\", \"email\": \"info@malwasolar.com\", \"altEmail\": \"support@malwasolar.com\", \"website\": \"https://www.malwasolar.com\", \"incorporationDate\": \"01/04/2021\", \"startDate\": \"01/05/2021\", \"companySize\": \"51-100 Employees\", \"industryType\": \"Solar Energy\", \"currency\": \"INR (Rs)\", \"timezone\": \"(GMT +05:30) Asia/Kolkata\", \"address1\": \"123, Industrial Area, Phase 1\", \"address2\": \"Near Transport Nagar\", \"city\": \"Indore\", \"state\": \"Madhya Pradesh\", \"pinCode\": \"452001\", \"country\": \"India\", \"bankName\": \"HDFC Bank\", \"accountNumber\": \"50200012345678\", \"ifsc\": \"HDFC0005020\", \"branch\": \"Ludhiana - Industrial Area\", \"contactName\": \"Amanpreet Singh\", \"designation\": \"Managing Director\", \"contactPhone\": \"+91 98765 43210\", \"contactEmail\": \"amanpreet@malwasolar.com\", \"notes\": \"Company notes...\"}','2026-07-18 09:42:29.978201');
/*!40000 ALTER TABLE `crm_settings_companyprofile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_documentnumberseries`
--

DROP TABLE IF EXISTS `crm_settings_documentnumberseries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_documentnumberseries`
--

LOCK TABLES `crm_settings_documentnumberseries` WRITE;
/*!40000 ALTER TABLE `crm_settings_documentnumberseries` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_documentnumberseries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_financialyear`
--

DROP TABLE IF EXISTS `crm_settings_financialyear`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_financialyear` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
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
-- Dumping data for table `crm_settings_financialyear`
--

LOCK TABLES `crm_settings_financialyear` WRITE;
/*!40000 ALTER TABLE `crm_settings_financialyear` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_financialyear` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_ipaccessrule`
--

DROP TABLE IF EXISTS `crm_settings_ipaccessrule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_ipaccessrule` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
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
-- Dumping data for table `crm_settings_ipaccessrule`
--

LOCK TABLES `crm_settings_ipaccessrule` WRITE;
/*!40000 ALTER TABLE `crm_settings_ipaccessrule` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_ipaccessrule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_ipblockedattempt`
--

DROP TABLE IF EXISTS `crm_settings_ipblockedattempt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_settings_ipblockedattempt` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ip_address` char(39) NOT NULL,
  `username` varchar(200) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `attempted_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_ipblockedattempt`
--

LOCK TABLES `crm_settings_ipblockedattempt` WRITE;
/*!40000 ALTER TABLE `crm_settings_ipblockedattempt` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_ipblockedattempt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_masterrecord`
--

DROP TABLE IF EXISTS `crm_settings_masterrecord`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_masterrecord`
--

LOCK TABLES `crm_settings_masterrecord` WRITE;
/*!40000 ALTER TABLE `crm_settings_masterrecord` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_masterrecord` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_paymentmode`
--

DROP TABLE IF EXISTS `crm_settings_paymentmode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_paymentmode`
--

LOCK TABLES `crm_settings_paymentmode` WRITE;
/*!40000 ALTER TABLE `crm_settings_paymentmode` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_paymentmode` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_systembackuplog`
--

DROP TABLE IF EXISTS `crm_settings_systembackuplog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_systembackuplog`
--

LOCK TABLES `crm_settings_systembackuplog` WRITE;
/*!40000 ALTER TABLE `crm_settings_systembackuplog` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_settings_systembackuplog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_settings_useractivitylog`
--

DROP TABLE IF EXISTS `crm_settings_useractivitylog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_settings_useractivitylog`
--

LOCK TABLES `crm_settings_useractivitylog` WRITE;
/*!40000 ALTER TABLE `crm_settings_useractivitylog` DISABLE KEYS */;
INSERT INTO `crm_settings_useractivitylog` VALUES (1,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 06:50:05.805086',NULL),(2,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 06:51:04.583917',NULL),(3,'','Login Failed','Authentication','Failed login attempt','200.97.171.119','Failed','2026-07-18 06:52:04.910354',NULL),(4,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 06:53:07.719044',NULL),(5,'','Login Failed','Authentication','Failed login attempt for ridwan786@gmail.com','106.214.3.3','Failed','2026-07-18 06:56:30.852319',NULL),(6,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 06:56:38.829594',NULL),(7,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 06:58:53.497577',NULL),(8,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 07:00:07.786306',NULL),(9,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:05:45.276298',NULL),(10,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:05:45.501164',NULL),(11,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 07:07:26.354997',NULL),(12,'','Login','Authentication','User logged in successfully','106.214.3.3','Success','2026-07-18 07:07:32.968389',NULL),(13,'','Login','Authentication','User logged in successfully','152.59.233.36','Success','2026-07-18 07:29:58.509257',NULL),(14,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:43:29.555434',NULL),(15,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:57:00.859677',NULL),(16,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:57:01.164265',NULL),(17,'','Login','Authentication','User logged in successfully','127.0.0.1','Success','2026-07-18 07:57:01.421671',NULL),(18,'','Login','Authentication','User logged in successfully','152.59.233.36','Success','2026-07-18 08:02:57.569132',NULL),(19,'','Login','Authentication','User logged in successfully','152.59.233.36','Success','2026-07-18 08:03:19.598814',NULL),(20,'','Login','Authentication','User logged in successfully','106.214.3.174','Success','2026-07-18 09:26:48.847790',NULL),(21,'','Login','Authentication','User logged in successfully','106.214.3.174','Success','2026-07-18 09:27:12.345435',NULL),(22,'','Login','Authentication','User logged in successfully','106.214.3.174','Success','2026-07-18 09:41:46.363257',NULL),(23,'Super Admin','Update','Settings','Company profile updated','106.214.3.174','Success','2026-07-18 09:42:27.732532',1),(24,'Super Admin','Update','Settings','Company profile updated','106.214.3.174','Success','2026-07-18 09:42:29.579116',1),(25,'Super Admin','Update','Settings','Company profile updated','106.214.3.174','Success','2026-07-18 09:42:29.763863',1),(26,'Super Admin','Update','Settings','Company profile updated','106.214.3.174','Success','2026-07-18 09:42:29.981493',1);
/*!40000 ALTER TABLE `crm_settings_useractivitylog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_tasks_dailytask`
--

DROP TABLE IF EXISTS `daily_tasks_dailytask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_tasks_dailytask`
--

LOCK TABLES `daily_tasks_dailytask` WRITE;
/*!40000 ALTER TABLE `daily_tasks_dailytask` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_tasks_dailytask` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_admin_log`
--

LOCK TABLES `django_admin_log` WRITE;
/*!40000 ALTER TABLE `django_admin_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `django_admin_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (8,'accounts','branch'),(9,'accounts','role'),(11,'accounts','rolepermission'),(10,'accounts','user'),(47,'accounts_module','account'),(48,'accounts_module','bankaccount'),(45,'accounts_module','chartofaccount'),(49,'accounts_module','cheque'),(51,'accounts_module','gstopeningbalance'),(50,'accounts_module','payment'),(61,'accounts_module','paymentvoucher'),(52,'accounts_module','purchasechallan'),(60,'accounts_module','purchasechallanline'),(53,'accounts_module','purchaseinvoice'),(59,'accounts_module','purchaseinvoiceextracharge'),(58,'accounts_module','purchaseinvoiceline'),(54,'accounts_module','sellchallan'),(57,'accounts_module','sellchallanline'),(55,'accounts_module','sellinvoice'),(56,'accounts_module','sellinvoiceline'),(46,'accounts_module','transaction'),(1,'admin','logentry'),(87,'amc','amcclaim'),(81,'amc','amccontract'),(86,'amc','amcdocument'),(85,'amc','amcrenewal'),(82,'amc','amcservicerequest'),(84,'amc','amcvisit'),(83,'amc','amcwarranty'),(3,'auth','group'),(2,'auth','permission'),(4,'contenttypes','contenttype'),(89,'crm_settings','appsetting'),(88,'crm_settings','companyprofile'),(92,'crm_settings','documentnumberseries'),(93,'crm_settings','financialyear'),(94,'crm_settings','ipaccessrule'),(95,'crm_settings','ipblockedattempt'),(91,'crm_settings','masterrecord'),(90,'crm_settings','paymentmode'),(96,'crm_settings','systembackuplog'),(97,'crm_settings','useractivitylog'),(98,'daily_tasks','dailytask'),(44,'inventory','inventorycategory'),(41,'inventory','inventoryitem'),(43,'inventory','stockmovement'),(42,'inventory','warehouse'),(16,'leads','adminapproval'),(15,'leads','followup'),(12,'leads','lead'),(19,'leads','leadsequencecounter'),(17,'leads','leadsitesurvey'),(18,'leads','leadsurveyphoto'),(13,'leads','quotation'),(14,'leads','quotationitem'),(73,'liaisoning','liaisonapplication'),(72,'liaisoning','liaisonapproval'),(71,'liaisoning','liaisoncommissioning'),(70,'liaisoning','liaisoncompliance'),(69,'liaisoning','liaisondocument'),(68,'liaisoning','liaisoninspection'),(74,'om','omasset'),(80,'om','ombreakdownticket'),(79,'om','omdocument'),(78,'om','ommaintenancetask'),(77,'om','omreport'),(76,'om','omsitevisit'),(75,'om','omsparepart'),(26,'projects','installationmaterial'),(33,'projects','materialplan'),(20,'projects','project'),(25,'projects','projectactivity'),(37,'projects','projectapproval'),(38,'projects','projectapprovaldocument'),(27,'projects','projectchecklistitem'),(24,'projects','projectdocument'),(23,'projects','projectexpense'),(36,'projects','projectexpensedocument'),(28,'projects','projectmilestone'),(22,'projects','projectnote'),(32,'projects','projectpayment'),(29,'projects','projectsystemconfig'),(30,'projects','projectteammember'),(40,'projects','sequencecounter'),(31,'projects','sitesurvey'),(39,'projects','sitesurveyphoto'),(34,'projects','subsidyapplication'),(35,'projects','subsidydocument'),(21,'projects','workorder'),(5,'sessions','session'),(6,'token_blacklist','blacklistedtoken'),(7,'token_blacklist','outstandingtoken'),(62,'workforce','employee'),(64,'workforce','employeeassignment'),(66,'workforce','employeeattendance'),(63,'workforce','employeedocument'),(67,'workforce','employeeidcounter'),(65,'workforce','employeevoucher');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'contenttypes','0001_initial','2026-07-18 06:48:23.028129'),(2,'contenttypes','0002_remove_content_type_name','2026-07-18 06:48:23.063644'),(3,'auth','0001_initial','2026-07-18 06:48:23.141897'),(4,'auth','0002_alter_permission_name_max_length','2026-07-18 06:48:23.159672'),(5,'auth','0003_alter_user_email_max_length','2026-07-18 06:48:23.167837'),(6,'auth','0004_alter_user_username_opts','2026-07-18 06:48:23.175265'),(7,'auth','0005_alter_user_last_login_null','2026-07-18 06:48:23.184255'),(8,'auth','0006_require_contenttypes_0002','2026-07-18 06:48:23.190835'),(9,'auth','0007_alter_validators_add_error_messages','2026-07-18 06:48:23.199966'),(10,'auth','0008_alter_user_username_max_length','2026-07-18 06:48:23.208167'),(11,'auth','0009_alter_user_last_name_max_length','2026-07-18 06:48:23.216067'),(12,'auth','0010_alter_group_name_max_length','2026-07-18 06:48:23.236643'),(13,'auth','0011_update_proxy_permissions','2026-07-18 06:48:23.255633'),(14,'auth','0012_alter_user_first_name_max_length','2026-07-18 06:48:23.265573'),(15,'accounts','0001_initial','2026-07-18 06:48:23.392451'),(16,'accounts','0002_rolepermission_alter_user_options_and_more','2026-07-18 06:48:23.687563'),(17,'accounts','0003_alter_rolepermission_module','2026-07-18 06:48:23.697302'),(18,'accounts','0004_alter_rolepermission_module','2026-07-18 06:48:23.705767'),(19,'accounts','0005_seed_workforce_permission','2026-07-18 06:48:23.764928'),(20,'accounts','0006_alter_user_mobile','2026-07-18 06:48:23.822843'),(21,'accounts','0007_alter_rolepermission_module_daily_tasks','2026-07-18 06:48:23.832579'),(22,'accounts','0008_seed_daily_tasks_permission','2026-07-18 06:48:23.857804'),(23,'accounts','0009_seed_baseline_roles_branch','2026-07-18 06:48:24.938240'),(24,'accounts','0010_seed_tele_sales_executive_role','2026-07-18 06:48:25.036998'),(25,'accounts','0011_grant_followup_delete_sales_tele','2026-07-18 06:48:25.081885'),(26,'leads','0001_initial','2026-07-18 06:48:25.337893'),(27,'projects','0001_initial','2026-07-18 06:48:25.687343'),(28,'inventory','0001_initial','2026-07-18 06:48:25.816399'),(29,'inventory','0002_alter_stockmovement_created_by','2026-07-18 06:48:25.837037'),(30,'projects','0002_installationmaterial_projectchecklistitem_and_more','2026-07-18 06:48:26.578296'),(31,'projects','0003_add_project_payment','2026-07-18 06:48:26.633497'),(32,'projects','0004_project_project_image','2026-07-18 06:48:26.659415'),(33,'projects','0005_add_access_level_to_team_member','2026-07-18 06:48:26.689424'),(34,'projects','0006_project_meter_number_site_size','2026-07-18 06:48:26.768718'),(35,'projects','0007_project_consumer_number_project_discom_name_and_more','2026-07-18 06:48:27.155798'),(36,'projects','0008_add_material_plan','2026-07-18 06:48:27.192161'),(37,'projects','0009_team_member_status','2026-07-18 06:48:27.221600'),(38,'workforce','0001_initial','2026-07-18 06:48:27.305441'),(39,'workforce','0002_employee_attendance_ledger','2026-07-18 06:48:27.461048'),(40,'workforce','0003_alter_employeedocument_file','2026-07-18 06:48:27.471989'),(41,'workforce','0004_alter_employeeattendance_employee_and_more','2026-07-18 06:48:27.507147'),(42,'workforce','0005_employeeidcounter_alter_employee_department','2026-07-18 06:48:27.531572'),(43,'inventory','0003_alter_stockmovement_options_and_more','2026-07-18 06:48:27.699582'),(44,'projects','0010_add_sub_cd_models','2026-07-18 06:48:27.861253'),(45,'projects','0011_rename_subcd_to_subsidy','2026-07-18 06:48:30.247687'),(46,'projects','0012_add_expense_fields','2026-07-18 06:48:30.400531'),(47,'projects','0013_alter_projectexpense_paid_by_and_more','2026-07-18 06:48:30.482474'),(48,'projects','0014_add_project_approval','2026-07-18 06:48:30.634285'),(49,'projects','0015_sitesurvey_latitude_sitesurvey_longitude','2026-07-18 06:48:30.692555'),(50,'projects','0016_sitesurvey_ac_cable_length_approx_and_more','2026-07-18 06:48:32.680921'),(51,'projects','0017_migrate_draft_survey_status','2026-07-18 06:48:32.718826'),(52,'projects','0018_alter_sitesurveyphoto_image','2026-07-18 06:48:32.742864'),(53,'accounts_module','0001_initial','2026-07-18 06:48:32.840839'),(54,'accounts_module','0002_alter_transaction_options_and_more','2026-07-18 06:48:32.898600'),(55,'accounts_module','0003_account_bankaccount_cheque_payment_and_more','2026-07-18 06:48:36.033909'),(56,'accounts_module','0004_account_opening_balance_bankaccount_opening_balance_and_more','2026-07-18 06:48:36.380162'),(57,'accounts_module','0005_accounts_documents','2026-07-18 06:48:37.286812'),(58,'accounts_module','0006_alter_paymentvoucher_voucher_no_and_more','2026-07-18 06:48:37.422840'),(59,'accounts_module','0007_purchasechallanline_stock_movement','2026-07-18 06:48:37.545505'),(60,'admin','0001_initial','2026-07-18 06:48:37.610378'),(61,'admin','0002_logentry_remove_auto_add','2026-07-18 06:48:37.738837'),(62,'admin','0003_logentry_add_action_flag_choices','2026-07-18 06:48:37.761374'),(63,'amc','0001_initial','2026-07-18 06:48:38.218836'),(64,'amc','0002_alter_amcdocument_file','2026-07-18 06:48:38.250092'),(65,'crm_settings','0001_initial','2026-07-18 06:48:38.431304'),(66,'crm_settings','0002_financialyear_ipaccessrule_and_more','2026-07-18 06:48:38.573049'),(67,'workforce','0006_bug_fixes','2026-07-18 06:48:38.591581'),(68,'daily_tasks','0001_initial','2026-07-18 06:48:38.644951'),(69,'daily_tasks','0002_solar_categories_assigned_to','2026-07-18 06:48:38.797042'),(70,'inventory','0004_inventorycategory_inventoryitem_item_code_and_more','2026-07-18 06:48:39.243227'),(71,'leads','0002_lead_alternate_number_lead_email_lead_latitude_and_more','2026-07-18 06:48:39.594597'),(72,'leads','0003_alter_lead_ivrs_number','2026-07-18 06:48:39.620879'),(73,'leads','0004_adminapproval_request_snapshot','2026-07-18 06:48:39.782568'),(74,'leads','0005_alter_quotationitem_options_and_more','2026-07-18 06:48:39.963297'),(75,'leads','0006_quotation_ac_cable_quotation_acdb_quotation_address_and_more','2026-07-18 06:48:42.816431'),(76,'leads','0007_quotation_aadhaar_number_quotation_cable_tray_and_more','2026-07-18 06:48:43.405785'),(77,'leads','0008_quotation_coating_details_and_more','2026-07-18 06:48:43.493158'),(78,'leads','0009_leadsitesurvey_leadsurveyphoto','2026-07-18 06:48:43.621637'),(79,'leads','0010_alter_leadsitesurvey_status','2026-07-18 06:48:43.650188'),(80,'leads','0011_alter_leadsurveyphoto_image','2026-07-18 06:48:43.691755'),(81,'leads','0012_alter_leadsurveyphoto_image','2026-07-18 06:48:43.731225'),(82,'leads','0013_leadsequencecounter_adminapproval_created_lead','2026-07-18 06:48:43.803882'),(83,'leads','0014_followup_reminder_followup_status_after','2026-07-18 06:48:43.979676'),(84,'leads','0015_unassign_self_assigned_leads','2026-07-18 06:48:44.027505'),(85,'leads','0016_followup_outcome','2026-07-18 06:48:44.069923'),(86,'liaisoning','0001_initial','2026-07-18 06:48:44.673951'),(87,'liaisoning','0002_alter_liaisondocument_file','2026-07-18 06:48:44.707653'),(88,'om','0001_initial','2026-07-18 06:48:45.255824'),(89,'om','0002_alter_omdocument_file_alter_omreport_file','2026-07-18 06:48:45.323752'),(90,'om','0003_omsparepart_linked_inventory_item','2026-07-18 06:48:45.375507'),(91,'projects','0019_alter_project_project_image_and_more','2026-07-18 06:48:45.558640'),(92,'projects','0020_sequencecounter_alter_projectexpense_project_and_more','2026-07-18 06:48:45.881234'),(93,'sessions','0001_initial','2026-07-18 06:48:45.908112'),(94,'token_blacklist','0001_initial','2026-07-18 06:48:46.018573'),(95,'token_blacklist','0002_outstandingtoken_jti_hex','2026-07-18 06:48:46.061608'),(96,'token_blacklist','0003_auto_20171017_2007','2026-07-18 06:48:46.125668'),(97,'token_blacklist','0004_auto_20171017_2013','2026-07-18 06:48:46.180391'),(98,'token_blacklist','0005_remove_outstandingtoken_jti','2026-07-18 06:48:46.479219'),(99,'token_blacklist','0006_auto_20171017_2113','2026-07-18 06:48:46.523930'),(100,'token_blacklist','0007_auto_20171017_2214','2026-07-18 06:48:47.842967'),(101,'token_blacklist','0008_migrate_to_bigautofield','2026-07-18 06:48:49.096948'),(102,'token_blacklist','0010_fix_migrate_to_bigautofield','2026-07-18 06:48:49.140862'),(103,'token_blacklist','0011_linearizes_history','2026-07-18 06:48:49.147823'),(104,'token_blacklist','0012_alter_outstandingtoken_user','2026-07-18 06:48:49.293721'),(105,'token_blacklist','0013_alter_blacklistedtoken_options_and_more','2026-07-18 06:48:49.336843');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_inventorycategory`
--

DROP TABLE IF EXISTS `inventory_inventorycategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_inventorycategory` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_inventorycategory`
--

LOCK TABLES `inventory_inventorycategory` WRITE;
/*!40000 ALTER TABLE `inventory_inventorycategory` DISABLE KEYS */;
INSERT INTO `inventory_inventorycategory` VALUES (1,'Solar Panel','PV modules and panels',1,'2026-07-18 06:48:39.111802'),(2,'Inverter','Grid-tie and hybrid inverters',1,'2026-07-18 06:48:39.125910'),(3,'Battery','Storage batteries',1,'2026-07-18 06:48:39.139411'),(4,'Structure','Mounting structures and rails',1,'2026-07-18 06:48:39.153084'),(5,'Cable & Wire','DC/AC cables and wiring',1,'2026-07-18 06:48:39.166895'),(6,'ACDB/DCDB','Distribution boxes',1,'2026-07-18 06:48:39.179976'),(7,'Steel','Angle, channel, sheet, pipe etc.',1,'2026-07-18 06:48:39.194034'),(8,'Hardware','Nuts, bolts, fasteners, consumables',1,'2026-07-18 06:48:39.208916'),(9,'Other','Miscellaneous items',1,'2026-07-18 06:48:39.224455');
/*!40000 ALTER TABLE `inventory_inventorycategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_inventoryitem`
--

DROP TABLE IF EXISTS `inventory_inventoryitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_inventoryitem`
--

LOCK TABLES `inventory_inventoryitem` WRITE;
/*!40000 ALTER TABLE `inventory_inventoryitem` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_inventoryitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_stockmovement`
--

DROP TABLE IF EXISTS `inventory_stockmovement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_stockmovement`
--

LOCK TABLES `inventory_stockmovement` WRITE;
/*!40000 ALTER TABLE `inventory_stockmovement` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_stockmovement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_warehouse`
--

DROP TABLE IF EXISTS `inventory_warehouse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_warehouse` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `location` varchar(200) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_warehouse`
--

LOCK TABLES `inventory_warehouse` WRITE;
/*!40000 ALTER TABLE `inventory_warehouse` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_warehouse` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_adminapproval`
--

DROP TABLE IF EXISTS `leads_adminapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_adminapproval`
--

LOCK TABLES `leads_adminapproval` WRITE;
/*!40000 ALTER TABLE `leads_adminapproval` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_adminapproval` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_followup`
--

DROP TABLE IF EXISTS `leads_followup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_followup`
--

LOCK TABLES `leads_followup` WRITE;
/*!40000 ALTER TABLE `leads_followup` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_followup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_lead`
--

DROP TABLE IF EXISTS `leads_lead`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_lead`
--

LOCK TABLES `leads_lead` WRITE;
/*!40000 ALTER TABLE `leads_lead` DISABLE KEYS */;
INSERT INTO `leads_lead` VALUES (1,'Test Lead 1','9876543210','12345','','','','','','','New','',NULL,'2026-07-18 06:56:46.520661','2026-07-18 06:56:46.520678',NULL,1,'','','','','','','',''),(2,'Shahid Multani','8224000822','IVRS2C51E383','5kW Rooftop Solar','5','122/1 nayta mundla','Indore','Madhya Pradesh','Website','Won','',NULL,'2026-07-18 06:59:31.101497','2026-07-18 08:03:50.516744',3,2,'','sheddysmithlab@gmail.com','','','','On-Grid','',''),(3,'Pool Lead Unassigned','9000010001','IVRSE2629D73','3kW Rooftop','','','','','Manual','New','',NULL,'2026-07-18 07:56:39.932494','2026-07-18 07:57:01.481591',4,1,'','','','','','On-Grid','',''),(4,'SE1 Won Customer','9000010002','IVRS7D05A846','5kW Hybrid','','','','','Manual','Won','',NULL,'2026-07-18 07:56:39.940086','2026-07-18 07:56:39.940101',3,1,'','','','','','Hybrid','',''),(5,'SE2 Won Customer','9000010003','IVRSC81F5D43','10kW On-Grid','','','','','Manual','Won','',NULL,'2026-07-18 07:56:39.980178','2026-07-18 09:40:34.998117',4,1,'','','','','','On-Grid','',''),(6,'SE1 Follow-up Lead','9000010004','IVRSDA601F33','2kW Off-Grid','','','','','Manual','Follow-up','',NULL,'2026-07-18 07:56:40.017485','2026-07-18 07:56:40.017501',3,1,'','','','','','Off-Grid','','');
/*!40000 ALTER TABLE `leads_lead` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_leadsequencecounter`
--

DROP TABLE IF EXISTS `leads_leadsequencecounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads_leadsequencecounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_leadsequencecounter`
--

LOCK TABLES `leads_leadsequencecounter` WRITE;
/*!40000 ALTER TABLE `leads_leadsequencecounter` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_leadsequencecounter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_leadsitesurvey`
--

DROP TABLE IF EXISTS `leads_leadsitesurvey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_leadsitesurvey`
--

LOCK TABLES `leads_leadsitesurvey` WRITE;
/*!40000 ALTER TABLE `leads_leadsitesurvey` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_leadsitesurvey` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_leadsurveyphoto`
--

DROP TABLE IF EXISTS `leads_leadsurveyphoto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_leadsurveyphoto`
--

LOCK TABLES `leads_leadsurveyphoto` WRITE;
/*!40000 ALTER TABLE `leads_leadsurveyphoto` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_leadsurveyphoto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_quotation`
--

DROP TABLE IF EXISTS `leads_quotation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
-- Dumping data for table `leads_quotation`
--

LOCK TABLES `leads_quotation` WRITE;
/*!40000 ALTER TABLE `leads_quotation` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_quotation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads_quotationitem`
--

DROP TABLE IF EXISTS `leads_quotationitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads_quotationitem`
--

LOCK TABLES `leads_quotationitem` WRITE;
/*!40000 ALTER TABLE `leads_quotationitem` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads_quotationitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisonapplication`
--

DROP TABLE IF EXISTS `liaisoning_liaisonapplication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisonapplication`
--

LOCK TABLES `liaisoning_liaisonapplication` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisonapplication` DISABLE KEYS */;
/*!40000 ALTER TABLE `liaisoning_liaisonapplication` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisonapproval`
--

DROP TABLE IF EXISTS `liaisoning_liaisonapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisonapproval`
--

LOCK TABLES `liaisoning_liaisonapproval` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisonapproval` DISABLE KEYS */;
INSERT INTO `liaisoning_liaisonapproval` VALUES (1,'DISCOM Approval','Pending','2026-06-30','nothing','Every thing is done',NULL,'','2026-07-18 08:12:56.015886','2026-07-18 08:12:56.015903',NULL,3,1,3);
/*!40000 ALTER TABLE `liaisoning_liaisonapproval` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisoncommissioning`
--

DROP TABLE IF EXISTS `liaisoning_liaisoncommissioning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisoncommissioning`
--

LOCK TABLES `liaisoning_liaisoncommissioning` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisoncommissioning` DISABLE KEYS */;
/*!40000 ALTER TABLE `liaisoning_liaisoncommissioning` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisoncompliance`
--

DROP TABLE IF EXISTS `liaisoning_liaisoncompliance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisoncompliance`
--

LOCK TABLES `liaisoning_liaisoncompliance` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisoncompliance` DISABLE KEYS */;
/*!40000 ALTER TABLE `liaisoning_liaisoncompliance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisondocument`
--

DROP TABLE IF EXISTS `liaisoning_liaisondocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisondocument`
--

LOCK TABLES `liaisoning_liaisondocument` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisondocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `liaisoning_liaisondocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `liaisoning_liaisoninspection`
--

DROP TABLE IF EXISTS `liaisoning_liaisoninspection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `liaisoning_liaisoninspection`
--

LOCK TABLES `liaisoning_liaisoninspection` WRITE;
/*!40000 ALTER TABLE `liaisoning_liaisoninspection` DISABLE KEYS */;
/*!40000 ALTER TABLE `liaisoning_liaisoninspection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_omasset`
--

DROP TABLE IF EXISTS `om_omasset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_omasset`
--

LOCK TABLES `om_omasset` WRITE;
/*!40000 ALTER TABLE `om_omasset` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_omasset` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_ombreakdownticket`
--

DROP TABLE IF EXISTS `om_ombreakdownticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_ombreakdownticket`
--

LOCK TABLES `om_ombreakdownticket` WRITE;
/*!40000 ALTER TABLE `om_ombreakdownticket` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_ombreakdownticket` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_omdocument`
--

DROP TABLE IF EXISTS `om_omdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_omdocument`
--

LOCK TABLES `om_omdocument` WRITE;
/*!40000 ALTER TABLE `om_omdocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_omdocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_ommaintenancetask`
--

DROP TABLE IF EXISTS `om_ommaintenancetask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_ommaintenancetask`
--

LOCK TABLES `om_ommaintenancetask` WRITE;
/*!40000 ALTER TABLE `om_ommaintenancetask` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_ommaintenancetask` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_omreport`
--

DROP TABLE IF EXISTS `om_omreport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_omreport`
--

LOCK TABLES `om_omreport` WRITE;
/*!40000 ALTER TABLE `om_omreport` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_omreport` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_omsitevisit`
--

DROP TABLE IF EXISTS `om_omsitevisit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_omsitevisit`
--

LOCK TABLES `om_omsitevisit` WRITE;
/*!40000 ALTER TABLE `om_omsitevisit` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_omsitevisit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `om_omsparepart`
--

DROP TABLE IF EXISTS `om_omsparepart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `om_omsparepart`
--

LOCK TABLES `om_omsparepart` WRITE;
/*!40000 ALTER TABLE `om_omsparepart` DISABLE KEYS */;
/*!40000 ALTER TABLE `om_omsparepart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_installationmaterial`
--

DROP TABLE IF EXISTS `projects_installationmaterial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_installationmaterial`
--

LOCK TABLES `projects_installationmaterial` WRITE;
/*!40000 ALTER TABLE `projects_installationmaterial` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_installationmaterial` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_materialplan`
--

DROP TABLE IF EXISTS `projects_materialplan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_materialplan`
--

LOCK TABLES `projects_materialplan` WRITE;
/*!40000 ALTER TABLE `projects_materialplan` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_materialplan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_project`
--

DROP TABLE IF EXISTS `projects_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_project`
--

LOCK TABLES `projects_project` WRITE;
/*!40000 ALTER TABLE `projects_project` DISABLE KEYS */;
INSERT INTO `projects_project` VALUES (1,'PRJ-2026-0001','5kW Rooftop Solar','Shahid Multani','','122/1 nayta mundla','Indore','Madhya Pradesh','On-Grid',5.00,'Rooftop Solar','Planning','Medium',0,NULL,NULL,NULL,NULL,'',0.00,'2026-07-18 06:59:31.143116','2026-07-18 06:59:31.143137',2,2,NULL,NULL,'','','','','','',NULL,''),(2,'PRJ-2026-0002','5kW Hybrid','SE1 Won Customer','','','','','Hybrid',0.00,'Rooftop Solar','Planning','Medium',0,NULL,NULL,NULL,NULL,'',0.00,'2026-07-18 07:56:39.973396','2026-07-18 07:56:39.973423',1,4,3,NULL,'','','','','','',NULL,''),(3,'PRJ-2026-0003','10kW On-Grid','SE2 Won Customer','','','','','On-Grid',0.00,'Rooftop Solar','On Hold','Medium',0,NULL,NULL,NULL,NULL,'',0.00,'2026-07-18 07:56:40.009561','2026-07-18 09:40:34.851548',1,5,4,NULL,'','','','','','',NULL,'');
/*!40000 ALTER TABLE `projects_project` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectactivity`
--

DROP TABLE IF EXISTS `projects_projectactivity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectactivity`
--

LOCK TABLES `projects_projectactivity` WRITE;
/*!40000 ALTER TABLE `projects_projectactivity` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectactivity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectapproval`
--

DROP TABLE IF EXISTS `projects_projectapproval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectapproval`
--

LOCK TABLES `projects_projectapproval` WRITE;
/*!40000 ALTER TABLE `projects_projectapproval` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectapproval` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectapprovaldocument`
--

DROP TABLE IF EXISTS `projects_projectapprovaldocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_projectapprovaldocument` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `file` varchar(100) NOT NULL,
  `uploaded_at` datetime(6) NOT NULL,
  `approval_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `projects_projectappr_approval_id_d20d5e23_fk_projects_` (`approval_id`),
  CONSTRAINT `projects_projectappr_approval_id_d20d5e23_fk_projects_` FOREIGN KEY (`approval_id`) REFERENCES `projects_projectapproval` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectapprovaldocument`
--

LOCK TABLES `projects_projectapprovaldocument` WRITE;
/*!40000 ALTER TABLE `projects_projectapprovaldocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectapprovaldocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectchecklistitem`
--

DROP TABLE IF EXISTS `projects_projectchecklistitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectchecklistitem`
--

LOCK TABLES `projects_projectchecklistitem` WRITE;
/*!40000 ALTER TABLE `projects_projectchecklistitem` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectchecklistitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectdocument`
--

DROP TABLE IF EXISTS `projects_projectdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectdocument`
--

LOCK TABLES `projects_projectdocument` WRITE;
/*!40000 ALTER TABLE `projects_projectdocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectdocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectexpense`
--

DROP TABLE IF EXISTS `projects_projectexpense`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectexpense`
--

LOCK TABLES `projects_projectexpense` WRITE;
/*!40000 ALTER TABLE `projects_projectexpense` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectexpense` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectexpensedocument`
--

DROP TABLE IF EXISTS `projects_projectexpensedocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectexpensedocument`
--

LOCK TABLES `projects_projectexpensedocument` WRITE;
/*!40000 ALTER TABLE `projects_projectexpensedocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectexpensedocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectmilestone`
--

DROP TABLE IF EXISTS `projects_projectmilestone`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectmilestone`
--

LOCK TABLES `projects_projectmilestone` WRITE;
/*!40000 ALTER TABLE `projects_projectmilestone` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectmilestone` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectnote`
--

DROP TABLE IF EXISTS `projects_projectnote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectnote`
--

LOCK TABLES `projects_projectnote` WRITE;
/*!40000 ALTER TABLE `projects_projectnote` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectnote` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectpayment`
--

DROP TABLE IF EXISTS `projects_projectpayment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectpayment`
--

LOCK TABLES `projects_projectpayment` WRITE;
/*!40000 ALTER TABLE `projects_projectpayment` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectpayment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectsystemconfig`
--

DROP TABLE IF EXISTS `projects_projectsystemconfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectsystemconfig`
--

LOCK TABLES `projects_projectsystemconfig` WRITE;
/*!40000 ALTER TABLE `projects_projectsystemconfig` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectsystemconfig` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_projectteammember`
--

DROP TABLE IF EXISTS `projects_projectteammember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_projectteammember`
--

LOCK TABLES `projects_projectteammember` WRITE;
/*!40000 ALTER TABLE `projects_projectteammember` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_projectteammember` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_sequencecounter`
--

DROP TABLE IF EXISTS `projects_sequencecounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_sequencecounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_sequencecounter`
--

LOCK TABLES `projects_sequencecounter` WRITE;
/*!40000 ALTER TABLE `projects_sequencecounter` DISABLE KEYS */;
INSERT INTO `projects_sequencecounter` VALUES (1,'PRJ-2026-',3);
/*!40000 ALTER TABLE `projects_sequencecounter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_sitesurvey`
--

DROP TABLE IF EXISTS `projects_sitesurvey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `survey_id` (`survey_id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` (`surveyed_by_id`),
  CONSTRAINT `projects_sitesurvey_project_id_1a5f1f7d_fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`),
  CONSTRAINT `projects_sitesurvey_surveyed_by_id_6c282df4_fk_accounts_user_id` FOREIGN KEY (`surveyed_by_id`) REFERENCES `accounts_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_sitesurvey`
--

LOCK TABLES `projects_sitesurvey` WRITE;
/*!40000 ALTER TABLE `projects_sitesurvey` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_sitesurvey` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_sitesurveyphoto`
--

DROP TABLE IF EXISTS `projects_sitesurveyphoto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_sitesurveyphoto`
--

LOCK TABLES `projects_sitesurveyphoto` WRITE;
/*!40000 ALTER TABLE `projects_sitesurveyphoto` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_sitesurveyphoto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_subsidyapplication`
--

DROP TABLE IF EXISTS `projects_subsidyapplication`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_subsidyapplication`
--

LOCK TABLES `projects_subsidyapplication` WRITE;
/*!40000 ALTER TABLE `projects_subsidyapplication` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_subsidyapplication` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_subsidydocument`
--

DROP TABLE IF EXISTS `projects_subsidydocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_subsidydocument`
--

LOCK TABLES `projects_subsidydocument` WRITE;
/*!40000 ALTER TABLE `projects_subsidydocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_subsidydocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects_workorder`
--

DROP TABLE IF EXISTS `projects_workorder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects_workorder`
--

LOCK TABLES `projects_workorder` WRITE;
/*!40000 ALTER TABLE `projects_workorder` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects_workorder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_blacklist_blacklistedtoken`
--

DROP TABLE IF EXISTS `token_blacklist_blacklistedtoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_blacklist_blacklistedtoken` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `blacklisted_at` datetime(6) NOT NULL,
  `token_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_id` (`token_id`),
  CONSTRAINT `token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk` FOREIGN KEY (`token_id`) REFERENCES `token_blacklist_outstandingtoken` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_blacklist_blacklistedtoken`
--

LOCK TABLES `token_blacklist_blacklistedtoken` WRITE;
/*!40000 ALTER TABLE `token_blacklist_blacklistedtoken` DISABLE KEYS */;
/*!40000 ALTER TABLE `token_blacklist_blacklistedtoken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_blacklist_outstandingtoken`
--

DROP TABLE IF EXISTS `token_blacklist_outstandingtoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_blacklist_outstandingtoken`
--

LOCK TABLES `token_blacklist_outstandingtoken` WRITE;
/*!40000 ALTER TABLE `token_blacklist_outstandingtoken` DISABLE KEYS */;
INSERT INTO `token_blacklist_outstandingtoken` VALUES (1,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjIwNSwiaWF0IjoxNzg0MzU3NDA1LCJqdGkiOiIzNDg0ZTE0NDM3YzA0NDAxOTRkZDc2YWYzMzFjMTkzYyIsInVzZXJfaWQiOiIxIn0.H3-phtj24QZQSn-l2Ha6N8yotDwj_KmVY-XbWjM2_3c','2026-07-18 06:50:05.773793','2026-07-25 06:50:05.000000',1,'3484e14437c0440194dd76af331c193c'),(2,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjI2NCwiaWF0IjoxNzg0MzU3NDY0LCJqdGkiOiJmNGE3ZWVhYzgyYjQ0NzQ4OWNjNDc3M2NjNThkZWI2NCIsInVzZXJfaWQiOiIxIn0.VO4bVYRzT040I8d5_aFe9o6CmzJoRhIfvuFUWhXVaPg','2026-07-18 06:51:04.554966','2026-07-25 06:51:04.000000',1,'f4a7eeac82b447489cc4773cc58deb64'),(3,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjM4NywiaWF0IjoxNzg0MzU3NTg3LCJqdGkiOiJlZGQ4NjQ3ZTJhMTg0NGI0YjJkY2Q3OTJiNzcwNmRlNyIsInVzZXJfaWQiOiIxIn0.RIUnOBPiCkASPHafKtPn2RMQ_ZvYCOt8YK_C8H_QS3c','2026-07-18 06:53:07.705272','2026-07-25 06:53:07.000000',1,'edd8647e2a1844b4b2dcd792b7706de7'),(4,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjU5OCwiaWF0IjoxNzg0MzU3Nzk4LCJqdGkiOiIwNzE4NDc0NTgxZGI0YmQyOTA2MDMxYWYwOTRhYTkxOCIsInVzZXJfaWQiOiIxIn0._TkX4sV6lQerNr8JzNeXjMEJm3ejPq8ifeUvBkj2vQc','2026-07-18 06:56:38.814375','2026-07-25 06:56:38.000000',1,'0718474581db4bd2906031af094aa918'),(5,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjczMywiaWF0IjoxNzg0MzU3OTMzLCJqdGkiOiJlZTVmN2FmNjU2MDQ0YTljYmY3OWVjNzlhNWRiM2M4NyIsInVzZXJfaWQiOiIyIn0.sOdWgSbNMSuNyrvQZYgIEKITOO1c1OmzCqTT9hyt5yo','2026-07-18 06:58:53.479659','2026-07-25 06:58:53.000000',2,'ee5f7af656044a9cbf79ec79a5db3c87'),(6,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MjgwNywiaWF0IjoxNzg0MzU4MDA3LCJqdGkiOiIwYzc5ZWRlNWE3OTg0ODM1OTY5OWUxZTU3ZWI4YzViZiIsInVzZXJfaWQiOiIyIn0.sfLWzmZZH77k9xDBy728q8-H2dF92cTxb9JQJNB-SKc','2026-07-18 07:00:07.768888','2026-07-25 07:00:07.000000',2,'0c79ede5a79848359699e1e57eb8c5bf'),(7,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MzE0NSwiaWF0IjoxNzg0MzU4MzQ1LCJqdGkiOiIzN2VhZDliMzllNDY0ZjRjOWQwYzZkY2RmNGVhOTExNiIsInVzZXJfaWQiOiIxIn0.y9ucwbAhD0TE45EmJj4sHlgtjUQpwd0CwHjIwBxs_os','2026-07-18 07:05:45.259563','2026-07-25 07:05:45.000000',1,'37ead9b39e464f4c9d0c6dcdf4ea9116'),(8,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MzE0NSwiaWF0IjoxNzg0MzU4MzQ1LCJqdGkiOiI0MWM1MWJjMWFkNTU0NjFmYWU5NjA3ODExMDNiNjI2ZiIsInVzZXJfaWQiOiIyIn0.6jH0KRIr9zZCAbI9DoRkYJuAmqiOs4XbhXKrULby_8I','2026-07-18 07:05:45.481688','2026-07-25 07:05:45.000000',2,'41c51bc1ad55461fae960781103b626f'),(9,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MzI0NiwiaWF0IjoxNzg0MzU4NDQ2LCJqdGkiOiIxNDdjMzQzNjNlNzk0Y2NlOTBkZjgzOGMzYmJjYmJhNCIsInVzZXJfaWQiOiIyIn0.7lvAM3WAxX6u1Vktz6DKOXi9AX3fsTCfRZxasvbCTQ4','2026-07-18 07:07:26.336574','2026-07-25 07:07:26.000000',2,'147c34363e794cce90df838c3bbcbba4'),(10,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2MzI1MiwiaWF0IjoxNzg0MzU4NDUyLCJqdGkiOiJlY2Q1Y2I5MDg5OTY0ZDVhYmIyZGQzYWIzZTc2MDk4MyIsInVzZXJfaWQiOiIxIn0.Nnz08WztOCnriaP9bg5OPUtRL1Ge9dAd-4dijB3H3hs','2026-07-18 07:07:32.953845','2026-07-25 07:07:32.000000',1,'ecd5cb9089964d5abb2dd3ab3e760983'),(11,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NDU5OCwiaWF0IjoxNzg0MzU5Nzk4LCJqdGkiOiJjN2ViNjkzYjEwODg0ZGJmYTM4OGI2NjMxZWViNTIxMSIsInVzZXJfaWQiOiIxIn0.1IXzQFUWT1nLnW2PdkHhXlF23GGIyFgBR4vGfgc9MJU','2026-07-18 07:29:58.494472','2026-07-25 07:29:58.000000',1,'c7eb693b10884dbfa388b6631eeb5211'),(12,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NTQwOSwiaWF0IjoxNzg0MzYwNjA5LCJqdGkiOiIwYjNiNDA2MGM4MGI0ZThiYjM1MWY4NjE4NmEyNDYwMyIsInVzZXJfaWQiOiIxIn0.RalTgkTrFWhb0yfhu1ULstUFVrxfsxhL-iXe0uF-VUA','2026-07-18 07:43:29.535228','2026-07-25 07:43:29.000000',1,'0b3b4060c80b4e8bb351f86186a24603'),(13,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NjIyMCwiaWF0IjoxNzg0MzYxNDIwLCJqdGkiOiIyYjE1OWQ2MjRmM2U0MjUzOGViOTNjZTk5Y2U1ZTUzOCIsInVzZXJfaWQiOiIxIn0.60Ek5E8rIntqY5EnRgT6ZSVqUUvU34GXFlUc4TwfC2o','2026-07-18 07:57:00.831769','2026-07-25 07:57:00.000000',1,'2b159d624f3e42538eb93ce99ce5e538'),(14,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NjIyMSwiaWF0IjoxNzg0MzYxNDIxLCJqdGkiOiI4MjI1ZThiZTc3ZDc0YjM4YTZkN2M0MTI4NWI1ZDE4ZCIsInVzZXJfaWQiOiIzIn0.qU-gXZw6AIYi0z0ElRGh-1ee_fseHSgaxahzOW1WM4U','2026-07-18 07:57:01.137030','2026-07-25 07:57:01.000000',3,'8225e8be77d74b38a6d7c41285b5d18d'),(15,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NjIyMSwiaWF0IjoxNzg0MzYxNDIxLCJqdGkiOiI5NTU3M2IwZDBiMWE0MWNiYThmYWFhNTA1Yzg3OTQ2MSIsInVzZXJfaWQiOiI0In0._jj9uaNH-p72HWlfl6amLyw2ktFOSymYGzH6XmhWgic','2026-07-18 07:57:01.395608','2026-07-25 07:57:01.000000',4,'95573b0d0b1a41cba8faaa505c879461'),(16,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NjU3NywiaWF0IjoxNzg0MzYxNzc3LCJqdGkiOiJkYjc2YzllNDk4Y2U0ZTE2YTcyMzhhZjRiNmI1OTA0YyIsInVzZXJfaWQiOiIzIn0.tXObnwl6_kLUJQXNoYpRwkd6bUURlLY4Jr8O0y4CdWs','2026-07-18 08:02:57.551212','2026-07-25 08:02:57.000000',3,'db76c9e498ce4e16a7238af4b6b5904c'),(17,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk2NjU5OSwiaWF0IjoxNzg0MzYxNzk5LCJqdGkiOiJmNzFiNmVkOGVhYjE0YTQxOTY4ZWMyYzM2NWYyMDg5OSIsInVzZXJfaWQiOiIxIn0.MjHrc-FJwq8DxF8757vYoCb5EeiGo9qp3st7YphtpiY','2026-07-18 08:03:19.584937','2026-07-25 08:03:19.000000',1,'f71b6ed8eab14a41968ec2c365f20899'),(18,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk3MTYwOCwiaWF0IjoxNzg0MzY2ODA4LCJqdGkiOiI3ODMyZTI4ODg3ZGY0MDZmYjRlMmU4MThhNzA5MGNiNiIsInVzZXJfaWQiOiI1In0.6-zTzL0SRMbUL9PCr9wV_CAMTgve3b3un095Vgl79t4','2026-07-18 09:26:48.826048','2026-07-25 09:26:48.000000',5,'7832e28887df406fb4e2e818a7090cb6'),(19,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk3MTYzMiwiaWF0IjoxNzg0MzY2ODMyLCJqdGkiOiIxZGU0NDA1ZDlhMjI0ODgxYjE0OTc5MWVkNDg2MjE5ZiIsInVzZXJfaWQiOiI1In0.x7jRyrQDZ7fYrY32azo-UyMz_X_kKtxtKwF_9P6PMlU','2026-07-18 09:27:12.328615','2026-07-25 09:27:12.000000',5,'1de4405d9a224881b149791ed486219f'),(20,'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NDk3MjUwNiwiaWF0IjoxNzg0MzY3NzA2LCJqdGkiOiIxMjkyYzU5MjcwMGY0NmQ0YjFlYTU0MTZkYTkxMzhhYSIsInVzZXJfaWQiOiIxIn0.z7-UWQ7sNM85HtEpdcw_j72Urevt0yZhTLzgGgxPkdo','2026-07-18 09:41:46.347587','2026-07-25 09:41:46.000000',1,'1292c592700f46d4b1ea5416da9138aa');
/*!40000 ALTER TABLE `token_blacklist_outstandingtoken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employee`
--

DROP TABLE IF EXISTS `workforce_employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employee`
--

LOCK TABLES `workforce_employee` WRITE;
/*!40000 ALTER TABLE `workforce_employee` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employeeassignment`
--

DROP TABLE IF EXISTS `workforce_employeeassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employeeassignment`
--

LOCK TABLES `workforce_employeeassignment` WRITE;
/*!40000 ALTER TABLE `workforce_employeeassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employeeassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employeeattendance`
--

DROP TABLE IF EXISTS `workforce_employeeattendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employeeattendance`
--

LOCK TABLES `workforce_employeeattendance` WRITE;
/*!40000 ALTER TABLE `workforce_employeeattendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employeeattendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employeedocument`
--

DROP TABLE IF EXISTS `workforce_employeedocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employeedocument`
--

LOCK TABLES `workforce_employeedocument` WRITE;
/*!40000 ALTER TABLE `workforce_employeedocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employeedocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employeeidcounter`
--

DROP TABLE IF EXISTS `workforce_employeeidcounter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workforce_employeeidcounter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employeeidcounter`
--

LOCK TABLES `workforce_employeeidcounter` WRITE;
/*!40000 ALTER TABLE `workforce_employeeidcounter` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employeeidcounter` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workforce_employeevoucher`
--

DROP TABLE IF EXISTS `workforce_employeevoucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workforce_employeevoucher`
--

LOCK TABLES `workforce_employeevoucher` WRITE;
/*!40000 ALTER TABLE `workforce_employeevoucher` DISABLE KEYS */;
/*!40000 ALTER TABLE `workforce_employeevoucher` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-18 16:37:11

